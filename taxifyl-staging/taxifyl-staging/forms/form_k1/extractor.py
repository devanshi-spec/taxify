"""
Form K-1 Extractor
==================
Extracts data from Schedule K-1 (Form 1065) tax forms using AI vision models.
"""

import json
import io
import re
import base64
from typing import Optional, Union
from PIL import Image

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    pytesseract = None

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    Groq = None

from .config import K1_1065_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class FormK1Extractor:
    """Schedule K-1 (Form 1065) Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the K-1 extractor."""
        self.gemini_client = None
        self.groq_client = None
        
        # Initialize Gemini
        if GEMINI_AVAILABLE and GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                self.gemini_client = genai.GenerativeModel(GEMINI_MODEL)
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")
        
        # Initialize Groq
        if GROQ_AVAILABLE and GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=GROQ_API_KEY)
            except Exception as e:
                print(f"Failed to initialize Groq: {e}")
    
    def is_configured(self) -> bool:
        """Check if at least one extraction method is available."""
        return self.gemini_client is not None or self.groq_client is not None or TESSERACT_AVAILABLE
    
    def extract(
        self, 
        image: Union[Image.Image, bytes, str],
        model: str = "gemini-2.5-flash"
    ) -> dict:
        """
        Extract K-1 data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use - 'gemini-2.0-flash', 'gemini-2.5-flash', or 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        Returns:
            Extracted K-1 data as dictionary
        """
        # Convert image to PIL Image if needed
        if isinstance(image, str):
            img = Image.open(image)
        elif isinstance(image, bytes):
            img = Image.open(io.BytesIO(image))
        else:
            img = image
        
        # Ensure RGB mode
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Convert to bytes for API
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_data = img_buffer.getvalue()
        
        # Try extraction with selected model
        if "gemini" in model.lower() and self.gemini_client:
            try:
                return self._extract_with_gemini(img, K1_1065_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, K1_1065_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_k1_text(text)
            except Exception as e:
                print(f"OCR extraction failed: {e}")
        
        return {"error": "No extraction method available"}
    
    def _extract_with_gemini(self, img: Image.Image, prompt: str, model: str) -> dict:
        """Extract using Google Gemini API."""
        # Create the model
        model_instance = genai.GenerativeModel(model)
        
        # Generate content
        response = model_instance.generate_content([prompt, img])
        
        # Parse response
        response_text = response.text
        json_text = self._clean_json_response(response_text)
        
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return {"raw_response": response_text, "error": "Failed to parse JSON"}
    
    def _extract_with_groq(self, img_data: bytes, prompt: str, model: str) -> dict:
        """Extract using Groq API with LLaMA Vision."""
        # Encode image to base64
        base64_image = base64.b64encode(img_data).decode('utf-8')
        
        # Create message with image
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }
        ]
        
        # Call Groq API
        response = self.groq_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=4096,
            temperature=0.1
        )
        
        # Parse response
        response_text = response.choices[0].message.content
        json_text = self._clean_json_response(response_text)
        
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return {"raw_response": response_text, "error": "Failed to parse JSON"}
    
    def _clean_json_response(self, text: str) -> str:
        """Clean JSON response by removing markdown code blocks."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()
    
    def _parse_k1_text(self, text: str) -> dict:
        """Parse OCR text into K-1 JSON structure (fallback method)."""
        result = [
            {
                "forms": [
                    {
                        "form_header": {
                            "form_number": "1065 (K-1)",
                            "year": self._extract_year(text),
                            "type": "Partner's Share of Income, Deductions, Credits, etc.",
                            "text_array": [
                                f"Partnership EIN: {self._extract_ein(text, 'partnership')}",
                                f"Partnership Name: {self._extract_name(text, 'partnership')}",
                                f"Partner Name: {self._extract_name(text, 'partner')}",
                                f"Partner TIN: {self._extract_tin(text)}"
                            ]
                        },
                        "boxes": [
                            {
                                "identification_plane": [
                                    {"data": [{"code": "E", "label": "Partner's SSN or TIN", "value": self._extract_tin(text)}]},
                                    {"data": [{"code": "F", "label": "Partner's name", "value": self._extract_name(text, 'partner')}]},
                                    {"data": [{"code": "I1", "label": "Entity Type", "value": self._extract_entity_type(text)}]},
                                    {"data": [{"code": "A", "label": "Partnership's EIN", "value": self._extract_ein(text, 'partnership')}]},
                                    {"data": [{"code": "B", "label": "Partnership's name", "value": self._extract_name(text, 'partnership')}]}
                                ]
                            },
                            {
                                "federal_tax_plane": [
                                    {"data": [{"code": "1", "label": "Ordinary business income (loss)", "value": self._extract_box_value(text, ["ordinary business", "box 1"])}]},
                                    {"data": [{"code": "2", "label": "Net rental real estate income (loss)", "value": self._extract_box_value(text, ["rental real estate", "box 2"])}]},
                                    {"data": [{"code": "3", "label": "Other net rental income (loss)", "value": self._extract_box_value(text, ["other rental", "box 3"])}]},
                                    {"data": [{"code": "4c", "label": "Total guaranteed payments", "value": self._extract_box_value(text, ["guaranteed payments", "box 4"])}]},
                                    {"data": [{"code": "5", "label": "Interest income", "value": self._extract_box_value(text, ["interest income", "box 5"])}]},
                                    {"data": [{"code": "6a", "label": "Ordinary dividends", "value": self._extract_box_value(text, ["ordinary dividends", "box 6a"])}]},
                                    {"data": [{"code": "6b", "label": "Qualified dividends", "value": self._extract_box_value(text, ["qualified dividends", "box 6b"])}]},
                                    {"data": [{"code": "7", "label": "Royalties", "value": self._extract_box_value(text, ["royalties", "box 7"])}]},
                                    {"data": [{"code": "8", "label": "Net short-term capital gain (loss)", "value": self._extract_box_value(text, ["short-term capital", "box 8"])}]},
                                    {"data": [{"code": "9a", "label": "Net long-term capital gain (loss)", "value": self._extract_box_value(text, ["long-term capital", "box 9a"])}]},
                                    {"data": [{"code": "10", "label": "Net section 1231 gain (loss)", "value": self._extract_box_value(text, ["section 1231", "box 10"])}]},
                                    {"data": [{"code": "11", "label": "Other income (loss)", "value": None}]},
                                    {"data": [{"code": "12", "label": "Section 179 deduction", "value": self._extract_box_value(text, ["section 179", "box 12"])}]},
                                    {"data": [{"code": "13", "label": "Other deductions", "value": None}]},
                                    {"data": [{"code": "L_Current", "label": "Current year net income (loss)", "value": self._extract_box_value(text, ["current year", "net income"])}]}
                                ]
                            },
                            {
                                "international_tax_plane": [
                                    {"data": [{"code": "K-3_PartII_24g", "label": "Total Gross Income (International)", "value": None}]},
                                    {"data": [{"code": "K-3_PartII_55g", "label": "Net Income (Loss) (International)", "value": None}]}
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        return result
    
    def _extract_year(self, text: str) -> str:
        """Extract tax year from text."""
        match = re.search(r'20[12][0-9]', text)
        return match.group(0) if match else "2024"
    
    def _extract_tin(self, text: str) -> str:
        """Extract Partner's TIN from text."""
        # Look for SSN pattern: XXX-XX-XXXX or masked
        match = re.search(r'XXX[-\s]?XX[-\s]?\d{4}|\d{3}[-\s]?\d{2}[-\s]?\d{4}', text)
        return match.group(0) if match else ""
    
    def _extract_ein(self, text: str, party: str) -> str:
        """Extract EIN (Employer Identification Number)."""
        match = re.search(r'\d{2}[-\s]?\d{7}', text)
        return match.group(0) if match else ""
    
    def _extract_name(self, text: str, party: str) -> str:
        """Extract partner or partnership name."""
        if party == 'partner':
            match = re.search(r"partner['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        else:
            match = re.search(r"partnership['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_entity_type(self, text: str) -> str:
        """Extract entity type (Individual, Corporation, etc.)."""
        entity_types = ["INDIVIDUAL", "CORPORATION", "ESTATE", "TRUST", "PARTNERSHIP", "LLC"]
        text_upper = text.upper()
        for entity in entity_types:
            if entity in text_upper:
                return entity
        return "INDIVIDUAL"
    
    def _extract_box_value(self, text: str, patterns: list) -> float:
        """Extract a numeric value near the given patterns."""
        for pattern in patterns:
            # Look for pattern followed by a number (may include negative, parentheses)
            match = re.search(f'{pattern}[\\s:]*[\\(]?([\\$]?[-]?[\\d,]+\\.?\\d*)[\\)]?', text, re.IGNORECASE)
            if match:
                value_str = match.group(1).replace('$', '').replace(',', '').replace('(', '-').replace(')', '')
                try:
                    return float(value_str)
                except ValueError:
                    continue
        return 0.00


class MultiPageK1Processor:
    """
    Optimized processor for multi-page PDFs with K-1 forms.
    
    Uses a two-phase approach:
    1. Fast local text detection to identify K-1 pages
    2. Batch extraction via vision models for identified pages
    """
    
    def __init__(self):
        """Initialize the multi-page processor."""
        self.extractor = FormK1Extractor()
        # Primary indicator - the EXACT K-1 form header
        # Must have "Schedule K-1" AND "(Form 1065)" together on same page
        self.k1_form_header = ("Schedule K-1", "(Form 1065)")
        
        # Part I header - indicates this is the START of a K-1 form, not a continuation
        self.part_i_indicator = ("Part I", "Information About the Partnership")
        
        # Form number indicator (651xxx appears on K-1 forms)
        self.form_number_pattern = "651"
    
    def detect_k1_pages(self, pdf_bytes: bytes, max_scan_percentage: float = 85.0, 
                         max_k1_pages: int = None) -> list:
        """
        Scan PDF text layer to find pages containing K-1 Form 1065.
        
        Uses strict multi-pattern matching:
        - Must contain BOTH "Schedule K-1" AND "(Form 1065)"
        - Must contain Part I header indicating it's the START of a K-1
        - Only scans first portion of document (default 85%) to avoid template pages
        
        Args:
            pdf_bytes: PDF file content as bytes
            max_scan_percentage: Only scan first X% of pages (default 85%)
            max_k1_pages: Maximum number of K-1 pages to return (None = no limit)
            
        Returns:
            List of 1-indexed page numbers containing K-1 Form 1065
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("PyMuPDF not available for text detection")
            return []
        
        k1_pages = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            
            # Limit pages to scan (filters out template pages at end)
            max_page_to_scan = int(total_pages * max_scan_percentage / 100)
            print(f"📄 Scanning pages 1-{max_page_to_scan} of {total_pages} ({max_scan_percentage}%)")
            
            for page_num in range(max_page_to_scan):
                page = doc[page_num]
                text = page.get_text()
                
                # Check for K-1 form header: both "Schedule K-1" AND "(Form 1065)"
                has_schedule_k1 = self.k1_form_header[0] in text
                has_form_1065 = self.k1_form_header[1] in text
                has_k1_header = has_schedule_k1 and has_form_1065
                
                # Check for Part I header: "Part I" AND "Information About the Partnership"
                has_part_i = (self.part_i_indicator[0] in text and 
                             self.part_i_indicator[1] in text)
                
                # A K-1 Form 1065 START page must have BOTH the form header AND Part I
                if has_k1_header and has_part_i:
                    k1_pages.append(page_num + 1)  # 1-indexed
                    
                    # Early exit if we've found max pages
                    if max_k1_pages and len(k1_pages) >= max_k1_pages:
                        break
            
            doc.close()
            print(f"✅ Found {len(k1_pages)} K-1 pages: {k1_pages}")
            
        except Exception as e:
            print(f"Error scanning PDF: {e}")
            return []
        
        return k1_pages
    
    def extract_k1_pages_as_images(self, pdf_bytes: bytes, page_numbers: list) -> list:
        """
        Convert only specified pages to images for extraction.
        
        Memory efficient: only processes high-value K-1 pages.
        
        Args:
            pdf_bytes: PDF file content as bytes
            page_numbers: List of 1-indexed page numbers to convert
            
        Returns:
            List of (page_number, PIL.Image) tuples
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("PyMuPDF not available")
            return []
        
        images = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in page_numbers:
                if 1 <= page_num <= len(doc):
                    page = doc[page_num - 1]  # 0-indexed internally
                    # High quality rendering (2x scale)
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    images.append((page_num, img))
            
            doc.close()
            print(f"✅ Converted {len(images)} pages to images")
            
        except Exception as e:
            print(f"Error converting pages: {e}")
            return []
        
        return images
    
    def batch_extract(self, page_images: list, model: str = "gemini-2.5-flash") -> dict:
        """
        Extract K-1 data from all page images.
        
        One API call per page extracts all Part I, II, III data.
        
        Args:
            page_images: List of (page_number, PIL.Image) tuples
            model: Model to use for extraction
            
        Returns:
            Consolidated extraction results with all partners
        """
        all_partner_records = []
        document_metadata = None
        raw_results = []
        
        for page_num, img in page_images:
            print(f"🤖 Extracting data from page {page_num}...")
            
            try:
                result = self.extractor.extract(img, model)
                print(f"   📦 Raw result type: {type(result)}")
                
                # Store raw result for debugging
                raw_results.append({"page": page_num, "raw": result})
                
                # Handle different response formats
                data = None
                if isinstance(result, list) and len(result) > 0:
                    data = result[0]
                    print(f"   📦 Extracted from list, keys: {data.keys() if isinstance(data, dict) else 'not a dict'}")
                elif isinstance(result, dict):
                    # Check if it's an error response
                    if "error" in result:
                        print(f"   ⚠️ Error in extraction: {result.get('error')}")
                        continue
                    data = result
                    print(f"   📦 Dict result, keys: {data.keys()}")
                else:
                    print(f"   ⚠️ Unknown result format: {type(result)}")
                    continue
                
                if data is None:
                    continue
                
                # Extract document metadata (use first one found)
                if document_metadata is None:
                    if "document_metadata" in data:
                        document_metadata = data["document_metadata"]
                        print(f"   ✅ Found document_metadata")
                    elif "partnership_name" in data or "tax_year" in data:
                        # Handle flat structure
                        document_metadata = {
                            "form_type": data.get("form_type", "Schedule K-1 (Form 1065)"),
                            "tax_year": data.get("tax_year", "2024"),
                            "partnership_name": data.get("partnership_name", ""),
                            "partnership_ein": data.get("partnership_ein", "")
                        }
                        print(f"   ✅ Built document_metadata from flat data")
                
                # Extract partner records
                partner_records = []
                if "partner_records" in data:
                    partner_records = data["partner_records"]
                    print(f"   ✅ Found {len(partner_records)} partner_records")
                elif "part_i_partnership_plane" in data or "part_ii_partner_plane" in data or "part_iii_income_loss_plane" in data:
                    # The AI returned a single partner as the top-level object
                    # Wrap it as a partner record
                    partner_records = [data]
                    print(f"   ✅ Wrapped flat data as single partner_record")
                
                for partner in partner_records:
                    partner["page_reference"] = page_num
                    all_partner_records.append(partner)
                    
            except Exception as e:
                print(f"Error extracting page {page_num}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Default document metadata if not found
        if document_metadata is None:
            document_metadata = {
                "form_type": "Schedule K-1 (Form 1065)",
                "tax_year": "2024",
                "partnership_name": "",
                "partnership_ein": ""
            }
        
        result = [{
            "document_metadata": document_metadata,
            "partner_records": all_partner_records,
            "_debug_raw_results": raw_results  # Include for debugging
        }]
        
        print(f"✅ Extracted data for {len(all_partner_records)} partner(s)")
        return result
    
    def process_pdf(self, pdf_bytes: bytes, model: str = "gemini-2.5-flash", 
                    progress_callback=None) -> dict:
        """
        Full pipeline: detect → convert → extract → consolidate.
        
        Args:
            pdf_bytes: PDF file content as bytes
            model: Model to use for extraction
            progress_callback: Optional callback for progress updates
                              Signature: callback(step, message, progress_pct)
        
        Returns:
            Consolidated extraction results
        """
        import time
        start_time = time.time()
        
        # Step 1: Detect K-1 pages
        if progress_callback:
            progress_callback("detecting", "🔍 Scanning for K-1 pages...", 10)
        
        k1_pages = self.detect_k1_pages(pdf_bytes)
        
        if not k1_pages:
            return {"error": "No K-1 forms found in PDF", "pages_scanned": 0}
        
        if progress_callback:
            progress_callback("detected", f"📄 Found {len(k1_pages)} K-1 pages", 30)
        
        # Step 2: Convert K-1 pages to images
        if progress_callback:
            progress_callback("converting", "🖼️ Converting K-1 pages to images...", 40)
        
        page_images = self.extract_k1_pages_as_images(pdf_bytes, k1_pages)
        
        if not page_images:
            return {"error": "Failed to convert K-1 pages", "k1_pages": k1_pages}
        
        # Step 3: Extract data from each page
        if progress_callback:
            progress_callback("extracting", "🤖 Extracting K-1 data...", 60)
        
        results = self.batch_extract(page_images, model)
        
        # Add metadata
        elapsed = time.time() - start_time
        if isinstance(results, list) and len(results) > 0:
            results[0]["_processing_metadata"] = {
                "k1_pages_found": k1_pages,
                "total_partners": len(results[0].get("partner_records", [])),
                "processing_time_seconds": round(elapsed, 2)
            }
        
        if progress_callback:
            progress_callback("complete", "✅ Extraction complete!", 100)
        
        print(f"✅ Processing complete in {elapsed:.2f}s")
        return results

