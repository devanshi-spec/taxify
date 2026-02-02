# US Tax Form Extractor - Release Notes

## Release v1.5.1

**Release Date:** 28th January 2026

**Tested Date:** 28th January 2026

**Tested On:** Google Chrome

**Tested By:** QA Team

**Release By:** Yash Gajera

---

## Implementation Done (00):

_No new implementations in this release._

---

## Enhancement Done (00):

_No enhancements in this release._

---

## Bug Fixed (03):

1. **Ally 1099-INT Customer Service Name Fix** - Fixed issue where "Customer Service" text/numbers were being captured in the Payer Name field. Added explicit exclusion rules in `1099-INT prompt v1.2.0`.
2. **1099-INT Missing Fields Fix** - Added extraction support for previously missing Payer RTN (Routing Transit Number) and FATCA filing checkbox in `1099-INT prompt v1.2.0`.
3. **1098 Payer TIN Fix** - Fixed issue where Payer TIN was not being read. Added critical instructions to locate Lender/Recipient TIN in top-left box in `1098 prompt v1.2.0`.

---

## Changes Done (00):

_No code logic changes in this release._

---

## New Bug (00):

_No new bugs identified._

---

## New Changes (02):

1. **1099-INT v1.2.0** - Updated in registry.json as current version
2. **1098 v1.2.0** - Updated in registry.json as current version

---

## Suggestion (00):

_No suggestions at this time._

---

## Conclusion:

Release is **stable**. Addressed critical QA reported bugs regarding extraction accuracy for 1099-INT and 1098 forms. Payer identification and missing field issues have been resolved via prompt engineering updates.

---

## Files Changed:

| File | Changes |
|------|---------|
| `registry.json` | Updated 1099-INT and 1098 to v1.2.0 |
| `prompts/1099-INT/prompt_v1.2.0.json` | New prompt version with customer service exclusion & new fields |
| `prompts/1098/prompt_v1.2.0.json` | New prompt version with explicit TIN extraction instructions |

---

## Testing Checklist:

- [x] Ally 1099-INT Payer Name verification
- [x] 1099-INT RTN/FATCA extraction verification
- [x] 1098 Payer TIN extraction verification

---

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `a22feda3ca05bb6d8306c0133e47326d89706b36` |
| **Branch** | `staging` |
| **Message** | fix(prompts): QA Bug Fixes - 1099-INT Name/RTN & 1098 TIN (v1.5.1) |
