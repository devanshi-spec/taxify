"""
Form K-3 Configuration
======================
Configuration for Schedule K-3 (Form 1065) Partner's Share of International Tax Information.
Includes ALL 13 Parts of Schedule K-3.
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

# K-3 (Form 1065) Extraction System Prompt - ALL 13 PARTS
K3_1065_SYSTEM_PROMPT = """You are an expert at extracting data from Schedule K-3 (Form 1065) tax forms.

Schedule K-3 reports a partner's share of items of international tax relevance from a partnership.
This form can span multiple pages with up to 13 parts.

Analyze this K-3 form and extract ALL data from ALL parts visible. Extract every box value you can see.

PART I - PARTNER'S SHARE OF PARTNERSHIP'S OTHER CURRENT YEAR INTERNATIONAL INFORMATION:
- Line 1: Gain on personal property sale
- Line 2: Foreign oil and gas taxes
- Line 3: Splitter arrangements
- Line 4: Foreign tax credit splitting events
- Line 5: High-taxed income
- Line 6: Section 267A disallowed deduction
- Line 7: Form 5471 information
- Line 8: Form 8865 information

PART II - FOREIGN TAX CREDIT LIMITATION:
Section 1: Gross Income (Lines 1-24)
- Lines 1a-1g: Section 951(a)(1)(A) income by category
- Lines 2a-2g: Section 951(a)(1)(B) income
- Lines 3a-3g: Section 951(a)(1)(C) income
- Lines 4a-4g: Section 951A income
- Lines 5a-5g: Dividends
- Lines 24a-24g: Total gross income by category

Section 2: Deductions and Losses (Lines 25-54)
- Lines for interest expense, R&E, other deductions

Section 3: Net Foreign Source Income (Lines 55a-55g)

PART III - OTHER INFORMATION FOR FORM 1116 OR 1118:
- Line 1: R&E expenses apportionment
- Line 2: Foreign taxes paid
- Line 3: Foreign taxes accrued
- Line 4: Reduction of foreign taxes
- Line 5: Gross receipts for section 250

PART IV - INFORMATION ON PARTNER'S SECTION 250 DEDUCTION:
- Line 1: FDII deduction
- Line 2: GILTI deduction

PART V - DISTRIBUTIONS FROM FOREIGN CORPORATIONS:
- Line 1a-1e: Previously taxed earnings and profits (PTEP)

PART VI - INFORMATION ON PARTNER'S SECTION 951(a)(1) AND 951A INCLUSIONS:

PART VII - INFORMATION TO COMPLETE FORM 8621:
- PFIC information

PART VIII - PARTNER'S INTEREST IN FOREIGN CORPORATION INCOME:

PART IX - INFORMATION TO COMPLETE FORM 8991 (BEAT):
- Line 1: Base erosion payments
- Line 2: Base erosion tax benefits

PART X - PARTNER'S SECTION 951(a)(1) AND 951A LIABILITY:

PART XI - SECTION 871(m) COVERED PARTNERSHIPS:

PART XII - PARTNER'S EFFECTIVELY CONNECTED INCOME:

PART XIII - PARTNER'S DISTRIBUTIVE SHARE OF DEEMED SALE ITEMS:

CRITICAL RULES:
- Output ONLY valid JSON, no explanations
- Use null for missing string values
- Use 0.00 for missing numeric values
- Numbers should be numeric values (not strings)
- Extract ALL boxes visible on the page(s)
- Include page reference for each part

Return EXACTLY this JSON structure:
[
  {
    "document_metadata": {
      "form_type": "Schedule K-3 (Form 1065)",
      "tax_year": "2024",
      "partnership_name": "",
      "partnership_ein": ""
    },
    "partner_records": [
      {
        "partner_name": "",
        "page_reference": 1,
        "part_i_other_international": [
          { "data": [{ "code": "1", "label": "Gain on personal property sale", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Foreign oil and gas taxes", "value": 0.00 }] },
          { "data": [{ "code": "3", "label": "Splitter arrangements", "value": false }] },
          { "data": [{ "code": "4", "label": "Foreign tax credit splitting events", "value": false }] },
          { "data": [{ "code": "5", "label": "High-taxed income", "value": 0.00 }] },
          { "data": [{ "code": "6", "label": "Section 267A disallowed deduction", "value": 0.00 }] },
          { "data": [{ "code": "7", "label": "Form 5471 information", "value": false }] },
          { "data": [{ "code": "8", "label": "Form 8865 information", "value": false }] }
        ],
        "part_ii_foreign_tax_credit": [
          { "data": [{ "code": "1a", "label": "Section 951(a)(1)(A) - Passive", "value": 0.00 }] },
          { "data": [{ "code": "1b", "label": "Section 951(a)(1)(A) - General", "value": 0.00 }] },
          { "data": [{ "code": "1c", "label": "Section 951(a)(1)(A) - Section 901(j)", "value": 0.00 }] },
          { "data": [{ "code": "1d", "label": "Section 951(a)(1)(A) - Foreign Branch", "value": 0.00 }] },
          { "data": [{ "code": "1e", "label": "Section 951(a)(1)(A) - Treaty", "value": 0.00 }] },
          { "data": [{ "code": "2a", "label": "Section 951(a)(1)(B) - Passive", "value": 0.00 }] },
          { "data": [{ "code": "2b", "label": "Section 951(a)(1)(B) - General", "value": 0.00 }] },
          { "data": [{ "code": "3a", "label": "Section 951(a)(1)(C) - Passive", "value": 0.00 }] },
          { "data": [{ "code": "3b", "label": "Section 951(a)(1)(C) - General", "value": 0.00 }] },
          { "data": [{ "code": "4a", "label": "Section 951A - Passive", "value": 0.00 }] },
          { "data": [{ "code": "4b", "label": "Section 951A - General", "value": 0.00 }] },
          { "data": [{ "code": "5a", "label": "Dividends - Passive", "value": 0.00 }] },
          { "data": [{ "code": "5b", "label": "Dividends - General", "value": 0.00 }] },
          { "data": [{ "code": "24a", "label": "Total gross income - Passive", "value": 0.00 }] },
          { "data": [{ "code": "24b", "label": "Total gross income - General", "value": 0.00 }] },
          { "data": [{ "code": "24c", "label": "Total gross income - Section 901(j)", "value": 0.00 }] },
          { "data": [{ "code": "24d", "label": "Total gross income - Foreign Branch", "value": 0.00 }] },
          { "data": [{ "code": "24e", "label": "Total gross income - Treaty", "value": 0.00 }] },
          { "data": [{ "code": "24f", "label": "Total gross income - US Source", "value": 0.00 }] },
          { "data": [{ "code": "24g", "label": "Total gross income - Total", "value": 0.00 }] },
          { "data": [{ "code": "55a", "label": "Net income (loss) - Passive", "value": 0.00 }] },
          { "data": [{ "code": "55b", "label": "Net income (loss) - General", "value": 0.00 }] },
          { "data": [{ "code": "55c", "label": "Net income (loss) - Section 901(j)", "value": 0.00 }] },
          { "data": [{ "code": "55d", "label": "Net income (loss) - Foreign Branch", "value": 0.00 }] },
          { "data": [{ "code": "55e", "label": "Net income (loss) - Treaty", "value": 0.00 }] },
          { "data": [{ "code": "55f", "label": "Net income (loss) - US Source", "value": 0.00 }] },
          { "data": [{ "code": "55g", "label": "Net income (loss) - Total", "value": 0.00 }] }
        ],
        "part_iii_form_1116_1118": [
          { "data": [{ "code": "1", "label": "R&E expenses apportionment", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Foreign taxes paid", "value": 0.00 }] },
          { "data": [{ "code": "3", "label": "Foreign taxes accrued", "value": 0.00 }] },
          { "data": [{ "code": "4", "label": "Reduction of foreign taxes", "value": 0.00 }] },
          { "data": [{ "code": "5", "label": "Gross receipts for section 250", "value": 0.00 }] }
        ],
        "part_iv_section_250": [
          { "data": [{ "code": "1", "label": "FDII deduction", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "GILTI deduction", "value": 0.00 }] }
        ],
        "part_v_distributions": [
          { "data": [{ "code": "1a", "label": "PTEP - Section 959(c)(1)(A)", "value": 0.00 }] },
          { "data": [{ "code": "1b", "label": "PTEP - Section 959(c)(1)(B)", "value": 0.00 }] },
          { "data": [{ "code": "1c", "label": "PTEP - Section 959(c)(2)", "value": 0.00 }] }
        ],
        "part_vi_inclusions": [
          { "data": [{ "code": "1", "label": "Section 951(a)(1) inclusions", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Section 951A inclusions", "value": 0.00 }] }
        ],
        "part_vii_form_8621": [
          { "data": [{ "code": "1", "label": "PFIC name", "value": "" }] },
          { "data": [{ "code": "2", "label": "PFIC EIN", "value": "" }] },
          { "data": [{ "code": "3", "label": "PFIC distribution", "value": 0.00 }] }
        ],
        "part_viii_foreign_corp_income": [
          { "data": [{ "code": "1", "label": "Partner's share of CFC income", "value": 0.00 }] }
        ],
        "part_ix_form_8991_beat": [
          { "data": [{ "code": "1", "label": "Base erosion payments", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Base erosion tax benefits", "value": 0.00 }] }
        ],
        "part_x_tax_liability": [
          { "data": [{ "code": "1", "label": "Section 951(a)(1) tax liability", "value": 0.00 }] },
          { "data": [{ "code": "2", "label": "Section 951A tax liability", "value": 0.00 }] }
        ],
        "part_xi_section_871m": [
          { "data": [{ "code": "1", "label": "Section 871(m) amount", "value": 0.00 }] }
        ],
        "part_xii_eci": [
          { "data": [{ "code": "1", "label": "Effectively connected income", "value": 0.00 }] }
        ],
        "part_xiii_deemed_sale": [
          { "data": [{ "code": "1", "label": "Deemed sale gain", "value": 0.00 }] }
        ]
      }
    ]
  }
]

Extract ALL values from every K-3 page for ALL partners and place them in the correct fields."""

# K-3 Form detection patterns
K3_DETECTION_PATTERNS = [
    "Schedule K-3",
    "K-3",
    "(Form 1065)",
    "Partner's Share of Income",
    "International",
    "Foreign Tax Credit",
    "OMB No. 1545-0123"
]
