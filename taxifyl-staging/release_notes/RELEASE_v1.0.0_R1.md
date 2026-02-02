# US Tax Form Extractor - Release Notes

## Release v1.0.0

**Release Date:** 22nd December 2024

**Release Given By:** Yash Gajera

**Developer:** Yash Gajera

---

## New Implementation (02):

1. **W-2 Form Extraction** - Extract data from W-2 Wage and Tax Statement forms
   - Identification plane (SSN, EIN, Employee/Employer info)
   - Federal tax plane (Boxes 1-11)
   - Supplemental plane (Box 12a-d codes, Box 13 checkboxes)
   - State/Local tax plane (Boxes 15-20)

2. **1099-INT Form Extraction** - Extract data from 1099-INT Interest Income forms
   - Identification plane (Payer/Recipient TIN, Account Number, RTN)
   - Financial plane (Boxes 1-11: Interest Income, Tax Withheld, Bond Premium)
   - State/Local plane (Boxes 15-17: State Tax Information)

---

## Enhancement (03):

1. **Multiple AI Model Support** - Choose between Gemini 2.5 Flash, Gemini 2.0 Flash, or Llama 4 Scout
2. **Default Model Changed** - meta-llama/llama-4-scout-17b-16e-instruct set as default (FREE API)
3. **Auto Form Detection** - Automatic detection of form type from filename or OCR patterns

---

## Bug Fixed (02):

1. **1099-INT Detection** - Fixed detection for filenames with space (e.g., "1099 INT" now correctly detected)
2. **1099-INT Transformer** - Fixed extraction when AI returns alternate JSON formats (financial_data.box_1_interest_income)

---

## Changes Done (03):

1. **Unified App Structure** - Single `app.py` handles all form types with modular extractors
2. **Form-Specific Table Views** - Separate table view renderers for W-2 and 1099-INT forms
3. **JSON Output Format** - Exact structured JSON format with planes (identification, financial, state_local)

---

## Known Issues (01):

1. **OCR Fallback** - Tesseract OCR fallback may have lower accuracy compared to AI extraction

---

## Supported Forms:

| Form | Status | Description |
|------|--------|-------------|
| W-2 | ✅ Complete | Wage and Tax Statement |
| 1099-INT | ✅ Complete | Interest Income |
| 1099-NEC | 🔜 Planned | Nonemployee Compensation |
| 1099-MISC | 🔜 Planned | Miscellaneous Income |

---

## API Models Used:

| Provider | Model | Cost |
|----------|-------|------|
| Groq | meta-llama/llama-4-scout-17b-16e-instruct | FREE |
| Google | gemini-2.5-flash | FREE (15 RPM) |
| Google | gemini-2.0-flash | FREE (15 RPM) |
