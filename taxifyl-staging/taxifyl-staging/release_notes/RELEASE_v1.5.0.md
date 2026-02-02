# US Tax Form Extractor - Release Notes

## Release v1.5.0

**Release Date:** 24th January 2026

**Tested Date:** 24th January 2026

**Tested On:** Google Chrome

**Tested By:** QA Team

**Release By:** Yash Gajera

---

## Implementation Done (03):

1. **API Usage Tracking** - Both `/get-pages` and `/extract-form` endpoints now return usage statistics including model, input/output tokens, total tokens, start time, end time, and processing time
2. **Comprehensive Debug Logging** - Step-by-step logging with emojis for file reading, Supabase upload, AI detection, token usage, and page processing
3. **All Fields Extraction** - Updated extraction prompt to always return ALL fields defined in schema, even if empty (null, 0.0, or false)

---

## Enhancement Done (02):

1. **1099-INT Prompt v1.1.0** - Enhanced system prompt for improved multi-account extraction
   - Multi-instance extraction for tables/combined statements
   - Conditional TOTALS row extraction with Account Number = 'TOTALS'
   - Payer contact mapping (phone numbers strictly to Payer, never Recipient)
   - Field mapping (interest to Box 1, federal tax to Box 4)
   - Data integrity with 1:1 relationship between Account and amounts

2. **1098 Prompt v1.1.0** - Full field list and improved system prompt
   - Added all boxes 1-11 with proper labels
   - Added identification fields (is_void, is_corrected, lender/borrower details)
   - Multi-instance support for multiple loans
   - Conditional TOTALS row extraction

---

## Bug Fixed (00):

_No bugs fixed in this release._

---

## Changes Done (02):

1. **Dynamic Model Selection** - Model now loaded from `.env` file (`DEFAULT_MODEL`) instead of hardcoded value
2. **Removed Version Parameter** - `/extract-form` no longer requires version parameter, automatically uses `current_version` from registry

---

## New Bug (00):

_No new bugs identified._

---

## New Changes (02):

1. **1099-INT v1.1.0** - Updated in registry.json as current version
2. **1098 v1.1.0** - Updated in registry.json as current version

---

## Suggestion (00):

_No suggestions at this time._

---

## Conclusion:

Release is **stable**. New API usage tracking and comprehensive logging added. 1099-INT and 1098 prompts enhanced for better multi-account and multi-loan extraction.

---

## Files Changed:

| File | Changes |
|------|---------|
| `api.py` | Usage tracking, debug logging, dynamic model, all fields extraction |
| `registry.json` | Updated 1099-INT and 1098 to v1.1.0 |
| `prompts/1099-INT/prompt_v1.1.0.json` | New prompt version with enhanced system prompt |
| `prompts/1098/prompt_v1.1.0.json` | New prompt version with full field list |

---

## Testing Checklist:

- [x] 1099-INT extraction tested
- [x] 1098 extraction tested

---

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `a0e51f299fb2c36b58f3b1bdbb3386a345eeeeaa7` |
| **Branch** | `staging` |
| **Message** | feat(api): Add usage tracking and update 1099-INT, 1098 prompts |

