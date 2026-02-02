"""
Form 8804 Configuration
=======================
System prompt and configuration for Form 8804 / Schedule K-1 (Form 8804).
"""

import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


FORM_8804_SYSTEM_PROMPT = '''You are extracting data from IRS Form 8804 or Schedule K-1 (Form 8804).

CRITICAL INSTRUCTION:
ONLY extract fields that are PHYSICALLY PRESENT on the document.
- If lines 6a, 10, or 13 are NOT on the page, DO NOT include them in the JSON.
- Do NOT hallucinate fields that do not exist.

HEADER EXTRACTION (Mandatory):
The following keys MUST be present in "form_metadata" if found on the page (usually top header):
- "partner_name": Extract Partner's name (top left)
- "allocation_percentage": Extract numeric percentage (top right, e.g. "74.6268")
- "partner_ein_ssn": Extract Partner's ID number
- "tax_year": Extract the year (e.g. "2024")

FORM STRUCTURE:
Extract the parts as they appear.
Common fields for Schedule K-1 (Form 8804):
- Part I: Partnership info (1a-1d)
- Part II: Withholding Agent info (2a-2b)
- Part III: Tax Liability (Lines 1-6 usually, sometimes up to 10 depending on year).

JSON STRUCTURE:
Return a JSON object. Keys in "fields" should ONLY be included if the line exists on the form.

{
  "form_metadata": {
    "form_type": "Schedule K-1 (Form 8804)",
    "tax_year": "2024",
    "partner_name": "Name Here",
    "allocation_percentage": 74.6268,
    "partner_ein_ssn": "XXX-XX-XXXX",
    "partnership_name": "Partnership Name",
    "partnership_ein": "XXX-XX-XXXX"
  },
  "parts": [
    {
      "part_number": "I",
      "label": "Partnership",
      "fields": [
        { "code": "1a", "label": "Name of partnership", "value": "Name" },
        { "code": "1b", "label": "U.S. employer identification number (EIN)", "value": "ID" }
        // Add 1c, 1d if present
      ]
    },
    {
      "part_number": "II",
      "label": "Withholding Agent",
      "fields": [
        // Add 2a, 2b if present
      ]
    },
    {
      "part_number": "III",
      "label": "Section 1446 Tax Liability and Payments",
      "fields": [
        // DYNAMIC: Only include lines actually seen on the form.
        // Examples (DO NOT FORCE THESE IF NOT PRESENT):
        // { "code": "3a", "label": "Number of foreign partners", "value": 0 },
        // { "code": "4d", "label": "ECTI allocable...", "value": 0.00 },
        // { "code": "6", "label": "Total gross section 1446 tax liability", "value": 0.00 },
        // { "code": "6a", "label": "...", "value": 0.00 } <--- ONLY IF PRESENT
        // { "code": "10", "label": "...", "value": 0.00 } <--- ONLY IF PRESENT
        // { "code": "13", "label": "...", "value": 0.00 } <--- ONLY IF PRESENT
      ]
    }
  ]
}

EXTRACTION RULES:
1. **partner_name**: Look CAREFULLY at the top left header area.
2. **allocation_percentage**: Look CAREFULLY at the top right. Return as a NUMBER (e.g. 75.5), not string.
3. **Optional Fields**: Lines 6a, 10, 13, and others typically found on Form 8804 (Return) might NOT be on Schedule K-1. If they are missing, omit them from the JSON.
4. **Values**: Return 0.00 for empty monetary fields that ARE present. Omit fields that are NOT present.
5. **Negative Numbers**: Use negative float for values in parentheses.

Return ONLY valid JSON.
'''


