"""
Form 8805 Extractor
===================
Extracts data from Form 8805 (Foreign Partner's Information Statement) using AI vision models.
Same structure as K-1/K-3 extractor with page detection and batch extraction.
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
load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GROQ_API_KEY_2 = os.environ.get("GROQ_API_KEY_2", "")

from .config import FORM_8805_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class Form8805Extractor:
    """Form 8805 (Foreign Partner's Information Statement) Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the 8805 extractor."""
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
                print("✅ Backup Groq client initialized for Form 8805")
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
        Extract Form 8805 data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use - 'gemini-2.0-flash', 'gemini-2.5-flash', or 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        Returns:
            Extracted Form 8805 data as dictionary
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
                return self._extract_with_gemini(img, FORM_8805_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, FORM_8805_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        if "gpt" in model.lower() and self.openai_client:
            try:
                return self._extract_with_openai(img_data, FORM_8805_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"OpenAI extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_8805_text(text)
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
    
    def _parse_8805_text(self, text: str) -> dict:
        """Parse OCR text into Form 8805 JSON structure (fallback method)."""
        result = {
            "partner_name": self._extract_name(text),
            "form_type": "Form 8805",
            "copy_type": self._extract_copy_type(text),
            "fields": [
                {"code": "1a", "label": "Foreign partner's name", "value": self._extract_name(text)},
                {"code": "1b", "label": "U.S. identifying number", "value": self._extract_tin(text)},
                {"code": "1c", "label": "Address (foreign or domestic)", "value": ""},
                {"code": "2", "label": "Account number assigned by partnership", "value": ""},
                {"code": "3", "label": "Type of partner", "value": self._extract_partner_type(text)},
                {"code": "4", "label": "Country code of partner", "value": ""},
                {"code": "5a", "label": "Name of partnership", "value": self._extract_partnership_name(text)},
                {"code": "5b", "label": "U.S. Employer Identification Number (EIN)", "value": self._extract_ein(text)},
                {"code": "5c", "label": "Address of partnership", "value": ""},
                {"code": "6", "label": "Withholding agent's name", "value": ""},
                {"code": "7", "label": "Withholding agent's U.S. EIN", "value": ""},
                {"code": "8a", "label": "Check if partnership owns interest in one or more partnerships", "value": False},
                {"code": "8b", "label": "Check if any ECTI is exempt from U.S. tax", "value": False},
                {"code": "9", "label": "Partnership's ECTI allocable to partner", "value": 0.00},
                {"code": "10", "label": "Total tax credit allowed to partner under section 1446", "value": 0.00},
                {"code": "11a", "label": "Name of beneficiary", "value": ""},
                {"code": "11b", "label": "U.S. identifying number of beneficiary", "value": ""},
                {"code": "11c", "label": "Address of beneficiary", "value": ""},
                {"code": "12", "label": "Amount of ECTI on line 9 included in beneficiary's gross income", "value": 0.00},
                {"code": "13", "label": "Amount of tax credit on line 10 beneficiary is entitled to claim", "value": 0.00}
            ]
        }
        return result
    
    def _extract_name(self, text: str) -> str:
        """Extract partner name from text."""
        match = re.search(r"partner['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_partnership_name(self, text: str) -> str:
        """Extract partnership name from text."""
        match = re.search(r"partnership['\"]?s?\s*name[:\s]+([^\n]+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_tin(self, text: str) -> str:
        """Extract TIN from text."""
        match = re.search(r'\d{3}[-\s]?\d{2}[-\s]?\d{4}', text)
        return match.group(0) if match else ""
    
    def _extract_ein(self, text: str) -> str:
        """Extract EIN from text."""
        match = re.search(r'\d{2}[-\s]?\d{7}', text)
        return match.group(0) if match else ""
    
    def _extract_partner_type(self, text: str) -> str:
        """Extract partner type from text."""
        text_upper = text.upper()
        if "INDIVIDUAL" in text_upper:
            return "INDIVIDUAL"
        elif "CORPORATION" in text_upper:
            return "CORPORATION"
        elif "PARTNERSHIP" in text_upper:
            return "PARTNERSHIP"
        elif "TRUST" in text_upper:
            return "TRUST"
        elif "ESTATE" in text_upper:
            return "ESTATE"
        return ""
    
    def _extract_copy_type(self, text: str) -> str:
        """Extract copy type from text."""
        text_upper = text.upper()
        if "COPY A" in text_upper:
            return "Copy A - For IRS"
        elif "COPY B" in text_upper:
            return "Copy B - For Partner"
        elif "COPY C" in text_upper:
            return "Copy C - For Partner"
        elif "COPY D" in text_upper:
            return "Copy D - For Withholding Agent"
        return "Copy B - For Partner"


class MultiPage8805Processor:
    """
    Optimized processor for multi-page PDFs with Form 8805 forms.
    
    Uses same approach as K-1/K-3:
    1. Fast local text detection to identify 8805 pages
    2. Batch extraction via vision models for identified pages
    """
    
    def __init__(self):
        """Initialize the multi-page processor."""
        self.extractor = Form8805Extractor()
        # Form 8805 header patterns
        self.form_header_patterns = ["Form 8805", "8805", "Foreign Partner's Information Statement"]
        # Section 1446 is specific to Form 8805
        self.section_pattern = "Section 1446"
    
    def detect_8805_page_ranges(self, pdf_bytes: bytes, max_scan_percentage: float = 100.0) -> list:
        """
        Scan PDF to find Form 8805 page RANGES.
        
        Groups consecutive Form 8805 pages together. Each partner typically has 
        4 copies (Copy A, B, C, D) appearing consecutively.
        
        Args:
            pdf_bytes: PDF file content as bytes
            max_scan_percentage: Scan percentage of pages (default 100%)
            
        Returns:
            List of tuples: [(start_page, end_page), ...] e.g., [(5, 8), (25, 28)]
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("PyMuPDF not available for text detection")
            return []
        
        form_8805_pages = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            
            max_page_to_scan = int(total_pages * max_scan_percentage / 100)
            print(f"📄 Scanning for Form 8805 pages in 1-{max_page_to_scan} of {total_pages}")
            
            # First pass: find all pages with actual Form 8805 content
            for page_num in range(max_page_to_scan):
                page = doc[page_num]
                text = page.get_text()
                
                # Form 8805 STRICT detection - must have "Form 8805" explicitly
                # Not just "8805" which might appear in other contexts
                has_form_8805 = "Form 8805" in text
                
                # Additional indicator: "Foreign Partner's Information Statement"
                has_title = "Foreign Partner's Information Statement" in text
                
                # Copy indicators (Copy A, Copy B, etc.) combined with 8805 reference
                has_copy = (("Copy A" in text or "Copy B" in text or "Copy C" in text or "Copy D" in text) 
                           and "8805" in text)
                
                # Section 1446 withholding is specific to Form 8805, but only count if also mentions Form 8805
                has_section_1446 = "Section 1446" in text and "Form 8805" in text
                
                # CRITICAL EXCLUSIONS:
                # Exclude Schedule K-1 (Form 8804) - it's NOT Form 8805!
                is_k1_8804 = "Schedule K-1" in text and "(Form 8804)" in text
                is_main_8804 = "Form 8804" in text and "Annual Return for Partnership Withholding Tax" in text
                is_any_8804 = is_k1_8804 or is_main_8804 or ("Form 8804" in text and "Schedule K-1" in text)
                
                # Exclude regular K-1/K-3 pages that might reference Form 8805
                is_k1 = "Schedule K-1" in text and "(Form 1065)" in text
                is_k3 = "Schedule K-3" in text
                
                # Must match: (Form 8805 OR title OR section 1446) AND NOT any 8804 variant AND not K-1/K-3
                is_8805_page = (has_form_8805 or has_title or has_section_1446 or has_copy) and not is_any_8804 and not is_k1 and not is_k3
                
                if is_8805_page:
                    form_8805_pages.append(page_num + 1)  # 1-indexed

            
            doc.close()
            
            if not form_8805_pages:
                print("✅ No Form 8805 pages found")
                return []
            
            # Second pass: group consecutive pages into ranges
            # Each partner has 4 copies, so ranges are typically 4 pages
            ranges_8805 = []
            start = form_8805_pages[0]
            end = form_8805_pages[0]
            
            for page in form_8805_pages[1:]:
                if page == end + 1:
                    # Consecutive page, extend range
                    end = page
                else:
                    # Gap found, save current range and start new one
                    ranges_8805.append((start, end))
                    start = page
                    end = page
            
            # Save last range
            ranges_8805.append((start, end))
            
            # Format ranges for display
            range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in ranges_8805]
            print(f"✅ Found {len(ranges_8805)} Form 8805 form(s): {', '.join(range_strs)}")
            
        except Exception as e:
            print(f"Error scanning PDF for Form 8805: {e}")
            return []
        
        return ranges_8805
    
    def detect_8805_pages(self, pdf_bytes: bytes, max_scan_percentage: float = 100.0) -> list:
        """
        Legacy method - returns all individual Form 8805 pages.
        Use detect_8805_page_ranges for range-based detection.
        """
        ranges = self.detect_8805_page_ranges(pdf_bytes, max_scan_percentage)
        pages = []
        for start, end in ranges:
            pages.extend(range(start, end + 1))
        return pages
    
    def extract_8805_pages_as_images(self, pdf_bytes: bytes, page_numbers: list) -> list:
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
            print(f"✅ Converted {len(images)} Form 8805 pages to images")
            
        except Exception as e:
            print(f"Error converting Form 8805 pages: {e}")
            return []
        
        return images
    
    def batch_extract(self, page_images: list, model: str = "gemini-2.5-flash") -> list:
        """
        Extract Form 8805 data from all page images.
        
        For Form 8805, each page range (e.g., pages 5-8) represents ONE partner's 
        4 copies. We extract from the most readable copy.
        
        Args:
            page_images: List of (page_number, PIL.Image) tuples
            model: Model to use for extraction
            
        Returns:
            List of extracted Form 8805 records
        """
        extracted_forms = []
        first_page = page_images[0][0] if page_images else 1
        last_page = page_images[-1][0] if page_images else 1
        
        # For Form 8805, we typically only need to extract from one copy
        # Try the first page which is usually Copy A
        if page_images:
            page_num, img = page_images[0]
            print(f"🤖 Extracting Form 8805 data from page {page_num}...")
            
            try:
                result = self.extractor.extract(img, model)
                
                if isinstance(result, dict) and "error" not in result:
                    # Add page reference
                    result["page_reference"] = f"{first_page}-{last_page}"
                    extracted_forms.append(result)
                    print(f"   ✅ Extracted partner: {result.get('partner_name', 'Unknown')}")
                else:
                    print(f"   ⚠️ Error: {result.get('error', 'Unknown error')}")
                    
            except Exception as e:
                print(f"Error extracting Form 8805 page {page_num}: {e}")
        
        # Wrap in expected format
        return {
            "extracted_forms_8805": extracted_forms,
            "_pages_extracted": [p[0] for p in page_images],
            "_page_range": f"{first_page}-{last_page}"
        }
    
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
        
        # Step 1: Detect Form 8805 pages
        if progress_callback:
            progress_callback("detecting", "🔍 Scanning for Form 8805 pages...", 10)
        
        page_ranges = self.detect_8805_page_ranges(pdf_bytes)
        
        if not page_ranges:
            return {"error": "No Form 8805 forms found in PDF", "pages_scanned": 0}
        
        if progress_callback:
            progress_callback("detected", f"📄 Found {len(page_ranges)} Form 8805 form(s)", 30)
        
        # Step 2: Convert to images (just first page of each range for efficiency)
        if progress_callback:
            progress_callback("converting", "🖼️ Converting Form 8805 pages to images...", 40)
        
        # Get first page of each range for extraction
        pages_to_extract = [r[0] for r in page_ranges]
        page_images = self.extract_8805_pages_as_images(pdf_bytes, pages_to_extract)
        
        if not page_images:
            return {"error": "Failed to convert Form 8805 pages", "page_ranges": page_ranges}
        
        # Step 3: Extract data from each range
        if progress_callback:
            progress_callback("extracting", "🤖 Extracting Form 8805 data...", 60)
        
        all_forms = []
        for (start, end), (page_num, img) in zip(page_ranges, page_images):
            result = self.extractor.extract(img, model)
            if isinstance(result, dict) and "error" not in result:
                result["page_reference"] = f"{start}-{end}"
                all_forms.append(result)
        
        # Add metadata
        elapsed = time.time() - start_time
        results = {
            "extracted_forms_8805": all_forms,
            "_processing_metadata": {
                "page_ranges_found": page_ranges,
                "total_forms": len(all_forms),
                "processing_time_seconds": round(elapsed, 2)
            }
        }
        
        if progress_callback:
            progress_callback("complete", "✅ Form 8805 extraction complete!", 100)
        
        print(f"✅ Form 8805 processing complete in {elapsed:.2f}s")
        return results
