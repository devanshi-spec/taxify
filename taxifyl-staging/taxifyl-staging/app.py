"""
US Tax Form Extractor - Unified App
====================================
Auto-detects form types and extracts data in exact plane-based JSON format.
"""

import streamlit as st
import json
import os
import sys
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

# Import multi-page K-1 processor
try:
    from forms.form_k1.extractor import MultiPageK1Processor
    MULTIPAGE_K1_AVAILABLE = True
except ImportError:
    MULTIPAGE_K1_AVAILABLE = False
    MultiPageK1Processor = None

# Import multi-page K-3 processor
try:
    from forms.form_k3.extractor import MultiPageK3Processor
    MULTIPAGE_K3_AVAILABLE = True
except ImportError:
    MULTIPAGE_K3_AVAILABLE = False
    MultiPageK3Processor = None

# Import multi-page Form 8805 processor
try:
    from forms.form_8805.extractor import MultiPage8805Processor
    MULTIPAGE_8805_AVAILABLE = True
except ImportError:
    MULTIPAGE_8805_AVAILABLE = False
    MultiPage8805Processor = None

# Import multi-page Form 8804 processor
try:
    from forms.form_8804.extractor import MultiPage8804Processor
    MULTIPAGE_8804_AVAILABLE = True
except ImportError:
    MULTIPAGE_8804_AVAILABLE = False
    MultiPage8804Processor = None

try:
    import fitz
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


# =============================================================================
# Page Configuration
# =============================================================================
st.set_page_config(
    page_title="US Tax Form Extractor",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =============================================================================
# Custom CSS
# =============================================================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Inter', sans-serif; }
    
    .stApp { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); }
    
    .main-header {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        text-align: center;
    }
    .main-header h1 {
        background: linear-gradient(135deg, #818cf8, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0;
    }
    .main-header p { color: #94a3b8; font-size: 0.95rem; margin: 0.3rem 0 0 0; }
    
    .form-detected {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 10px;
        padding: 0.75rem 1rem;
        margin: 0.75rem 0;
    }
    .form-unknown {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 10px;
        padding: 0.75rem 1rem;
        margin: 0.75rem 0;
    }
    
    /* Section Header - matching original app */
    .section-header {
        color: #e2e8f0;
        font-size: 1.25rem;
        font-weight: 600;
        margin: 1.5rem 0 1rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Info Field - Label + Value */
    .info-field { margin-bottom: 0.75rem; }
    .info-label {
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
    }
    .info-value { font-size: 1rem; font-weight: 500; color: #e2e8f0; }
    
    /* Box Card - Main styling like original app */
    .box-card {
        background: rgba(30, 41, 59, 0.8);
        padding: 1rem 1.25rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        margin-bottom: 0.75rem;
        transition: all 0.2s ease;
    }
    .box-card:hover {
        border-color: rgba(99, 102, 241, 0.3);
        background: rgba(30, 41, 59, 0.9);
    }
    .box-label {
        font-size: 0.7rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.35rem;
    }
    .box-value {
        font-size: 1.4rem;
        font-weight: 700;
        color: #e2e8f0;
    }
    .box-value-money { color: #4ade80 !important; }
    .box-value-small { font-size: 1rem; font-weight: 500; }
    
    /* Form Info Header */
    .form-info-header {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
    }
    .form-info-title { color: #a78bfa; font-weight: 600; font-size: 1.1rem; margin-bottom: 1rem; }
    
    /* Subsection Title */
    .subsection-title { color: #e2e8f0; font-weight: 600; font-size: 1rem; margin-bottom: 0.75rem; }
    
    /* Metrics */
    .metric-box {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 0.6rem;
        text-align: center;
    }
    .metric-value { font-size: 1.1rem; font-weight: 700; color: #818cf8; }
    .metric-label { font-size: 0.7rem; color: #94a3b8; }
    
    /* Logs */
    .log-item {
        background: rgba(15, 23, 42, 0.5);
        border-left: 3px solid #22c55e;
        padding: 0.4rem 0.6rem;
        margin-bottom: 0.3rem;
        border-radius: 0 6px 6px 0;
        font-size: 0.75rem;
        color: #94a3b8;
    }
    .log-item-error { border-left-color: #ef4444; }
    
    /* Scrollable Review Container */
    .review-scroll-container {
        max-height: 500px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 0.5rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(139, 92, 246, 0.5) rgba(30, 41, 59, 0.3);
    }
    .review-scroll-container::-webkit-scrollbar {
        width: 8px;
    }
    .review-scroll-container::-webkit-scrollbar-track {
        background: rgba(30, 41, 59, 0.3);
        border-radius: 4px;
    }
    .review-scroll-container::-webkit-scrollbar-thumb {
        background: rgba(139, 92, 246, 0.5);
        border-radius: 4px;
    }
    .review-scroll-container::-webkit-scrollbar-thumb:hover {
        background: rgba(139, 92, 246, 0.7);
    }
</style>
""", unsafe_allow_html=True)


# =============================================================================
# Supported Forms
# =============================================================================
SUPPORTED_FORMS = {
    "W-2": {"name": "Wage and Tax Statement", "patterns": ["W-2", "W2", "Wage and Tax Statement", "Form W-2"], "icon": "📄"},
    "1099-INT": {"name": "Interest Income", "patterns": ["1099-INT", "1099INT", "Interest Income", "Combined Statement For Form 1099-INT", "Combined Statement For Form"], "icon": "💰"},
    "1099-NEC": {"name": "Nonemployee Compensation", "patterns": ["1099-NEC", "1099NEC"], "icon": "💼"},
    "1099-MISC": {"name": "Miscellaneous Income", "patterns": ["1099-MISC", "1099MISC"], "icon": "📋"},
    "1099-R": {"name": "Distributions From Pensions", "patterns": ["1099-R", "1099R"], "icon": "🏦"},
    "1099-K": {"name": "Payment Card Transactions", "patterns": ["1099-K", "1099K"], "icon": "💳"},
    "1098": {"name": "Mortgage Interest Statement", "patterns": ["1098", "Mortgage Interest"], "icon": "🏠"},
    "K-1": {"name": "Partner's Share of Income", "patterns": ["K-1", "K1", "Schedule K-1", "1065", "Partner's Share"], "icon": "📊"},
    "K-3": {"name": "Partner's Share - International", "patterns": ["K-3", "K3", "Schedule K-3", "International", "Foreign Tax Credit"], "icon": "🌐"},
    "8805": {"name": "Foreign Partner's Information", "patterns": ["8805", "Form 8805", "Section 1446", "Foreign Partner"], "icon": "🌍"},
    "8804": {"name": "Partnership Withholding Tax", "patterns": ["8804", "Form 8804", "Annual Return for Partnership Withholding"], "icon": "📑"}
}



# =============================================================================
# W-2 Prompt - SIMPLE extraction (AI extracts freely, we transform after)
# =============================================================================
W2_PROMPT = '''Extract all data from this W-2 tax form. This form may show multiple copies (Copy A, B, C, D) - extract from any ONE complete copy.

IMPORTANT BOX DEFINITIONS (read values carefully from the correct labeled boxes):

FEDERAL SECTION (Boxes 1-6):
- Box 1: Wages, tips, other compensation (total taxable wages)
- Box 2: Federal income tax withheld  
- Box 3: Social security wages (OFTEN DIFFERENT from Box 1 due to wage cap ~$168,600)
- Box 4: Social security tax withheld
- Box 5: Medicare wages and tips (often equals or EXCEEDS Box 1, no wage cap)
- Box 6: Medicare tax withheld

STATE/LOCAL SECTION (Boxes 15-20) - READ CAREFULLY:
- Box 15: State abbreviation (e.g., "CA", "NY") AND Employer's state ID number
- Box 16: STATE WAGES - This is the LARGER number (total wages subject to state tax, often same as Box 1)
- Box 17: STATE INCOME TAX WITHHELD - This is the SMALLER number (actual tax withheld)
- Box 18: Local wages, tips, etc.
- Box 19: Local income tax withheld
- Box 20: Locality name

NOTE: Box 16 (state wages) is usually a LARGE number similar to Box 1.
Box 17 (state tax) is usually a SMALLER number (the tax amount withheld).
Do NOT confuse these - they are in separate columns on the form.

BOX 13 CHECKBOXES - CRITICAL:
Box 13 has 3 separate small checkboxes. Look CAREFULLY for an "X" or checkmark in each:
- Statutory employee
- Retirement plan
- Third-party sick pay
Return "true" ONLY if that specific box has a visible mark. Return "false" otherwise.

Return as JSON with these fields:

{
  "year": "2024",
  "employee_ssn": "XXX-XX-XXXX",
  "employer_ein": "XX-XXXXXXX",
  "employer_name": "",
  "employer_address": "",
  "control_number": "",
  "dept": "",
  "employee_name": "",
  "employee_address": "",
  "box_1": 0.00,
  "box_2": 0.00,
  "box_3": 0.00,
  "box_4": 0.00,
  "box_5": 0.00,
  "box_6": 0.00,
  "box_7": 0.00,
  "box_8": 0.00,
  "box_9": "",
  "box_10": 0.00,
  "box_11": 0.00,
  "box_12a_code": "",
  "box_12a_amount": 0.00,
  "box_12b_code": "",
  "box_12b_amount": 0.00,
  "box_12c_code": "",
  "box_12c_amount": 0.00,
  "box_12d_code": "",
  "box_12d_amount": 0.00,
  "box_13_statutory_employee": false,
  "box_13_retirement_plan": false,
  "box_13_third_party_sick_pay": false,
  "box_14_other": "",
  "box_15_state": "",
  "box_15_state_id": "",
  "box_16": 0.00,
  "box_17": 0.00,
  "box_18": 0.00,
  "box_19": 0.00,
  "box_20": "",
  "box_15b_state": "",
  "box_15b_state_id": "",
  "box_16b": 0.00,
  "box_17b": 0.00,
  "box_18b": 0.00,
  "box_19b": 0.00,
  "box_20b": "",
  "employer_use_only": "",
  "other_data": ""
}

CRITICAL: Read each box individually from its labeled position on the form. 
- Box 1, Box 3, and Box 5 are often DIFFERENT values.
- Box 16 (state wages) and Box 17 (state tax) are DIFFERENT - wages is larger, tax is smaller.
Output only JSON.'''


def transform_to_w2_structure(raw_data):
    """
    Transform any AI-extracted data into our EXACT hardcoded W-2 JSON structure.
    This guarantees 100% consistent output regardless of AI format.
    """
    # Handle list or dict input
    if isinstance(raw_data, list) and len(raw_data) > 0:
        raw_data = raw_data[0]
    
    # If already has error, return as-is
    if isinstance(raw_data, dict) and "error" in raw_data:
        return raw_data
    
    # Flatten nested structures to find values
    flat = flatten_dict(raw_data) if isinstance(raw_data, dict) else {}
    
    # Helper to find value by multiple possible keys
    def find_value(keys, default=None):
        for key in keys:
            key_lower = key.lower()
            for k, v in flat.items():
                if key_lower in k.lower():
                    if v is not None and v != "" and v != "N/A":
                        return v
        return default
    
    def find_number(keys, default=0.00):
        val = find_value(keys, default)
        if val is None:
            return 0.00
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            # Remove $ and commas
            val = val.replace("$", "").replace(",", "").strip()
            try:
                return float(val)
            except:
                return 0.00
        return 0.00
    
    def find_bool(keys, default=False):
        val = find_value(keys, default)
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() in ["true", "yes", "1", "x", "checked"]
        return default
    
    def find_combined_value(name_keys, address_keys, default="", separator="\n"):
        """Combine two field values into a single value with a configurable separator."""
        name = find_value(name_keys, "")
        address = find_value(address_keys, "")
        
        # Clean up values
        if isinstance(name, str):
            name = name.strip()
        else:
            name = str(name) if name else ""
        
        if isinstance(address, str):
            address = address.strip()
        else:
            address = str(address) if address else ""
        
        # Combine name and address
        if name and address:
            return f"{name}{separator}{address}"
        elif name:
            return name
        elif address:
            return address
        else:
            return default
    
    # Build the EXACT hardcoded structure
    result = [
        {
            "forms": [
                {
                    "form_header": {
                        "form_number": "W-2",
                        "year": str(find_value(["year", "tax_year", "form_year"], "2024")),
                        "type": "Wage and Tax Statement",
                        "text_array": [
                            "Employee Reference",
                            find_value(["copy", "copy_type"], "Copy C for employee's records"),
                            "OMB No. 1545-0008"
                        ]
                    },
                    "boxes": [
                        {
                            "identification_plane": [
                                {"data": [{"code": "a", "label": "Employee's SSA number", "value": find_value(["ssn", "ssa", "employee_ssn", "social_security", "box_a"], "")}]},
                                {"data": [{"code": "b", "label": "Employer's FED ID number", "value": find_value(["ein", "fed_id", "employer_ein", "employer_fed", "box_b"], "")}]},
                                {"data": [{"code": "c", "label": "Employer's name and address", "value": find_combined_value(["employer_name"], ["employer_address", "employer_street", "employer_city"], "")}]},
                                {"data": [{"code": "d", "label": "Control number", "value": find_value(["control", "control_number", "box_d"], "")}]},
                                {"data": [{"code": "dept", "label": "Department", "value": find_value(["dept", "department", "dept_code"], "")}]},
                                {"data": [{"code": "e/f", "label": "Employee's name and address", "value": find_combined_value(["employee_name"], ["employee_address", "employee_street", "employee_city"], "")}]}
                            ]
                        },
                        {
                            "federal_tax_plane": [
                                {"data": [{"code": "1", "label": "Wages, tips, other comp.", "value": find_number(["box_1", "box1", "wages", "wages_tips"])}]},
                                {"data": [{"code": "2", "label": "Federal income tax withheld", "value": find_number(["box_2", "box2", "federal_income_tax", "federal_tax_withheld"])}]},
                                {"data": [{"code": "3", "label": "Social security wages", "value": find_number(["box_3", "box3", "social_security_wages"])}]},
                                {"data": [{"code": "4", "label": "Social security tax withheld", "value": find_number(["box_4", "box4", "social_security_tax"])}]},
                                {"data": [{"code": "5", "label": "Medicare wages and tips", "value": find_number(["box_5", "box5", "medicare_wages"])}]},
                                {"data": [{"code": "6", "label": "Medicare tax withheld", "value": find_number(["box_6", "box6", "medicare_tax"])}]},
                                {"data": [{"code": "7", "label": "Social security tips", "value": find_number(["box_7", "box7", "social_security_tips"])}]},
                                {"data": [{"code": "8", "label": "Allocated tips", "value": find_number(["box_8", "box8", "allocated_tips"])}]},
                                {"data": [{"code": "9", "label": "Verification code", "value": find_value(["box_9", "box9", "verification_code", "verification"], "")}]},
                                {"data": [{"code": "10", "label": "Dependent care benefits", "value": find_number(["box_10", "box10", "dependent_care"])}]},
                                {"data": [{"code": "11", "label": "Nonqualified plans", "value": find_number(["box_11", "box11", "nonqualified"])}]}
                            ]
                        },
                        {
                            "boxes": [
                                {
                                    "supplemental_plane": [
                                        {"data": [{"code": "12a", "label": find_value(["box_12a_code", "12a_code"], ""), "value": find_number(["box_12a_amount", "12a_amount", "box_12a"])}]},
                                        {"data": [{"code": "12b", "label": find_value(["box_12b_code", "12b_code"], ""), "value": find_number(["box_12b_amount", "12b_amount", "box_12b"])}]},
                                        {"data": [{"code": "12c", "label": find_value(["box_12c_code", "12c_code"], ""), "value": find_number(["box_12c_amount", "12c_amount", "box_12c"])}]},
                                        {"data": [{"code": "12d", "label": find_value(["box_12d_code", "12d_code"], ""), "value": find_number(["box_12d_amount", "12d_amount", "box_12d"])}]},
                                        {"data": [{"code": "13", "label": "Statutory employee", "value": find_bool(["box_13_statutory", "box_13_statutory_employee", "statutory_employee", "statutory"])}]},
                                        {"data": [{"code": "13b", "label": "Retirement plan", "value": find_bool(["box_13_retirement", "box_13_retirement_plan", "retirement_plan", "retirement"])}]},
                                        {"data": [{"code": "13c", "label": "Third-party sick pay", "value": find_bool(["box_13_sick_pay", "box_13_third_party_sick_pay", "third_party_sick_pay", "sick_pay"])}]},
                                        {"data": [{"code": "14", "label": "Other", "value": find_value(["box_14", "box_14_other", "other"], None)}]}
                                    ]
                                }
                            ]
                        },
                        {
                            "state_local_plane": [
                                {"data": [{"code": "15", "label": "State / Employer ID", "value": find_combined_value(["box_15_state", "state"], ["box_15_state_id", "state_id", "employer_state_id"], None, " ")}]},
                                {"data": [{"code": "16", "label": "State wages, tips, etc.", "value": find_number(["box_16", "state_wages"])}]},
                                {"data": [{"code": "17", "label": "State income tax", "value": find_number(["box_17", "state_income_tax", "state_tax"])}]},
                                {"data": [{"code": "18", "label": "Local wages, tips, etc.", "value": find_number(["box_18", "local_wages"])}]},
                                {"data": [{"code": "19", "label": "Local income tax", "value": find_number(["box_19", "local_income_tax", "local_tax"])}]},
                                {"data": [{"code": "20", "label": "Locality name", "value": find_value(["box_20", "locality", "locality_name"], None)}]},
                                {"data": [{"code": "15b", "label": "State / Employer ID (2)", "value": find_combined_value(["box_15b_state"], ["box_15b_state_id"], None, " ")}]},
                                {"data": [{"code": "16b", "label": "State wages (2)", "value": find_number(["box_16b"])}]},
                                {"data": [{"code": "17b", "label": "State income tax (2)", "value": find_number(["box_17b"])}]},
                                {"data": [{"code": "18b", "label": "Local wages (2)", "value": find_number(["box_18b"])}]},
                                {"data": [{"code": "19b", "label": "Local income tax (2)", "value": find_number(["box_19b"])}]},
                                {"data": [{"code": "20b", "label": "Locality name (2)", "value": find_value(["box_20b"], None)}]}
                            ]
                        },
                        {
                            "additional_data_plane": [
                                {"data": [{"code": "employer_use", "label": "Employer Use Only", "value": find_value(["employer_use_only", "employer_use", "for_employer_use"], "")}]},
                                {"data": [{"code": "other", "label": "Other Data", "value": find_value(["other_data", "other", "additional_info"], "")}]}
                            ]
                        }
                    ]
                }
            ]
        }
    ]
    
    return result


def flatten_dict(d, parent_key='', sep='_'):
    """Flatten a nested dictionary."""
    items = []
    if isinstance(d, dict):
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    if isinstance(item, dict):
                        items.extend(flatten_dict(item, f"{new_key}_{i}", sep=sep).items())
                    else:
                        items.append((f"{new_key}_{i}", item))
            else:
                items.append((new_key, v))
    return dict(items)


def transform_to_1099int_structure(raw_data):
    """
    Transform AI-extracted data into the EXACT 1099-INT JSON structure.
    If AI already returned correct structure, pass through the values.
    Otherwise, try to extract from flattened data.
    """
    # Handle list input - unwrap if needed
    original_data = raw_data
    if isinstance(raw_data, list) and len(raw_data) > 0:
        raw_data = raw_data[0]
    
    # If already has error, return as-is
    if isinstance(raw_data, dict) and "error" in raw_data:
        return raw_data
    
    # Helper to get value from nested path
    def get_nested_value(data, *keys):
        """Safely get nested value from dict/list structure."""
        try:
            result = data
            for key in keys:
                if isinstance(result, list):
                    result = result[int(key)]
                elif isinstance(result, dict):
                    result = result.get(key)
                else:
                    return None
            return result
        except (KeyError, IndexError, TypeError, ValueError):
            return None
    
    # Try to extract from AI's output if it has the correct structure
    forms = get_nested_value(raw_data, "forms")
    if not forms and isinstance(original_data, list):
        forms = get_nested_value(original_data, 0, "forms")
    
    if forms and len(forms) > 0:
        # Process ALL forms (for Combined Statements with multiple accounts)
        all_processed_forms = []
        
        for form in forms:
            boxes = form.get("boxes", [])
            
            # Check if boxes have correct planes
            id_plane = None
            fin_plane = None
            state_plane = None
            
            for box in boxes:
                if "identification_plane" in box:
                    id_plane = box["identification_plane"]
                if "financial_plane" in box:
                    fin_plane = box["financial_plane"]
                if "state_local_plane" in box:
                    state_plane = box["state_local_plane"]
            
            # If we found the planes, extract values from them
            if id_plane and fin_plane:
                def get_plane_value(plane, code):
                    """Extract value from a plane by code."""
                    for item in plane:
                        data_list = item.get("data", [])
                        for d in data_list:
                            if d.get("code") == code:
                                return d.get("value")
                    return None
                
                # Extract all values from the AI output
                payer = get_plane_value(id_plane, "Payer") or ""
                payer_tin = get_plane_value(id_plane, "Payer TIN") or ""
                payer_telephone = get_plane_value(id_plane, "Payer Telephone") or ""
                recipient_tin = get_plane_value(id_plane, "Recipient TIN") or ""
                recipient_name = get_plane_value(id_plane, "Recipient Name") or ""
                account_no = get_plane_value(id_plane, "Account No") or ""
                payer_rtn = get_plane_value(id_plane, "Payer RTN") or ""
                fatca = get_plane_value(id_plane, "FATCA")
                
                box_1 = get_plane_value(fin_plane, "1")
                box_2 = get_plane_value(fin_plane, "2")
                box_3 = get_plane_value(fin_plane, "3")
                box_4 = get_plane_value(fin_plane, "4")
                box_5 = get_plane_value(fin_plane, "5")
                box_6 = get_plane_value(fin_plane, "6")
                box_7 = get_plane_value(fin_plane, "7")
                box_8 = get_plane_value(fin_plane, "8")
                box_9 = get_plane_value(fin_plane, "9")
                box_10 = get_plane_value(fin_plane, "10")
                box_11 = get_plane_value(fin_plane, "11")
                box_12 = get_plane_value(fin_plane, "12")
                box_13 = get_plane_value(fin_plane, "13")
                box_14 = get_plane_value(fin_plane, "14")
                
                box_15 = get_plane_value(state_plane, "15") if state_plane else None
                box_16 = get_plane_value(state_plane, "16") if state_plane else None
                box_17 = get_plane_value(state_plane, "17") if state_plane else 0.00
                
                # Clean up string values (replace newlines with commas)
                def clean_string(val):
                    if val is None:
                        return ""
                    if isinstance(val, str):
                        # Replace newlines with ", " and clean up
                        val = val.replace("\n", ", ").replace("\r", "").strip()
                        # Remove trailing asterisks or special chars
                        val = val.rstrip("*")
                        return val
                    return str(val)
                
                def clean_number(val, default=0.00):
                    if val is None:
                        return None
                    if isinstance(val, (int, float)):
                        return float(val)
                    if isinstance(val, str):
                        try:
                            return float(val.replace("$", "").replace(",", "").strip())
                        except:
                            return default
                    return default
                
                # Get year from header
                year = form.get("form_header", {}).get("year", "2024")
                
                # Build form structure
                processed_form = {
                    "form_header": {
                        "form_number": "1099-INT",
                        "year": str(year),
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
                                {"data": [{"code": "Payer", "label": "Payer's name, address and telephone", "value": clean_string(payer)}]},
                                {"data": [{"code": "Payer TIN", "label": "Payer's TIN", "value": clean_string(payer_tin)}]},
                                {"data": [{"code": "Payer Telephone", "label": "Payer's telephone number", "value": clean_string(payer_telephone)}]},
                                {"data": [{"code": "Recipient TIN", "label": "Recipient's TIN", "value": clean_string(recipient_tin)}]},
                                {"data": [{"code": "Recipient Name", "label": "Recipient's name and address", "value": clean_string(recipient_name)}]},
                                {"data": [{"code": "Account No", "label": "Account number", "value": clean_string(account_no)}]},
                                {"data": [{"code": "Payer RTN", "label": "Payer's RTN", "value": clean_string(payer_rtn)}]},
                                {"data": [{"code": "FATCA", "label": "FATCA filing requirement", "value": fatca if isinstance(fatca, bool) else False}]}
                            ]
                        },
                        {
                            "financial_plane": [
                                {"data": [{"code": "1", "label": "Interest income", "value": clean_number(box_1, 0.00) if box_1 is not None else 0.00}]},
                                {"data": [{"code": "2", "label": "Early withdrawal penalty", "value": clean_number(box_2, 0.00) if box_2 is not None else 0.00}]},
                                {"data": [{"code": "3", "label": "Interest on U.S. Savings Bonds and Treasury obligations", "value": clean_number(box_3, 0.00) if box_3 is not None else 0.00}]},
                                {"data": [{"code": "4", "label": "Federal income tax withheld", "value": clean_number(box_4, 0.00) if box_4 is not None else 0.00}]},
                                {"data": [{"code": "5", "label": "Investment expenses", "value": clean_number(box_5, 0.00) if box_5 is not None else 0.00}]},
                                {"data": [{"code": "6", "label": "Foreign tax paid", "value": clean_number(box_6, None)}]},
                                {"data": [{"code": "7", "label": "Foreign country or U.S. possession", "value": clean_string(box_7) if box_7 else None}]},
                                {"data": [{"code": "8", "label": "Tax-exempt interest", "value": clean_number(box_8, None)}]},
                                {"data": [{"code": "9", "label": "Specified private activity bond interest", "value": clean_number(box_9, None)}]},
                                {"data": [{"code": "10", "label": "Market discount", "value": clean_number(box_10, None)}]},
                                {"data": [{"code": "11", "label": "Bond premium", "value": clean_number(box_11, None)}]},
                                {"data": [{"code": "12", "label": "Bond premium on Treasury obligations", "value": clean_number(box_12, None)}]},
                                {"data": [{"code": "13", "label": "Bond premium on tax-exempt bond", "value": clean_number(box_13, None)}]},
                                {"data": [{"code": "14", "label": "Tax-exempt and tax credit bond CUSIP no.", "value": clean_string(box_14) if box_14 else None}]}
                            ]
                        },
                        {
                            "state_local_plane": [
                                {"data": [{"code": "15", "label": "State", "value": clean_string(box_15) if box_15 and box_15 != "15" else None}]},
                                {"data": [{"code": "16", "label": "State identification no.", "value": clean_string(box_16) if box_16 else None}]},
                                {"data": [{"code": "17", "label": "State tax withheld", "value": clean_number(box_17, 0.00) if box_17 is not None else 0.00}]}
                            ]
                        }
                    ]
                }
                all_processed_forms.append(processed_form)
        
        # If we processed any forms, return them
        if all_processed_forms:
            return [{"forms": all_processed_forms}]
    
    # Fallback: Try to extract from flattened data (handles alternate AI output formats)
    flat = flatten_dict(raw_data) if isinstance(raw_data, dict) else {}
    
    def find_value(keys, default=None):
        """Find value by multiple possible key patterns in flattened dict."""
        for key in keys:
            key_lower = key.lower()
            for k, v in flat.items():
                if key_lower in k.lower():
                    if v is not None and v != "" and v != "N/A":
                        return v
        return default
    
    def find_number(keys, default=0.00):
        """Find numeric value by key patterns."""
        val = find_value(keys, None)
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                return float(val.replace("$", "").replace(",", "").strip())
            except:
                return default if default is not None else 0.00
        return default if default is not None else 0.00
    
    def clean_str(val):
        if val is None:
            return ""
        if isinstance(val, str):
            return val.replace("\n", ", ").replace("\r", "").strip().rstrip("*")
        return str(val)
    
    # Extract from flattened data using various possible key patterns
    payer = find_value(["payer_name", "payer's name", "payer_address", "payer"], "")
    payer_tin = find_value(["payer_tin", "payer's tin", "payer tin"], "")
    payer_telephone = find_value(["payer_telephone", "payer's telephone", "payer phone", "telephone"], "")
    recipient_tin = find_value(["recipient_tin", "recipient's tin", "recipient tin"], "")
    recipient_name = find_value(["recipient_name", "recipient's name", "recipient_address", "recipient"], "")
    account_no = find_value(["account", "account_number", "account no"], "")
    payer_rtn = find_value(["payer_rtn", "rtn", "routing"], "")
    fatca = find_value(["fatca", "fatca_filing", "fatca filing requirement"], False)
    
    # Financial data - try various key patterns
    box_1 = find_number(["box_1", "box1", "interest_income", "box_1_interest"], 0.00)
    box_2 = find_number(["box_2", "box2", "early_withdrawal", "withdrawal_penalty"], 0.00)
    box_3 = find_number(["box_3", "box3", "savings_bonds", "treasury"], 0.00)
    box_4 = find_number(["box_4", "box4", "federal_tax", "tax_withheld"], 0.00)
    box_5 = find_number(["box_5", "box5", "investment_expenses"], 0.00)
    box_6 = find_number(["box_6", "box6", "foreign_tax"], None)
    box_7 = find_value(["box_7", "box7", "foreign_country", "us_possession"], None)
    box_8 = find_number(["box_8", "box8", "tax_exempt"], None)
    box_9 = find_number(["box_9", "box9", "private_activity"], None)
    box_10 = find_number(["box_10", "box10", "market_discount"], None)
    box_11 = find_number(["box_11", "box11", "bond_premium"], None)
    box_12 = find_number(["box_12", "box12", "bond_premium_treasury"], None)
    box_13 = find_number(["box_13", "box13", "bond_premium_tax_exempt"], None)
    box_14 = find_value(["box_14", "box14", "cusip", "tax_credit_bond_cusip"], None)
    box_15 = find_value(["box_15", "state"], None)
    box_16 = find_value(["box_16", "state_id"], None)
    box_17 = find_number(["box_17", "state_tax"], 0.00)
    
    year = find_value(["year", "tax_year"], "2024")
    
    return [
        {
            "forms": [
                {
                    "form_header": {
                        "form_number": "1099-INT",
                        "year": str(year),
                        "type": "Interest Income",
                        "text_array": ["Copy B", "For Recipient", "OMB No. 1545-0112", "Department of the Treasury - Internal Revenue Service"]
                    },
                    "boxes": [
                        {"identification_plane": [
                            {"data": [{"code": "Payer", "label": "Payer's name, address and telephone", "value": clean_str(payer)}]},
                            {"data": [{"code": "Payer TIN", "label": "Payer's TIN", "value": clean_str(payer_tin)}]},
                            {"data": [{"code": "Payer Telephone", "label": "Payer's telephone number", "value": clean_str(payer_telephone)}]},
                            {"data": [{"code": "Recipient TIN", "label": "Recipient's TIN", "value": clean_str(recipient_tin)}]},
                            {"data": [{"code": "Recipient Name", "label": "Recipient's name and address", "value": clean_str(recipient_name)}]},
                            {"data": [{"code": "Account No", "label": "Account number", "value": clean_str(account_no)}]},
                            {"data": [{"code": "Payer RTN", "label": "Payer's RTN", "value": clean_str(payer_rtn)}]},
                            {"data": [{"code": "FATCA", "label": "FATCA filing requirement", "value": fatca if isinstance(fatca, bool) else False}]}
                        ]},
                        {"financial_plane": [
                            {"data": [{"code": "1", "label": "Interest income", "value": box_1}]},
                            {"data": [{"code": "2", "label": "Early withdrawal penalty", "value": box_2}]},
                            {"data": [{"code": "3", "label": "Interest on U.S. Savings Bonds and Treasury obligations", "value": box_3}]},
                            {"data": [{"code": "4", "label": "Federal income tax withheld", "value": box_4}]},
                            {"data": [{"code": "5", "label": "Investment expenses", "value": box_5}]},
                            {"data": [{"code": "6", "label": "Foreign tax paid", "value": box_6}]},
                            {"data": [{"code": "7", "label": "Foreign country or U.S. possession", "value": clean_str(box_7) if box_7 else None}]},
                            {"data": [{"code": "8", "label": "Tax-exempt interest", "value": box_8}]},
                            {"data": [{"code": "9", "label": "Specified private activity bond interest", "value": box_9}]},
                            {"data": [{"code": "10", "label": "Market discount", "value": box_10}]},
                            {"data": [{"code": "11", "label": "Bond premium", "value": box_11}]},
                            {"data": [{"code": "12", "label": "Bond premium on Treasury obligations", "value": box_12}]},
                            {"data": [{"code": "13", "label": "Bond premium on tax-exempt bond", "value": box_13}]},
                            {"data": [{"code": "14", "label": "Tax-exempt and tax credit bond CUSIP no.", "value": clean_str(box_14) if box_14 else None}]}
                        ]},
                        {"state_local_plane": [
                            {"data": [{"code": "15", "label": "State", "value": clean_str(box_15) if box_15 else None}]},
                            {"data": [{"code": "16", "label": "State identification no.", "value": clean_str(box_16) if box_16 else None}]},
                            {"data": [{"code": "17", "label": "State tax withheld", "value": box_17}]}
                        ]}
                    ]
                }
            ]
        }
    ]


# =============================================================================
# 1099-INT Prompt - User's EXACT 3-Plane Structure
# =============================================================================
INT_1099_PROMPT = '''Extract ALL data from this 1099-INT form into this EXACT JSON structure.

CRITICAL - MULTI-ACCOUNT EXTRACTION:
This form may contain MULTIPLE accounts with different interest amounts.
Look for an "Account Information" table or list with columns like:
- Account Number/Type, Interest Income, Early Withdrawal Penalty, etc.

For EACH ACCOUNT ROW in the table, create a SEPARATE form object in the "forms" array.
Each form should have:
- Same Payer (bank name/address)
- Same Recipient (customer name/address)  
- Different Account Number
- Different Interest Income amount
- Different values for other boxes as applicable

CRITICAL ADDRESS SPELLING:
- Double-check city name spelling (e.g., "HORSHAM" not "HERSHAM", "MCLEAN" not "MCLEIN").
- PAYER'S NAME AND ADDRESS: Top left of form - bank name, street address, city, state, ZIP.
  Include building/floor identifiers like "HQ 06-07" or "SUITE 100" as PART OF THE ADDRESS, not RTN.
- RECIPIENT'S NAME AND ADDRESS: Middle left - customer name and address.
- FATCA filing requirement: Look for checkbox - return true if checked, false if not

CRITICAL - PAYER RTN (Routing Number):
- RTN is a 9-DIGIT NUMBER ONLY (e.g., "021000089", "124003116").
- RTN is NOT "HQ 06-07", "SUITE 100", or other building/floor codes - those belong in address.
- If no 9-digit RTN is visible, leave Payer RTN empty ("").

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

CRITICAL RULES:
- For Payer and Recipient: INCLUDE FULL NAME AND COMPLETE ADDRESS (city, state, ZIP)
- Output ONLY valid JSON, no explanations
- Use null for missing string values
- Use 0.00 for missing numeric values
- Numbers should be numeric values (not strings)
- Keep original text exactly as shown on the form

Output ONLY valid JSON, no explanations.'''


# =============================================================================
# K-1 Prompt - Final Document Metadata & Partner Records Structure
# =============================================================================
K1_PROMPT = '''Extract ALL data from this Schedule K-1 (Form 1065) form.
If there are MULTIPLE partners in the document, include each partner separately in partner_records array.

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

CRITICAL RULES:
- Output ONLY valid JSON, no explanations
- Use null for missing string values
- Use 0.00 for missing numeric values (income/loss can be NEGATIVE)
- Numbers should be numeric values (not strings)
- Keep original text exactly as shown on the form
- Include ALL partners found in the document in partner_records array
- For boxes with multiple entries (11, 13, 14, 15, 17, 18, 19, 20), use array format: [{ "code": "A", "amount": 123.00 }]

Output ONLY valid JSON, no explanations.'''


def transform_to_k1_structure(raw_data):
    """
    Transform AI-extracted data into the final K-1 JSON structure.
    Uses document_metadata and partner_records with comprehensive Part I, II, III planes.
    """
    # Handle list input
    original_data = raw_data
    if isinstance(raw_data, list) and len(raw_data) > 0:
        raw_data = raw_data[0]
    
    # If already has error, return as-is
    if isinstance(raw_data, dict) and "error" in raw_data:
        return raw_data
    
    # Helper functions
    def get_plane_value(plane, code):
        if not plane:
            return None
        for item in plane:
            data_list = item.get("data", [])
            for d in data_list:
                if d.get("code") == code:
                    return d.get("value")
        return None
    
    def clean_string(val):
        if val is None:
            return ""
        if isinstance(val, str):
            return val.replace("\n", ", ").replace("\r", "").strip()
        return str(val)
    
    def clean_number(val, default=0.00):
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                val = val.replace("$", "").replace(",", "").replace("(", "-").replace(")", "").strip()
                return float(val)
            except:
                return default
        return default
    
    def clean_bool(val):
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() in ["true", "yes", "1", "x", "checked"]
        return False
    
    def clean_array(val):
        if val is None:
            return []
        if isinstance(val, list):
            return val
        return []
    
    # Check if already in new document_metadata structure
    doc_metadata = raw_data.get("document_metadata") if isinstance(raw_data, dict) else None
    partner_records = raw_data.get("partner_records", []) if isinstance(raw_data, dict) else []
    
    if doc_metadata and partner_records:
        # AI returned new structure, clean and pass through
        cleaned_partners = []
        for idx, partner in enumerate(partner_records):
            part_i = partner.get("part_i_partnership_plane", [])
            part_ii = partner.get("part_ii_partner_plane", [])
            part_iii = partner.get("part_iii_income_loss_plane", [])
            
            cleaned_partner = {
                "partner_name": clean_string(partner.get("partner_name", "")),
                "page_reference": partner.get("page_reference", idx + 1),
                "part_i_partnership_plane": [
                    {"data": [{"code": "A", "label": "Partnership EIN", "value": clean_string(get_plane_value(part_i, "A"))}]},
                    {"data": [{"code": "B", "label": "Partnership Name/Address", "value": clean_string(get_plane_value(part_i, "B"))}]},
                    {"data": [{"code": "C", "label": "IRS Center", "value": clean_string(get_plane_value(part_i, "C"))}]},
                    {"data": [{"code": "D", "label": "PTP Check", "value": clean_bool(get_plane_value(part_i, "D"))}]}
                ],
                "part_ii_partner_plane": [
                    {"data": [{"code": "E", "label": "Partner's SSN or TIN", "value": clean_string(get_plane_value(part_ii, "E"))}]},
                    {"data": [{"code": "F", "label": "Partner's Name/Address", "value": clean_string(get_plane_value(part_ii, "F"))}]},
                    {"data": [{"code": "G", "label": "General partner or LLC member-manager", "value": clean_bool(get_plane_value(part_ii, "G"))}]},
                    {"data": [{"code": "H1", "label": "Domestic partner", "value": clean_bool(get_plane_value(part_ii, "H1"))}]},
                    {"data": [{"code": "H2", "label": "Foreign partner", "value": clean_bool(get_plane_value(part_ii, "H2"))}]},
                    {"data": [{"code": "I1", "label": "Entity Type", "value": clean_string(get_plane_value(part_ii, "I1"))}]},
                    {"data": [{"code": "J_Profit_Beg", "label": "Profit Share % (Beginning)", "value": clean_number(get_plane_value(part_ii, "J_Profit_Beg"))}]},
                    {"data": [{"code": "J_Profit_End", "label": "Profit Share % (Ending)", "value": clean_number(get_plane_value(part_ii, "J_Profit_End"))}]},
                    {"data": [{"code": "K1_Nonrecourse_End", "label": "Nonrecourse (End)", "value": clean_number(get_plane_value(part_ii, "K1_Nonrecourse_End"))}]},
                    {"data": [{"code": "K1_Qualified_End", "label": "Qualified Nonrecourse Financing (End)", "value": clean_number(get_plane_value(part_ii, "K1_Qualified_End"))}]},
                    {"data": [{"code": "K1_Recourse_End", "label": "Recourse (End)", "value": clean_number(get_plane_value(part_ii, "K1_Recourse_End"))}]},
                    {"data": [{"code": "L_Beg_Capital", "label": "Beginning capital account", "value": clean_number(get_plane_value(part_ii, "L_Beg_Capital"))}]},
                    {"data": [{"code": "L_Capital_Contributed", "label": "Capital contributed during year", "value": clean_number(get_plane_value(part_ii, "L_Capital_Contributed"))}]},
                    {"data": [{"code": "L_Net_Income", "label": "Current year net income (loss)", "value": clean_number(get_plane_value(part_ii, "L_Net_Income"))}]},
                    {"data": [{"code": "L_Other", "label": "Other increase (decrease)", "value": clean_number(get_plane_value(part_ii, "L_Other"))}]},
                    {"data": [{"code": "L_Withdrawals", "label": "Withdrawals & distributions", "value": clean_number(get_plane_value(part_ii, "L_Withdrawals"))}]},
                    {"data": [{"code": "L_Ending_Capital", "label": "Ending capital account", "value": clean_number(get_plane_value(part_ii, "L_Ending_Capital"))}]},
                    {"data": [{"code": "M", "label": "Did the partner contribute property with a built-in gain (loss)?", "value": clean_bool(get_plane_value(part_ii, "M"))}]},
                    {"data": [{"code": "N_Beg", "label": "Net unrecognized Section 704(c) gain or loss (Beginning)", "value": clean_number(get_plane_value(part_ii, "N_Beg"))}]},
                    {"data": [{"code": "N_End", "label": "Net unrecognized Section 704(c) gain or loss (Ending)", "value": clean_number(get_plane_value(part_ii, "N_End"))}]}
                ],
                "part_iii_income_loss_plane": [
                    {"data": [{"code": "1", "label": "Ordinary business income (loss)", "value": clean_number(get_plane_value(part_iii, "1"))}]},
                    {"data": [{"code": "2", "label": "Net rental real estate income (loss)", "value": clean_number(get_plane_value(part_iii, "2"))}]},
                    {"data": [{"code": "3", "label": "Other net rental income (loss)", "value": clean_number(get_plane_value(part_iii, "3"))}]},
                    {"data": [{"code": "4a", "label": "Guaranteed payments for services", "value": clean_number(get_plane_value(part_iii, "4a"))}]},
                    {"data": [{"code": "4b", "label": "Guaranteed payments for capital", "value": clean_number(get_plane_value(part_iii, "4b"))}]},
                    {"data": [{"code": "4c", "label": "Total guaranteed payments", "value": clean_number(get_plane_value(part_iii, "4c"))}]},
                    {"data": [{"code": "5", "label": "Interest income", "value": clean_number(get_plane_value(part_iii, "5"))}]},
                    {"data": [{"code": "6a", "label": "Ordinary dividends", "value": clean_number(get_plane_value(part_iii, "6a"))}]},
                    {"data": [{"code": "6b", "label": "Qualified dividends", "value": clean_number(get_plane_value(part_iii, "6b"))}]},
                    {"data": [{"code": "6c", "label": "Dividend equivalents", "value": clean_number(get_plane_value(part_iii, "6c"))}]},
                    {"data": [{"code": "7", "label": "Royalties", "value": clean_number(get_plane_value(part_iii, "7"))}]},
                    {"data": [{"code": "8", "label": "Net short-term capital gain (loss)", "value": clean_number(get_plane_value(part_iii, "8"))}]},
                    {"data": [{"code": "9a", "label": "Net long-term capital gain (loss)", "value": clean_number(get_plane_value(part_iii, "9a"))}]},
                    {"data": [{"code": "9b", "label": "Collectibles (28%) gain (loss)", "value": clean_number(get_plane_value(part_iii, "9b"))}]},
                    {"data": [{"code": "9c", "label": "Unrecaptured section 1250 gain", "value": clean_number(get_plane_value(part_iii, "9c"))}]},
                    {"data": [{"code": "10", "label": "Net section 1231 gain (loss)", "value": clean_number(get_plane_value(part_iii, "10"))}]},
                    {"data": [{"code": "11", "label": "Other income (loss)", "value": clean_array(get_plane_value(part_iii, "11"))}]},
                    {"data": [{"code": "12", "label": "Section 179 deduction", "value": clean_number(get_plane_value(part_iii, "12"))}]},
                    {"data": [{"code": "13", "label": "Other deductions", "value": clean_array(get_plane_value(part_iii, "13"))}]},
                    {"data": [{"code": "14", "label": "Self-employment earnings (loss)", "value": clean_array(get_plane_value(part_iii, "14"))}]},
                    {"data": [{"code": "15", "label": "Credits", "value": clean_array(get_plane_value(part_iii, "15"))}]},
                    {"data": [{"code": "16", "label": "Schedule K-3 attached check", "value": clean_bool(get_plane_value(part_iii, "16"))}]},
                    {"data": [{"code": "17", "label": "Alternative minimum tax (AMT) items", "value": clean_array(get_plane_value(part_iii, "17"))}]},
                    {"data": [{"code": "18", "label": "Tax-exempt income and nondeductible expenses", "value": clean_array(get_plane_value(part_iii, "18"))}]},
                    {"data": [{"code": "19", "label": "Distributions", "value": clean_array(get_plane_value(part_iii, "19"))}]},
                    {"data": [{"code": "20", "label": "Other information", "value": clean_array(get_plane_value(part_iii, "20"))}]},
                    {"data": [{"code": "21", "label": "Foreign taxes paid or accrued", "value": clean_number(get_plane_value(part_iii, "21"))}]},
                    {"data": [{"code": "22", "label": "More than one activity for at-risk purposes", "value": clean_bool(get_plane_value(part_iii, "22"))}]},
                    {"data": [{"code": "23", "label": "More than one activity for passive activity purposes", "value": clean_bool(get_plane_value(part_iii, "23"))}]}
                ]
            }
            cleaned_partners.append(cleaned_partner)
        
        return [{
            "document_metadata": {
                "form_type": doc_metadata.get("form_type", "Schedule K-1 (Form 1065)"),
                "tax_year": str(doc_metadata.get("tax_year", "2024")),
                "partnership_name": clean_string(doc_metadata.get("partnership_name", "")),
                "partnership_ein": clean_string(doc_metadata.get("partnership_ein", ""))
            },
            "partner_records": cleaned_partners
        }]
    
    # Fallback: Build default structure with single partner
    flat = flatten_dict(raw_data) if isinstance(raw_data, dict) else {}
    
    def find_value(keys, default=None):
        for key in keys:
            key_lower = key.lower()
            for k, v in flat.items():
                if key_lower in k.lower():
                    if v is not None and v != "" and v != "N/A":
                        return v
        return default
    
    def find_number(keys, default=0.00):
        val = find_value(keys, None)
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                return float(val.replace("$", "").replace(",", "").replace("(", "-").replace(")", "").strip())
            except:
                return default
        return default
    
    return [{
        "document_metadata": {
            "form_type": "Schedule K-1 (Form 1065)",
            "tax_year": str(find_value(["year", "tax_year"], "2024")),
            "partnership_name": find_value(["partnership_name", "partnership"], ""),
            "partnership_ein": find_value(["partnership_ein", "ein"], "")
        },
        "partner_records": [{
            "partner_name": find_value(["partner_name", "partner"], ""),
            "page_reference": 1,
            "part_i_partnership_plane": [
                {"data": [{"code": "A", "label": "Partnership EIN", "value": find_value(["partnership_ein", "ein"], "")}]},
                {"data": [{"code": "B", "label": "Partnership Name/Address", "value": find_value(["partnership_name", "partnership"], "")}]},
                {"data": [{"code": "C", "label": "IRS Center", "value": find_value(["irs_center"], "")}]},
                {"data": [{"code": "D", "label": "PTP Check", "value": False}]}
            ],
            "part_ii_partner_plane": [
                {"data": [{"code": "E", "label": "Partner's SSN or TIN", "value": find_value(["partner_tin", "partner_ssn", "tin"], "")}]},
                {"data": [{"code": "F", "label": "Partner's Name/Address", "value": find_value(["partner_name", "partner"], "")}]},
                {"data": [{"code": "G", "label": "General partner or LLC member-manager", "value": False}]},
                {"data": [{"code": "H1", "label": "Domestic partner", "value": False}]},
                {"data": [{"code": "H2", "label": "Foreign partner", "value": False}]},
                {"data": [{"code": "I1", "label": "Entity Type", "value": find_value(["entity_type"], "")}]},
                {"data": [{"code": "J_Profit_Beg", "label": "Profit Share % (Beginning)", "value": find_number(["profit_share", "j_profit"])}]},
                {"data": [{"code": "L_Beg_Capital", "label": "Beginning capital account", "value": find_number(["beg_capital", "beginning_capital"])}]},
                {"data": [{"code": "L_Net_Income", "label": "Current year net income (loss)", "value": find_number(["net_income", "l_net"])}]},
                {"data": [{"code": "L_Ending_Capital", "label": "Ending capital account", "value": find_number(["ending_capital", "end_capital"])}]},
                {"data": [{"code": "M", "label": "Did the partner contribute property with a built-in gain (loss)?", "value": False}]},
                {"data": [{"code": "N_Beg", "label": "Net unrecognized Section 704(c) gain or loss (Beginning)", "value": 0.00}]},
                {"data": [{"code": "N_End", "label": "Net unrecognized Section 704(c) gain or loss (Ending)", "value": 0.00}]}
            ],
            "part_iii_income_loss_plane": [
                {"data": [{"code": "1", "label": "Ordinary business income (loss)", "value": find_number(["box_1", "ordinary_business"])}]},
                {"data": [{"code": "5", "label": "Interest income", "value": find_number(["box_5", "interest_income"])}]},
                {"data": [{"code": "6a", "label": "Ordinary dividends", "value": find_number(["box_6a", "ordinary_dividends"])}]},
                {"data": [{"code": "8", "label": "Net short-term capital gain (loss)", "value": find_number(["box_8", "short_term"])}]},
                {"data": [{"code": "9a", "label": "Net long-term capital gain (loss)", "value": find_number(["box_9a", "long_term"])}]},
                {"data": [{"code": "13", "label": "Other deductions", "value": []}]},
                {"data": [{"code": "14", "label": "Self-employment earnings (loss)", "value": []}]},
                {"data": [{"code": "16", "label": "Schedule K-3 attached check", "value": False}]},
                {"data": [{"code": "21", "label": "Foreign taxes paid or accrued", "value": 0.00}]},
                {"data": [{"code": "22", "label": "More than one activity for at-risk purposes", "value": False}]},
                {"data": [{"code": "23", "label": "More than one activity for passive activity purposes", "value": False}]}
            ]
        }]
    }]




# =============================================================================
# Logger
# =============================================================================
class ExtractionLogger:
    def __init__(self):
        self.logs = []
    
    def log(self, filename, form_type, status, total_time, model_used, error_msg=None):
        self.logs.insert(0, {
            "time": datetime.now().strftime("%H:%M:%S"),
            "file": filename[:20] + "..." if len(filename) > 20 else filename,
            "form": form_type,
            "ms": int(total_time * 1000),
            "status": status,
            "error": error_msg
        })
        self.logs = self.logs[:15]


# =============================================================================
# Form Detector
# =============================================================================
class FormDetector:
    def detect(self, image, filename=""):
        text = ""
        if TESSERACT_AVAILABLE:
            try:
                text = pytesseract.image_to_string(image)
            except:
                pass
        
        text_upper = text.upper()
        
        # First try OCR-based detection
        for form_type, info in SUPPORTED_FORMS.items():
            for pattern in info["patterns"]:
                if pattern.upper() in text_upper:
                    return {"form_type": form_type, "info": info}
        
        # Fallback: filename-based detection
        filename_upper = filename.upper()
        if "W2" in filename_upper or "W-2" in filename_upper:
            return {"form_type": "W-2", "info": SUPPORTED_FORMS.get("W-2")}
        # Check for 1099-INT with different patterns (hyphen, space, underscore, no separator)
        if "1099-INT" in filename_upper or "1099INT" in filename_upper or "1099 INT" in filename_upper or "1099_INT" in filename_upper:
            return {"form_type": "1099-INT", "info": SUPPORTED_FORMS.get("1099-INT")}
        if "1099-NEC" in filename_upper or "1099NEC" in filename_upper or "1099 NEC" in filename_upper or "1099_NEC" in filename_upper:
            return {"form_type": "1099-NEC", "info": SUPPORTED_FORMS.get("1099-NEC")}
        if "1099-MISC" in filename_upper or "1099MISC" in filename_upper or "1099 MISC" in filename_upper or "1099_MISC" in filename_upper:
            return {"form_type": "1099-MISC", "info": SUPPORTED_FORMS.get("1099-MISC")}
        # Also check for Combined Statement (1099-INT)
        if "ALLY" in filename_upper and "1099" in filename_upper:
            return {"form_type": "1099-INT", "info": SUPPORTED_FORMS.get("1099-INT")}
        if "1099" in filename_upper:
            # Default unknown 1099 to MISC (only if no other patterns matched)
            return {"form_type": "1099-MISC", "info": SUPPORTED_FORMS.get("1099-MISC")}
        # Check for K-1 (Schedule K-1, Form 1065)
        if "K-1" in filename_upper or "K1" in filename_upper or "1065" in filename_upper or "SCHEDULE K" in filename_upper:
            return {"form_type": "K-1", "info": SUPPORTED_FORMS.get("K-1")}
        # Check for Form 8805 (Foreign Partner's Information Statement)
        if "8805" in filename_upper or "SECTION 1446" in filename_upper or "FOREIGN PARTNER" in filename_upper:
            return {"form_type": "8805", "info": SUPPORTED_FORMS.get("8805")}
        # Check for Form 8804 (Annual Return for Partnership Withholding Tax)
        if "8804" in filename_upper or "PARTNERSHIP WITHHOLDING" in filename_upper:
            return {"form_type": "8804", "info": SUPPORTED_FORMS.get("8804")}
        
        return {"form_type": "UNKNOWN", "info": None}



# =============================================================================
# Vision Client
# =============================================================================
class VisionClient:
    def __init__(self):
        self.gemini_ready = False
        self.groq_client = None
        
        if GEMINI_AVAILABLE and os.environ.get("GEMINI_API_KEY"):
            try:
                genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
                self.gemini_ready = True
            except:
                pass
        
        if GROQ_AVAILABLE and os.environ.get("GROQ_API_KEY"):
            try:
                self.groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
            except:
                pass
    
    def extract(self, image, form_type, model="gemini-2.0-flash"):
        # Select appropriate prompt based on form type
        if form_type == "W-2":
            prompt = W2_PROMPT
        elif form_type == "1099-INT":
            prompt = INT_1099_PROMPT
        elif form_type == "K-1":
            prompt = K1_PROMPT
        else:
            prompt = f"Extract all data from this {form_type} form as structured JSON."
        
        raw_result = None
        
        if "gemini" in model.lower() and self.gemini_ready:
            try:
                raw_result = self._gemini_extract(image, prompt, model)
            except Exception as e:
                return {"error": str(e)}
        elif self.groq_client:
            try:
                raw_result = self._groq_extract(image, prompt, model)
            except Exception as e:
                return {"error": str(e)}
        else:
            return {"error": "No AI model available"}
        
        # Apply transformer for W-2 forms to guarantee exact structure
        if form_type == "W-2" and raw_result:
            # Save raw for debugging
            import logging
            logging.info(f"Raw AI output: {raw_result}")
            transformed = transform_to_w2_structure(raw_result)
            # Attach raw for debugging in UI
            if isinstance(transformed, list) and len(transformed) > 0:
                transformed[0]["_raw_ai_output"] = raw_result
            return transformed
        
        # Apply transformer for 1099-INT forms to guarantee exact structure
        if form_type == "1099-INT" and raw_result:
            import logging
            logging.info(f"Raw AI output: {raw_result}")
            transformed = transform_to_1099int_structure(raw_result)
            # Attach raw for debugging in UI
            if isinstance(transformed, list) and len(transformed) > 0:
                transformed[0]["_raw_ai_output"] = raw_result
            return transformed
        
        # Apply transformer for K-1 forms to guarantee exact structure
        if form_type == "K-1" and raw_result:
            import logging
            logging.info(f"Raw AI output: {raw_result}")
            transformed = transform_to_k1_structure(raw_result)
            # Attach raw for debugging in UI
            if isinstance(transformed, list) and len(transformed) > 0:
                transformed[0]["_raw_ai_output"] = raw_result
            return transformed
        
        return raw_result

    
    def _gemini_extract(self, image, prompt, model):
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content([prompt, image])
        return self._parse_json(response.text)
    
    def _groq_extract(self, image, prompt, model):
        import base64
        buf = BytesIO()
        image.save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode()
        
        response = self.groq_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
            ]}],
            max_tokens=4096, temperature=0.1
        )
        return self._parse_json(response.choices[0].message.content)
    
    def _parse_json(self, text):
        text = text.strip()
        if text.startswith("```json"): text = text[7:]
        elif text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        try:
            return json.loads(text.strip())
        except:
            return {"error": "Failed to parse JSON", "raw": text}


# =============================================================================
# Helper Functions
# =============================================================================
def pdf_to_images(pdf_bytes):
    if not PDF_SUPPORT:
        return []
    images = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        images.append(Image.frombytes("RGB", [pix.width, pix.height], pix.samples))
    doc.close()
    return images


def format_value(value):
    """Format value for display."""
    if value is None:
        return '<span class="data-value">—</span>'
    elif isinstance(value, bool):
        if value:
            return '<span class="data-value data-value-bool-true">✅ Yes</span>'
        else:
            return '<span class="data-value data-value-bool-false">❌ No</span>'
    elif isinstance(value, (int, float)):
        if value == 0:
            return '<span class="data-value">$0.00</span>'
        return f'<span class="data-value data-value-money">${value:,.2f}</span>'
    else:
        return f'<span class="data-value">{value}</span>'


def render_data_box(code, label, value):
    """Render a single data box with code, label, and value."""
    val_html = format_value(value)
    label_display = label if label else ""
    
    return f'''
    <div class="data-box">
        <div class="data-left">
            <span class="data-code">{code}</span>
            <span class="data-label">{label_display}</span>
        </div>
        {val_html}
    </div>
    '''


def render_plane(plane_name, plane_data):
    """Render a plane section with all its data boxes."""
    # Icon mapping
    icons = {
        "identification": "👤",
        "federal": "💵",
        "supplemental": "📦",
        "state": "🏛️",
        "local": "🏛️",
        "payer": "🏢",
        "recipient": "👤",
        "interest": "💰",
        "foreign": "🌍",
        "tax_exempt": "📋",
        "bond": "📈"
    }
    
    icon = "📋"
    for key, ico in icons.items():
        if key in plane_name.lower():
            icon = ico
            break
    
    display_name = plane_name.replace("_", " ").title()
    
    html = f'''<div class="plane-card">
        <div class="plane-title">{icon} {display_name}</div>'''
    
    if isinstance(plane_data, list):
        for item in plane_data:
            data_list = item.get("data", [])
            for d in data_list:
                html += render_data_box(d.get("code", ""), d.get("label", ""), d.get("value"))
    
    html += "</div>"
    return html


def has_error(data):
    """Check if result has an error (handles list or dict)."""
    if isinstance(data, dict):
        return "error" in data
    return False

def get_error(data):
    """Get error message from result."""
    if isinstance(data, dict):
        return data.get("error")
    return None


def render_table_view(data):
    """Render full W-2 extraction results like the original app."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Navigate to forms
    forms_data = data
    if isinstance(data, list) and len(data) > 0:
        forms_data = data[0].get("forms", data)
    elif isinstance(data, dict):
        forms_data = data.get("forms", [data])
    
    if not isinstance(forms_data, list):
        forms_data = [forms_data]
    
    # Helper functions
    def get_box_value(boxes, plane_name, code):
        """Get value from a specific box in a plane."""
        for box in boxes:
            if plane_name in box:
                for item in box[plane_name]:
                    for d in item.get("data", []):
                        if d.get("code") == code:
                            return d.get("value"), d.get("label", "")
            # Check nested boxes (supplemental_plane)
            if "boxes" in box:
                for nested in box["boxes"]:
                    if plane_name in nested:
                        for item in nested[plane_name]:
                            for d in item.get("data", []):
                                if d.get("code") == code:
                                    return d.get("value"), d.get("label", "")
        return None, ""
    
    def format_currency(val):
        if val is None or val == "":
            return "—"
        if isinstance(val, (int, float)):
            return f"${val:,.2f}"
        return str(val)
    
    def display_box_card(box_num, label, value, is_currency=True):
        if is_currency:
            disp = format_currency(value)
            cls = "box-value box-value-money" if value and value != 0 else "box-value"
        else:
            disp = value if value else "—"
            cls = "box-value"
        st.markdown(f'''
        <div class="box-card">
            <div class="box-label">Box {box_num}: {label}</div>
            <div class="{cls}">{disp}</div>
        </div>
        ''', unsafe_allow_html=True)
    
    for form in forms_data:
        header = form.get("form_header", {})
        year = header.get("year", "2024")
        form_num = header.get("form_number", "W-2")
        boxes = form.get("boxes", [])
        
        # Form Header - matching original app exactly
        control, _ = get_box_value(boxes, "identification_plane", "d")
        st.markdown(f'''
        <div class="form-info-header">
            <div class="form-info-title">📄 Form Information</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">
                <div class="info-field">
                    <div class="info-label">Form</div>
                    <div class="info-value" style="color: #a78bfa; font-weight: 700;">{form_num}</div>
                </div>
                <div class="info-field">
                    <div class="info-label">Tax Year</div>
                    <div class="info-value">{year if year else "—"}</div>
                </div>
                <div class="info-field">
                    <div class="info-label">Control Number</div>
                    <div class="info-value">{control if control else "—"}</div>
                </div>
            </div>
        </div>
        ''', unsafe_allow_html=True)
        
        # === IDENTIFICATION SECTION ===
        st.markdown('<div class="section-header">👤 Employee & Employer Information</div>', unsafe_allow_html=True)
        col_emp, col_empr = st.columns(2)
        
        # Helper to convert newlines to HTML breaks for multi-line values
        def format_multiline(val):
            if val is None or val == "":
                return "—"
            return str(val).replace("\n", "<br>")
        
        with col_emp:
            ssn, _ = get_box_value(boxes, "identification_plane", "a")
            emp_name, _ = get_box_value(boxes, "identification_plane", "e/f")
            st.markdown("**Employee**")
            st.markdown(f'<div class="box-card"><div class="box-label">Box a: SSN</div><div class="box-value">{ssn or "—"}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Box e/f: Name & Address</div><div class="box-value">{format_multiline(emp_name)}</div></div>', unsafe_allow_html=True)
        
        with col_empr:
            ein, _ = get_box_value(boxes, "identification_plane", "b")
            empr_name, _ = get_box_value(boxes, "identification_plane", "c")
            control, _ = get_box_value(boxes, "identification_plane", "d")
            dept, _ = get_box_value(boxes, "identification_plane", "dept")
            st.markdown("**Employer**")
            st.markdown(f'<div class="box-card"><div class="box-label">Box b: EIN</div><div class="box-value">{ein or "—"}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Box c: Name & Address</div><div class="box-value">{format_multiline(empr_name)}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Box d: Control Number</div><div class="box-value">{control or "—"}</div></div>', unsafe_allow_html=True)
            if dept:
                st.markdown(f'<div class="box-card"><div class="box-label">Dept</div><div class="box-value">{dept}</div></div>', unsafe_allow_html=True)
        
        # === WAGES & TAXES SECTION (Boxes 1-6) ===
        st.markdown('<div class="section-header">💵 Wages & Taxes (Boxes 1-6)</div>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v, l = get_box_value(boxes, "federal_tax_plane", "1")
            display_box_card("1", "Wages, tips, other comp.", v)
            v, l = get_box_value(boxes, "federal_tax_plane", "2")
            display_box_card("2", "Federal tax withheld", v)
        
        with col2:
            v, l = get_box_value(boxes, "federal_tax_plane", "3")
            display_box_card("3", "Social security wages", v)
            v, l = get_box_value(boxes, "federal_tax_plane", "4")
            display_box_card("4", "Social security tax", v)
        
        with col3:
            v, l = get_box_value(boxes, "federal_tax_plane", "5")
            display_box_card("5", "Medicare wages & tips", v)
            v, l = get_box_value(boxes, "federal_tax_plane", "6")
            display_box_card("6", "Medicare tax withheld", v)
        
        # === OTHER COMPENSATION (Boxes 7-11) ===
        st.markdown('<div class="section-header">📋 Other Compensation (Boxes 7-11)</div>', unsafe_allow_html=True)
        col1, col2, col3, col4, col5 = st.columns(5)
        
        with col1:
            v, _ = get_box_value(boxes, "federal_tax_plane", "7")
            display_box_card("7", "SS Tips", v)
        with col2:
            v, _ = get_box_value(boxes, "federal_tax_plane", "8")
            display_box_card("8", "Alloc Tips", v)
        with col3:
            v, _ = get_box_value(boxes, "federal_tax_plane", "9")
            display_box_card("9", "Verification Code", v, is_currency=False)
        with col4:
            v, _ = get_box_value(boxes, "federal_tax_plane", "10")
            display_box_card("10", "Dep Care", v)
        with col5:
            v, _ = get_box_value(boxes, "federal_tax_plane", "11")
            display_box_card("11", "Nonqual", v)
        
        # === BOX 12 - CODED ITEMS ===
        st.markdown('<div class="section-header">📦 Box 12 - Coded Items</div>', unsafe_allow_html=True)
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            v, code = get_box_value(boxes, "supplemental_plane", "12a")
            display_box_card("12a", f"Code {code}" if code else "—", v)
        with col2:
            v, code = get_box_value(boxes, "supplemental_plane", "12b")
            display_box_card("12b", f"Code {code}" if code else "—", v)
        with col3:
            v, code = get_box_value(boxes, "supplemental_plane", "12c")
            display_box_card("12c", f"Code {code}" if code else "—", v)
        with col4:
            v, code = get_box_value(boxes, "supplemental_plane", "12d")
            display_box_card("12d", f"Code {code}" if code else "—", v)
        
        # === BOX 13 - CHECKBOXES ===
        st.markdown('<div class="section-header">📋 Box 13 - Checkboxes</div>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)
        
        statutory, _ = get_box_value(boxes, "supplemental_plane", "13")
        retirement, _ = get_box_value(boxes, "supplemental_plane", "13b")
        sick_pay, _ = get_box_value(boxes, "supplemental_plane", "13c")
        
        with col1:
            status = "☑" if retirement else "☐"
            st.markdown(f"**{status} Retirement Plan**")
        with col2:
            status = "☑" if statutory else "☐"
            st.markdown(f"**{status} Statutory Employee**")
        with col3:
            status = "☑" if sick_pay else "☐"
            st.markdown(f"**{status} Third-Party Sick Pay**")
        
        # === BOX 14 - OTHER ===
        v14, _ = get_box_value(boxes, "supplemental_plane", "14")
        if v14:
            st.markdown('<div class="section-header">📝 Box 14 - Other</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-value">{v14}</div></div>', unsafe_allow_html=True)
        
        # === STATE/LOCAL TAX (Boxes 15-20) - First Row ===
        st.markdown('<div class="section-header">🏛️ State/Local Tax (Boxes 15-20)</div>', unsafe_allow_html=True)
        col1, col2 = st.columns(2)
        
        with col1:
            v, _ = get_box_value(boxes, "state_local_plane", "15")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 15: State/Employer State ID</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
            v, _ = get_box_value(boxes, "state_local_plane", "16")
            display_box_card("16", "State wages", v)
            v, _ = get_box_value(boxes, "state_local_plane", "17")
            display_box_card("17", "State tax withheld", v)
        
        with col2:
            v, _ = get_box_value(boxes, "state_local_plane", "18")
            display_box_card("18", "Local wages", v)
            v, _ = get_box_value(boxes, "state_local_plane", "19")
            display_box_card("19", "Local tax withheld", v)
            v, _ = get_box_value(boxes, "state_local_plane", "20")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 20: Locality Name</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        
        # === STATE/LOCAL TAX - Second Row (if present) ===
        v15b, _ = get_box_value(boxes, "state_local_plane", "15b")
        v16b, _ = get_box_value(boxes, "state_local_plane", "16b")
        v17b, _ = get_box_value(boxes, "state_local_plane", "17b")
        
        # Only show second row if there's data
        if v15b or v16b or v17b:
            st.markdown('<div class="section-header">🏛️ State/Local Tax - Row 2</div>', unsafe_allow_html=True)
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown(f'<div class="box-card"><div class="box-label">Box 15b: State/Employer State ID (2)</div><div class="box-value">{v15b or "—"}</div></div>', unsafe_allow_html=True)
                display_box_card("16b", "State wages (2)", v16b)
                display_box_card("17b", "State tax withheld (2)", v17b)
            
            with col2:
                v18b, _ = get_box_value(boxes, "state_local_plane", "18b")
                display_box_card("18b", "Local wages (2)", v18b)
                v19b, _ = get_box_value(boxes, "state_local_plane", "19b")
                display_box_card("19b", "Local tax withheld (2)", v19b)
                v20b, _ = get_box_value(boxes, "state_local_plane", "20b")
                st.markdown(f'<div class="box-card"><div class="box-label">Box 20b: Locality Name (2)</div><div class="box-value">{v20b or "—"}</div></div>', unsafe_allow_html=True)
        
        # === ADDITIONAL DATA SECTION ===
        employer_use, _ = get_box_value(boxes, "additional_data_plane", "employer_use")
        other_data, _ = get_box_value(boxes, "additional_data_plane", "other")
        
        # Only show section if there's data
        if employer_use or other_data:
            st.markdown('<div class="section-header">📋 Additional Information</div>', unsafe_allow_html=True)
            col1, col2 = st.columns(2)
            
            with col1:
                if employer_use:
                    st.markdown(f'<div class="box-card"><div class="box-label">Employer Use Only</div><div class="box-value">{employer_use}</div></div>', unsafe_allow_html=True)
            
            with col2:
                if other_data:
                    st.markdown(f'<div class="box-card"><div class="box-label">Other Data</div><div class="box-value">{other_data}</div></div>', unsafe_allow_html=True)


def render_1099int_table_view(data):
    """Render 1099-INT extraction results with proper layout."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Navigate to forms
    forms_data = data
    if isinstance(data, list) and len(data) > 0:
        forms_data = data[0].get("forms", data)
    elif isinstance(data, dict):
        forms_data = data.get("forms", [data])
    
    if not isinstance(forms_data, list):
        forms_data = [forms_data]
    
    # Helper functions
    def get_box_value(boxes, plane_name, code):
        """Get value from a specific box in a plane."""
        for box in boxes:
            if plane_name in box:
                for item in box[plane_name]:
                    for d in item.get("data", []):
                        if d.get("code") == code:
                            return d.get("value"), d.get("label", "")
        return None, ""
    
    def format_currency(val):
        if val is None or val == "":
            return "—"
        if isinstance(val, (int, float)):
            return f"${val:,.2f}"
        return str(val)
    
    def format_multiline(val):
        """Format multi-line values (addresses) with HTML line breaks."""
        if val is None or val == "":
            return "—"
        if isinstance(val, str):
            # Replace commas-space and newlines with <br> for HTML display
            formatted = val.replace(", ", "<br>").replace("\n", "<br>")
            return formatted
        return str(val)
    
    def display_box_card(box_num, label, value, is_currency=True):
        if is_currency:
            disp = format_currency(value)
            cls = "box-value box-value-money" if value and value != 0 else "box-value"
        else:
            disp = value if value else "—"
            cls = "box-value"
        st.markdown(f'''
        <div class="box-card">
            <div class="box-label">Box {box_num}: {label}</div>
            <div class="{cls}">{disp}</div>
        </div>
        ''', unsafe_allow_html=True)
    
    for form in forms_data:
        header = form.get("form_header", {})
        year = header.get("year", "2024")
        form_num = header.get("form_number", "1099-INT")
        boxes = form.get("boxes", [])
        
        # Form Header
        st.markdown(f'''
        <div class="form-info-header">
            <div class="form-info-title">📄 Form Information</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="info-field">
                    <div class="info-label">Form</div>
                    <div class="info-value" style="color: #a78bfa; font-weight: 700;">{form_num}</div>
                </div>
                <div class="info-field">
                    <div class="info-label">Tax Year</div>
                    <div class="info-value">{year if year else "—"}</div>
                </div>
            </div>
        </div>
        ''', unsafe_allow_html=True)
        
        # === PAYER & RECIPIENT INFORMATION ===
        st.markdown('<div class="section-header">🏢 Payer & Recipient Information</div>', unsafe_allow_html=True)
        col_payer, col_recipient = st.columns(2)
        
        with col_payer:
            payer, _ = get_box_value(boxes, "identification_plane", "Payer")
            payer_tin, _ = get_box_value(boxes, "identification_plane", "Payer TIN")
            payer_telephone, _ = get_box_value(boxes, "identification_plane", "Payer Telephone")
            payer_rtn, _ = get_box_value(boxes, "identification_plane", "Payer RTN")
            st.markdown("**Payer**")
            st.markdown(f'<div class="box-card"><div class="box-label">Payer Name, Address & Phone</div><div class="box-value box-value-small">{format_multiline(payer)}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Payer TIN</div><div class="box-value">{payer_tin or "—"}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Payer Telephone</div><div class="box-value">{payer_telephone or "—"}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Payer RTN (Routing)</div><div class="box-value">{payer_rtn or "—"}</div></div>', unsafe_allow_html=True)
        
        with col_recipient:
            recipient, _ = get_box_value(boxes, "identification_plane", "Recipient Name")
            recipient_tin, _ = get_box_value(boxes, "identification_plane", "Recipient TIN")
            account, _ = get_box_value(boxes, "identification_plane", "Account No")
            fatca, _ = get_box_value(boxes, "identification_plane", "FATCA")
            st.markdown("**Recipient**")
            st.markdown(f'<div class="box-card"><div class="box-label">Recipient Name & Address</div><div class="box-value box-value-small">{format_multiline(recipient)}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Recipient TIN</div><div class="box-value">{recipient_tin or "—"}</div></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="box-card"><div class="box-label">Account Number</div><div class="box-value">{account or "—"}</div></div>', unsafe_allow_html=True)
            fatca_display = "☑ Yes" if fatca else "☐ No"
            st.markdown(f'<div class="box-card"><div class="box-label">FATCA Filing Requirement</div><div class="box-value">{fatca_display}</div></div>', unsafe_allow_html=True)
        
        # === INTEREST INCOME (Boxes 1-5) ===
        st.markdown('<div class="section-header">💰 Interest Income (Boxes 1-5)</div>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v, _ = get_box_value(boxes, "financial_plane", "1")
            display_box_card("1", "Interest Income", v)
            v, _ = get_box_value(boxes, "financial_plane", "2")
            display_box_card("2", "Early Withdrawal Penalty", v)
        
        with col2:
            v, _ = get_box_value(boxes, "financial_plane", "3")
            display_box_card("3", "U.S. Savings Bonds Interest", v)
            v, _ = get_box_value(boxes, "financial_plane", "4")
            display_box_card("4", "Federal Tax Withheld", v)
        
        with col3:
            v, _ = get_box_value(boxes, "financial_plane", "5")
            display_box_card("5", "Investment Expenses", v)
            v, _ = get_box_value(boxes, "financial_plane", "6")
            display_box_card("6", "Foreign Tax Paid", v)
        
        # === TAX-EXEMPT & BOND PREMIUM (Boxes 7-14) ===
        st.markdown('<div class="section-header">📋 Foreign Tax & Bond Premium (Boxes 7-14)</div>', unsafe_allow_html=True)
        
        # Row 1: Boxes 7-9
        col1, col2, col3 = st.columns(3)
        with col1:
            v, _ = get_box_value(boxes, "financial_plane", "7")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 7: Foreign Country/U.S. Possession</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        with col2:
            v, _ = get_box_value(boxes, "financial_plane", "8")
            display_box_card("8", "Tax-Exempt Interest", v)
        with col3:
            v, _ = get_box_value(boxes, "financial_plane", "9")
            display_box_card("9", "Private Activity Bond", v)
        
        # Row 2: Boxes 10-12
        col1, col2, col3 = st.columns(3)
        with col1:
            v, _ = get_box_value(boxes, "financial_plane", "10")
            display_box_card("10", "Market Discount", v)
        with col2:
            v, _ = get_box_value(boxes, "financial_plane", "11")
            display_box_card("11", "Bond Premium", v)
        with col3:
            v, _ = get_box_value(boxes, "financial_plane", "12")
            display_box_card("12", "Bond Prem. on Treasury", v)
        
        # Row 3: Boxes 13-14
        col1, col2 = st.columns(2)
        with col1:
            v, _ = get_box_value(boxes, "financial_plane", "13")
            display_box_card("13", "Bond Prem. on Tax-Exempt", v)
        with col2:
            v, _ = get_box_value(boxes, "financial_plane", "14")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 14: CUSIP No.</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        
        # === STATE TAX (Boxes 15-17) ===
        st.markdown('<div class="section-header">🏛️ State Tax Information (Boxes 15-17)</div>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v, _ = get_box_value(boxes, "state_local_plane", "15")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 15: State</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        with col2:
            v, _ = get_box_value(boxes, "state_local_plane", "16")
            st.markdown(f'<div class="box-card"><div class="box-label">Box 16: State ID</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        with col3:
            v, _ = get_box_value(boxes, "state_local_plane", "17")
            display_box_card("17", "State Tax Withheld", v)


def render_k1_table_view(data):
    """Render Schedule K-1 extraction results with document_metadata and partner_records structure."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Navigate to data - handle both list and dict formats
    doc_data = data
    if isinstance(data, list) and len(data) > 0:
        doc_data = data[0]
    
    # Get document metadata and partner records
    doc_metadata = doc_data.get("document_metadata", {})
    partner_records = doc_data.get("partner_records", [])
    
    # Helper functions
    def get_plane_value(plane, code):
        """Get value from a plane by code."""
        if not plane:
            return None
        for item in plane:
            data_list = item.get("data", [])
            for d in data_list:
                if d.get("code") == code:
                    return d.get("value")
        return None
    
    def format_currency(val):
        if val is None:
            return "—"
        if isinstance(val, (int, float)):
            if val < 0:
                return f"(${abs(val):,.2f})"
            return f"${val:,.2f}"
        return str(val)
    
    def format_percentage(val):
        if val is None:
            return "—"
        if isinstance(val, (int, float)):
            return f"{val:.4f}%"
        return str(val)
    
    def display_box_card(box_code, label, value, is_currency=True):
        if is_currency:
            formatted_val = format_currency(value)
            if isinstance(value, (int, float)):
                if value < 0:
                    color = "color: #ef4444;"  # red
                elif value > 0:
                    color = "color: #4ade80;"  # green
                else:
                    color = "color: #e2e8f0;"
            else:
                color = "color: #e2e8f0;"
            st.markdown(f'<div class="box-card"><div class="box-label">Box {box_code}: {label}</div><div class="box-value" style="{color}">{formatted_val}</div></div>', unsafe_allow_html=True)
        else:
            val_display = value if value else "—"
            if isinstance(value, bool):
                val_display = "✓ Yes" if value else "✗ No"
            elif isinstance(value, list) and len(value) > 0:
                # Format array values for boxes 11, 13, 14, etc.
                val_display = ", ".join([f"{item.get('code', '')}: {item.get('amount', item)}" for item in value])
            st.markdown(f'<div class="box-card"><div class="box-label">Box {box_code}: {label}</div><div class="box-value">{val_display}</div></div>', unsafe_allow_html=True)
    
    # Extract document metadata
    form_type = doc_metadata.get("form_type", "Schedule K-1 (Form 1065)")
    tax_year = doc_metadata.get("tax_year", "2024")
    partnership_name = doc_metadata.get("partnership_name", "")
    partnership_ein = doc_metadata.get("partnership_ein", "")
    
    # Form Header
    st.markdown(f'''
    <div class="form-info-header">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <span style="color: #a78bfa; font-size: 1.4rem; font-weight: 700;">📊 {form_type}</span>
                <span style="color: #94a3b8; margin-left: 0.75rem; font-size: 0.95rem;">Partner's Share of Income, Deductions, Credits, etc.</span>
            </div>
            <span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                Tax Year {tax_year}
            </span>
        </div>
        <div style="background: rgba(99, 102, 241, 0.1); border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem;">
            <span style="color: #94a3b8;">Partnership:</span> <span style="color: #e2e8f0; font-weight: 600;">{partnership_name}</span>
            <span style="color: #94a3b8; margin-left: 1rem;">EIN:</span> <span style="color: #e2e8f0;">{partnership_ein}</span>
        </div>
    </div>
    ''', unsafe_allow_html=True)
    
    # Display each partner's data
    for partner_idx, partner in enumerate(partner_records):
        partner_name = partner.get("partner_name", f"Partner {partner_idx + 1}")
        page_ref = partner.get("page_reference", partner_idx + 1)
        part_i = partner.get("part_i_partnership_plane", [])
        part_ii = partner.get("part_ii_partner_plane", [])
        part_iii = partner.get("part_iii_income_loss_plane", [])

            
        # Partner Header
        st.markdown(f'''
        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2)); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 1rem; margin: 1.5rem 0 1rem 0;">
            <span style="color: #a78bfa; font-size: 1.2rem; font-weight: 700;">👤 {partner_name}</span>
            <span style="color: #94a3b8; margin-left: 0.5rem; font-size: 0.9rem;">Partner {partner_idx + 1} of {len(partner_records)} (Page {page_ref})</span>
        </div>
        ''', unsafe_allow_html=True)
        
        # === PART I: Partnership Information ===
        st.markdown('<div class="section-header">📋 Part I: Partnership Information</div>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_i, "A")
            st.markdown(f'<div class="box-card"><div class="box-label">Box A: Partnership EIN</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        with col2:
            v = get_plane_value(part_i, "B")
            st.markdown(f'<div class="box-card"><div class="box-label">Box B: Partnership Name/Address</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        with col3:
            v = get_plane_value(part_i, "C")
            st.markdown(f'<div class="box-card"><div class="box-label">Box C: IRS Center</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        
        # === PART II: Partner Information ===
        st.markdown('<div class="section-header">👤 Part II: Partner Information</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_plane_value(part_ii, "E")
            st.markdown(f'<div class="box-card"><div class="box-label">Box E: Partner\'s TIN</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
            v = get_plane_value(part_ii, "F")
            st.markdown(f'<div class="box-card"><div class="box-label">Box F: Partner\'s Name/Address</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
            v = get_plane_value(part_ii, "I1")
            st.markdown(f'<div class="box-card"><div class="box-label">Box I1: Entity Type</div><div class="box-value">{v or "—"}</div></div>', unsafe_allow_html=True)
        
        with col2:
            v = get_plane_value(part_ii, "G")
            display_box_card("G", "General Partner/LLC Manager", v, is_currency=False)
            v = get_plane_value(part_ii, "H1")
            display_box_card("H1", "Domestic Partner", v, is_currency=False)
            v = get_plane_value(part_ii, "H2")
            display_box_card("H2", "Foreign Partner", v, is_currency=False)
        
        # === Box J: Profit Share ===
        st.markdown('<div class="section-header">📊 Box J: Partner\'s Share of Profit, Loss, and Capital</div>', unsafe_allow_html=True)
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_plane_value(part_ii, "J_Profit_Beg")
            st.markdown(f'<div class="box-card"><div class="box-label">Profit % (Beginning)</div><div class="box-value">{format_percentage(v)}</div></div>', unsafe_allow_html=True)
        with col2:
            v = get_plane_value(part_ii, "J_Profit_End")
            st.markdown(f'<div class="box-card"><div class="box-label">Profit % (Ending)</div><div class="box-value">{format_percentage(v)}</div></div>', unsafe_allow_html=True)
        
        # === Box L: Capital Account Analysis ===
        st.markdown('<div class="section-header">💰 Box L: Partner\'s Capital Account Analysis</div>', unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_ii, "L_Beg_Capital")
            display_box_card("L", "Beginning Capital", v)
            v = get_plane_value(part_ii, "L_Capital_Contributed")
            display_box_card("L", "Capital Contributed", v)
        
        with col2:
            v = get_plane_value(part_ii, "L_Net_Income")
            display_box_card("L", "Current Year Net Income (Loss)", v)
            v = get_plane_value(part_ii, "L_Withdrawals")
            display_box_card("L", "Withdrawals & Distributions", v)
        
        with col3:
            v = get_plane_value(part_ii, "L_Ending_Capital")
            if v is not None and isinstance(v, (int, float)):
                color = "#4ade80" if v >= 0 else "#ef4444"
                st.markdown(f'''
                <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">Ending Capital Account</div>
                    <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
                </div>
                ''', unsafe_allow_html=True)
        
        # === PART III: Partner's Share of Income/Loss ===
        st.markdown('<div class="section-header">💵 Part III: Partner\'s Share of Current Year Income, Deductions</div>', unsafe_allow_html=True)
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            v = get_plane_value(part_iii, "1")
            display_box_card("1", "Ordinary Business Income", v)
            v = get_plane_value(part_iii, "2")
            display_box_card("2", "Net Rental RE Income", v)
        
        with col2:
            v = get_plane_value(part_iii, "3")
            display_box_card("3", "Other Net Rental", v)
            v = get_plane_value(part_iii, "4c")
            display_box_card("4c", "Guaranteed Payments", v)
        
        with col3:
            v = get_plane_value(part_iii, "5")
            display_box_card("5", "Interest Income", v)
            v = get_plane_value(part_iii, "6a")
            display_box_card("6a", "Ordinary Dividends", v)
        
        with col4:
            v = get_plane_value(part_iii, "6b")
            display_box_card("6b", "Qualified Dividends", v)
            v = get_plane_value(part_iii, "7")
            display_box_card("7", "Royalties", v)
        
        # === Capital Gains/Losses ===
        st.markdown('<div class="section-header">📈 Capital Gains/Losses</div>', unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_iii, "8")
            display_box_card("8", "Net Short-Term Cap Gain", v)
        with col2:
            v = get_plane_value(part_iii, "9a")
            display_box_card("9a", "Net Long-Term Cap Gain", v)
        with col3:
            v = get_plane_value(part_iii, "10")
            display_box_card("10", "Net Section 1231 Gain", v)
        
        # === Deductions ===
        st.markdown('<div class="section-header">📋 Deductions</div>', unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_iii, "11")
            display_box_card("11", "Other Income (Loss)", v, is_currency=False)
        with col2:
            v = get_plane_value(part_iii, "12")
            display_box_card("12", "Section 179 Deduction", v)
        with col3:
            v = get_plane_value(part_iii, "13")
            display_box_card("13", "Other Deductions", v, is_currency=False)
        
        # === Additional Part III items ===
        with st.expander("📋 Additional Part III Items (Boxes 14-23)", expanded=False):
            col1, col2, col3 = st.columns(3)
            with col1:
                v = get_plane_value(part_iii, "14")
                display_box_card("14", "Self-Employment", v, is_currency=False)
                v = get_plane_value(part_iii, "19")
                display_box_card("19", "Distributions", v, is_currency=False)
            with col2:
                v = get_plane_value(part_iii, "16")
                display_box_card("16", "K-3 Attached", v, is_currency=False)
                v = get_plane_value(part_iii, "20")
                display_box_card("20", "Other Information", v, is_currency=False)
            with col3:
                v = get_plane_value(part_iii, "21")
                display_box_card("21", "Foreign Taxes", v)
                v = get_plane_value(part_iii, "22")
                display_box_card("22", "Multi At-Risk Activity", v, is_currency=False)
                v = get_plane_value(part_iii, "23")
                display_box_card("23", "Multi Passive Activity", v, is_currency=False)
        
        # Separator between partners
        if partner_idx < len(partner_records) - 1:
            st.markdown('<hr style="border: 1px dashed rgba(255,255,255,0.2); margin: 2rem 0;">', unsafe_allow_html=True)


def render_k3_table_view(data):
    """Render Schedule K-3 extraction results with international tax data."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Navigate to data - handle both list and dict formats
    doc_data = data
    if isinstance(data, list) and len(data) > 0:
        doc_data = data[0]
    
    # Get document metadata and partner records
    doc_metadata = doc_data.get("document_metadata", {})
    partner_records = doc_data.get("partner_records", [])
    
    # Helper functions
    def get_plane_value(plane, code):
        """Get value from a plane by code."""
        if not plane:
            return None
        for item in plane:
            data_list = item.get("data", [])
            for d in data_list:
                if d.get("code") == code:
                    return d.get("value")
        return None
    
    def format_currency(val):
        if val is None:
            return "—"
        if isinstance(val, (int, float)):
            if val < 0:
                return f"(${abs(val):,.2f})"
            return f"${val:,.2f}"
        return str(val)
    
    def display_box_card(box_code, label, value, is_currency=True):
        if is_currency:
            formatted_val = format_currency(value)
            if isinstance(value, (int, float)):
                if value < 0:
                    color = "color: #ef4444;"
                elif value > 0:
                    color = "color: #4ade80;"
                else:
                    color = "color: #e2e8f0;"
            else:
                color = "color: #e2e8f0;"
            st.markdown(f'<div class="box-card"><div class="box-label">{box_code}: {label}</div><div class="box-value" style="{color}">{formatted_val}</div></div>', unsafe_allow_html=True)
        else:
            val_display = value if value else "—"
            if isinstance(value, bool):
                val_display = "✓ Yes" if value else "✗ No"
            st.markdown(f'<div class="box-card"><div class="box-label">{box_code}: {label}</div><div class="box-value">{val_display}</div></div>', unsafe_allow_html=True)
    
    # Extract document metadata
    form_type = doc_metadata.get("form_type", "Schedule K-3 (Form 1065)")
    tax_year = doc_metadata.get("tax_year", "2024")
    partnership_name = doc_metadata.get("partnership_name", "")
    partnership_ein = doc_metadata.get("partnership_ein", "")
    
    # Form Header with blue theme for K-3 (international)
    st.markdown(f'''
    <div class="form-info-header" style="border-color: rgba(59, 130, 246, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <span style="color: #60a5fa; font-size: 1.4rem; font-weight: 700;">🌐 {form_type}</span>
                <span style="color: #94a3b8; margin-left: 0.75rem; font-size: 0.95rem;">Partner's Share of International Tax Information</span>
            </div>
            <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                Tax Year {tax_year}
            </span>
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem;">
            <span style="color: #94a3b8;">Partnership:</span> <span style="color: #e2e8f0; font-weight: 600;">{partnership_name}</span>
            <span style="color: #94a3b8; margin-left: 1rem;">EIN:</span> <span style="color: #e2e8f0;">{partnership_ein}</span>
        </div>
    </div>
    ''', unsafe_allow_html=True)
    
    # Display each partner's K-3 data
    for partner_idx, partner in enumerate(partner_records):
        partner_name = partner.get("partner_name", f"Partner {partner_idx + 1}")
        page_ref = partner.get("page_reference", partner_idx + 1)
        part_i = partner.get("part_i_other_international", [])
        part_ii = partner.get("part_ii_foreign_tax_credit", [])
        part_iii = partner.get("part_iii_form_1116_1118", [])
        
        # Partner Header
        st.markdown(f'''
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2)); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 1rem; margin: 1.5rem 0 1rem 0;">
            <span style="color: #60a5fa; font-size: 1.2rem; font-weight: 700;">👤 {partner_name}</span>
            <span style="color: #94a3b8; margin-left: 0.5rem; font-size: 0.9rem;">Partner {partner_idx + 1} of {len(partner_records)} (Page {page_ref})</span>
        </div>
        ''', unsafe_allow_html=True)
        
        # === PART I: Other International Information ===
        st.markdown('<div class="section-header">🌍 Part I: Other Current Year International Information</div>', unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_i, "1")
            display_box_card("1", "Gain on Personal Property Sale", v)
            v = get_plane_value(part_i, "2")
            display_box_card("2", "Foreign Oil and Gas Taxes", v)
        
        with col2:
            v = get_plane_value(part_i, "5")
            display_box_card("5", "High-Taxed Income", v)
            v = get_plane_value(part_i, "6")
            display_box_card("6", "Section 267A Disallowed Deduction", v)
        
        with col3:
            v = get_plane_value(part_i, "3")
            display_box_card("3", "Splitter Arrangements", v, is_currency=False)
            v = get_plane_value(part_i, "7")
            display_box_card("7", "Form 5471 Information", v, is_currency=False)
        
        # === PART II: Foreign Tax Credit Limitation ===
        st.markdown('<div class="section-header">💱 Part II: Foreign Tax Credit Limitation</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown('<div class="subsection-title">Gross Income by Category</div>', unsafe_allow_html=True)
            v = get_plane_value(part_ii, "24a")
            display_box_card("24a", "Total Gross Income - Passive", v)
            v = get_plane_value(part_ii, "24b")
            display_box_card("24b", "Total Gross Income - General", v)
            v = get_plane_value(part_ii, "24f")
            display_box_card("24f", "Total Gross Income - US Source", v)
            v = get_plane_value(part_ii, "24g")
            if v is not None and isinstance(v, (int, float)):
                color = "#4ade80" if v >= 0 else "#ef4444"
                st.markdown(f'''
                <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center; margin: 0.5rem 0;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">24g: Total Gross Income</div>
                    <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
                </div>
                ''', unsafe_allow_html=True)
            else:
                display_box_card("24g", "Total Gross Income - Total", v)
        
        with col2:
            st.markdown('<div class="subsection-title">Net Income (Loss) by Category</div>', unsafe_allow_html=True)
            v = get_plane_value(part_ii, "55a")
            display_box_card("55a", "Net Income - Passive", v)
            v = get_plane_value(part_ii, "55b")
            display_box_card("55b", "Net Income - General", v)
            v = get_plane_value(part_ii, "55f")
            display_box_card("55f", "Net Income - US Source", v)
            v = get_plane_value(part_ii, "55g")
            if v is not None and isinstance(v, (int, float)):
                color = "#4ade80" if v >= 0 else "#ef4444"
                st.markdown(f'''
                <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center; margin: 0.5rem 0;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">55g: Net Income (Loss) Total</div>
                    <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
                </div>
                ''', unsafe_allow_html=True)
            else:
                display_box_card("55g", "Net Income (Loss) - Total", v)
        
        # === PART III: Form 1116/1118 Information ===
        st.markdown('<div class="section-header">📋 Part III: Other Information for Form 1116 or 1118</div>', unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            v = get_plane_value(part_iii, "1")
            display_box_card("1", "R&E Expenses Apportionment", v)
        with col2:
            v = get_plane_value(part_iii, "2")
            display_box_card("2", "Foreign Taxes Paid", v)
            v = get_plane_value(part_iii, "3")
            display_box_card("3", "Foreign Taxes Accrued", v)
        with col3:
            v = get_plane_value(part_iii, "4")
            display_box_card("4", "Reduction of Foreign Taxes", v)
            v = get_plane_value(part_iii, "5")
            display_box_card("5", "Gross Receipts for Section 250", v)
        
        # Separator between partners
        if partner_idx < len(partner_records) - 1:
            st.markdown('<hr style="border: 1px dashed rgba(255,255,255,0.2); margin: 2rem 0;">', unsafe_allow_html=True)



def render_8805_table_view(data):
    """Render Form 8805 extraction results with partner information."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Get extracted forms from data
    forms_8805 = []
    if isinstance(data, dict):
        forms_8805 = data.get("extracted_forms_8805", [])
        if not forms_8805 and "partner_name" in data:
            # Single form result
            forms_8805 = [data]
    elif isinstance(data, list):
        forms_8805 = data
    
    if not forms_8805:
        st.warning("No Form 8805 data found in extraction results")
        return
    
    # Helper functions
    def format_currency(val):
        if val is None:
            return "—"
        if isinstance(val, (int, float)):
            if val < 0:
                return f"(${abs(val):,.2f})"
            return f"${val:,.2f}"
        return str(val)
    
    def get_field_value(fields, code):
        """Get value from fields list by code."""
        if not fields:
            return None
        for field in fields:
            if field.get("code") == code:
                return field.get("value")
        return None
    
    def display_field_card(code, label, value, is_currency=False):
        if is_currency:
            formatted_val = format_currency(value)
            if isinstance(value, (int, float)):
                if value < 0:
                    color = "color: #ef4444;"
                elif value > 0:
                    color = "color: #4ade80;"
                else:
                    color = "color: #e2e8f0;"
            else:
                color = "color: #e2e8f0;"
            st.markdown(f'<div class="box-card"><div class="box-label">{code}: {label}</div><div class="box-value" style="{color}">{formatted_val}</div></div>', unsafe_allow_html=True)
        else:
            val_display = value if value else "—"
            if isinstance(value, bool):
                val_display = "✓ Yes" if value else "✗ No"
            st.markdown(f'<div class="box-card"><div class="box-label">{code}: {label}</div><div class="box-value">{val_display}</div></div>', unsafe_allow_html=True)
    
    # Form Header
    st.markdown(f'''
    <div class="form-info-header" style="border-color: rgba(34, 197, 94, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <span style="color: #4ade80; font-size: 1.4rem; font-weight: 700;">🌍 Form 8805</span>
                <span style="color: #94a3b8; margin-left: 0.75rem; font-size: 0.95rem;">Foreign Partner's Information Statement</span>
            </div>
            <span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                Section 1446 Withholding Tax
            </span>
        </div>
    </div>
    ''', unsafe_allow_html=True)
    
    # Display each Form 8805
    for form_idx, form in enumerate(forms_8805):
        partner_name = form.get("partner_name", f"Partner {form_idx + 1}")
        form_type = form.get("form_type", "Form 8805")
        copy_type = form.get("copy_type", "")
        page_ref = form.get("page_reference", form_idx + 1)
        fields = form.get("fields", [])
        
        # Partner Header
        st.markdown(f'''
        <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.2)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 1rem; margin: 1.5rem 0 1rem 0;">
            <span style="color: #4ade80; font-size: 1.2rem; font-weight: 700;">👤 {partner_name}</span>
            <span style="color: #94a3b8; margin-left: 0.5rem; font-size: 0.9rem;">Form {form_idx + 1} of {len(forms_8805)} (Page {page_ref})</span>
            <span style="color: #86efac; margin-left: 0.5rem; font-size: 0.8rem;">{copy_type}</span>
        </div>
        ''', unsafe_allow_html=True)
        
        # === Partner Information (Boxes 1a-4) ===
        st.markdown('<div class="section-header">👤 Partner Information</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_field_value(fields, "1a")
            display_field_card("1a", "Foreign partner's name", v)
            v = get_field_value(fields, "1b")
            display_field_card("1b", "U.S. identifying number", v)
            v = get_field_value(fields, "1c")
            display_field_card("1c", "Address", v)
        
        with col2:
            v = get_field_value(fields, "2")
            display_field_card("2", "Account number", v)
            v = get_field_value(fields, "3")
            display_field_card("3", "Type of partner", v)
            v = get_field_value(fields, "4")
            display_field_card("4", "Country code", v)
        
        # === Partnership Information (Boxes 5a-5c) ===
        st.markdown('<div class="section-header">🏢 Partnership Information</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_field_value(fields, "5a")
            display_field_card("5a", "Name of partnership", v)
            v = get_field_value(fields, "5b")
            display_field_card("5b", "Partnership EIN", v)
        
        with col2:
            v = get_field_value(fields, "5c")
            display_field_card("5c", "Address of partnership", v)
        
        # === Withholding Agent (Boxes 6-7) ===
        st.markdown('<div class="section-header">💼 Withholding Agent</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_field_value(fields, "6")
            display_field_card("6", "Withholding agent's name", v)
        
        with col2:
            v = get_field_value(fields, "7")
            display_field_card("7", "Withholding agent's EIN", v)
        
        # === Checkboxes (Boxes 8a-8b) ===
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_field_value(fields, "8a")
            display_field_card("8a", "Partnership owns interest in other partnerships", v)
        
        with col2:
            v = get_field_value(fields, "8b")
            display_field_card("8b", "Any ECTI exempt from U.S. tax", v)
        
        # === Tax Information (Boxes 9-10) - Highlight these as key values ===
        st.markdown('<div class="section-header">💰 Tax Information</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            v = get_field_value(fields, "9")
            if v is not None and isinstance(v, (int, float)):
                color = "#4ade80" if v >= 0 else "#ef4444"
                st.markdown(f'''
                <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center; margin: 0.5rem 0;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">9: Partnership's ECTI allocable to partner</div>
                    <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
                </div>
                ''', unsafe_allow_html=True)
            else:
                display_field_card("9", "Partnership's ECTI allocable to partner", v, is_currency=True)
        
        with col2:
            v = get_field_value(fields, "10")
            if v is not None and isinstance(v, (int, float)):
                color = "#60a5fa" if v >= 0 else "#ef4444"
                st.markdown(f'''
                <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center; margin: 0.5rem 0;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">10: Total tax credit allowed</div>
                    <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
                </div>
                ''', unsafe_allow_html=True)
            else:
                display_field_card("10", "Total tax credit allowed", v, is_currency=True)
        
        # === Beneficiary Information (Boxes 11-13) - In expander ===
        with st.expander("📋 Beneficiary Information (Boxes 11-13)", expanded=False):
            col1, col2, col3 = st.columns(3)
            
            with col1:
                v = get_field_value(fields, "11a")
                display_field_card("11a", "Name of beneficiary", v)
            
            with col2:
                v = get_field_value(fields, "11b")
                display_field_card("11b", "Beneficiary's TIN", v)
            
            with col3:
                v = get_field_value(fields, "11c")
                display_field_card("11c", "Beneficiary's address", v)
            
            col1, col2 = st.columns(2)
            
            with col1:
                v = get_field_value(fields, "12")
                display_field_card("12", "ECTI included in beneficiary's gross income", v, is_currency=True)
            
            with col2:
                v = get_field_value(fields, "13")
                display_field_card("13", "Tax credit beneficiary entitled to claim", v, is_currency=True)
        
        # Separator between forms
        if form_idx < len(forms_8805) - 1:
            st.markdown('<hr style="border: 1px dashed rgba(255,255,255,0.2); margin: 2rem 0;">', unsafe_allow_html=True)


def render_8804_table_view(data):
    """Render Form 8804 extraction results with parts structure."""
    if has_error(data):
        st.error(f"❌ {data['error']}")
        return
    
    # Get extracted forms from data
    forms_8804 = []
    if isinstance(data, dict):
        forms_8804 = data.get("extracted_forms_8804", [])
        if not forms_8804 and "form_metadata" in data:
            forms_8804 = [data]
    elif isinstance(data, list):
        forms_8804 = data
    
    if not forms_8804:
        st.warning("No Form 8804 data found in extraction results")
        return
    
    def format_currency(val):
        if val is None:
            return "—"
        if isinstance(val, (int, float)):
            if val < 0:
                return f"(${abs(val):,.2f})"
            return f"${val:,.2f}"
        return str(val)
    
    def get_part_field(parts, part_num, code):
        for part in parts:
            if part.get("part_number") == part_num:
                for field in part.get("fields", []):
                    if field.get("code") == code:
                        return field.get("value")
        return None
    
    def display_field_card(code, label, value, is_currency=False):
        if is_currency:
            formatted_val = format_currency(value)
            if isinstance(value, (int, float)):
                color = "color: #ef4444;" if value < 0 else ("color: #4ade80;" if value > 0 else "color: #e2e8f0;")
            else:
                color = "color: #e2e8f0;"
            st.markdown(f'<div class="box-card"><div class="box-label">{code}: {label}</div><div class="box-value" style="{color}">{formatted_val}</div></div>', unsafe_allow_html=True)
        else:
            val_display = value if value else "—"
            st.markdown(f'<div class="box-card"><div class="box-label">{code}: {label}</div><div class="box-value">{val_display}</div></div>', unsafe_allow_html=True)
    
    # Form header
    st.markdown(f'''
    <div class="form-info-header" style="border-color: rgba(168, 85, 247, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <span style="color: #a855f7; font-size: 1.4rem; font-weight: 700;">📑 Form 8804</span>
                <span style="color: #94a3b8; margin-left: 0.75rem; font-size: 0.95rem;">Annual Return for Partnership Withholding Tax</span>
            </div>
            <span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                Section 1446
            </span>
        </div>
    </div>
    ''', unsafe_allow_html=True)
    
    for form_idx, form in enumerate(forms_8804):
        metadata = form.get("form_metadata", {})
        parts = form.get("parts", [])
        page_ref = form.get("page_reference", form_idx + 1)
        
        partnership_name = metadata.get("partnership_name", "Unknown Partnership")
        tax_year = metadata.get("tax_year", "")
        
        # Partnership header
        st.markdown(f'''
        <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.2)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 1rem; margin: 1.5rem 0 1rem 0;">
            <span style="color: #a855f7; font-size: 1.2rem; font-weight: 700;">🏢 {partnership_name}</span>
            <span style="color: #94a3b8; margin-left: 0.5rem; font-size: 0.9rem;">Tax Year {tax_year} (Page {page_ref})</span>
        </div>
        ''', unsafe_allow_html=True)
        
        # PART I: Partnership Information
        st.markdown('<div class="section-header">Part I: Partnership Information</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "I", "1a")
            display_field_card("1a", "Name of partnership", v)
            v = get_part_field(parts, "I", "1c")
            display_field_card("1c", "Address", v)
        with col2:
            v = get_part_field(parts, "I", "1b")
            display_field_card("1b", "EIN", v)
            v = get_part_field(parts, "I", "1d")
            display_field_card("1d", "City, State, ZIP", v)
        
        # PART II: Withholding Agent
        st.markdown('<div class="section-header">Part II: Withholding Agent</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "II", "2a")
            display_field_card("2a", "Withholding agent's name", v)
        with col2:
            v = get_part_field(parts, "II", "2b")
            display_field_card("2b", "Withholding agent's EIN", v)
        
        # PART III: Tax Liability and Payments
        st.markdown('<div class="section-header">Part III: Section 1446 Tax Liability</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "III", "3a")
            display_field_card("3a", "Number of foreign partners", v)
        with col2:
            v = get_part_field(parts, "III", "3b")
            display_field_card("3b", "Number of Forms 8805 attached", v)
        
        # ECTI Calculations
        st.markdown('<div class="section-header">📊 ECTI (Effectively Connected Taxable Income)</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "III", "4d")
            display_field_card("4d", "ECTI (corporate partners)", v, is_currency=True)
            v = get_part_field(parts, "III", "4e")
            display_field_card("4e", "ECTI (non-corporate)", v, is_currency=True)
            v = get_part_field(parts, "III", "4h")
            display_field_card("4h", "Combined ECTI", v, is_currency=True)
        with col2:
            v = get_part_field(parts, "III", "4l")
            display_field_card("4l", "28% rate gain", v, is_currency=True)
            v = get_part_field(parts, "III", "4p")
            display_field_card("4p", "25% rate gain", v, is_currency=True)
        
        # Page 2 - Capital Gains & Adjustments
        st.markdown('<div class="section-header">📈 Capital Gains & Adjustments (Page 2)</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "III", "4q")
            display_field_card("4q", "Adjusted net capital gain", v, is_currency=True)
            v = get_part_field(parts, "III", "4r")
            display_field_card("4r", "Reduction (state/local taxes)", v, is_currency=True)
        with col2:
            v = get_part_field(parts, "III", "4s")
            display_field_card("4s", "Reduction (foreign partner items)", v, is_currency=True)
            v = get_part_field(parts, "III", "4t")
            display_field_card("4t", "Combined 4q, 4r, 4s", v, is_currency=True)
        
        # Gross Section 1446 Tax Liability
        st.markdown('<div class="section-header">💰 Gross Section 1446 Tax Liability</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "III", "5a")
            display_field_card("5a", "Line 4d × 21%", v, is_currency=True)
            v = get_part_field(parts, "III", "5b")
            display_field_card("5b", "Line 4h × 37%", v, is_currency=True)
            v = get_part_field(parts, "III", "5c")
            display_field_card("5c", "Line 4l × 28%", v, is_currency=True)
        with col2:
            v = get_part_field(parts, "III", "5d")
            display_field_card("5d", "Line 4p × 25%", v, is_currency=True)
            v = get_part_field(parts, "III", "5e")
            display_field_card("5e", "Line 4t × 20%", v, is_currency=True)
            v = get_part_field(parts, "III", "5f")
            display_field_card("5f", "Total gross tax liability", v, is_currency=True)
        
        # Payments and Credits
        st.markdown('<div class="section-header">💳 Payments and Credits</div>', unsafe_allow_html=True)
        
        col1, col2 = st.columns(2)
        with col1:
            v = get_part_field(parts, "III", "6a")
            display_field_card("6a", "Tax paid by partnership", v, is_currency=True)
        with col2:
            v = get_part_field(parts, "III", "10")
            display_field_card("10", "Total payments and credits", v, is_currency=True)
        
        # Balance due - highlight
        v = get_part_field(parts, "III", "13")
        if v is not None and isinstance(v, (int, float)):
            color = "#ef4444" if v > 0 else "#4ade80"
            st.markdown(f'''
            <div style="background: rgba(30, 41, 59, 0.9); border: 2px solid {color}; border-radius: 12px; padding: 1rem; text-align: center; margin: 1rem 0;">
                <div style="color: #94a3b8; font-size: 0.85rem;">13: Balance Due</div>
                <div style="color: {color}; font-size: 1.5rem; font-weight: 700;">{format_currency(v)}</div>
            </div>
            ''', unsafe_allow_html=True)
        else:
            display_field_card("13", "Balance due", v, is_currency=True)
        
        if form_idx < len(forms_8804) - 1:
            st.markdown('<hr style="border: 1px dashed rgba(255,255,255,0.2); margin: 2rem 0;">', unsafe_allow_html=True)


def render_results(data):
    """Render extraction results in plane format."""
    if has_error(data):

        st.error(f"❌ {data['error']}")
        if "raw" in data:
            with st.expander("Raw Response"):
                st.code(data["raw"])
        return
    
    # Navigate to forms
    forms_data = data
    if isinstance(data, list) and len(data) > 0:
        forms_data = data[0].get("forms", data)
    elif isinstance(data, dict):
        forms_data = data.get("forms", [data])
    
    if not isinstance(forms_data, list):
        forms_data = [forms_data]
    
    for form in forms_data:
        # Form Header
        header = form.get("form_header", {})
        year = header.get("year", "2024")
        form_num = header.get("form_number", "Form")
        form_type = header.get("type", "Tax Form")
        
        st.markdown(f'''
        <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: #a78bfa; font-size: 1.4rem; font-weight: 700;">📄 {form_num}</span>
                    <span style="color: #94a3b8; margin-left: 0.75rem; font-size: 0.95rem;">{form_type}</span>
                </div>
                <span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                    Tax Year {year}
                </span>
            </div>
        </div>
        ''', unsafe_allow_html=True)
        
        # Process boxes
        boxes = form.get("boxes", [])
        col1, col2 = st.columns(2)
        col_idx = 0
        
        for box in boxes:
            for plane_name, plane_data in box.items():
                if plane_name == "boxes" and isinstance(plane_data, list):
                    # Nested boxes (supplemental_plane, etc.)
                    for nested in plane_data:
                        if isinstance(nested, dict):
                            for n_name, n_data in nested.items():
                                col = col1 if col_idx % 2 == 0 else col2
                                with col:
                                    st.markdown(render_plane(n_name, n_data), unsafe_allow_html=True)
                                col_idx += 1
                else:
                    col = col1 if col_idx % 2 == 0 else col2
                    with col:
                        st.markdown(render_plane(plane_name, plane_data), unsafe_allow_html=True)
                    col_idx += 1


# =============================================================================
# Main App
# =============================================================================
def main():
    if "logger" not in st.session_state:
        st.session_state.logger = ExtractionLogger()
    if "detector" not in st.session_state:
        st.session_state.detector = FormDetector()
    if "client" not in st.session_state:
        st.session_state.client = VisionClient()
    
    # Header
    st.markdown('''
    <div class="main-header">
        <h1>🔍 US Tax Form Extractor</h1>
        <p>Auto-detects W-2, 1099-INT, 1099-NEC and extracts structured data</p>
    </div>
    ''', unsafe_allow_html=True)
    
    # Sidebar
    with st.sidebar:
        st.markdown("### ⚙️ Settings")
        model = st.selectbox("AI Model", ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-3.2-90b-vision-instruct", "gemini-2.5-flash", "gpt-4o-mini"])
        
        st.markdown("---")
        st.markdown("### 📋 Supported Forms")
        for ft, info in SUPPORTED_FORMS.items():
            st.caption(f"{info['icon']} {ft}")
        
        st.markdown("---")
        st.markdown("### 📊 Status")
        if st.session_state.client.gemini_ready:
            st.success("✅ Gemini")
        else:
            st.warning("⚠️ Gemini")
        if st.session_state.client.groq_client:
            st.success("✅ Groq")
        else:
            st.warning("⚠️ Groq")
    
    # Main layout
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.markdown("### 📤 Upload Form")
        uploaded = st.file_uploader("PDF or Image", type=["pdf", "png", "jpg", "jpeg"])
        
        if uploaded:
            # Get image(s) from PDF or single image
            all_images = []
            if "pdf" in uploaded.type and PDF_SUPPORT:
                all_images = pdf_to_images(uploaded.getvalue())
            else:
                all_images = [Image.open(uploaded)]
            
            if all_images:
                num_pages = len(all_images)
                
                # Page selector for multi-page PDFs
                if num_pages > 1:
                    st.markdown(f"**📄 {num_pages} pages**")
                    page_idx = st.slider("Select page to preview", 1, num_pages, 1, key="page_selector") - 1
                    img = all_images[page_idx]
                    st.image(img, caption=f"Page {page_idx + 1} of {num_pages}", width=None, use_container_width=True)
                else:
                    img = all_images[0]
                    st.image(img, caption="Preview", width=None, use_container_width=True)
                
                # Detect
                detection = st.session_state.detector.detect(img, uploaded.name)
                form_type = detection["form_type"]
                
                if form_type != "UNKNOWN":
                    info = SUPPORTED_FORMS.get(form_type, {})
                    st.markdown(f'''
                    <div class="form-detected">
                        <strong style="color: #22c55e;">{info.get('icon', '📄')} Detected: {form_type}</strong>
                        <span style="color: #86efac; font-size: 0.85rem;"> — {info.get('name', '')}</span>
                    </div>
                    ''', unsafe_allow_html=True)
                else:
                    st.markdown('''
                    <div class="form-unknown">
                        <strong style="color: #ef4444;">⚠️ Unknown Form</strong>
                        <span style="color: #fca5a5; font-size: 0.85rem;"> — Not in supported list</span>
                    </div>
                    ''', unsafe_allow_html=True)
                
                # For K-1 PDFs, first scan to find K-1 pages
                is_k1_pdf = form_type == "K-1" and "pdf" in uploaded.type and MULTIPAGE_K1_AVAILABLE
                
                if is_k1_pdf:
                    # Initialize processor and scan for K-1 pages
                    if "k1_processor" not in st.session_state:
                        st.session_state.k1_processor = MultiPageK1Processor()
                    
                    pdf_bytes = uploaded.getvalue()
                    
                    # Scan for K-1 pages (cached in session state)
                    if "k1_detected_pages" not in st.session_state or st.session_state.get("k1_pdf_name") != uploaded.name:
                        with st.spinner("🔍 Scanning for K-1 pages..."):
                            st.session_state.k1_detected_pages = st.session_state.k1_processor.detect_k1_pages(pdf_bytes)
                            st.session_state.k1_pdf_name = uploaded.name
                            st.session_state.k1_pdf_bytes = pdf_bytes
                    
                    k1_pages = st.session_state.k1_detected_pages
                    
                    if k1_pages:
                        # Show detected K-1 pages
                        st.markdown(f'''
                        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 0.75rem; margin: 0.5rem 0;">
                            <strong style="color: #22c55e;">📄 Found {len(k1_pages)} K-1 Form(s)</strong>
                            <div style="color: #86efac; font-size: 0.9rem; margin-top: 0.25rem;">
                                Pages: {", ".join(map(str, k1_pages))}
                            </div>
                        </div>
                        ''', unsafe_allow_html=True)
                        
                        # Page selection dropdown
                        page_options = [f"Page {p}" for p in k1_pages]
                        selected_page_label = st.selectbox(
                            "Select K-1 page to extract:",
                            options=page_options,
                            index=0,
                            key="k1_page_selector"
                        )
                        selected_page = k1_pages[page_options.index(selected_page_label)]
                        
                        # Extract button for selected page
                        if st.button(f"🚀 Extract Page {selected_page}", type="primary", use_container_width=True):
                            start = time.time()
                            progress_container = st.empty()
                            status_container = st.empty()
                            
                            try:
                                status_container.info(f"🤖 Extracting K-1 data from page {selected_page}...")
                                progress_container.progress(30, text="Converting page to image...")
                                
                                # Extract only the selected page
                                page_images = st.session_state.k1_processor.extract_k1_pages_as_images(
                                    st.session_state.k1_pdf_bytes, [selected_page]
                                )
                                
                                progress_container.progress(60, text="Extracting data with AI...")
                                
                                if page_images:
                                    result = st.session_state.k1_processor.batch_extract(page_images, model)
                                    
                                    # Add metadata
                                    if isinstance(result, list) and len(result) > 0:
                                        result[0]["_processing_metadata"] = {
                                            "k1_pages_found": k1_pages,
                                            "extracted_page": selected_page,
                                            "total_partners": len(result[0].get("partner_records", []))
                                        }
                                    
                                    status_container.success(f"✅ Extracted data from page {selected_page}")
                                else:
                                    result = {"error": f"Failed to convert page {selected_page}"}
                                    status_container.error(f"❌ Failed to extract page {selected_page}")
                                
                            except Exception as e:
                                result = {"error": f"Extraction failed: {str(e)}"}
                                status_container.error(f"❌ {str(e)}")
                            
                            progress_container.empty()
                            elapsed = time.time() - start
                            
                            status = "SUCCESS" if not has_error(result) else "FAILED"
                            st.session_state.logger.log(uploaded.name, form_type, status, elapsed, model, get_error(result))
                            
                            st.session_state["result"] = result
                            st.session_state["form_type"] = form_type
                            st.session_state["time"] = elapsed
                            st.session_state["filename"] = f"{uploaded.name} (Page {selected_page})"
                            
                            if status == "SUCCESS":
                                st.success(f"✅ Done in {elapsed:.1f}s")
                    else:
                        st.warning("⚠️ No K-1 forms detected in this PDF")
                
                # For K-3 PDFs (or same PDF with K-1), scan for K-3 page RANGES
                is_k3_pdf = "pdf" in uploaded.type and MULTIPAGE_K3_AVAILABLE
                
                if is_k3_pdf:
                    # Initialize K-3 processor and scan for K-3 pages
                    if "k3_processor" not in st.session_state:
                        st.session_state.k3_processor = MultiPageK3Processor()
                    
                    pdf_bytes = uploaded.getvalue()
                    
                    # Scan for K-3 page ranges (cached in session state)
                    if "k3_detected_ranges" not in st.session_state or st.session_state.get("k3_pdf_name") != uploaded.name:
                        with st.spinner("🔍 Scanning for K-3 page ranges..."):
                            st.session_state.k3_detected_ranges = st.session_state.k3_processor.detect_k3_page_ranges(pdf_bytes)
                            st.session_state.k3_pdf_name = uploaded.name
                            st.session_state.k3_pdf_bytes = pdf_bytes
                    
                    k3_ranges = st.session_state.k3_detected_ranges
                    
                    if k3_ranges:
                        # Format ranges for display (e.g., "5-8, 17-22")
                        range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in k3_ranges]
                        
                        # Show detected K-3 page ranges
                        st.markdown(f'''
                        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; border-radius: 8px; padding: 0.75rem; margin: 0.5rem 0;">
                            <strong style="color: #3b82f6;">🌐 Found {len(k3_ranges)} K-3 Form(s)</strong>
                            <div style="color: #93c5fd; font-size: 0.9rem; margin-top: 0.25rem;">
                                Page Ranges: {", ".join(range_strs)}
                            </div>
                        </div>
                        ''', unsafe_allow_html=True)
                        
                        # Range selection dropdown for K-3
                        k3_range_options = [f"Pages {s}-{e}" if s != e else f"Page {s}" for s, e in k3_ranges]
                        selected_k3_range_label = st.selectbox(
                            "Select K-3 form to extract (all pages in range):",
                            options=k3_range_options,
                            index=0,
                            key="k3_range_selector"
                        )
                        selected_k3_range = k3_ranges[k3_range_options.index(selected_k3_range_label)]
                        start_page, end_page = selected_k3_range
                        
                        # Calculate pages in range
                        pages_in_range = list(range(start_page, end_page + 1))
                        num_pages = len(pages_in_range)
                        
                        st.caption(f"Will extract {num_pages} page(s): {start_page} to {end_page}")
                        
                        # Use unique button key based on range to prevent stale button states
                        button_key = f"k3_extract_btn_{start_page}_{end_page}"
                        
                        # Extract button for selected K-3 range
                        if st.button(f"🌐 Extract K-3 Pages {start_page}-{end_page}", type="primary", use_container_width=True, key=button_key):
                            start = time.time()
                            progress_container = st.empty()
                            status_container = st.empty()
                            
                            try:
                                status_container.info(f"🤖 Extracting K-3 data from pages {start_page}-{end_page}...")
                                progress_container.progress(20, text=f"Converting {num_pages} pages to images...")
                                
                                # Extract ALL pages in the selected range
                                page_images = st.session_state.k3_processor.extract_k3_pages_as_images(
                                    st.session_state.k3_pdf_bytes, pages_in_range
                                )
                                
                                progress_container.progress(50, text=f"Extracting data from {num_pages} pages with AI...")
                                
                                if page_images:
                                    result = st.session_state.k3_processor.batch_extract(page_images, model)
                                    
                                    # Add metadata including which range was extracted
                                    if isinstance(result, list) and len(result) > 0:
                                        result[0]["_processing_metadata"] = {
                                            "k3_ranges_found": k3_ranges,
                                            "extracted_range": f"{start_page}-{end_page}",
                                            "pages_extracted": pages_in_range,
                                            "total_partners": len(result[0].get("partner_records", []))
                                        }
                                    
                                    status_container.success(f"✅ Extracted K-3 data from pages {start_page}-{end_page}")
                                else:
                                    result = {"error": f"Failed to convert K-3 pages {start_page}-{end_page}"}
                                    status_container.error(f"❌ Failed to extract K-3 pages")
                                
                            except Exception as e:
                                result = {"error": f"K-3 extraction failed: {str(e)}"}
                                status_container.error(f"❌ {str(e)}")
                            
                            progress_container.empty()
                            elapsed = time.time() - start
                            
                            status = "SUCCESS" if not has_error(result) else "FAILED"
                            st.session_state.logger.log(uploaded.name, "K-3", status, elapsed, model, get_error(result))
                            
                            # Store result with range info
                            st.session_state["result"] = result
                            st.session_state["k3_extracted_range"] = f"{start_page}-{end_page}"
                            st.session_state["form_type"] = "K-3"
                            st.session_state["time"] = elapsed
                            st.session_state["filename"] = f"{uploaded.name} (K-3 Pages {start_page}-{end_page})"
                            
                            if status == "SUCCESS":
                                st.success(f"✅ Done in {elapsed:.1f}s - Extracted {num_pages} pages")
                
                # For Form 8805 PDFs, scan for page RANGES
                is_8805_pdf = "pdf" in uploaded.type and MULTIPAGE_8805_AVAILABLE
                
                if is_8805_pdf:
                    # Initialize Form 8805 processor and scan for pages
                    if "processor_8805" not in st.session_state:
                        st.session_state.processor_8805 = MultiPage8805Processor()
                    
                    pdf_bytes = uploaded.getvalue()
                    
                    # Scan for Form 8805 page ranges (cached in session state)
                    if "detected_ranges_8805" not in st.session_state or st.session_state.get("pdf_name_8805") != uploaded.name:
                        with st.spinner("🔍 Scanning for Form 8805 pages..."):
                            st.session_state.detected_ranges_8805 = st.session_state.processor_8805.detect_8805_page_ranges(pdf_bytes)
                            st.session_state.pdf_name_8805 = uploaded.name
                            st.session_state.pdf_bytes_8805 = pdf_bytes
                    
                    ranges_8805 = st.session_state.detected_ranges_8805
                    
                    if ranges_8805:
                        # Format ranges for display (e.g., "5-8, 25-28")
                        range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in ranges_8805]
                        
                        # Show detected Form 8805 page ranges
                        st.markdown(f'''
                        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 0.75rem; margin: 0.5rem 0;">
                            <strong style="color: #22c55e;">🌍 Found {len(ranges_8805)} Form 8805(s)</strong>
                            <div style="color: #86efac; font-size: 0.9rem; margin-top: 0.25rem;">
                                Page Ranges: {", ".join(range_strs)}
                            </div>
                        </div>
                        ''', unsafe_allow_html=True)
                        
                        # Range selection dropdown for Form 8805
                        range_options_8805 = [f"Pages {s}-{e}" if s != e else f"Page {s}" for s, e in ranges_8805]
                        selected_range_label_8805 = st.selectbox(
                            "Select Form 8805 to extract:",
                            options=range_options_8805,
                            index=0,
                            key="range_selector_8805"
                        )
                        selected_range_8805 = ranges_8805[range_options_8805.index(selected_range_label_8805)]
                        start_page_8805, end_page_8805 = selected_range_8805
                        
                        # Calculate pages in range
                        pages_in_range_8805 = list(range(start_page_8805, end_page_8805 + 1))
                        num_pages_8805 = len(pages_in_range_8805)
                        
                        st.caption(f"Will extract {num_pages_8805} page(s): {start_page_8805} to {end_page_8805}")
                        
                        # Use unique button key based on range
                        button_key_8805 = f"btn_8805_{start_page_8805}_{end_page_8805}"
                        
                        # Extract button for selected Form 8805 range
                        if st.button(f"🌍 Extract Form 8805 Pages {start_page_8805}-{end_page_8805}", type="primary", use_container_width=True, key=button_key_8805):
                            start = time.time()
                            progress_container = st.empty()
                            status_container = st.empty()
                            
                            try:
                                status_container.info(f"🤖 Extracting Form 8805 data from pages {start_page_8805}-{end_page_8805}...")
                                progress_container.progress(20, text=f"Converting {num_pages_8805} pages to images...")
                                
                                # Extract ALL pages in the selected range
                                page_images_8805 = st.session_state.processor_8805.extract_8805_pages_as_images(
                                    st.session_state.pdf_bytes_8805, pages_in_range_8805
                                )
                                
                                progress_container.progress(50, text=f"Extracting data from {num_pages_8805} pages with AI...")
                                
                                if page_images_8805:
                                    result = st.session_state.processor_8805.batch_extract(page_images_8805, model)
                                    
                                    # Add metadata including which range was extracted
                                    if isinstance(result, dict):
                                        result["_processing_metadata"] = {
                                            "ranges_found_8805": ranges_8805,
                                            "extracted_range": f"{start_page_8805}-{end_page_8805}",
                                            "pages_extracted": pages_in_range_8805,
                                            "total_forms": len(result.get("extracted_forms_8805", []))
                                        }
                                    
                                    status_container.success(f"✅ Extracted Form 8805 data from pages {start_page_8805}-{end_page_8805}")
                                else:
                                    result = {"error": f"Failed to convert Form 8805 pages {start_page_8805}-{end_page_8805}"}
                                    status_container.error(f"❌ Failed to extract Form 8805 pages")
                                
                            except Exception as e:
                                result = {"error": f"Form 8805 extraction failed: {str(e)}"}
                                status_container.error(f"❌ {str(e)}")
                            
                            progress_container.empty()
                            elapsed = time.time() - start
                            
                            status = "SUCCESS" if not has_error(result) else "FAILED"
                            st.session_state.logger.log(uploaded.name, "8805", status, elapsed, model, get_error(result))
                            
                            # Store result with range info
                            st.session_state["result"] = result
                            st.session_state["extracted_range_8805"] = f"{start_page_8805}-{end_page_8805}"
                            st.session_state["form_type"] = "8805"
                            st.session_state["time"] = elapsed
                            st.session_state["filename"] = f"{uploaded.name} (Form 8805 Pages {start_page_8805}-{end_page_8805})"
                            
                            if status == "SUCCESS":
                                st.success(f"✅ Done in {elapsed:.1f}s - Extracted {num_pages_8805} pages")
                
                # For Form 8804 PDFs, scan for page RANGES
                is_8804_pdf = "pdf" in uploaded.type and MULTIPAGE_8804_AVAILABLE
                
                if is_8804_pdf:
                    # Initialize Form 8804 processor and scan for pages
                    if "processor_8804" not in st.session_state:
                        st.session_state.processor_8804 = MultiPage8804Processor()
                    
                    pdf_bytes = uploaded.getvalue()
                    
                    # Scan for Form 8804 page ranges (cached in session state)
                    if "detected_ranges_8804" not in st.session_state or st.session_state.get("pdf_name_8804") != uploaded.name:
                        with st.spinner("🔍 Scanning for Form 8804 pages..."):
                            st.session_state.detected_ranges_8804 = st.session_state.processor_8804.detect_8804_page_ranges(pdf_bytes)
                            st.session_state.pdf_name_8804 = uploaded.name
                            st.session_state.pdf_bytes_8804 = pdf_bytes
                    
                    ranges_8804 = st.session_state.detected_ranges_8804
                    
                    if ranges_8804:
                        range_strs = [f"{s}-{e}" if s != e else str(s) for s, e in ranges_8804]
                        
                        st.markdown(f'''
                        <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid #a855f7; border-radius: 8px; padding: 0.75rem; margin: 0.5rem 0;">
                            <strong style="color: #a855f7;">📑 Found {len(ranges_8804)} Form 8804(s)</strong>
                            <div style="color: #c4b5fd; font-size: 0.9rem; margin-top: 0.25rem;">
                                Page Ranges: {", ".join(range_strs)}
                            </div>
                        </div>
                        ''', unsafe_allow_html=True)
                        
                        range_options_8804 = [f"Pages {s}-{e}" if s != e else f"Page {s}" for s, e in ranges_8804]
                        selected_range_label_8804 = st.selectbox(
                            "Select Form 8804 to extract:",
                            options=range_options_8804,
                            index=0,
                            key="range_selector_8804"
                        )
                        selected_range_8804 = ranges_8804[range_options_8804.index(selected_range_label_8804)]
                        start_page_8804, end_page_8804 = selected_range_8804
                        
                        pages_in_range_8804 = list(range(start_page_8804, end_page_8804 + 1))
                        num_pages_8804 = len(pages_in_range_8804)
                        
                        st.caption(f"Will extract {num_pages_8804} page(s): {start_page_8804} to {end_page_8804}")
                        
                        button_key_8804 = f"btn_8804_{start_page_8804}_{end_page_8804}"
                        
                        if st.button(f"📑 Extract Form 8804 Pages {start_page_8804}-{end_page_8804}", type="primary", use_container_width=True, key=button_key_8804):
                            start = time.time()
                            progress_container = st.empty()
                            status_container = st.empty()
                            
                            try:
                                status_container.info(f"🤖 Extracting Form 8804 data from pages {start_page_8804}-{end_page_8804}...")
                                progress_container.progress(20, text=f"Converting {num_pages_8804} pages to images...")
                                
                                page_images_8804 = st.session_state.processor_8804.extract_8804_pages_as_images(
                                    st.session_state.pdf_bytes_8804, pages_in_range_8804
                                )
                                
                                progress_container.progress(50, text=f"Extracting data from {num_pages_8804} pages with AI...")
                                
                                if page_images_8804:
                                    result = st.session_state.processor_8804.batch_extract(page_images_8804, model)
                                    
                                    if isinstance(result, dict):
                                        result["_processing_metadata"] = {
                                            "ranges_found_8804": ranges_8804,
                                            "extracted_range": f"{start_page_8804}-{end_page_8804}",
                                            "pages_extracted": pages_in_range_8804,
                                            "total_forms": len(result.get("extracted_forms_8804", []))
                                        }
                                    
                                    status_container.success(f"✅ Extracted Form 8804 data from pages {start_page_8804}-{end_page_8804}")
                                else:
                                    result = {"error": f"Failed to convert Form 8804 pages {start_page_8804}-{end_page_8804}"}
                                    status_container.error(f"❌ Failed to extract Form 8804 pages")
                                
                            except Exception as e:
                                result = {"error": f"Form 8804 extraction failed: {str(e)}"}
                                status_container.error(f"❌ {str(e)}")
                            
                            progress_container.empty()
                            elapsed = time.time() - start
                            
                            status = "SUCCESS" if not has_error(result) else "FAILED"
                            st.session_state.logger.log(uploaded.name, "8804", status, elapsed, model, get_error(result))
                            
                            st.session_state["result"] = result
                            st.session_state["extracted_range_8804"] = f"{start_page_8804}-{end_page_8804}"
                            st.session_state["form_type"] = "8804"
                            st.session_state["time"] = elapsed
                            st.session_state["filename"] = f"{uploaded.name} (Form 8804 Pages {start_page_8804}-{end_page_8804})"
                            
                            if status == "SUCCESS":
                                st.success(f"✅ Done in {elapsed:.1f}s - Extracted {num_pages_8804} pages")
                
                # Standard extraction button for non-K-1/K-3/8805/8804 PDFs or images
                if not is_k1_pdf and not (is_k3_pdf and k3_ranges) and not (is_8805_pdf and ranges_8805) and not (is_8804_pdf and ranges_8804):
                    # Standard extraction for non-K-1 or images
                    should_extract = False
                    if "result" not in st.session_state or st.session_state.get("filename") != uploaded.name:
                        should_extract = True
                    
                    if should_extract:
                        start = time.time()
                        with st.spinner("Extracting..."):
                            result = st.session_state.client.extract(img, form_type, model)
                        
                        elapsed = time.time() - start
                        
                        status = "SUCCESS" if not has_error(result) else "FAILED"
                        st.session_state.logger.log(uploaded.name, form_type, status, elapsed, model, get_error(result))
                        
                        st.session_state["result"] = result
                        st.session_state["form_type"] = form_type
                        st.session_state["time"] = elapsed
                        st.session_state["filename"] = uploaded.name
                        
                        if status == "SUCCESS":
                            st.success(f"✅ Done in {elapsed:.1f}s")
                            st.rerun()
    
    with col2:
        st.markdown("### 📊 Results")
        
        if "result" in st.session_state:
            # Metrics row
            cols = st.columns(3)
            with cols[0]:
                st.markdown(f'<div class="metric-box"><div class="metric-value">{st.session_state.get("form_type", "—")}</div><div class="metric-label">Form</div></div>', unsafe_allow_html=True)
            with cols[1]:
                st.markdown(f'<div class="metric-box"><div class="metric-value">{st.session_state.get("time", 0):.1f}s</div><div class="metric-label">Time</div></div>', unsafe_allow_html=True)
            with cols[2]:
                status = "✅" if not has_error(st.session_state["result"]) else "❌"
                st.markdown(f'<div class="metric-box"><div class="metric-value">{status}</div><div class="metric-label">Status</div></div>', unsafe_allow_html=True)
            
            st.markdown("---")
            
            # === TABS: Review | Validation ===
            tab_review, tab_validate = st.tabs([
                "📋 Review",
                "✅ Validation"
            ])
            
            # REVIEW TAB - Shows all data in a scrollable container
            with tab_review:
                filename = st.session_state.get("filename", "Extracted Form")
                form_type = st.session_state.get("form_type", "W-2")
                
                # Scrollable container with fixed height (500px for compact view)
                with st.container(height=720):
                    st.markdown(f"### 📄 {filename}")
                    # Dispatch to form-specific renderer
                    if form_type == "1099-INT":
                        render_1099int_table_view(st.session_state["result"])
                    elif form_type == "K-1":
                        render_k1_table_view(st.session_state["result"])
                    elif form_type == "K-3":
                        render_k3_table_view(st.session_state["result"])
                    elif form_type == "8805":
                        render_8805_table_view(st.session_state["result"])
                    elif form_type == "8804":
                        render_8804_table_view(st.session_state["result"])
                    else:
                        # Default to W-2 view for W-2 and unknown forms
                        render_table_view(st.session_state["result"])

            

                

            
            # VALIDATION TAB
            with tab_validate:
                st.markdown(f"### {st.session_state.get('filename', 'Extracted Form')}")
                if has_error(st.session_state["result"]):
                    st.error("❌ Extraction failed")
                    if isinstance(st.session_state["result"], dict):
                        st.markdown(f'<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 1rem; color: #fca5a5;"><strong>Error:</strong> {st.session_state["result"].get("error", "Unknown error")}</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 1rem; color: #86efac;">✓ All validations passed</div>', unsafe_allow_html=True)
                
                # Debug: Show raw AI output
                result = st.session_state["result"]
                if isinstance(result, list) and len(result) > 0 and "_raw_ai_output" in result[0]:
                    with st.expander("🔍 Debug: Raw AI Output"):
                        st.json(result[0]["_raw_ai_output"])
                
                st.markdown("---")
                
                # JSON Comparison Tool
                st.markdown("### 🔍 Compare with Expected JSON")
                st.markdown("Paste expected JSON to compare with extraction results.")
                expected_json = st.text_area("Expected JSON", height=200)
                
                if expected_json:
                    try:
                        import json as json_module
                        expected = json_module.loads(expected_json)
                        st.success("✓ Valid JSON")
                        
                        col_exp, col_act = st.columns(2)
                        with col_exp:
                            st.markdown("**Expected**")
                            st.json(expected)
                        with col_act:
                            st.markdown("**Actual**")
                            st.json(st.session_state["result"])
                    except Exception as e:
                        st.error(f"Invalid JSON: {e}")
        else:
            st.info("Upload a form and click Extract")
        
        # Logs
        st.markdown("---")
        st.markdown("### 📜 Logs")
        for log in st.session_state.logger.logs[:5]:
            cls = "log-item" if log["status"] == "SUCCESS" else "log-item log-item-error"
            st.markdown(f'<div class="{cls}">{log["time"]} | <b>{log["file"]}</b> → {log["form"]} | {log["ms"]}ms | {log["status"]}</div>', unsafe_allow_html=True)


if __name__ == "__main__":
    main()
 