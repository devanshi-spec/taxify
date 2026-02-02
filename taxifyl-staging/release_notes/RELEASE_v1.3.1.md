# US Tax Form Extractor - Release v1.3.1

Here is the release of US Tax Form Extractor v1.3.1. This release focuses on fixing critical extraction issues in W-2 forms specifically related to Box 12 positioning and data shifting on multi-page documents.

---

**Release Date:** 16th January 2026

**Release Given By:** Yash Gajera

**Developer:** Yash Gajera

**Staging Environment:**
- **Frontend (Streamlit):** [https://taxifyl-streamlit-staging-be.avinashi.dev/](https://taxifyl-streamlit-staging-be.avinashi.dev/)
- **Backend API (Docs):** [https://taxifyl-staging-backend.avinashi.dev/docs](https://taxifyl-staging-backend.avinashi.dev/docs)

---

## Bug Fixed (10):

1. **W-2 Box 12 Extraction Shift on Multi-Page** - Fixed issue in `1.pdf` where Box 12a/b/c/d values were shifting on subsequent pages. Implemented "Strict Positioning Rule" (`registry.json` Rule 5) to prevent data migration when slots are visually empty.
2. **W-2 Box 3 vs Box 5 Value Copying** - Fixed critical issue where Box 3 (Social Security wages) was incorrectly copying values from Box 5 (Medicare wages) or vice versa. Implemented "Separation Rule" (`registry.json` Rule 1) to treat them as independent.
3. **W-2 Box 12 vs Box 14 Content** - Fixed issue where Box 14 content (like "RETIRE", "CASDI") was being incorrectly extracted into Box 12a. Added filter to allow only valid IRS codes in Box 12 (`registry.json` Rule 2).
4. **W-2 Box 13 Checkbox Accuracy** - Fixed "wrong value in checkbox" issue by enforcing strict visual checkmark detection inside the tiny squares, rather than label presence (`registry.json` Rule 3).
5. **W-2 Box 12 "Shift-Down" Prevention** (Updated) - Re-refixed issue where Box 12b values were drifting into Box 12c. Implemented "Rule 5 - Label Matching" to force the model to identify the printed labels "12a", "12b", "12c", "12d" and map values strictly to the matching JSON key, ignoring spatial grid alignment.
6. **W-2 Field Separation (Control/Corp vs Employer Use Only)** - Fixed issue where "Employer use only" data was being incorrectly extracted as "Control number" or "Corp". Updated explicit rule (`registry.json` Rule 6) to treat these as distinct fields with strict boundaries.
7. **W-2 Employer Use Only Boundaries (Footer Leakage)** - Fixed issue where "Employer use only" was incorrectly extracting footer codes like "L87 5206" when the actual box was empty. Updated 'registry.json' Rule 7 to enforce strict box boundaries and explicitly ignore footer text, while still maintaining full capture logic for valid data (e.g., "A 22").
8. **W-2 Dept Field False Positive** - Fixed issue where "Dept. of the Treasury - IRS" from the footer was incorrectly extracted as the "Dept" box value. Added validation rule (`registry.json` Rule 8) to only accept data from the specific "Dept." box.
9. **W-2 Control Number vs Employer Use Only (Identity Crisis)** (Updated) - Fixed critical issue where the "Employer Use Only" value (e.g. `62-1026428`) was being erroneously duplicated into a blank "Control Number" (Box d). Rewrote `registry.json` Rule 9 to explicitly check the box header: if the number is under "Employer use only", it must NOT be extracted as "Control number".
10. **W-2 Box 14 Differential Extraction (Federal vs State/City)** - Fixed issue where "CA" prefixes were being incorrectly forced onto Federal copies or dropped from State copies. Updated `registry.json` Rule 10 to enforce strictly independent extraction per page: State/City copies must retain "CA SDI", while Federal copies must remain "SDI" if no prefix is printed.

**Commit:** `6eb7b132672d81bc85872a74ca6e66e28cb608cd`

---

## Conclusion:

This release provides specific fixes for 10 reported W-2 extraction bugs, significantly improving accuracy for Box 12, Checkboxes, Box 14, and field boundaries.
