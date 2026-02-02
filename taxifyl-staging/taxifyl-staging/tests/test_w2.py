"""
W-2 Detection & Extraction Test Script
========================================
Tests the API with multiple W-2 PDFs and saves results to output folder.
"""

import requests
import json
import os
from pathlib import Path

# Configuration
API_BASE_URL = "http://127.0.0.1:8000"
OUTPUT_DIR = Path("output/w2_tests")

# W-2 PDFs to test
W2_PDFS = [
    r"PDFS\5.pdf",
    r"PDFS\New data\W-2\1.pdf",
    r"PDFS\New data\W-2\2.pdf",
    r"PDFS\New data\W-2\3.pdf",
    r"PDFS\New data\W-2\4.pdf",
    r"PDFS\New data\W-2\5.pdf"
]

def test_pdf(pdf_path: str):
    """Run detection and extraction for a single PDF."""
    pdf_name = Path(pdf_path).stem
    print(f"\n{'='*60}")
    print(f"Testing: {pdf_path}")
    print(f"{'='*60}")
    
    # 1. Detection (get-pages)
    print("\n[1/2] Detecting forms...")
    with open(pdf_path, "rb") as f:
        files = {"file": (Path(pdf_path).name, f, "application/pdf")}
        response = requests.post(f"{API_BASE_URL}/get-pages", files=files)
    
    if response.status_code != 200:
        print(f"  ❌ Detection failed: {response.text}")
        return None
    
    detection_result = response.json()
    pages = detection_result.get("data", {}).get("pages", [])
    print(f"  ✅ Found {len(pages)} page(s) with forms")
    
    # Save detection result
    detection_file = OUTPUT_DIR / f"{pdf_name}_detection.json"
    with open(detection_file, "w") as f:
        json.dump(detection_result, f, indent=2)
    print(f"  📄 Saved: {detection_file}")
    
    # 2. Extract each page
    all_extractions = []
    for page in pages:
        page_url = page.get("pageUrl")
        page_num = page.get("pageNumber")
        detected_types = page.get("detectedTypes", ["W-2"])
        form_type = detected_types[0] if detected_types else "W-2"
        
        print(f"\n[2/2] Extracting page {page_num} ({form_type})...")
        
        extract_payload = {
            "page_url": page_url,
            "detected_type": form_type
        }
        
        response = requests.post(f"{API_BASE_URL}/extract-form", json=extract_payload)
        
        if response.status_code == 200:
            extract_result = response.json()
            forms_count = len(extract_result.get("data", {}).get("extractedForms", []))
            print(f"  ✅ Extracted {forms_count} form(s)")
            all_extractions.append({
                "page": page_num,
                "result": extract_result
            })
        else:
            print(f"  ❌ Extraction failed: {response.text}")
    
    # Save extraction results
    extraction_file = OUTPUT_DIR / f"{pdf_name}_extraction.json"
    with open(extraction_file, "w") as f:
        json.dump(all_extractions, f, indent=2)
    print(f"  📄 Saved: {extraction_file}")
    
    return all_extractions


def main():
    print("=" * 60)
    print("W-2 Detection & Extraction Test Script")
    print("=" * 60)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Check API health
    try:
        health = requests.get(f"{API_BASE_URL}/health")
        if health.status_code != 200:
            print("❌ API is not healthy. Please start the server first.")
            return
        print("✅ API is healthy")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Please start the server:")
        print("   uvicorn api:app --port 8000")
        return
    
    # Test each PDF
    results_summary = []
    for pdf_path in W2_PDFS:
        if not os.path.exists(pdf_path):
            print(f"\n⚠️ File not found: {pdf_path}")
            continue
        
        result = test_pdf(pdf_path)
        if result:
            total_forms = sum(
                len(page.get("result", {}).get("data", {}).get("extractedForms", []))
                for page in result
            )
            results_summary.append({
                "pdf": pdf_path,
                "pages": len(result),
                "forms_extracted": total_forms
            })
    
    # Print Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for r in results_summary:
        print(f"  {r['pdf']}: {r['pages']} page(s), {r['forms_extracted']} form(s)")
    print(f"\n📁 Results saved to: {OUTPUT_DIR.absolute()}")


if __name__ == "__main__":
    main()
