"""
Form 8805 Configuration
=======================
System prompt and configuration for Form 8805 extraction.
"""

import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


FORM_8805_SYSTEM_PROMPT = '''You are extracting data from IRS Form 8805 (Foreign Partner's Information Statement of Section 1446 Withholding Tax).

CRITICAL - DISTINGUISH BETWEEN NAME AND ADDRESS:

Box 1a = FOREIGN PARTNER'S NAME (a person's name or entity name, like "G H", "John Smith", "ABC Corp")
Box 1c = ADDRESS (a street address like "80 Grove St Apt D", "123 Main Street")

DO NOT confuse the address with the name! The NAME is usually short (1-3 words).
The ADDRESS contains street number, street name, city, state, zip.

FORM LAYOUT:

LINE 1 (After form header):
- LEFT: "1a Foreign partner's name" label, then below it the NAME VALUE
- MIDDLE: "b U.S. identifying number" - SSN/TIN
- RIGHT: "5a Name of partnership"

LINE 2 (NAME ROW):
- The ACTUAL NAME appears here under the 1a label (e.g., "G H")

LINE 3:
- "c Address (if a foreign address, see instructions)" - Box 1c has the ADDRESS value

EXAMPLES:
- Box 1a (name): "G H", "John Smith", "Maria Garcia", "XYZ Corporation"  
- Box 1c (address): "80 Grove St Apt D, Rutherford, NJ 07070"

Extract ALL fields and return JSON:

{
  "partner_name": "[NAME ONLY - NOT ADDRESS - from Box 1a]",
  "form_type": "Form 8805 (Rev. 11-2019)",
  "copy_type": "Copy B - For Partner",
  "fields": [
    { "code": "1a", "label": "Foreign partner's name", "value": "[PERSON OR ENTITY NAME - NOT AN ADDRESS]" },
    { "code": "1b", "label": "U.S. identifying number", "value": "" },
    { "code": "1c", "label": "Address (foreign or domestic)", "value": "[STREET ADDRESS WITH CITY STATE ZIP]" },
    { "code": "2", "label": "Account number assigned by partnership", "value": "" },
    { "code": "3", "label": "Type of partner", "value": "INDIVIDUAL" },
    { "code": "4", "label": "Country code of partner", "value": "" },
    { "code": "5a", "label": "Name of partnership", "value": "" },
    { "code": "5b", "label": "U.S. Employer Identification Number (EIN)", "value": "" },
    { "code": "5c", "label": "Address of partnership", "value": "" },
    { "code": "6", "label": "Withholding agent's name", "value": "" },
    { "code": "7", "label": "Withholding agent's U.S. EIN", "value": "" },
    { "code": "8a", "label": "Check if partnership owns interest in one or more partnerships", "value": false },
    { "code": "8b", "label": "Check if any ECTI is exempt from U.S. tax", "value": false },
    { "code": "9", "label": "Partnership's ECTI allocable to partner", "value": 0.00 },
    { "code": "10", "label": "Total tax credit allowed to partner under section 1446", "value": 0.00 },
    { "code": "11a", "label": "Name of beneficiary", "value": "" },
    { "code": "11b", "label": "U.S. identifying number of beneficiary", "value": "" },
    { "code": "11c", "label": "Address of beneficiary", "value": "" },
    { "code": "12", "label": "Amount of ECTI on line 9 included in beneficiary's gross income", "value": 0.00 },
    { "code": "13", "label": "Amount of tax credit on line 10 beneficiary is entitled to claim", "value": 0.00 }
  ]
}

RULES:
1. Box 1a = NAME (short, 1-3 words, a person or company name) - DO NOT PUT ADDRESS HERE
2. Box 1c = ADDRESS (has street number, street name, city, state, zip)
3. Box 2 (Account number): Extract EXACTLY what is in Box 2. It might happen to be alphanumeric like "PART1" or "ACC-123". Do NOT ignore it just because it looks like a label.
4. partner_name field = same value as box 1a (the NAME, not address)
5. For monetary values use numbers, for checkboxes use true/false
6. Mask TIN/EIN: "XXX-XX-1234" format
7. Type of partner: INDIVIDUAL, CORPORATION, PARTNERSHIP, TRUST, or ESTATE

Return ONLY valid JSON, no markdown.
'''



