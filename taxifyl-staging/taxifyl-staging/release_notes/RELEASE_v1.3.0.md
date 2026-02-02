# US Tax Form Extractor - Release v1.3.0

Here is the release of US Tax Form Extractor v1.3.0. This release introduces a major architectural change with the API split and the new Registry system, alongside critical W-2 bug fixes.

---

**Release Date:** 16th January 2026

**Release Given By:** Yash Gajera

**Developer:** Yash Gajera

**Staging Environment:**
- **Frontend (Streamlit):** [https://taxifyl-streamlit-staging-be.avinashi.dev/](https://taxifyl-streamlit-staging-be.avinashi.dev/)
- **Backend API (Docs):** [https://taxifyl-staging-backend.avinashi.dev/docs](https://taxifyl-staging-backend.avinashi.dev/docs)

---

## New Implementation (02):

1. **Dynamic Registry System** - Introduced `registry.json` to centralize form definitions.
    - Form prompts, fields, and validation rules are now configurable via JSON, allowing easier additions of new forms without code changes.
2. **API Endpoint Split (Refactor)** - Split the single extraction endpoint into two distinct endpoints for better control:
    - `POST /get-pages` - Detects valid tax form pages in an uploaded file.
    - `POST /extract-form` - Performs extraction on specific identified pages.

---

## Enhancement (01):

1. **AI Model Upgrade** - Updated default extraction model to **Gemini 2.5 Flash** for improved accuracy.

---

## Bug Fixed (04):

1. **W-2 Selection Issue** - Fixed issue in `W2_Jobcase_2023_Redacted.pdf` where Box B was not selectable but an output number was displayed.
2. **W-2 Box 13 Read Error** - Fixed OCR issue in `W2_2023_Redacted.pdf` where the "A" in "Employer Use Only" was not read.
3. **W-2 Control Number** - Corrected Control Number extraction accuracy for `2024 W2_Redacted.pdf`.
4. **W-2 Data Merging** - Fixed an issue where CASDI-E and DD values were incorrectly merged into "Other Data" in redacted extracts.

---

## Changes Done (01):

1. **Environment Configuration** - Updated `.env` settings to support new `gemini-2.5-flash` model.

---

## Conclusion:

This release marks a significant step forward with the **API decoupling** and the introduction of the **Registry Pattern**, making the system more modular and scalable. Several critical parsing bugs related to W-2 forms have also been resolved.

---

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `9350aaf6145f711f21f871d2793d4257677fd17e` |
| **Branch** | `staging` |
| **Message** | Feature: API Split, Registry, and W-2 Fixes |
