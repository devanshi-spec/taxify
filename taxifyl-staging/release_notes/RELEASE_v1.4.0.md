# US Tax Form Extractor - Release v1.4.0

**Release Date:** 21st January 2026  
**Developer:** Yash Gajera  
**Model:** Gemini 2.5 Pro  
**W-2 Prompt Version:** 1.4.0  
**Commit:** `967eaf8`

---

## What's New

- ✅ **Form Order Updated:** W-2 → 1099-INT → 1099-DIV → 1099-NEC → 1098 → 1098-T
- ✅ **W-2 Prompt v1.4.0:** New principle-based extraction (10 principles, no hardcoded rules)
- ✅ **Test Suite Added:** Automated W-2 validation with bug tracking

---

## Bugs Fixed (6)

| # | Issue | Status |
|---|-------|--------|
| 1 | Dept and Corp values shifted (w2_2023_redacted) | ✅ Fixed |
| 2 | Dept taken from footer text (5.pdf) | ✅ Fixed |
| 3 | Employer use only taken from outside form (5.pdf) | ✅ Fixed |
| 4 | Control number truncated, Corp taken from emp use only (w2_2023_jobcase) | ✅ Fixed |
| 5 | Missed CA in Box 14 "Others" (w2_2023_redacted) | ✅ Fixed |
| 6 | Box 12 contents shifted (1.pdf) | ✅ Fixed |

---

## Known Issue (1)

### 🔴 Corp & Employer Use Only Splitting

**Problem:** Value like `T 13` in "Employer use only" gets split:
- Corp shows: `T` ❌
- Employer use only shows: `13` ❌

**Expected:**
- Corp: `null`
- Employer use only: `T 13`

**Status:** Under investigation for next release.
