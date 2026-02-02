"""
Form 1099-INT Configuration
===========================
Configuration for 1099-INT (Interest Income) tax form extraction.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys from environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Model Configuration
GEMINI_MODEL = "gemini-2.5-flash"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# 1099-INT Extraction System Prompt - User's Exact JSON Format
INT_1099_SYSTEM_PROMPT = """You are an expert at extracting data from 1099-INT tax forms (Interest Income).

Analyze this 1099-INT form image and extract ALL data into the exact JSON format below.
CRITICAL: This may be a "Combined Statement" containing MULTIPLE 1099-INT forms for different accounts on the same page.
Look for multiple sections with different "Activity ID", "Account Number", or "Bond" descriptions.
Create a SEPARATE form object in the "forms" list for EACH distinct account/section.

ADDRESS SPELLING CRITICAL:
- Double check spelling of City names (e.g., "HORSHAM", not "HERSHAM").
- Verify state abbreviations (e.g., "PA").
- Use the Payer address from the top left for ALL forms if they are under the same Payer.

IDENTIFICATION FIELDS - VERY IMPORTANT LOCATION RULES:
- PAYER'S NAME AND ADDRESS: Look for the box labeled "PAYER'S name, street address, city or town, state or province, country, ZIP" in the TOP LEFT of the form. This is typically above the main form grid. Extract the COMPLETE name, street, city, state, ZIP from this specific labeled box.
- Payer's TIN: The number in the box labeled "PAYER'S TIN" (usually formatted like XX-XXXXXXX)
- Recipient's TIN: The number in the box labeled "RECIPIENT'S TIN" (may be masked as XXX-XX-XXXX)
- RECIPIENT'S NAME AND ADDRESS: Look for the box labeled "RECIPIENT'S name" and "Street address" - this is usually in the middle-left area. Extract the complete name and address.
- Account number: Look for box labeled "Account number"
- FATCA filing requirement: Look for a checkbox labeled "FATCA filing requirement" - return true if checked, false if not checked
- Payer's RTN (Routing Transit Number) if present
- Payer's telephone number (if present)

IMPORTANT: For Payer and Recipient fields, combine the name AND address into one value.
DO NOT confuse the payer address in the top-left with the recipient address in the middle area.
Example: "DISCOVER BANK\nPO BOX 30416\nSALT LAKE CITY, UT 84130"

FINANCIAL FIELDS (Boxes 1-14):
- Box 1: Interest income (main taxable interest)
- Box 2: Early withdrawal penalty
- Box 3: Interest on U.S. Savings Bonds and Treasury obligations
- Box 4: Federal income tax withheld
- Box 5: Investment expenses
- Box 6: Foreign tax paid
- Box 7: Foreign country or U.S. possession
- Box 8: Tax-exempt interest
- Box 9: Specified private activity bond interest
- Box 10: Market discount
- Box 11: Bond premium
- Box 12: Bond premium on Treasury obligations
- Box 13: Bond premium on tax-exempt bond
- Box 14: Tax-exempt and tax credit bond CUSIP no.

STATE INFORMATION (Boxes 15-17):
- Box 15: State abbreviation
- Box 16: State identification number
- Box 17: State tax withheld

CRITICAL RULES:
- Output ONLY valid JSON, no explanations
- Use null for missing string values
- Use 0.00 for missing numeric values
- Numbers should be numeric values (not strings)
- Keep original text exactly as shown on the form

Return EXACTLY this JSON structure:
[
  {
    "forms": [
      {
        "form_header": {
          "form_number": "1099-INT",
          "year": "2024",
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
              { "data": [{ "code": "Payer", "label": "Payer's name, address and telephone", "value": "" }] },
              { "data": [{ "code": "Payer TIN", "label": "Payer's TIN", "value": "" }] },
              { "data": [{ "code": "Payer Telephone", "label": "Payer's telephone number", "value": "" }] },
              { "data": [{ "code": "Recipient TIN", "label": "Recipient's TIN", "value": "" }] },
              { "data": [{ "code": "Recipient Name", "label": "Recipient's name and address", "value": "" }] },
              { "data": [{ "code": "Account No", "label": "Account number", "value": "" }] },
              { "data": [{ "code": "Payer RTN", "label": "Payer's RTN", "value": "" }] },
              { "data": [{ "code": "FATCA", "label": "FATCA filing requirement", "value": false }] }
            ]
          },
          {
            "financial_plane": [
              { "data": [{ "code": "1", "label": "Interest income", "value": 0.00 }] },
              { "data": [{ "code": "2", "label": "Early withdrawal penalty", "value": 0.00 }] },
              { "data": [{ "code": "3", "label": "Interest on U.S. Savings Bonds and Treasury obligations", "value": 0.00 }] },
              { "data": [{ "code": "4", "label": "Federal income tax withheld", "value": 0.00 }] },
              { "data": [{ "code": "5", "label": "Investment expenses", "value": 0.00 }] },
              { "data": [{ "code": "6", "label": "Foreign tax paid", "value": null }] },
              { "data": [{ "code": "7", "label": "Foreign country or U.S. possession", "value": null }] },
              { "data": [{ "code": "8", "label": "Tax-exempt interest", "value": null }] },
              { "data": [{ "code": "9", "label": "Specified private activity bond interest", "value": null }] },
              { "data": [{ "code": "10", "label": "Market discount", "value": null }] },
              { "data": [{ "code": "11", "label": "Bond premium", "value": null }] },
              { "data": [{ "code": "12", "label": "Bond premium on Treasury obligations", "value": null }] },
              { "data": [{ "code": "13", "label": "Bond premium on tax-exempt bond", "value": null }] },
              { "data": [{ "code": "14", "label": "Tax-exempt and tax credit bond CUSIP no.", "value": null }] }
            ]
          },
          {
            "state_local_plane": [
              { "data": [{ "code": "15", "label": "State", "value": null }] },
              { "data": [{ "code": "16", "label": "State identification no.", "value": null }] },
              { "data": [{ "code": "17", "label": "State tax withheld", "value": 0.00 }] }
            ]
          }
        ]
      }
    ]
  }
]

Extract ALL values from the 1099-INT form and place them in the correct fields."""

# 1099-INT Form detection patterns
INT_1099_DETECTION_PATTERNS = [
    "1099-INT",
    "1099INT",
    "Interest Income",
    "Form 1099-INT",
    "OMB No. 1545-0112",
    "Combined Statement For Form",
    "Combined Statement For Form 1099-INT"
]
