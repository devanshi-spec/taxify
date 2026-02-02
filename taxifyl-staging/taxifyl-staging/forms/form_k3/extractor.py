"""
Form K-3 Extractor
==================
Extracts data from Schedule K-3 (Form 1065) tax forms using AI vision models.
Same structure as K-1 extractor with page detection and batch extraction.
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

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

import os
from dotenv import load_dotenv
load_dotenv()  # Load .env file

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GROQ_API_KEY_2 = os.environ.get("GROQ_API_KEY_2", "")

from .config import K3_1065_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class FormK3Extractor:
    """Schedule K-3 (Form 1065) Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the K-3 extractor."""
        self.gemini_client = None
        self.groq_client = None
        self.openai_client = None
        
        # Initialize Gemini
        if GEMINI_AVAILABLE and GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                self.gemini_client = genai.GenerativeModel(GEMINI_MODEL)
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")
        
        # Initialize Groq (primary and backup)
        if GROQ_AVAILABLE and GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=GROQ_API_KEY)
            except Exception as e:
                print(f"Failed to initialize Groq: {e}")
        
        # Initialize backup Groq client
        self.groq_client_backup = None
        if GROQ_AVAILABLE and GROQ_API_KEY_2:
            try:
                self.groq_client_backup = Groq(api_key=GROQ_API_KEY_2)
                print("✅ Backup Groq client initialized")
            except Exception as e:
                print(f"Failed to initialize backup Groq: {e}")
        
        # Initialize OpenAI
        if OPENAI_AVAILABLE and OPENAI_API_KEY:
            try:
                self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
            except Exception as e:
                print(f"Failed to initialize OpenAI: {e}")
    
    def is_configured(self) -> bool:
        """Check if at least one extraction method is available."""
        return self.gemini_client is not None or self.groq_client is not None or self.openai_client is not None or TESSERACT_AVAILABLE
    
    def extract(
        self, 
        image: Union[Image.Image, bytes, str],
        model: str = "gemini-2.5-flash"
    ) -> dict:
        """
        Extract K-3 data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use - 'gemini-2.0-flash', 'gemini-2.5-flash', or 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        Returns:
            Extracted K-3 data as dictionary
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
                return self._extract_with_gemini(img, K3_1065_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, K3_1065_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        if "gpt" in model.lower() and self.openai_client:
            try:
                return self._extract_with_openai(img_data, K3_1065_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"OpenAI extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_k3_text(text)
            except Exception as e:
                print(f"OCR extraction failed: {e}")
        
        return {"error": "No extraction method available"}
    
    def _extract_with_gemini(self, img: Image.Image, prompt: str, model: str) -> dict:
        """Extract using Google Gemini API."""
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content([prompt, img])
        
        response_text = response.text
        json_text = self._clean_json_response(response_text)
        
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return {"raw_response": response_text, "error": "Failed to parse JSON"}
    
    def _extract_with_groq(self, img_data: bytes, prompt: str, model: str) -> dict:
        """Extract using Groq API with LLaMA Vision. Uses backup key if rate limited."""
        base64_image = base64.b64encode(img_data).decode('utf-8')
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{base64_image}"}
                    }
                ]
            }
        ]
        
        # Try primary client first
        try:
            response = self.groq_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=0.1
            )
        except Exception as e:
            error_str = str(e)
            # If rate limit hit and backup available, try backup
            if ("429" in error_str or "rate_limit" in error_str.lower()) and self.groq_client_backup:
                print("⚠️ Primary Groq rate limited. Trying backup API key...")
                response = self.groq_client_backup.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=4096,
                    temperature=0.1
                )
            else:
                raise e
        
        response_text = response.choices[0].message.content
        json_text = self._clean_json_response(response_text)
        
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return {"raw_response": response_text, "error": "Failed to parse JSON"}
    
    def _extract_with_openai(self, img_data: bytes, prompt: str, model: str) -> dict:
        """Extract using OpenAI GPT-4 Vision API."""
        base64_image = base64.b64encode(img_data).decode('utf-8')
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{base64_image}"}
                    }
                ]
            }
        ]
        
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=4096,
            temperature=0.1
        )
        
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
    
    def _parse_k3_text(self, text: str) -> dict:
        """Parse OCR text into K-3 JSON structure (fallback method)."""
        result = [{
            "document_metadata": {
                "form_type": "Schedule K-3 (Form 1065)",
                "tax_year": self._extract_year(text),
                "partnership_name": self._extract_name(text, 'partnership'),
                "partnership_ein": self._extract_ein(text)
            },
            "partner_records": [{
                "partner_name": self._extract_name(text, 'partner'),
                "page_reference": 1,
                "part_i_other_international": [
                    {"data": [{"code": "1", "label": "Gain on personal property sale", "value": 0.00}]},
                    {"data": [{"code": "2", "label": "Foreign oil and gas taxes", "value": 0.00}]}
                ],
                "part_ii_foreign_tax_credit": [
                    {"data": [{"code": "24g", "label": "Total gross income", "value": 0.00}]},
                    {"data": [{"code": "55g", "label": "Net income (loss)", "value": 0.00}]}
                ],
                "part_iii_form_1116_1118": [
                    {"data": [{"code": "2", "label": "Foreign taxes paid", "value": 0.00}]}
                ]
            }]
        }]
        return result
    
    def _extract_year(self, text: str) -> str:
        """Extract tax year from text."""
        match = re.search(r'20[12][0-9]', text)
        return match.group(0) if match else "2024"
    
    def _extract_ein(self, text: str) -> str:
        """Extract EIN."""
        match = re.search(r'\d{2}[-\s]?\d{7}', text)
        return match.group(0) if match else ""
    
    def _extract_name(self, text: str, party: str) -> str:
        """Extract partner or partnership name."""
        if party == 'partner':
            match = re.search(r"partner['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        else:
            match = re.search(r"partnership['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""


class MultiPageK3Processor:
    """
    Optimized processor for multi-page PDFs with K-3 forms.
    
    Uses same approach as K-1:
    1. Fast local text detection to identify K-3 pages
    2. Batch extraction via vision models for identified pages
    """
    
    def __init__(self):
        """Initialize the multi-page processor."""
        self.extractor = FormK3Extractor()
        # K-3 form header patterns - must have BOTH
        self.k3_form_header = ("Schedule K-3", "(Form 1065)")
        # Part indicators for K-3 - all 13 parts
        self.part_indicators = [
            ("Part I", "Other Current Year International Information"),
            ("Part II", "Foreign Tax Credit Limitation"),
            ("Part III", "Other Information for Preparation of Form 1116"),
            ("Part IV", "Information on Partner's Section 250"),
            ("Part V", "Distributions from Foreign Corporations"),
            ("Part VI", "Information on Partner's Section 951(a)(1)"),
            ("Part VII", "Information To Complete Form 8621"),
            ("Part VIII", "Partner's Interest in Foreign Corporation Income"),
            ("Part IX", "Information To Complete Form 8991"),
            ("Part X", "Partner's Section 951(a)(1)"),
            ("Part XI", "Section 871"),
            ("Part XII", "Partner's Effectively Connected"),
            ("Part XIII", "Partner's Distributive Share")
        ]
    
    def detect_k3_page_ranges(self, pdf_bytes: bytes, max_scan_percentage: float = 100.0) -> list:
        """
        Scan PDF to find K-3 Form 1065 page RANGES.
        
        Simply looks for pages with "Schedule K-3" text and groups consecutive K-3 pages.
        
        Args:
            pdf_bytes: PDF file content as bytes
            max_scan_percentage: Scan percentage of pages (default 100%)
            
        Returns:
            List of tuples: [(start_page, end_page), ...] e.g., [(2, 12), (14, 26)]
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("PyMuPDF not available for text detection")
            return []
        
        k3_pages = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            
            max_page_to_scan = int(total_pages * max_scan_percentage / 100)
            print(f"📄 Scanning for K-3 pages in 1-{max_page_to_scan} of {total_pages}")
            
            # First pass: find all pages with "Schedule K-3"
            for page_num in range(max_page_to_scan):
                page = doc[page_num]
                text = page.get_text()
                
                # K-3 page must have "Schedule K-3" but NOT "Schedule K-1"
                has_k3 = "Schedule K-3" in text
                has_k1 = "Schedule K-1" in text
                
                if has_k3 and not has_k1:
                    k3_pages.append(page_num + 1)  # 1-indexed
            
            doc.close()
            
            if not k3_pages:
                print("✅ No K-3 pages found")
                return []
            
            # Second pass: group consecutive pages into ranges
            k3_ranges = []
            start = k3_pages[0]
            end = k3_pages[0]
            
            for page in k3_pages[1:]:
                if page == end + 1:
                    # Consecutive page, extend range
                    end = page
                else:
                    # Gap found, save current range and start new one
                    k3_ranges.append((start, end))
                    start = page
                    end = page
            
            # Save last range
            k3_ranges.append((start, end))
            
            # Format ranges for display
            range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in k3_ranges]
            print(f"✅ Found {len(k3_ranges)} K-3 form(s): {', '.join(range_strs)}")
            
        except Exception as e:
            print(f"Error scanning PDF for K-3: {e}")
            return []
        
        return k3_ranges
    
    def detect_k3_pages(self, pdf_bytes: bytes, max_scan_percentage: float = 100.0, 
                        max_k3_pages: int = None) -> list:
        """
        Legacy method - returns all individual K-3 pages.
        Use detect_k3_page_ranges for range-based detection.
        """
        ranges = self.detect_k3_page_ranges(pdf_bytes, max_scan_percentage)
        pages = []
        for start, end in ranges:
            pages.extend(range(start, end + 1))
        return pages
    
    def extract_k3_pages_as_images(self, pdf_bytes: bytes, page_numbers: list) -> list:
        """
        Convert only specified pages to images for extraction.
        
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
            print(f"✅ Converted {len(images)} K-3 pages to images")
            
        except Exception as e:
            print(f"Error converting K-3 pages: {e}")
            return []
        
        return images
    
    def batch_extract(self, page_images: list, model: str = "gemini-2.5-flash") -> dict:
        """
        Extract K-3 data from all page images and MERGE into single partner record.
        
        For K-3 forms, one page range (e.g., pages 3-12) represents ONE partner's data.
        We extract from each page and merge all part data together.
        
        Args:
            page_images: List of (page_number, PIL.Image) tuples
            model: Model to use for extraction
            
        Returns:
            Consolidated extraction results with merged partner data
        """
        raw_results = []
        document_metadata = None
        
        # Collect all extracted data from all pages
        all_part_data = {
            "part_i_other_international": [],
            "part_ii_foreign_tax_credit": [],
            "part_iii_form_1116_1118": [],
            "part_iv_section_250": [],
            "part_v_distributions": [],
            "part_vi_inclusions": [],
            "part_vii_form_8621": [],
            "part_viii_foreign_corp_income": [],
            "part_ix_form_8991_beat": [],
            "part_x_tax_liability": [],
            "part_xi_section_871m": [],
            "part_xii_eci": [],
            "part_xiii_deemed_sale": [],
        }
        partner_name = ""
        first_page = page_images[0][0] if page_images else 1
        last_page = page_images[-1][0] if page_images else 1
        
        for page_num, img in page_images:
            print(f"🤖 Extracting K-3 data from page {page_num}...")
            
            try:
                result = self.extractor.extract(img, model)
                raw_results.append({"page": page_num, "raw": result})
                
                # Handle different response formats
                data = None
                if isinstance(result, list) and len(result) > 0:
                    data = result[0]
                elif isinstance(result, dict):
                    if "error" in result:
                        print(f"   ⚠️ Error: {result.get('error')}")
                        continue
                    data = result
                else:
                    continue
                
                if data is None:
                    continue
                
                # Extract document metadata (first one found)
                if document_metadata is None:
                    if "document_metadata" in data:
                        document_metadata = data["document_metadata"]
                    elif "partnership_name" in data or "tax_year" in data:
                        document_metadata = {
                            "form_type": data.get("form_type", "Schedule K-3 (Form 1065)"),
                            "tax_year": data.get("tax_year", "2024"),
                            "partnership_name": data.get("partnership_name", ""),
                            "partnership_ein": data.get("partnership_ein", "")
                        }
                
                # Get partner name if available
                if not partner_name:
                    if "partner_records" in data and data["partner_records"]:
                        partner_name = data["partner_records"][0].get("partner_name", "")
                    elif "partner_name" in data:
                        partner_name = data.get("partner_name", "")
                
                # Merge part data from this page
                # Check if data is in partner_records format
                page_data = data
                if "partner_records" in data and data["partner_records"]:
                    page_data = data["partner_records"][0]
                
                # Collect all part data
                for part_key in all_part_data.keys():
                    if part_key in page_data:
                        part_items = page_data[part_key]
                        if part_items:
                            # Merge items, avoiding duplicates by code
                            existing_codes = set()
                            for item in all_part_data[part_key]:
                                if "data" in item:
                                    for d in item["data"]:
                                        existing_codes.add(d.get("code"))
                            
                            for item in part_items:
                                if "data" in item:
                                    for d in item["data"]:
                                        if d.get("code") not in existing_codes:
                                            all_part_data[part_key].append(item)
                                            existing_codes.add(d.get("code"))
                                            break
                                        else:
                                            # Update existing value if new one is not empty/zero
                                            val = d.get("value")
                                            if val is not None and val != 0 and val != 0.00 and val != "":
                                                # Find and update
                                                for existing_item in all_part_data[part_key]:
                                                    if "data" in existing_item:
                                                        for ed in existing_item["data"]:
                                                            if ed.get("code") == d.get("code"):
                                                                if ed.get("value") in [None, 0, 0.00, ""]:
                                                                    ed["value"] = val
                                                break
                    
            except Exception as e:
                print(f"Error extracting K-3 page {page_num}: {e}")
                continue
        
        # Default metadata
        if document_metadata is None:
            document_metadata = {
                "form_type": "Schedule K-3 (Form 1065)",
                "tax_year": "2024",
                "partnership_name": "",
                "partnership_ein": ""
            }
        
        # Create consolidated partner record
        partner_record = {
            "partner_name": partner_name or f"Partner (Pages {first_page}-{last_page})",
            "page_reference": f"{first_page}-{last_page}",
            **all_part_data
        }
        
        result = [{
            "document_metadata": document_metadata,
            "partner_records": [partner_record],
            "_debug_raw_results": raw_results,
            "_pages_extracted": [p[0] for p in page_images]
        }]
        
        print(f"✅ Merged K-3 data from {len(page_images)} pages")
        return result
    
    def process_pdf(self, pdf_bytes: bytes, model: str = "gemini-2.5-flash",
                    progress_callback=None) -> dict:
        """
        Full pipeline: detect → convert → extract → consolidate.
        
        Args:
            pdf_bytes: PDF file content as bytes
            model: Model to use for extraction
            progress_callback: Optional callback for progress updates
        
        Returns:
            Consolidated extraction results
        """
        import time
        start_time = time.time()
        
        # Step 1: Detect K-3 pages
        if progress_callback:
            progress_callback("detecting", "🔍 Scanning for K-3 pages...", 10)
        
        k3_pages = self.detect_k3_pages(pdf_bytes)
        
        if not k3_pages:
            return {"error": "No K-3 forms found in PDF", "pages_scanned": 0}
        
        if progress_callback:
            progress_callback("detected", f"📄 Found {len(k3_pages)} K-3 pages", 30)
        
        # Step 2: Convert to images
        if progress_callback:
            progress_callback("converting", "🖼️ Converting K-3 pages to images...", 40)
        
        page_images = self.extract_k3_pages_as_images(pdf_bytes, k3_pages)
        
        if not page_images:
            return {"error": "Failed to convert K-3 pages", "k3_pages": k3_pages}
        
        # Step 3: Extract data
        if progress_callback:
            progress_callback("extracting", "🤖 Extracting K-3 data...", 60)
        
        results = self.batch_extract(page_images, model)
        
        # Add metadata
        elapsed = time.time() - start_time
        if isinstance(results, list) and len(results) > 0:
            results[0]["_processing_metadata"] = {
                "k3_pages_found": k3_pages,
                "total_partners": len(results[0].get("partner_records", [])),
                "processing_time_seconds": round(elapsed, 2)
            }
        
        if progress_callback:
            progress_callback("complete", "✅ K-3 extraction complete!", 100)
        
        print(f"✅ K-3 processing complete in {elapsed:.2f}s")
        return results
