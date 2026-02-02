# US Tax Form Extractor - Release Notes

## Release v1.1.0

**Release Date:** 26th December 2024

**Tested Date:** 26th December 2024

**Tested On:** Google Chrome

**Tested By:** QA Team

**Release By:** Yash Gajera

---

## Implementation Done (00):

_No new implementations in this release._

---

## Enhancement Done (01):

1. **W-2 Extraction Prompt Enhancement** - Improved AI prompt with detailed box definitions for better extraction accuracy
   - Added Federal Section (Boxes 1-6) with Social Security wage cap notes
   - Added State/Local Section (Boxes 15-20) with clear wage vs tax distinction

---

## Bug Fixed (04):

1. **W-2 Form > Box E/F and Box C** - Name and address not fully displayed in extracted form (only name was showing, address was missing)
2. **W-2 Form > Box 3 (Social Security Wages)** - Amount not matching PDF due to AI confusion with Box 1 value
3. **W-2 Form > Box 5 (Medicare Wages)** - Amount not matching PDF due to AI confusion with Box 1 value
4. **W-2 Form > Box 16/17 (State Wages/Tax)** - State wages and state tax amounts were swapped in extraction

---

## Changes Done (03):

1. **W-2 Transformation** - Added `find_combined_value()` helper function to combine name + address fields
2. **W-2 Rendering** - Added `format_multiline()` helper to convert newlines to HTML `<br>` tags for proper display
3. **W-2 Box 15** - Modified to display both state abbreviation AND employer state ID (e.g., "CA 168-3280-0")

---

## New Bug (00):

_No new bugs identified._

---

## New Changes (01):

1. **W-2 Box 15 Display** - Now shows complete state employer ID (e.g., "CA 168-3280-0") instead of just state abbreviation

---

## Suggestion (01):

1. Consider adding validation rules to verify extracted amounts match expected ranges (e.g., Box 3 should not exceed Social Security wage cap)

---

## Conclusion:

Release is **stable**. All reported QA bugs have been fixed and the W-2 form extraction accuracy has been improved with enhanced AI prompts.

---

## Files Changed:

| File | Changes |
|------|---------|
| `app.py` | Enhanced W-2 prompt, added helper functions, fixed Box 15 display |

---

## Testing Checklist:

- [x] W-2 Form > Box E/F shows name AND address
- [x] W-2 Form > Box C shows employer name AND address  
- [x] W-2 Form > Box 15 shows state AND employer state ID
- [x] W-2 Form > Box 16 shows correct state wages
- [x] W-2 Form > Box 17 shows correct state tax withheld

---

## Git Commit:

| Field | Value |
|-------|-------|
| **Commit Hash** | `ee620729e887d7443140d67ddcd5a0419b2e864a` |
| **Branch** | `staging` |
| **Message** | fix(W-2): Fix name+address display and improve extraction accuracy |

### Commit Details:
- Add find_combined_value helper to combine name and address fields
- Fix Box E/F and Box C to display both name AND address (not just name)
- Add format_multiline helper to convert newlines to HTML br tags
- Enhance W-2 extraction prompt with detailed box definitions:
  - Federal section (Boxes 1-6) with wage cap notes
  - State/Local section (Boxes 15-20) with clear wage vs tax distinction
- Fix Box 15 to display both state abbreviation AND employer state ID
- Add configurable separator param to find_combined_value function
