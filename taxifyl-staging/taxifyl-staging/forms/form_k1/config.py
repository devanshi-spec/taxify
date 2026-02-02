"""
Form K-1 Configuration
======================
Configuration for Schedule K-1 (Form 1065) Partner's Share of Income extraction.
Supports multiple partners with comprehensive Part I, II, III data.
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

# K-1 (Form 1065) Extraction System Prompt - Final Comprehensive Structure
K1_1065_SYSTEM_PROMPT = """You are an expert at extracting data from Schedule K-1 (Form 1065) tax forms.

Analyze this K-1 form and extract ALL data. If there are MULTIPLE partners in the document, include each partner's data separately in the partner_records array.

PART I - PARTNERSHIP INFORMATION (Boxes A-D):
- Box A: Partnership's employer identification number (EIN)
- Box B: Partnership's name, address, city, state, and ZIP code
- Box C: IRS center where partnership filed return
- Box D: Check if publicly traded partnership (PTP)

PART II - PARTNER INFORMATION (Boxes E-N):
- Box E: Partner's SSN or TIN
- Box F: Partner's name, address, city, state, and ZIP code
- Box G: General partner or LLC member-manager (checkbox)
- Box H1: Domestic partner (checkbox)
- Box H2: Foreign partner (checkbox)
- Box I1: Type of entity (Individual, Corporation, Estate, Trust, etc.)
- Box I2: If entity, country of organization
- Box J: Partner's share of profit, loss, and capital (Beginning/Ending percentages)
  - J_Profit_Beg, J_Profit_End, J_Loss_Beg, J_Loss_End, J_Capital_Beg, J_Capital_End
- Box K: Partner's share of liabilities
  - K1_Nonrecourse_Beg, K1_Nonrecourse_End
  - K1_Qualified_Beg, K1_Qualified_End (Qualified nonrecourse financing)
  - K1_Recourse_Beg, K1_Recourse_End
  - K2 (Check if decrease due to sale)
- Box L: Partner's capital account analysis
  - L_Beg_Capital, L_Capital_Contributed, L_Net_Income, L_Other, L_Withdrawals, L_Ending_Capital
- Box M: Did the partner contribute property with a built-in gain (loss)?
- Box N: Net unrecognized Section 704(c) gain or loss (Beginning/Ending)
  - N_Beg, N_End

PART III - PARTNER'S SHARE OF CURRENT YEAR INCOME, DEDUCTIONS, CREDITS (Boxes 1-23):
- Box 1: Ordinary business income (loss)
- Box 2: Net rental real estate income (loss)
- Box 3: Other net rental income (loss)
- Box 4a: Guaranteed payments for services
- Box 4b: Guaranteed payments for capital
- Box 4c: Total guaranteed payments
- Box 5: Interest income
- Box 6a: Ordinary dividends
- Box 6b: Qualified dividends
- Box 6c: Dividend equivalents
- Box 7: Royalties
- Box 8: Net short-term capital gain (loss)
- Box 9a: Net long-term capital gain (loss)
- Box 9b: Collectibles (28%) gain (loss)
- Box 9c: Unrecaptured section 1250 gain
- Box 10: Net section 1231 gain (loss)
- Box 11: Other income (loss) - array with codes
- Box 12: Section 179 deduction
- Box 13: Other deductions - array with codes (A-W, especially L for portfolio)
- Box 14: Self-employment earnings (loss) - array with codes
- Box 15: Credits - array with codes
- Box 16: Schedule K-3 attached (checkbox)
- Box 17: Alternative minimum tax (AMT) items - array
- Box 18: Tax-exempt income and nondeductible expenses - array
- Box 19: Distributions - array
- Box 20: Other information - array with codes
- Box 21: Foreign taxes paid or accrued
- Box 22: More than one activity for at-risk purposes (checkbox)
- Box 23: More than one activity for passive activity purposes (checkbox)

CRITICAL RULES:
- Output ONLY valid JSON, no explanations
- Use null for missing string values
- Use 0.00 for missing numeric values (income/loss can be NEGATIVE)
- Numbers should be numeric values (not strings)
- Keep original text exactly as shown on the form
- Include ALL partners found in the document in partner_records array
- For boxes with multiple entries (11, 13, 14, 15, 17, 18, 19, 20), use array format: [{ "code": "A", "amount": 123.00 }]

Return EXACTLY this JSON structure:
[
  {
    "document_metadata": {
      "form_type": "Schedule K-1 (Form 1065)",
      "tax_year": "2024",
      "partnership_name": "",
      "partnership_ein": "XXX-XX-XXXX"
    },
    "partner_records": [
      {
        "partner_name": "",
        "page_reference": 1,
        "part_i_partnership_plane": [
          { "data": [{ "code": "A", "label": "Partnership EIN", "value": "" }] },
          { "data": [{ "code": "B", "label": "Partnership Name/Address", "value": "" }] },
          { "data": [{ "code": "C", "label": "IRS Center", "value": "" }] },
          { "data": [{ "code": "D", "label": "PTP Check", "value": false }] }
        ],
        "part_ii_partner_plane": [
          { "data": [{ "code": "E", "label": "Partner's SSN or TIN", "value": "" }] },
          { "data": [{ "code": "F", "label": "Partner's Name/Address", "value": "" }] },
          { "data": [{ "code": "G", "label": "General partner or LLC member-manager", "value": false }] },
          { "data": [{ "code": "H1", "label": "Domestic partner", "value": false }] },
          { "data": [{ "code": "H2", "label": "Foreign partner", "value": false }] },
          { "data": [{ "code": "I1", "label": "Entity Type", "value": "" }] },
          { "data": [{ "code": "J_Profit_Beg", "label": "Profit Share % (Beginning)", "value": 0.00 }] },
          { "data": [{ "code": "J_Profit_End", "label": "Profit Share % (Ending)", "value": 0.00 }] },
          { "data": [{ "code": "K1_Nonrecourse_End", "label": "Nonrecourse (End)", "value": 0.00 }] },
          { "data": [{ "code": "K1_Qualified_End", "label": "Qualified Nonrecourse Financing (End)", "value": 0.00 }] },
          { "data": [{ "code": "K1_Recourse_End", "label": "Recourse (End)", "value": 0.00 }] },
          { "data": [{ "code": "L_Beg_Capital", "label": "Beginning capital account", "value": 0.00 }] },
          { "data": [{ "code": "L_Capital_Contributed", "label": "Capital contributed during year", "value": 0.00 }] },
          { "data": [{ "code": "L_Net_Income", "label": "Current year net income (loss)", "value": 0.00 }] },
          { "data": [{ "code": "L_Other", "label": "Other increase (decrease)", "value": 0.00 }] },
          { "data": [{ "code": "L_Withdrawals", "label": "Withdrawals & distributions", "value": 0.00 }] },
          { "data": [{ "code": "L_Ending_Capital", "label": "Ending capital account", "value": 0.00 }] },
          { "data": [{ "code": "M", "label": "Did the partner contribute property with a built-in gain (loss)?", "value": false }] },
          { "data": [{ "code": "N_Beg", "label": "Net unrecognized Section 704(c) gain or loss (Beginning)", "value": 0.00 }] },
          { "data": [{ "code": "N_End", "label": "Net unrecognized Section 704(c) gain or loss (Ending)", "value": 0.00 }] }
        ],
        "part_iii_income_loss_plane": [
          { "data": [{ "code": "1", "label": "Ordinary business income (loss)", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Net rental real estate income (loss)", "value": 0.00 }] },
          { "data": [{ "code": "3", "label": "Other net rental income (loss)", "value": 0.00 }] },
          { "data": [{ "code": "4a", "label": "Guaranteed payments for services", "value": 0.00 }] },
          { "data": [{ "code": "4b", "label": "Guaranteed payments for capital", "value": 0.00 }] },
          { "data": [{ "code": "4c", "label": "Total guaranteed payments", "value": 0.00 }] },
          { "data": [{ "code": "5", "label": "Interest income", "value": 0.00 }] },
          { "data": [{ "code": "6a", "label": "Ordinary dividends", "value": 0.00 }] },
          { "data": [{ "code": "6b", "label": "Qualified dividends", "value": 0.00 }] },
          { "data": [{ "code": "6c", "label": "Dividend equivalents", "value": 0.00 }] },
          { "data": [{ "code": "7", "label": "Royalties", "value": 0.00 }] },
          { "data": [{ "code": "8", "label": "Net short-term capital gain (loss)", "value": 0.00 }] },
          { "data": [{ "code": "9a", "label": "Net long-term capital gain (loss)", "value": 0.00 }] },
          { "data": [{ "code": "9b", "label": "Collectibles (28%) gain (loss)", "value": 0.00 }] },
          { "data": [{ "code": "9c", "label": "Unrecaptured section 1250 gain", "value": 0.00 }] },
          { "data": [{ "code": "10", "label": "Net section 1231 gain (loss)", "value": 0.00 }] },
          { "data": [{ "code": "11", "label": "Other income (loss)", "value": [] }] },
          { "data": [{ "code": "12", "label": "Section 179 deduction", "value": 0.00 }] },
          { "data": [{ "code": "13", "label": "Other deductions", "value": [] }] },
          { "data": [{ "code": "14", "label": "Self-employment earnings (loss)", "value": [] }] },
          { "data": [{ "code": "15", "label": "Credits", "value": [] }] },
          { "data": [{ "code": "16", "label": "Schedule K-3 attached check", "value": false }] },
          { "data": [{ "code": "17", "label": "Alternative minimum tax (AMT) items", "value": [] }] },
          { "data": [{ "code": "18", "label": "Tax-exempt income and nondeductible expenses", "value": [] }] },
          { "data": [{ "code": "19", "label": "Distributions", "value": [] }] },
          { "data": [{ "code": "20", "label": "Other information", "value": [] }] },
          { "data": [{ "code": "21", "label": "Foreign taxes paid or accrued", "value": 0.00 }] },
          { "data": [{ "code": "22", "label": "More than one activity for at-risk purposes", "value": false }] },
          { "data": [{ "code": "23", "label": "More than one activity for passive activity purposes", "value": false }] }
        ]
      }
    ]
  }
]

Extract ALL values from the K-1 form for ALL partners and place them in the correct fields."""

# K-1 Form detection patterns
K1_DETECTION_PATTERNS = [
    "K-1",
    "K1",
    "Schedule K-1",
    "Form 1065",
    "1065",
    "Partner's Share",
    "Partners Share",
    "OMB No. 1545-0123"
]
