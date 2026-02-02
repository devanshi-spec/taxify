"""
W-2 Form Extractor
==================
Extracts data from W-2 tax forms using AI vision models (Gemini/Groq)
with Tesseract OCR fallback.
"""

import json
import io
import re
import os
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

from .config import W2_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class W2Extractor:
    """W-2 Form Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the W-2 extractor."""
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
        model: str = "gemini-2.0-flash"
    ) -> dict:
        """
        Extract W-2 data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use - 'gemini-2.0-flash', 'gemini-2.5-flash', or 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        Returns:
            Extracted W-2 data as dictionary
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
                return self._extract_with_gemini(img_data, W2_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, W2_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_w2_text(text)
            except Exception as e:
                print(f"OCR extraction failed: {e}")
        
        return {"error": "No extraction method available"}
    
    def _extract_with_gemini(self, img_data: bytes, prompt: str, model: str) -> dict:
        """Extract using Google Gemini API."""
        import PIL.Image
        
        # Convert bytes to PIL Image for Gemini
        img = PIL.Image.open(io.BytesIO(img_data))
        
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
    
    def _parse_w2_text(self, text: str) -> dict:
        """Parse OCR text into W-2 JSON structure (fallback method)."""
        # Basic pattern matching for W-2 fields
        result = {
            "forms": [{
                "form_header": {
                    "form_number": "W-2",
                    "year": self._extract_year(text),
                    "type": "Wage and Tax Statement",
                    "text_array": []
                },
                "boxes": [
                    {
                        "identification_plane": [
                            {"data": [{"code": "a", "label": "Employee's SSA number", "value": self._extract_ssn(text)}]},
                            {"data": [{"code": "b", "label": "Employer's FED ID number", "value": self._extract_ein(text)}]},
                            {"data": [{"code": "c", "label": "Employer's name and address", "value": ""}]},
                            {"data": [{"code": "d", "label": "Control number", "value": ""}]},
                            {"data": [{"code": "e/f", "label": "Employee's name and address", "value": ""}]}
                        ]
                    },
                    {
                        "federal_tax_plane": [
                            {"data": [{"code": "1", "label": "Wages, tips, other comp.", "value": self._extract_box_value(text, ["wages", "box 1", "1\\s+"])}]},
                            {"data": [{"code": "2", "label": "Federal income tax withheld", "value": self._extract_box_value(text, ["federal", "box 2", "2\\s+"])}]},
                            {"data": [{"code": "3", "label": "Social security wages", "value": 0.00}]},
                            {"data": [{"code": "4", "label": "Social security tax withheld", "value": 0.00}]},
                            {"data": [{"code": "5", "label": "Medicare wages and tips", "value": 0.00}]},
                            {"data": [{"code": "6", "label": "Medicare tax withheld", "value": 0.00}]},
                            {"data": [{"code": "7", "label": "Social security tips", "value": 0.00}]},
                            {"data": [{"code": "8", "label": "Allocated tips", "value": 0.00}]},
                            {"data": [{"code": "10", "label": "Dependent care benefits", "value": 0.00}]},
                            {"data": [{"code": "11", "label": "Nonqualified plans", "value": 0.00}]}
                        ]
                    },
                    {
                        "boxes": [{
                            "supplemental_plane": [
                                {"data": [{"code": "12a", "label": "", "value": None}]},
                                {"data": [{"code": "12b", "label": "", "value": None}]},
                                {"data": [{"code": "12c", "label": "", "value": None}]},
                                {"data": [{"code": "12d", "label": "", "value": None}]},
                                {"data": [{"code": "13", "label": "Retirement plan", "value": False}]},
                                {"data": [{"code": "14", "label": "Other", "value": None}]}
                            ]
                        }]
                    },
                    {
                        "state_local_plane": [
                            {"data": [{"code": "15", "label": "State / Employer ID", "value": None}]},
                            {"data": [{"code": "16", "label": "State wages, tips, etc.", "value": 0.00}]},
                            {"data": [{"code": "17", "label": "State income tax", "value": 0.00}]},
                            {"data": [{"code": "18", "label": "Local wages, tips, etc.", "value": 0.00}]},
                            {"data": [{"code": "19", "label": "Local income tax", "value": 0.00}]},
                            {"data": [{"code": "20", "label": "Locality name", "value": None}]}
                        ]
                    }
                ]
            }]
        }
        return result
    
    def _extract_year(self, text: str) -> str:
        """Extract tax year from text."""
        match = re.search(r'20[12][0-9]', text)
        return match.group(0) if match else "2024"
    
    def _extract_ssn(self, text: str) -> str:
        """Extract Social Security Number."""
        match = re.search(r'\d{3}[-\s]?\d{2}[-\s]?\d{4}', text)
        return match.group(0) if match else ""
    
    def _extract_ein(self, text: str) -> str:
        """Extract Employer Identification Number."""
        match = re.search(r'\d{2}[-\s]?\d{7}', text)
        return match.group(0) if match else ""
    
    def _extract_box_value(self, text: str, patterns: list) -> float:
        """Extract a numeric value near the given patterns."""
        for pattern in patterns:
            match = re.search(f'{pattern}[\\s:]*([\\$]?[\\d,]+\\.?\\d*)', text, re.IGNORECASE)
            if match:
                value_str = match.group(1).replace('$', '').replace(',', '')
                try:
                    return float(value_str)
                except ValueError:
                    continue
        return 0.00
