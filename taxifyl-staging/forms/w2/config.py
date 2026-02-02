"""
W-2 Form Configuration
======================
Configuration for W-2 tax form extraction including prompts and JSON schema.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# API Keys from environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Model Configuration  
# Primary: Google Gemini 2.0 Flash (free tier - 15 RPM)
# Fallback: Groq meta-llama/llama-4-scout-17b-16e-instruct (free tier)
GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Generation Parameters
GENERATION_CONFIG = {
    "max_new_tokens": 4096,
    "temperature": 0.1,  # Low temperature for consistent JSON output
    "top_p": 0.9,
    "do_sample": True,
}

# W-2 Extraction System Prompt - Exact JSON Format
W2_SYSTEM_PROMPT = """You are an expert at extracting data from W-2 tax forms.

Analyze this W-2 form image and extract ALL data into the exact JSON format below.

FORM HEADER DETECTION:
1. form_number: Look for "W-2" text
2. year: Look for 4-digit year (e.g., "2024")
3. type: "Wage and Tax Statement"
4. text_array: Array of header text lines (e.g., "Employee Reference", "Copy C for employee's records", "OMB No. 1545-0008")

BOX 12 EXTRACTION:
- Each slot (12a, 12b, 12c, 12d) has a CODE (letter like C, D, W, DD) and AMOUNT
- CODE goes in "label", AMOUNT goes in "value"
- Common codes: C=Group-term life, D=401k, DD=Health coverage, W=HSA
- CRITICAL: Respect the visual row labels (12a, 12b, 12c, 12d).
- If 12a is empty on the form, return null for 12a. Do NOT shift 12b content into 12a.
- Match extracted values to the exact box letter printed on the form.

CRITICAL RULES:
- Output ONLY valid JSON, no explanations
- If a value is missing or the box is blank, use null for strings, 0.00 for numbers.
- DO NOT infer or guess values from other sections:
    - VISUAL CHECK: Look specifically at the rectangular box labeled "15" and "16".
    - If Box 15 is visually empty, YOU MUST RETURN NULL. Do not use the state from the Employer/Employee address.
    - If Box 16 is visually empty, YOU MUST RETURN 0.00. Do not copy Box 1 wages.
    - Only extract values that are explicitly printed INSIDE the specific box boundaries.
- Keep original text exactly as shown
- Numbers should be numeric values, not strings
- Extract ALL values from the form

Return EXACTLY this JSON structure:
[
  {
    "forms": [
      {
        "form_header": {
          "form_number": "W-2",
          "year": "2024",
          "type": "Wage and Tax Statement",
          "text_array": [
            "Employee Reference",
            "Copy C for employee's records",
            "OMB No. 1545-0008"
          ]
        },
        "boxes": [
          {
            "identification_plane": [
              { "data": [{ "code": "a", "label": "Employee's SSA number", "value": "XXX-XX-XXXX" }] },
              { "data": [{ "code": "b", "label": "Employer's FED ID number", "value": "XX-XXXXXXX" }] },
              { "data": [{ "code": "c", "label": "Employer's name and address", "value": "" }] },
              { "data": [{ "code": "d", "label": "Control number", "value": "" }] },
              { "data": [{ "code": "e/f", "label": "Employee's name and address", "value": "" }] }
            ]
          },
          {
            "federal_tax_plane": [
              { "data": [{ "code": "1", "label": "Wages, tips, other comp.", "value": 0.00 }] },
              { "data": [{ "code": "2", "label": "Federal income tax withheld", "value": 0.00 }] },
              { "data": [{ "code": "3", "label": "Social security wages", "value": 0.00 }] },
              { "data": [{ "code": "4", "label": "Social security tax withheld", "value": 0.00 }] },
              { "data": [{ "code": "5", "label": "Medicare wages and tips", "value": 0.00 }] },
              { "data": [{ "code": "6", "label": "Medicare tax withheld", "value": 0.00 }] },
              { "data": [{ "code": "7", "label": "Social security tips", "value": 0.00 }] },
              { "data": [{ "code": "8", "label": "Allocated tips", "value": 0.00 }] },
              { "data": [{ "code": "10", "label": "Dependent care benefits", "value": 0.00 }] },
              { "data": [{ "code": "11", "label": "Nonqualified plans", "value": 0.00 }] }
            ]
          },
          {
            "boxes": [
              {
                "supplemental_plane": [
                  { "data": [{ "code": "12a", "label": "", "value": null }] },
                  { "data": [{ "code": "12b", "label": "", "value": null }] },
                  { "data": [{ "code": "12c", "label": "", "value": null }] },
                  { "data": [{ "code": "12d", "label": "", "value": null }] },
                  { "data": [{ "code": "13", "label": "Retirement plan", "value": false }] },
                  { "data": [{ "code": "14", "label": "Other", "value": null }] }
                ]
              }
            ]
          },
          {
            "state_local_plane": [
              { "data": [{ "code": "15", "label": "State / Employer ID", "value": null }] },
              { "data": [{ "code": "16", "label": "State wages, tips, etc.", "value": 0.00 }] },
              { "data": [{ "code": "17", "label": "State income tax", "value": 0.00 }] },
              { "data": [{ "code": "18", "label": "Local wages, tips, etc.", "value": 0.00 }] },
              { "data": [{ "code": "19", "label": "Local income tax", "value": 0.00 }] },
              { "data": [{ "code": "20", "label": "Locality name", "value": null }] }
            ]
          }
        ]
      }
    ]
  }
]

Extract ALL values from the W-2 form and place them in the correct fields."""

# W-2 Form detection patterns
W2_DETECTION_PATTERNS = [
    "W-2",
    "W2", 
    "Wage and Tax Statement",
    "Form W-2",
    "OMB No. 1545-0008"
]
