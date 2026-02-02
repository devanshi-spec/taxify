.\venv\Scripts\Activate.ps1
 uvicorn api:app --host 0.0.0.0 --port 8000 --reload 
streamlit run ui.py                                               


4.45 pm 28/01/2026 solve bugs 
9.00 am 29/01/2026 -  Removed "Detect All Forms" button - detection now starts automatically when you upload files 
10.05 am 29/01/2026 - QA check on 1098 extraction results, identified TIN misclassification bug 
11.10 am 29/01/2026 - Analyzed 1098 extraction results (v1.4.0), confirmed TIN fix, identified new bug with CORRECTED checkbox hallucination 
11.34 am 29/01/2026 - Confirmed fixes for checkbox/lender bugs. User requested "redacted" value instead of null for blurred text. 
10.30 am 30/01/2026 - Implemented batch extraction feature: /extract-form now accepts multiple pages, auto-chunks into batches of 10, reduces API costs by up to 90%
11.00 am 30/01/2026 - Updated UI with single dynamic button ("Extract Form" / "Extract All X Forms"), removed individual per-page extract buttons
