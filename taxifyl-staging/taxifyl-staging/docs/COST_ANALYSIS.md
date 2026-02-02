# AI Model Cost & Confidence Score Analysis

> **Document Version**: 1.0  
> **Date**: 28th January 2026  
> **Project**: US Tax Form Extractor  
> **Exchange Rate**: ₹92 per USD

---

## 1. Current Token Usage (Per Page)

Based on actual API logs from this project:

| Operation | Input Tokens | Output Tokens | Total |
| :--- | ---: | ---: | ---: |
| **Detection** (`/get-pages`) | ~1,200 | ~150 | ~1,350 |
| **Extraction** (`/extract-form`) | ~1,500 | ~400 | ~1,900 |
| **Total per Page** | **~2,700** | **~550** | **~3,250** |

> **Note**: Input tokens are mostly from the image (~1,000-1,500 tokens per page).

---

## 2. Current Model Pricing (January 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
| :--- | ---: | ---: |
| **Gemini 2.5 Flash Lite** | ₹9.20 | ₹36.80 |
| **Gemini 2.5 Flash** | ₹13.80 | ₹55.20 |
| **Gemini 2.5 Pro** | ₹115.00 | ₹460.00 |

---

## 3. Current Cost Per Page (No Confidence Score)

| Model | Input Cost | Output Cost | **Total/Page** | **Cost for 1000 Pages** |
| :--- | ---: | ---: | ---: | ---: |
| **Flash Lite** | ₹0.025 | ₹0.020 | **₹0.045** | **₹45** |
| **Flash** | ₹0.037 | ₹0.030 | **₹0.067** | **₹67** |
| **Pro** | ₹0.311 | ₹0.253 | **₹0.564** | **₹564** |

---

## 4. Estimated Cost WITH Confidence Scores

Adding confidence scores increases **output tokens by ~50%** (JSON becomes more verbose).

| Model | New Output Cost | **New Total/Page** | **Cost for 1000 Pages** | **Increase** |
| :--- | ---: | ---: | ---: | ---: |
| **Flash Lite** | ₹0.030 | **₹0.055** | **₹55** | +22% |
| **Flash** | ₹0.045 | **₹0.082** | **₹82** | +22% |
| **Pro** | ₹0.380 | **₹0.691** | **₹691** | +23% |

> **Verdict**: Adding confidence scores costs approximately **₹15-₹127 more per 1000 pages** depending on model.

---

## 5. How Does AI Calculate Confidence Score?

### Simple Explanation:

The AI does **NOT** have a built-in "confidence meter". Instead, we **ask** the AI to self-assess how sure it is.

### What the AI Considers (Basis):

| Factor | High Confidence (0.9 - 1.0) | Low Confidence (0.5 - 0.7) |
| :--- | :--- | :--- |
| **Text Clarity** | Clear, printed text | Blurry, handwritten, or stamped over |
| **Layout Match** | Standard IRS box layout | Non-standard bank format |
| **Value Format** | Matches expected format (e.g., `$1,234.56`) | Unusual format or missing decimals |
| **Field Presence** | Field clearly labeled on form | Label missing, value guessed from position |
| **OCR Quality** | Digital PDF (vector text) | Scanned/faxed image |

### Example Prompt Instruction:

```
For each extracted field, also return a "confidence" score between 0.0 and 1.0:
- 0.9 - 1.0: Text is perfectly clear, matches expected format
- 0.7 - 0.9: Text is readable but slightly ambiguous (e.g., "0" vs "O")
- 0.5 - 0.7: Text is blurry, handwritten, or partially obscured
- Below 0.5: Pure guess, no clear text visible
```

### Important Note:

This is **self-reported** by the AI. It is a good heuristic but not 100% reliable. For critical fields (like TIN or dollar amounts), you can add **post-processing validation** in code:

```python
# Example: Lower confidence if TIN format is invalid
if not re.match(r'^\d{2}-\d{7}$', value):
    confidence = min(confidence, 0.6)
```

---

## 6. Summary

| Metric | Current | With Confidence |
| :--- | ---: | ---: |
| Output Tokens | ~550 | ~825 (+50%) |
| Cost per 1000 pages (Flash) | ₹67 | ₹82 (+22%) |
| Extra Cost per 1000 pages | - | ₹15 |
| QA Benefit | Manual review all | Auto-flag low confidence |

**Recommendation**: The ₹15 extra cost per 1000 pages (Flash model) is worth the automation benefit. Low-confidence fields can be auto-flagged for human review, reducing QA time significantly.
