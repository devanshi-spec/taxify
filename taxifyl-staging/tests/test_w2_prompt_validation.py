"""
W-2 Prompt Validation Test Script
==================================
Runs extraction tests on all W-2 PDFs after prompt changes.
Detects common extraction bugs and reports PASS/FAIL for each PDF.

BUG DETECTION:
1. Value Copying Bug - Box 3/4 incorrectly copying from Box 1/2
2. Box 12 Shifting Bug - Values appearing in wrong Box 12 slots
3. Box 14 State Prefix Bug - CA prefix missing or incorrectly added
4. Field Merging Bug - Control number, Dept, Corp fields merging
5. Employer Use Only Truncation - Missing prefix in employer field
6. Footer Hallucination Bug - Extracting IRS footer text as field values

Usage:
    python tests/test_w2_prompt_validation.py
    python tests/test_w2_prompt_validation.py --pdf "1.pdf"
    python tests/test_w2_prompt_validation.py --verbose
"""

import requests
import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Configuration
API_BASE_URL = "http://127.0.0.1:8000"
W2_FOLDER = Path("PDFS/New data/W-2")
OUTPUT_DIR = Path("output/w2_prompt_tests")
BUG_HISTORY_FILE = Path("tests/w2_bug_history.json")
PROMPT_HISTORY_FILE = Path("tests/prompt_version_history.json")
REGISTRY_FILE = Path("registry.json")

# Box 12 valid IRS codes (official list)
BOX_12_VALID_CODES = [
    "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
    "P", "Q", "R", "S", "T", "V", "W", "Y", "Z", "AA", "BB", "DD", "EE", "FF", "GG", "HH"
]

# Keywords that belong in Box 14, NOT Box 12
BOX_14_KEYWORDS = [
    "RETIRE", "FLI", "SUT", "LST", "SDI", "CASDI", "UI", "DI", "VPDI",
    "PFL", "TDI", "NJFLI", "NYSDI", "NYPFL", "HEALTH", "DENTAL", "VISION",
    "UNION", "DUES", "401K", "403B", "HSA", "FSA", "LIFE", "LTD", "STD"
]

# Footer/hallucination patterns to detect
FOOTER_PATTERNS = [
    r"Dept\.?\s*of\s*(the)?\s*Treasury",
    r"Internal\s*Revenue\s*Service",
    r"IRS",
    r"OMB\s*No",
    r"Form\s*W-2",
    r"Cat\.\s*No",
    r"[A-Z]\d{2}\s+\d{4}",  # Form codes like "L87 5206"
]

# Copy type patterns
FEDERAL_COPY_PATTERNS = ["Copy A", "Copy B", "Employee", "Federal", "SSA"]
STATE_COPY_PATTERNS = ["Copy 1", "Copy 2", "State", "City", "Local"]


class BugType:
    """Enumeration of bug types detected."""
    VALUE_COPYING = "VALUE_COPYING"
    BOX12_SHIFTING = "BOX12_SHIFTING"
    BOX12_INVALID_CODE = "BOX12_INVALID_CODE"
    BOX14_PREFIX_ERROR = "BOX14_PREFIX_ERROR"
    FIELD_MERGING = "FIELD_MERGING"
    EMPLOYER_TRUNCATION = "EMPLOYER_TRUNCATION"
    FOOTER_HALLUCINATION = "FOOTER_HALLUCINATION"
    CHECKBOX_TYPE_ERROR = "CHECKBOX_TYPE_ERROR"
    NULL_FIELD_COPIED = "NULL_FIELD_COPIED"


class TestResult:
    """Represents the result of a single PDF test."""
    def __init__(self, pdf_name: str):
        self.pdf_name = pdf_name
        self.passed = True
        self.bugs: List[Dict] = []  # Detailed bug info
        self.warnings: List[str] = []
        self.extraction_data: Optional[Dict] = None
        self.forms_extracted = 0
        self.pages_processed = 0
    
    def add_bug(self, bug_type: str, message: str, form_id: str, details: Dict = None):
        """Add a detected bug."""
        self.passed = False
        self.bugs.append({
            "type": bug_type,
            "message": message,
            "form_id": form_id,
            "details": details or {}
        })
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    def status(self) -> str:
        return "✅ PASS" if self.passed else "❌ FAIL"
    
    def bug_summary(self) -> Dict[str, int]:
        """Count bugs by type."""
        summary = {}
        for bug in self.bugs:
            bug_type = bug["type"]
            summary[bug_type] = summary.get(bug_type, 0) + 1
        return summary


def get_w2_pdfs() -> List[Path]:
    """Get all PDF files from the W-2 folder."""
    if not W2_FOLDER.exists():
        print(f"❌ W-2 folder not found: {W2_FOLDER}")
        return []
    
    pdfs = list(W2_FOLDER.glob("*.pdf"))
    return sorted(pdfs)


def check_api_health() -> bool:
    """Check if the API is running and healthy."""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        return False


def extract_pdf(pdf_path: Path) -> Dict:
    """Run detection and extraction for a PDF file."""
    result = {
        "detection": None,
        "extractions": [],
        "error": None
    }
    
    try:
        # Step 1: Detection
        with open(pdf_path, "rb") as f:
            files = {"file": (pdf_path.name, f, "application/pdf")}
            response = requests.post(f"{API_BASE_URL}/get-pages", files=files, timeout=120)
        
        if response.status_code != 200:
            result["error"] = f"Detection failed: {response.text}"
            return result
        
        detection_result = response.json()
        result["detection"] = detection_result
        pages = detection_result.get("data", {}).get("pages", [])
        
        if not pages:
            result["error"] = "No pages detected"
            return result
        
        # Step 2: Extract each page
        for page in pages:
            page_url = page.get("pageUrl")
            page_num = page.get("pageNumber")
            detected_types = page.get("detectedTypes", ["W-2"])
            form_type = detected_types[0] if detected_types else "W-2"
            
            # Only extract W-2 forms
            if form_type != "W-2":
                continue
            
            extract_payload = {
                "page_url": page_url,
                "detected_type": form_type
            }
            
            response = requests.post(
                f"{API_BASE_URL}/extract-form", 
                json=extract_payload,
                timeout=120
            )
            
            if response.status_code == 200:
                extract_result = response.json()
                result["extractions"].append({
                    "page": page_num,
                    "result": extract_result
                })
        
        return result
        
    except Exception as e:
        result["error"] = str(e)
        return result


def get_field_value(box_details: List[Dict], code: str) -> Any:
    """Get a field value from box_details by code."""
    for box in box_details:
        if box.get("code") == code:
            return box.get("value")
    return None


def get_all_fields(box_details: List[Dict]) -> Dict[str, Any]:
    """Convert box_details list to dictionary."""
    return {box.get("code"): box.get("value") for box in box_details}


def is_federal_copy(copy_type: str) -> bool:
    """Check if this is a Federal/Employee copy type."""
    if not copy_type:
        return False
    copy_upper = copy_type.upper()
    return any(pattern.upper() in copy_upper for pattern in FEDERAL_COPY_PATTERNS)


def is_state_copy(copy_type: str) -> bool:
    """Check if this is a State/City copy type."""
    if not copy_type:
        return False
    copy_upper = copy_type.upper()
    return any(pattern.upper() in copy_upper for pattern in STATE_COPY_PATTERNS)


def check_footer_hallucination(value: Any) -> bool:
    """Check if a value looks like it was extracted from footer/header."""
    if value is None:
        return False
    value_str = str(value)
    for pattern in FOOTER_PATTERNS:
        if re.search(pattern, value_str, re.IGNORECASE):
            return True
    return False


def check_box12_valid(value: Any) -> Tuple[bool, str]:
    """
    Check if Box 12 value is valid.
    Returns (is_valid, error_message).
    Box 12 format: [CODE] [AMOUNT] where CODE is 1-2 letters from valid list.
    """
    if value is None or value == "" or value == "null":
        return True, ""
    
    value_str = str(value).strip().upper()
    
    # Check for Box 14 keywords that should NOT be in Box 12
    for keyword in BOX_14_KEYWORDS:
        if keyword in value_str:
            return False, f"Contains '{keyword}' which belongs in Box 14"
    
    # Extract the code part (first word or letters before space/number)
    match = re.match(r'^([A-Z]{1,2})\s*', value_str)
    if match:
        code = match.group(1)
        if code not in BOX_12_VALID_CODES:
            return False, f"Invalid IRS code '{code}'"
    
    return True, ""


def check_value_copying(fields: Dict, form_id: str, test_result: TestResult):
    """
    BUG: Value Copying
    Detect when Box 3/4 are incorrectly copying from Box 1/2.
    Box 3 (SS wages) should NOT equal Box 1 (Wages) if Box 3 should be empty.
    Box 4 (SS tax) should NOT equal Box 2 (Fed tax) - they are different tax types.
    """
    box1 = fields.get("1")
    box2 = fields.get("2")
    box3 = fields.get("3")
    box4 = fields.get("4")
    box5 = fields.get("5")
    box6 = fields.get("6")
    
    # Check Box 3 copying from Box 1
    # If Box 3 equals Box 1 exactly BUT Box 5 (Medicare wages) is different,
    # it might indicate Box 3 copied from Box 1 incorrectly
    if box3 is not None and box1 is not None:
        try:
            val1 = float(box1) if box1 else 0
            val3 = float(box3) if box3 else 0
            val5 = float(box5) if box5 else 0
            
            # If Box 3 == Box 1 but Box 3 != Box 5, suspicious
            # (normally Box 3 and Box 5 are close or same, not Box 3 and Box 1)
            if val1 > 0 and val3 == val1 and val5 > 0 and val3 != val5:
                test_result.add_warning(
                    f"{form_id}: Box 3 ({box3}) equals Box 1 ({box1}) but differs from Box 5 ({box5}) - verify"
                )
        except (ValueError, TypeError):
            pass
    
    # Check Box 4 copying from Box 2 - this is almost always wrong
    # Box 2 is Federal Income Tax, Box 4 is Social Security Tax (different rates)
    if box4 is not None and box2 is not None:
        try:
            val2 = float(box2) if box2 else 0
            val4 = float(box4) if box4 else 0
            
            # If they're exactly equal and non-zero, very suspicious
            if val2 > 0 and val4 == val2:
                test_result.add_bug(
                    BugType.VALUE_COPYING,
                    f"Box 4 ({box4}) equals Box 2 ({box2}) - these are different tax types",
                    form_id,
                    {"box2": box2, "box4": box4}
                )
        except (ValueError, TypeError):
            pass
    
    # Check if Box 3/4 have values when they should be null
    # If Box 5/6 have values but Box 3/4 also have identical values to Box 1/2
    if box3 is not None and box1 is not None and box5 is None:
        try:
            if float(box3) == float(box1) and float(box1) > 0:
                test_result.add_bug(
                    BugType.NULL_FIELD_COPIED,
                    f"Box 3 ({box3}) copied from Box 1 when Box 5 is null - Box 3 may be empty",
                    form_id,
                    {"box1": box1, "box3": box3, "box5": box5}
                )
        except (ValueError, TypeError):
            pass


def check_box12_shifting(fields: Dict, form_id: str, test_result: TestResult):
    """
    BUG: Box 12 Shifting
    Detect when Box 12 values are shifted to wrong slots.
    E.g., 12b value appears in 12c, etc.
    """
    box12_fields = ["12a", "12b", "12c", "12d"]
    box12_values = {f: fields.get(f) for f in box12_fields}
    
    # Check each Box 12 field for validity
    for field, value in box12_values.items():
        is_valid, error_msg = check_box12_valid(value)
        if not is_valid:
            test_result.add_bug(
                BugType.BOX12_INVALID_CODE,
                f"{field}: {error_msg}",
                form_id,
                {"field": field, "value": value}
            )
    
    # Detect potential shifting: if 12a is null but 12b has value, or pattern gaps
    non_null_slots = [f for f in box12_fields if box12_values.get(f)]
    
    # Check for unusual gaps (e.g., 12a=null, 12b=null, 12c=value)
    if non_null_slots:
        first_value_idx = box12_fields.index(non_null_slots[0])
        if first_value_idx > 0:
            # Value doesn't start at 12a - could be shifting error
            test_result.add_warning(
                f"{form_id}: Box 12 values start at {non_null_slots[0]}, not 12a - verify no shifting"
            )


def check_box14_prefix(fields: Dict, copy_type: str, form_id: str, test_result: TestResult):
    """
    BUG: Box 14 State Prefix Error
    - State/City copies should have state prefix (e.g., "CA SDI")
    - Federal copies should NOT have state prefix (just "SDI")
    Check if prefix is incorrectly added or removed.
    """
    box14 = fields.get("14")
    if box14 is None or box14 == "":
        return
    
    box14_str = str(box14).upper()
    
    # Common state abbreviations that might appear as prefixes
    state_prefixes = ["CA", "NY", "NJ", "PA", "TX", "FL", "IL", "OH", "GA", "NC", "MI", "WA", "AZ", "MA", "CO"]
    
    has_state_prefix = any(box14_str.startswith(state + " ") for state in state_prefixes)
    
    if is_federal_copy(copy_type):
        # Federal copy should NOT have state prefix
        if has_state_prefix:
            test_result.add_bug(
                BugType.BOX14_PREFIX_ERROR,
                f"Box 14 has state prefix in Federal copy (should not have prefix)",
                form_id,
                {"box14": box14, "copy_type": copy_type}
            )
    elif is_state_copy(copy_type):
        # State copy should have state prefix for state-specific items
        # Check common patterns that should have prefix
        state_specific_keywords = ["SDI", "SUI", "VPDI", "TDI", "PFL"]
        for keyword in state_specific_keywords:
            if keyword in box14_str and not has_state_prefix:
                test_result.add_warning(
                    f"{form_id}: Box 14 ({box14}) in State copy may be missing state prefix"
                )
                break


def check_field_merging(fields: Dict, form_id: str, test_result: TestResult):
    """
    BUG: Field Merging
    Detect when fields are incorrectly merged:
    - Control number (d) merging with Dept
    - Dept shifting into Corp
    - Employer use only getting truncated
    """
    control_num = fields.get("d")
    dept = fields.get("dept")
    corp = fields.get("corp")
    employer_use = fields.get("employer_use_only")
    
    # Check for footer hallucination in these fields
    for field_name, value in [("d", control_num), ("dept", dept), ("corp", corp), ("employer_use_only", employer_use)]:
        if check_footer_hallucination(value):
            test_result.add_bug(
                BugType.FOOTER_HALLUCINATION,
                f"{field_name} contains footer/header text: '{value}'",
                form_id,
                {"field": field_name, "value": value}
            )
    
    # Check if Dept contains "Dept." label text (should just be value)
    if dept and "Dept" in str(dept):
        test_result.add_bug(
            BugType.FIELD_MERGING,
            f"Dept field contains label text: '{dept}'",
            form_id,
            {"dept": dept}
        )
    
    # Check if control number looks like it has merged data
    if control_num:
        cn_str = str(control_num)
        # Control number is usually numeric or alphanumeric, not containing spaces with letters
        if len(cn_str.split()) > 2:
            test_result.add_warning(
                f"{form_id}: Control number '{control_num}' may have merged fields"
            )
    
    # Check employer_use_only for truncation
    # If it has just a number but looks like it should have a letter prefix
    if employer_use:
        eu_str = str(employer_use).strip()
        # Pattern like "13" instead of "T 13" - just a number when it might need prefix
        if re.match(r'^\d+$', eu_str):
            test_result.add_warning(
                f"{form_id}: Employer use only '{employer_use}' may be truncated (missing prefix?)"
            )


def check_checkbox_types(fields: Dict, form_id: str, test_result: TestResult):
    """
    BUG: Checkbox Type Error
    Box 13 checkboxes must be boolean values, not strings.
    """
    checkbox_fields = ["13_statutory", "13_retirement", "13_sick_pay"]
    
    for field in checkbox_fields:
        value = fields.get(field)
        if value is not None:
            if not isinstance(value, bool):
                test_result.add_bug(
                    BugType.CHECKBOX_TYPE_ERROR,
                    f"{field} should be boolean, got {type(value).__name__}: {value}",
                    form_id,
                    {"field": field, "value": value, "type": type(value).__name__}
                )


def validate_form(form: Dict, page_num: int, form_idx: int, test_result: TestResult):
    """Run all validation checks on a single form."""
    form_id = f"Page {page_num}, Form {form_idx + 1}"
    copy_type = form.get("copyType", "")
    box_details = form.get("boxDetails", [])
    fields = get_all_fields(box_details)
    
    # Run all bug detection checks
    check_value_copying(fields, form_id, test_result)
    check_box12_shifting(fields, form_id, test_result)
    check_box14_prefix(fields, copy_type, form_id, test_result)
    check_field_merging(fields, form_id, test_result)
    check_checkbox_types(fields, form_id, test_result)


def validate_extraction(extraction_data: Dict, test_result: TestResult):
    """Validate all extracted forms in a PDF."""
    extractions = extraction_data.get("extractions", [])
    if not extractions:
        test_result.add_bug(BugType.VALUE_COPYING, "No extractions found", "PDF", {})
        return
    
    for page_extraction in extractions:
        page_num = page_extraction.get("page", "?")
        result = page_extraction.get("result", {})
        extracted_forms = result.get("data", {}).get("extractedForms", [])
        
        if not extracted_forms:
            test_result.add_warning(f"Page {page_num}: No forms extracted")
            continue
        
        test_result.forms_extracted += len(extracted_forms)
        test_result.pages_processed += 1
        
        for form_idx, form in enumerate(extracted_forms):
            validate_form(form, page_num, form_idx, test_result)


def run_test(pdf_path: Path, verbose: bool = False) -> TestResult:
    """Run extraction test on a single PDF."""
    test_result = TestResult(pdf_path.name)
    
    print(f"\n{'─' * 60}")
    print(f"Testing: {pdf_path.name}")
    print(f"{'─' * 60}")
    
    # Extract the PDF
    extraction_data = extract_pdf(pdf_path)
    test_result.extraction_data = extraction_data
    
    if extraction_data.get("error"):
        test_result.add_bug("EXTRACTION_ERROR", extraction_data["error"], "PDF", {})
        print(f"  ❌ Error: {extraction_data['error']}")
        return test_result
    
    # Validate extraction
    validate_extraction(extraction_data, test_result)
    
    # Print results
    print(f"  📄 Pages processed: {test_result.pages_processed}")
    print(f"  📝 Forms extracted: {test_result.forms_extracted}")
    
    if test_result.warnings:
        print(f"  ⚠️  Warnings ({len(test_result.warnings)}):")
        for warning in test_result.warnings[:5]:  # First 5
            print(f"      - {warning}")
        if len(test_result.warnings) > 5:
            print(f"      ... and {len(test_result.warnings) - 5} more")
    
    if test_result.bugs:
        print(f"  🐛 Bugs Detected ({len(test_result.bugs)}):")
        for bug in test_result.bugs[:5]:  # First 5
            print(f"      [{bug['type']}] {bug['message']}")
        if len(test_result.bugs) > 5:
            print(f"      ... and {len(test_result.bugs) - 5} more")
    
    print(f"  Status: {test_result.status()}")
    
    if verbose and extraction_data.get("extractions"):
        print(f"\n  📋 Extraction Details:")
        for page_ext in extraction_data["extractions"]:
            print(f"     Page {page_ext['page']}:")
            forms = page_ext.get("result", {}).get("data", {}).get("extractedForms", [])
            for form in forms:
                print(f"       Copy: {form.get('copyType', 'Unknown')}")
                fields = get_all_fields(form.get("boxDetails", []))
                # Print key fields
                key_fields = ["d", "dept", "corp", "employer_use_only", "1", "2", "3", "4", "5", "6", 
                              "12a", "12b", "12c", "12d", "14", "13_statutory", "13_retirement", "13_sick_pay"]
                for code in key_fields:
                    if fields.get(code) is not None:
                        print(f"         {code}: {fields[code]}")
    
    return test_result


def save_test_report(results: List[TestResult], output_dir: Path):
    """Save detailed test report."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = output_dir / f"test_report_{timestamp}.json"
    
    # Aggregate bug statistics
    all_bugs = {}
    for result in results:
        for bug_type, count in result.bug_summary().items():
            all_bugs[bug_type] = all_bugs.get(bug_type, 0) + count
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_pdfs": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "bug_statistics": all_bugs,
        "results": []
    }
    
    for result in results:
        report["results"].append({
            "pdf": result.pdf_name,
            "status": "PASS" if result.passed else "FAIL",
            "forms_extracted": result.forms_extracted,
            "pages_processed": result.pages_processed,
            "bugs": result.bugs,
            "warnings": result.warnings,
            "extraction_data": result.extraction_data
        })
    
    output_dir.mkdir(parents=True, exist_ok=True)
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n📁 Detailed report saved to: {report_file.absolute()}")
    return report_file


def load_bug_history() -> Dict:
    """Load bug history from file."""
    if BUG_HISTORY_FILE.exists():
        with open(BUG_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"runs": [], "all_bugs": {}, "solved_bugs": [], "active_bugs": []}


def save_bug_history(history: Dict):
    """Save bug history to file."""
    BUG_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(BUG_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def generate_bug_id(bug: Dict, pdf_name: str) -> str:
    """Generate unique ID for a bug to track it across runs."""
    # Create a unique identifier based on bug characteristics
    bug_key = f"{pdf_name}|{bug['type']}|{bug['form_id']}|{bug['message'][:50]}"
    return bug_key


def update_bug_history(results: List[TestResult]) -> Dict:
    """
    Update bug history with current test results.
    Tracks:
    - All bugs ever detected
    - Bugs that were solved (appeared before, not now)
    - Currently active bugs
    """
    history = load_bug_history()
    timestamp = datetime.now().isoformat()
    
    # Collect all current bugs with their IDs
    current_bugs = {}
    for result in results:
        for bug in result.bugs:
            bug_id = generate_bug_id(bug, result.pdf_name)
            current_bugs[bug_id] = {
                "bug_id": bug_id,
                "pdf": result.pdf_name,
                "type": bug["type"],
                "form_id": bug["form_id"],
                "message": bug["message"],
                "details": bug["details"],
                "first_seen": timestamp,
                "last_seen": timestamp,
                "status": "ACTIVE"
            }
    
    # Get previous active bugs
    previous_active = {b["bug_id"]: b for b in history.get("active_bugs", [])}
    all_bugs = {b["bug_id"]: b for b in history.get("all_bugs_list", [])}
    
    # Update bug statuses
    newly_solved = []
    still_active = []
    new_bugs = []
    
    # Check previous bugs - are they solved?
    for bug_id, prev_bug in previous_active.items():
        if bug_id not in current_bugs:
            # Bug is solved!
            prev_bug["status"] = "SOLVED"
            prev_bug["solved_date"] = timestamp
            newly_solved.append(prev_bug)
            if bug_id in all_bugs:
                all_bugs[bug_id]["status"] = "SOLVED"
                all_bugs[bug_id]["solved_date"] = timestamp
    
    # Check current bugs - are they new or continuing?
    for bug_id, curr_bug in current_bugs.items():
        if bug_id in previous_active:
            # Bug still exists
            curr_bug["first_seen"] = previous_active[bug_id]["first_seen"]
            still_active.append(curr_bug)
        else:
            # New bug
            new_bugs.append(curr_bug)
            still_active.append(curr_bug)
        
        # Update all_bugs
        if bug_id in all_bugs:
            all_bugs[bug_id]["last_seen"] = timestamp
            all_bugs[bug_id]["status"] = "ACTIVE"
        else:
            all_bugs[bug_id] = curr_bug.copy()
    
    # Create run record
    run_record = {
        "timestamp": timestamp,
        "total_pdfs": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "total_bugs": len(current_bugs),
        "new_bugs": len(new_bugs),
        "solved_bugs": len(newly_solved),
        "bug_types": {}
    }
    
    # Count bugs by type
    for bug in current_bugs.values():
        bug_type = bug["type"]
        run_record["bug_types"][bug_type] = run_record["bug_types"].get(bug_type, 0) + 1
    
    # Update history
    history["runs"].append(run_record)
    history["runs"] = history["runs"][-50:]  # Keep last 50 runs
    history["all_bugs_list"] = list(all_bugs.values())
    history["active_bugs"] = still_active
    history["solved_bugs"] = history.get("solved_bugs", []) + newly_solved
    history["last_updated"] = timestamp
    
    # Summary stats
    history["summary"] = {
        "total_bugs_ever": len(all_bugs),
        "currently_active": len(still_active),
        "total_solved": len([b for b in all_bugs.values() if b.get("status") == "SOLVED"]),
        "bug_types_active": run_record["bug_types"]
    }
    
    save_bug_history(history)
    
    return {
        "newly_solved": newly_solved,
        "new_bugs": new_bugs,
        "still_active": still_active,
        "history": history
    }


def get_current_prompt_version() -> Dict:
    """Get current prompt version from registry."""
    try:
        with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
            registry = json.load(f)
        w2_config = registry.get("W-2", {})
        return {
            "version": w2_config.get("promptVersion", "unknown"),
            "last_updated": w2_config.get("lastUpdated", "unknown")
        }
    except:
        return {"version": "unknown", "last_updated": "unknown"}


def load_prompt_history() -> Dict:
    """Load prompt version history."""
    if PROMPT_HISTORY_FILE.exists():
        with open(PROMPT_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"W-2": {"current_version": "unknown", "versions": []}}


def save_prompt_history(history: Dict):
    """Save prompt version history."""
    PROMPT_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROMPT_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def update_prompt_test_results(passed: int, failed: int, total_bugs: int, solved_bugs: int):
    """Update test results for current prompt version."""
    prompt_info = get_current_prompt_version()
    history = load_prompt_history()
    
    w2_history = history.get("W-2", {"versions": []})
    versions = w2_history.get("versions", [])
    
    # Find current version and update test results
    for version in versions:
        if version.get("version") == prompt_info["version"]:
            version["test_results"] = {
                "passed": passed,
                "failed": failed,
                "total_bugs": total_bugs,
                "solved_bugs": solved_bugs,
                "last_tested": datetime.now().isoformat(),
                "notes": f"Tested on {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            }
            break
    
    history["W-2"] = w2_history
    save_prompt_history(history)


def show_prompt_versions():
    """Display prompt version history."""
    history = load_prompt_history()
    current = get_current_prompt_version()
    
    print("\n📋 PROMPT VERSION HISTORY")
    print("=" * 60)
    print(f"  Current Version: {current['version']}")
    print(f"  Last Updated: {current['last_updated']}")
    
    w2_versions = history.get("W-2", {}).get("versions", [])
    
    if w2_versions:
        print("\n  Version History:")
        for v in reversed(w2_versions):
            version = v.get("version", "?")
            date = v.get("date", "?")
            desc = v.get("description", "No description")
            test_results = v.get("test_results", {})
            
            passed = test_results.get("passed")
            failed = test_results.get("failed")
            
            status = ""
            if passed is not None and failed is not None:
                if failed == 0:
                    status = " ✅"
                else:
                    status = f" ❌ ({failed} failed)"
            else:
                status = " ⏳ Not tested"
            
            print(f"\n  v{version} ({date}){status}")
            print(f"      {desc}")
            
            changes = v.get("changes", [])
            if changes:
                print(f"      Changes:")
                for change in changes[:3]:
                    print(f"        - {change[:60]}")
                if len(changes) > 3:
                    print(f"        ... and {len(changes) - 3} more")
            
            bugs_addressed = v.get("bugs_addressed", [])
            if bugs_addressed:
                print(f"      Bugs Addressed:")
                for bug in bugs_addressed[:3]:
                    print(f"        🐛 {bug}")
                if len(bugs_addressed) > 3:
                    print(f"        ... and {len(bugs_addressed) - 3} more")


def main():
    parser = argparse.ArgumentParser(description="W-2 Prompt Validation Test Script")
    parser.add_argument("--pdf", type=str, help="Test specific PDF file name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed extraction output")
    parser.add_argument("--show-history", action="store_true", help="Show bug history and exit")
    parser.add_argument("--show-solved", action="store_true", help="Show solved bugs")
    parser.add_argument("--show-versions", action="store_true", help="Show prompt version history")
    args = parser.parse_args()
    
    print("=" * 60)
    print("W-2 Prompt Validation Test Script")
    print("=" * 60)
    
    # Show prompt versions mode
    if args.show_versions:
        show_prompt_versions()
        return
    
    # Show history mode
    if args.show_history:
        history = load_bug_history()
        if not history.get("runs"):
            print("\n📋 No test history found. Run tests first.")
            return
        
        print("\n📊 BUG HISTORY SUMMARY")
        print("=" * 60)
        summary = history.get("summary", {})
        print(f"  Total bugs ever detected: {summary.get('total_bugs_ever', 0)}")
        print(f"  Currently active bugs:    {summary.get('currently_active', 0)}")
        print(f"  Total solved bugs:        {summary.get('total_solved', 0)}")
        
        print("\n📈 Recent Runs:")
        for run in history.get("runs", [])[-10:]:
            solved_str = f" (🎉 {run['solved_bugs']} solved!)" if run.get('solved_bugs', 0) > 0 else ""
            new_str = f" (⚠️ {run['new_bugs']} new)" if run.get('new_bugs', 0) > 0 else ""
            print(f"  {run['timestamp'][:19]} - {run['passed']}/{run['total_pdfs']} passed, {run['total_bugs']} bugs{solved_str}{new_str}")
        
        print("\n🐛 Active Bugs by Type:")
        for bug_type, count in summary.get("bug_types_active", {}).items():
            print(f"      {bug_type}: {count}")
        
        if args.show_solved:
            print("\n✅ SOLVED BUGS:")
            print("-" * 60)
            for bug in history.get("solved_bugs", [])[-20:]:
                print(f"  [{bug['type']}] {bug['pdf']}: {bug['message'][:60]}")
                print(f"      Solved: {bug.get('solved_date', 'Unknown')[:19]}")
        
        return
    
    print("\nBug Detection Rules:")
    print("  1. VALUE_COPYING      - Box 3/4 copying from Box 1/2")
    print("  2. BOX12_SHIFTING     - Values in wrong Box 12 slots")
    print("  3. BOX12_INVALID_CODE - Invalid IRS codes in Box 12")
    print("  4. BOX14_PREFIX_ERROR - CA prefix incorrectly added/removed")
    print("  5. FIELD_MERGING      - Control/Dept/Corp fields merged")
    print("  6. EMPLOYER_TRUNCATION- Employer use only missing prefix")
    print("  7. FOOTER_HALLUCINATION- Footer text in field values")
    print("  8. CHECKBOX_TYPE_ERROR- Non-boolean checkbox values")
    
    # Show current prompt version
    prompt_info = get_current_prompt_version()
    print(f"\n📝 Testing Prompt Version: {prompt_info['version']} (Updated: {prompt_info['last_updated']})")
    
    # Check API health
    if not check_api_health():
        print("\n❌ API is not running. Please start the server:")
        print("   uvicorn api:app --host 0.0.0.0 --port 8000")
        sys.exit(1)
    
    print("✅ API is healthy")
    
    # Get PDFs to test
    pdfs = get_w2_pdfs()
    if not pdfs:
        print(f"\n❌ No PDF files found in {W2_FOLDER}")
        sys.exit(1)
    
    # Filter to specific PDF if requested
    if args.pdf:
        pdfs = [p for p in pdfs if p.name == args.pdf or args.pdf in p.name]
        if not pdfs:
            print(f"\n❌ PDF not found: {args.pdf}")
            sys.exit(1)
    
    print(f"\n📂 Found {len(pdfs)} PDF file(s) to test:")
    for pdf in pdfs:
        print(f"   - {pdf.name}")
    
    # Run tests
    results: List[TestResult] = []
    
    for pdf_path in pdfs:
        result = run_test(pdf_path, verbose=args.verbose)
        results.append(result)
    
    # Summary
    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"  Prompt Version: {prompt_info['version']}")
    print(f"  Total PDFs:  {len(results)}")
    print(f"  ✅ Passed:   {passed}")
    print(f"  ❌ Failed:   {failed}")
    
    # Aggregate bug statistics
    all_bugs = {}
    total_bug_count = 0
    for result in results:
        for bug_type, count in result.bug_summary().items():
            all_bugs[bug_type] = all_bugs.get(bug_type, 0) + count
            total_bug_count += count
    
    if all_bugs:
        print("\n  🐛 Bug Statistics:")
        for bug_type, count in sorted(all_bugs.items(), key=lambda x: -x[1]):
            print(f"      {bug_type}: {count}")
    
    print()
    
    # List results per PDF
    print("Results by PDF:")
    for result in results:
        status = result.status()
        bug_count = len(result.bugs)
        warn_count = len(result.warnings)
        print(f"  {status} {result.pdf_name} - {result.forms_extracted} forms, {bug_count} bugs, {warn_count} warnings")
    
    # Update bug history and show changes
    print("\n" + "=" * 60)
    print("BUG TRACKING")
    print("=" * 60)
    
    bug_update = update_bug_history(results)
    solved_count = len(bug_update["newly_solved"])
    
    if bug_update["newly_solved"]:
        print(f"\n  🎉 BUGS SOLVED ({solved_count}):")
        for bug in bug_update["newly_solved"]:
            print(f"      ✅ [{bug['type']}] {bug['pdf']}: {bug['message'][:50]}")
    
    if bug_update["new_bugs"]:
        print(f"\n  ⚠️  NEW BUGS ({len(bug_update['new_bugs'])}):")
        for bug in bug_update["new_bugs"]:
            print(f"      🆕 [{bug['type']}] {bug['pdf']}: {bug['message'][:50]}")
    
    if bug_update["still_active"] and not bug_update["new_bugs"]:
        print(f"\n  🐛 Active bugs: {len(bug_update['still_active'])}")
    
    history = bug_update["history"]
    print(f"\n  📊 Overall: {history['summary']['total_solved']} solved / {history['summary']['total_bugs_ever']} total bugs")
    print(f"  📁 Bug history saved to: {BUG_HISTORY_FILE.absolute()}")
    
    # Update prompt version test results
    update_prompt_test_results(passed, failed, total_bug_count, solved_count)
    print(f"  📝 Prompt v{prompt_info['version']} test results updated")
    
    # Save detailed report
    save_test_report(results, OUTPUT_DIR)
    
    # Exit code
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
