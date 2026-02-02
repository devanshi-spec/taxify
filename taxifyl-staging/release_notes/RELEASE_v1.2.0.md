# US Tax Form Extractor - Release v1.2.0

Here is the release of US Tax Form Extractor v1.2.0. Below are the features & bug fixes implemented.

---

**Release Date:** 12th January 2025

**Release Given By:** Yash Gajera

**Developer:** Yash Gajera

---

## New Implementation (04):

1. **Form K-1 Support** - Added Schedule K-1 (Form 1065) extraction with multi-page detection and partner records
2. **Form 8804 Support** - Added Form 8804 (Annual Return for Partnership Withholding Tax) extraction
3. **Form 8805 Support** - Added Form 8805 (Foreign Partner's Information Statement) extraction

---

## Enhancement (03):

1. **PDF Page Navigation** - Added slider to preview all pages of multi-page PDFs (previously only first page shown)
2. **Scrollable Review Container** - Results section now has fixed height (720px) with scroll for better UX
3. **1099-INT Multi-Account Extraction** - Enhanced prompt to extract all accounts from "Account Information" tables

---

## Bug Fixed (11):

1. **Bug 1: 1099-INT Address Spelling** - AI was misspelling city names (e.g., "HERSHAM" instead of "HORSHAM"); added spelling verification instructions
2. **Bug 2: 1099-INT FATCA Checkbox** - FATCA filing requirement checkbox not being extracted correctly
3. **Bug 3: W-2 Box 9 Verification Code** - Verification code field not displaying in the UI
4. **Bug 4: W-2 Box 13 Checkboxes** - Retirement Plan, Statutory Employee, Third-Party Sick Pay checkboxes not rendering correctly
5. **Bug 5: 1099-INT Payer Telephone** - Added Payer's telephone number extraction support
6. **Bug 6: 1099-INT Multi-Account Detection** - Ally Bank "Combined Statement" not detected as 1099-INT (detected as 1099-MISC)
7. **Bug 7: W-2 Dual State Tax Rows** - DC state row was missing; added Box 15b-20b support for W-2 forms with two state entries
8. **Bug 8: 1099-INT Multiple Accounts** - Capital One 1099-INT with multiple savings accounts now extracts all rows from table
9. **Bug 10: 1099-INT RTN Confusion** - "HQ 06-07" (building code) was extracted as Payer RTN; added 9-digit validation for RTN
10. **Bug 11: W-2 Department Field** - Added "Dept" field extraction and display in Employer section
11. **W-2 Employer Use Only** - Added "Employer Use Only" and "Other Data" catch-all fields

---

## Changes Done (05):

1. **W-2 Second State Row** - Added Box 15b, 16b, 17b, 18b, 19b, 20b fields for dual state W-2 forms
2. **W-2 Additional Data** - Added "Employer Use Only" and "Other Data" catch-all section at end of form
3. **1099-INT RTN Validation** - Added explicit instructions that RTN must be 9-digit number only
4. **Form Detection Priority** - Added "Combined Statement" patterns to 1099-INT detection before 1099-MISC
5. **Filename Detection** - Added underscore pattern support (e.g., "1099_INT" now detected correctly)

---

## Known Issues (02):

1. **W-2 Box 12 Code Extraction** - Single character codes (like "D") may occasionally not be read by AI vision models; this is an AI limitation, not a code bug
2. **W-2 Box 16 Hallucination** - In specific PDF layouts (e.g., 2024 W-2), Box 1 wages are incorrectly extracted as Box 16 (State wages) due to visual proximity when Box 16 is empty

---

## UI Improvements (02):

1. **Deprecation Fix** - Fixed Streamlit `use_column_width` deprecation warning (replaced with `use_container_width`)
2. **Conditional Display** - Dept, Employer Use Only, Other Data, and Second State Row sections only appear when data exists

---

## Conclusion:

Release is **stable**. Major additions include K-1, 8804 and 8805 form support. Multiple W-2 and 1099-INT extraction bugs have been fixed.

---

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `fb8d00e` |
| **Branch** | `staging` |
| **Message** | UI Update: Remove JSON Output tab as requested |
