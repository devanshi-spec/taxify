# Release v1.6.0

**Date:** January 30, 2026
**Focus:** History Feature & Critical Extraction Fixes

## 🚀 New Features

### 1. Extraction History (Supabase Integration)
- **History Tab:** Added a new "History" tab in the UI to view past extractions.
- **Persistence:** All extraction results are now saved to a Supabase database.
- **Form Types:** History list clearly indicates which form types were extracted (e.g., `[1099-INT, 1098]`).
- **Timezone Support:** Timestamps are strictly displayed in **IST (Indian Standard Time)**.

## 🐛 Resolved Bugs

The following specific issues have been addressed and fixed in this release:

### Form 1098
- **Payer TIN Misclassification:** Fixed issue where Payer's TIN was being misclassified into Receiver's TIN (`1098>3.pdf`).
- **Payer TIN Content:** Fixed issue where Payer's TIN was being misclassified into Account Number (`1098>4.pdf`).

### Form 1099-INT
- **Header Hallucination (Name/Address):** Fixed critical bug where Name & Address were extracted from the document header/letterhead instead of the official form box (`1099_int>1.pdf`).
- **Header Hallucination (Account Number):** Fixed issue where Account Number was extracted from the header instead of the form (`1099_int>1.pdf`).
- **Capital One Penalty:** Fixed issue where "Early Withdrawal Penalty" was taken from the summary table below, causing it to be skipped in later field extraction (`capitalonerc_1099`).

### General 1099 Forms
- **Address & Account Hallucination:** Fixed similar issues where address and account numbers were being pulled from headers in general 1099 forms (`1099>1.pdf`).

## ⚠️ Known Issues
- **Form 1098 Extraction:**
    -   In specific files (e.g., `1098 3.pdf`), the **Payer's TIN** is currently not being extracted. This is under investigation.

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `fac08e9cb83e2690662b52ed9fa4c28111e967f7` |
| **Branch** | `dev` |
| **Message** | feat: Add v1.4.0 prompts for Forms 1098 and 1099-INT, and simplify the API extraction response data. |


