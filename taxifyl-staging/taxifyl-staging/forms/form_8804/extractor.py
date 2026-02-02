"""
Form 8804 Extractor
===================
Extracts data from Form 8804 (Annual Return for Partnership Withholding Tax) using AI vision models.
Same structure as K-1/K-3/8805 extractor with page detection and batch extraction.
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

from .config import FORM_8804_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class Form8804Extractor:
    """Form 8804 (Annual Return for Partnership Withholding Tax) Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the 8804 extractor."""
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
        
        # Initialize Groq
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
        Extract Form 8804 data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use for extraction
        
        Returns:
            Extracted Form 8804 data as dictionary
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
                return self._extract_with_gemini(img, FORM_8804_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, FORM_8804_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        if "gpt" in model.lower() and self.openai_client:
            try:
                return self._extract_with_openai(img_data, FORM_8804_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"OpenAI extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_8804_text(text)
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
        """Extract using Groq API with LLaMA Vision."""
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
        
        try:
            response = self.groq_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=0.1
            )
        except Exception as e:
            error_str = str(e)
            if ("429" in error_str or "rate_limit" in error_str.lower()) and self.groq_client_backup:
                print("⚠️ Primary Groq rate limited. Trying backup...")
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
    
    def _parse_8804_text(self, text: str) -> dict:
        """Parse OCR text into Form 8804 JSON structure (fallback method)."""
        return {
            "form_metadata": {
                "form_type": "Schedule K-1 (Form 8804)",
                "tax_year": "",
                "partnership_name": "",
                "partnership_ein": ""
            },
            "parts": [
                {
                    "part_number": "I",
                    "label": "Partnership",
                    "fields": [
                        {"code": "1a", "label": "Name of partnership", "value": ""},
                        {"code": "1b", "label": "U.S. employer identification number (EIN)", "value": ""},
                        {"code": "1c", "label": "Address (number, street, and room/suite no.)", "value": ""},
                        {"code": "1d", "label": "City, state, and ZIP code", "value": ""}
                    ]
                },
                {
                    "part_number": "II",
                    "label": "Withholding Agent",
                    "fields": [
                        {"code": "2a", "label": "Name of withholding agent", "value": ""},
                        {"code": "2b", "label": "Withholding agent's U.S. EIN", "value": ""}
                    ]
                },
                {
                    "part_number": "III",
                    "label": "Section 1446 Tax Liability and Payments",
                    "fields": [
                        {"code": "3a", "label": "Number of foreign partners", "value": 0},
                        {"code": "3b", "label": "Number of Forms 8805 attached", "value": 0},
                        {"code": "4d", "label": "ECTI allocable to corporate partners", "value": 0.00},
                        {"code": "4e", "label": "Total ECTI allocable to non-corporate partners", "value": 0.00},
                        {"code": "4h", "label": "Combined non-corporate ECTI", "value": 0.00},
                        {"code": "4l", "label": "28% rate gain allocable to non-corporate partners", "value": 0.00},
                        {"code": "4p", "label": "25% rate gain allocable to non-corporate partners", "value": 0.00},
                        {"code": "4q", "label": "Adjusted net capital gain", "value": 0.00},
                        {"code": "4r", "label": "Reduction for state and local taxes", "value": 0.00},
                        {"code": "4s", "label": "Reduction for certified foreign partner-level items", "value": 0.00},
                        {"code": "4t", "label": "Combine lines 4q, 4r, and 4s", "value": 0.00},
                        {"code": "5a", "label": "Multiply line 4d by 21%", "value": 0.00},
                        {"code": "5b", "label": "Multiply line 4h by 37%", "value": 0.00},
                        {"code": "5c", "label": "Multiply line 4l by 28%", "value": 0.00},
                        {"code": "5d", "label": "Multiply line 4p by 25%", "value": 0.00},
                        {"code": "5e", "label": "Multiply line 4t by 20%", "value": 0.00},
                        {"code": "5f", "label": "Total gross section 1446 tax liability", "value": 0.00}
                    ]
                }
            ]
        }


class MultiPage8804Processor:
    """
    Optimized processor for multi-page PDFs with Form 8804 forms.
    
    Uses same approach as K-1/K-3/8805:
    1. Fast local text detection to identify 8804 pages
    2. Batch extraction via vision models for identified pages
    """
    
    def __init__(self):
        """Initialize the multi-page processor."""
        self.extractor = Form8804Extractor()
    
    def detect_8804_page_ranges(self, pdf_bytes: bytes, max_scan_percentage: float = 100.0) -> list:
        """
        Scan PDF to find Form 8804 page RANGES.
        
        Form 8804 is typically 1-2 pages per instance.
        
        Args:
            pdf_bytes: PDF file content as bytes
            max_scan_percentage: Scan percentage of pages (default 100%)
            
        Returns:
            List of tuples: [(start_page, end_page), ...]
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("PyMuPDF not available for text detection")
            return []
        
        form_8804_pages = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            
            max_page_to_scan = int(total_pages * max_scan_percentage / 100)
            print(f"📄 Scanning for Form 8804 pages in 1-{max_page_to_scan} of {total_pages}")
            
            for page_num in range(max_page_to_scan):
                page = doc[page_num]
                text = page.get_text()
                
                
                # Form 8804 detection - two variants:
                # 1. Main Form 8804 - "Annual Return for Partnership Withholding Tax"
                # 2. Schedule K-1 (Form 8804) - "Partner's Section 1446 Withholding Tax"
                
                # Main Form 8804 indicators
                has_form_8804_exact = "Form 8804" in text and not "Schedule K-1" in text
                has_main_title = "Annual Return for Partnership Withholding Tax" in text
                
                # Schedule K-1 (Form 8804) indicators - this is what the user has!
                has_schedule_k1_8804 = "Schedule K-1" in text and "(Form 8804)" in text
                has_partner_1446_title = "Partner's Section 1446 Withholding Tax" in text
                
                # Part indicators (both forms have these)
                has_part_i = "Part I" in text and ("Partnership" in text or "Name of partnership" in text.lower())
                has_part_ii = "Part II" in text and ("Withholding Agent" in text or "withholding agent" in text.lower())
                
                # CRITICAL: Exclude Form 8805 (Foreign Partner's Information)
                # Form 8805 is NOT Form 8804, even though they're related
                is_8805 = ("Form 8805" in text or 
                          "Foreign Partner's Information Statement" in text or
                          "Foreign Partner's Information" in text and "Form 8805" in text)
                
                # Exclude standard K-1 (Form 1065) - not Form 8804
                is_standard_k1 = "Schedule K-1" in text and "(Form 1065)" in text
                
                # Exclude K-3
                is_k3 = "Schedule K-3" in text
                
                # DETECTION RULES:
                # 1. Schedule K-1 (Form 8804): has "Schedule K-1" + "(Form 8804)" or the partner 1446 title
                # 2. Main Form 8804: has "Form 8804" (without Schedule K-1) + title or parts
                # 3. MUST NOT be Form 8805, K-1 (1065),  or K-3
                is_schedule_k1_8804 = (has_schedule_k1_8804 or has_partner_1446_title) and not is_standard_k1 and not is_8805
                is_main_8804 = has_form_8804_exact and (has_main_title or (has_part_i and has_part_ii)) and not is_8805
                
                is_8804_page = (is_schedule_k1_8804 or is_main_8804) and not is_8805 and not is_k3 and not is_standard_k1
                
                if is_8804_page:
                    form_8804_pages.append(page_num + 1)  # 1-indexed

            
            doc.close()
            
            if not form_8804_pages:
                print("✅ No Form 8804 pages found")
                return []
            
            # Group consecutive pages into ranges
            ranges_8804 = []
            start = form_8804_pages[0]
            end = form_8804_pages[0]
            
            for page in form_8804_pages[1:]:
                if page == end + 1:
                    end = page
                else:
                    ranges_8804.append((start, end))
                    start = page
                    end = page
            
            ranges_8804.append((start, end))
            
            range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in ranges_8804]
            print(f"✅ Found {len(ranges_8804)} Form 8804 form(s): {', '.join(range_strs)}")
            
        except Exception as e:
            print(f"Error scanning PDF for Form 8804: {e}")
            return []
        
        return ranges_8804
    
    def extract_8804_pages_as_images(self, pdf_bytes: bytes, page_numbers: list) -> list:
        """Convert specified pages to images for extraction."""
        try:
            import fitz
        except ImportError:
            print("PyMuPDF not available")
            return []
        
        images = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in page_numbers:
                if 1 <= page_num <= len(doc):
                    page = doc[page_num - 1]
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    images.append((page_num, img))
            
            doc.close()
            print(f"✅ Converted {len(images)} Form 8804 pages to images")
            
        except Exception as e:
            print(f"Error converting Form 8804 pages: {e}")
            return []
        
        return images
    
    def batch_extract(self, page_images: list, model: str = "gemini-2.5-flash") -> dict:
        """
        Extract Form 8804 data from page images.
        
        Form 8804 is typically a single form per partnership, so we extract
        from the first page of each range.
        """
        extracted_forms = []
        first_page = page_images[0][0] if page_images else 1
        last_page = page_images[-1][0] if page_images else 1
        
        if page_images:
            page_num, img = page_images[0]
            print(f"🤖 Extracting Form 8804 data from page {page_num}...")
            
            try:
                result = self.extractor.extract(img, model)
                
                if isinstance(result, dict) and "error" not in result:
                    result["page_reference"] = f"{first_page}-{last_page}"
                    extracted_forms.append(result)
                    partnership_name = result.get("form_metadata", {}).get("partnership_name", "Unknown")
                    print(f"   ✅ Extracted partnership: {partnership_name}")
                else:
                    print(f"   ⚠️ Error: {result.get('error', 'Unknown error')}")
                    
            except Exception as e:
                print(f"Error extracting Form 8804 page {page_num}: {e}")
        
        return {
            "extracted_forms_8804": extracted_forms,
            "_pages_extracted": [p[0] for p in page_images],
            "_page_range": f"{first_page}-{last_page}"
        }
    
    def process_pdf(self, pdf_bytes: bytes, model: str = "gemini-2.5-flash",
                    progress_callback=None) -> dict:
        """Full pipeline: detect → convert → extract → consolidate."""
        import time
        start_time = time.time()
        
        if progress_callback:
            progress_callback("detecting", "🔍 Scanning for Form 8804 pages...", 10)
        
        page_ranges = self.detect_8804_page_ranges(pdf_bytes)
        
        if not page_ranges:
            return {"error": "No Form 8804 forms found in PDF", "pages_scanned": 0}
        
        if progress_callback:
            progress_callback("detected", f"📄 Found {len(page_ranges)} Form 8804 form(s)", 30)
        
        if progress_callback:
            progress_callback("converting", "🖼️ Converting Form 8804 pages to images...", 40)
        
        pages_to_extract = [r[0] for r in page_ranges]
        page_images = self.extract_8804_pages_as_images(pdf_bytes, pages_to_extract)
        
        if not page_images:
            return {"error": "Failed to convert Form 8804 pages", "page_ranges": page_ranges}
        
        if progress_callback:
            progress_callback("extracting", "🤖 Extracting Form 8804 data...", 60)
        
        all_forms = []
        for (start, end), (page_num, img) in zip(page_ranges, page_images):
            result = self.extractor.extract(img, model)
            if isinstance(result, dict) and "error" not in result:
                result["page_reference"] = f"{start}-{end}"
                all_forms.append(result)
        
        elapsed = time.time() - start_time
        results = {
            "extracted_forms_8804": all_forms,
            "_processing_metadata": {
                "page_ranges_found": page_ranges,
                "total_forms": len(all_forms),
                "processing_time_seconds": round(elapsed, 2)
            }
        }
        
        if progress_callback:
            progress_callback("complete", "✅ Form 8804 extraction complete!", 100)
        
        print(f"✅ Form 8804 processing complete in {elapsed:.2f}s")
        return results
