"""
Test Script: Multi-Form PDF Detection
======================================
Tests the new multi-form detection functionality on sample PDF (1.pdf).
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import (
    is_pdf_scanned,
    pdf_to_images_with_detection,
    detect_form_type_from_text,
    SUPPORTED_FORMS
)

def test_multi_form_detection():
    """Test multi-form detection on sample PDF with mixed form types."""
    
    print("=" * 70)
    print("Multi-Form PDF Detection Test")
    print("=" * 70)
    
    # Load sample PDF
    pdf_path = Path(__file__).parent.parent / "PDFS" / "1.pdf"
    
    if not pdf_path.exists():
        print(f"❌ Error: PDF not found at {pdf_path}")
        return
    
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    print(f"\n📄 Testing PDF: {pdf_path.name}")
    
    # Step 1: Check if PDF is scanned
    print("\n" + "="*70)
    print("STEP 1: Detect if PDF is Scanned or Digital")
    print("="*70)
    is_scanned = is_pdf_scanned(pdf_bytes)
    print(f"Result: {'🖨️  SCANNED (image-based)' if is_scanned else '💻 DIGITAL (text-based)'}")
    
    # Step 2: Process pages with OCR (since it's scanned)
    print("\n" + "="*70)
    print("STEP 2: Process Pages with OCR and Form Detection")
    print("="*70)
    print("Applying OCR to each page and detecting form types...")
    print()
    
    pages = pdf_to_images_with_detection(pdf_bytes, apply_ocr=is_scanned)
    
    # Step 3: Analyze results
    print("\n" + "="*70)
    print("STEP 3: Detection Results")
    print("="*70)
    
    supported_pages = []
    unsupported_pages = []
    form_counts = {}
    
    for page in pages:
        page_num = page["page_num"]
        form_type = page.get("form_type", "UNKNOWN")
        supported = page.get("supported", False)
        confidence = page.get("confidence", "N/A")
        
        # Count forms
        if supported:
            supported_pages.append(page)
            form_counts[form_type] = form_counts.get(form_type, 0) + 1
            icon = SUPPORTED_FORMS.get(form_type, {}).get("icon", "📄")
            print(f"✅ Page {page_num:2d}: {icon} {form_type:15s} (Confidence: {confidence})")
        else:
            unsupported_pages.append(page)
            print(f"⚠️  Page {page_num:2d}: ❌ {form_type:15s} (UNSUPPORTED)")
    
    # Step 4: Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"📊 Total Pages: {len(pages)}")
    print(f"✅ Supported Forms: {len(supported_pages)}")
    print(f"⚠️  Unsupported/Skipped: {len(unsupported_pages)}")
    
    if form_counts:
        print("\n📋 Form Type Breakdown:")
        for form_type, count in sorted(form_counts.items()):
            icon = SUPPORTED_FORMS.get(form_type, {}).get("icon", "📄")
            name = SUPPORTED_FORMS.get(form_type, {}).get("name", "Unknown")
            print(f"   {icon} {form_type}: {count} form(s) - {name}")
    
    if unsupported_pages:
        print("\n⚠️  Skipped Pages:")
        for page in unsupported_pages:
            print(f"   Page {page['page_num']}")
    
    print("\n" + "="*70)
    print("✅ TEST COMPLETE")
    print("="*70)
    
    return {
        "total_pages": len(pages),
        "supported": len(supported_pages),
        "unsupported": len(unsupported_pages),
        "form_counts": form_counts,
        "is_scanned": is_scanned
    }


if __name__ == "__main__":
    try:
        results = test_multi_form_detection()
        
        # Return exit code based on results
        if results and results["supported"] > 0:
            sys.exit(0)  # Success
        else:
            sys.exit(1)  # No forms detected
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
