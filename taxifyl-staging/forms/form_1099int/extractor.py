"""
Form 1099-INT Extractor
=======================
Extracts data from 1099-INT (Interest Income) tax forms using AI vision models.
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

from .config import INT_1099_SYSTEM_PROMPT, GEMINI_API_KEY, GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL


class Form1099INTExtractor:
    """1099-INT Form Extraction Client using AI Vision models."""
    
    def __init__(self):
        """Initialize the 1099-INT extractor."""
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
        Extract 1099-INT data from an image.
        
        Args:
            image: PIL Image, bytes, or file path
            model: Model to use - 'gemini-2.0-flash', 'gemini-2.5-flash', or 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        Returns:
            Extracted 1099-INT data as dictionary
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
                return self._extract_with_gemini(img, INT_1099_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Gemini extraction failed: {e}")
        
        if "llama" in model.lower() and self.groq_client:
            try:
                return self._extract_with_groq(img_data, INT_1099_SYSTEM_PROMPT, model)
            except Exception as e:
                print(f"Groq extraction failed: {e}")
        
        # Fallback to OCR
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(img)
                return self._parse_1099int_text(text)
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
    
    def _parse_1099int_text(self, text: str) -> dict:
        """Parse OCR text into 1099-INT JSON structure (fallback method)."""
        result = [
            {
                "forms": [
                    {
                        "form_header": {
                            "form_number": "1099-INT",
                            "year": self._extract_year(text),
                            "type": "Interest Income",
                            "text_array": [
                                "Copy B",
                                "For Recipient",
                                "OMB No. 1545-0112",
                                "Department of the Treasury - Internal Revenue Service"
                            ]
                        },
                        "boxes": [
                            {
                                "identification_plane": [
                                    {"data": [{"code": "Payer", "label": "Payer's name and address", "value": self._extract_payer(text)}]},
                                    {"data": [{"code": "Payer TIN", "label": "Payer's TIN", "value": self._extract_tin(text, "payer")}]},
                                    {"data": [{"code": "Recipient TIN", "label": "Recipient's TIN", "value": self._extract_tin(text, "recipient")}]},
                                    {"data": [{"code": "Recipient Name", "label": "Recipient's name and address", "value": self._extract_recipient(text)}]},
                                    {"data": [{"code": "Account No", "label": "Account number", "value": self._extract_account(text)}]},
                                    {"data": [{"code": "Payer RTN", "label": "Payer's RTN", "value": self._extract_rtn(text)}]}
                                ]
                            },
                            {
                                "financial_plane": [
                                    {"data": [{"code": "1", "label": "Interest income", "value": self._extract_box_value(text, ["interest income", "box 1"])}]},
                                    {"data": [{"code": "2", "label": "Early withdrawal penalty", "value": self._extract_box_value(text, ["early withdrawal", "box 2"])}]},
                                    {"data": [{"code": "3", "label": "Interest on U.S. Savings Bonds and Treasury obligations", "value": self._extract_box_value(text, ["savings bonds", "treasury", "box 3"])}]},
                                    {"data": [{"code": "4", "label": "Federal income tax withheld", "value": self._extract_box_value(text, ["federal", "tax withheld", "box 4"])}]},
                                    {"data": [{"code": "5", "label": "Investment expenses", "value": self._extract_box_value(text, ["investment expenses", "box 5"])}]},
                                    {"data": [{"code": "6", "label": "Foreign tax paid", "value": None}]},
                                    {"data": [{"code": "8", "label": "Tax-exempt interest", "value": None}]},
                                    {"data": [{"code": "9", "label": "Specified private activity bond interest", "value": None}]},
                                    {"data": [{"code": "10", "label": "Market discount", "value": None}]},
                                    {"data": [{"code": "11", "label": "Bond premium", "value": None}]}
                                ]
                            },
                            {
                                "state_local_plane": [
                                    {"data": [{"code": "15", "label": "State", "value": None}]},
                                    {"data": [{"code": "16", "label": "State identification no.", "value": None}]},
                                    {"data": [{"code": "17", "label": "State tax withheld", "value": 0.00}]}
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
    
    def _extract_payer(self, text: str) -> str:
        """Extract payer name and address."""
        # Simple extraction - look for text after "PAYER'S"
        match = re.search(r"PAYER'S.*?name.*?[:]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_recipient(self, text: str) -> str:
        """Extract recipient name and address."""
        match = re.search(r"RECIPIENT'S.*?name.*?[:]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_tin(self, text: str, party: str) -> str:
        """Extract TIN (Taxpayer Identification Number)."""
        pattern = r'\d{2}[-\s]?\d{7}' if party == "payer" else r'XXX[-\s]?XX[-\s]?\d{4}|\d{3}[-\s]?\d{2}[-\s]?\d{4}'
        match = re.search(pattern, text)
        return match.group(0) if match else ""
    
    def _extract_account(self, text: str) -> str:
        """Extract account number."""
        match = re.search(r'account.*?[:]\s*(\S+)', text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_rtn(self, text: str) -> str:
        """Extract Payer's RTN (Routing Transit Number)."""
        match = re.search(r'\b\d{9}\b', text)
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
