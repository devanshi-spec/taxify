"""
Debug Script: Test Form 8804 Extraction Directly
================================================
Tests Form 8804 extraction to see raw AI output including partner name and allocation.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from forms.form_8804.extractor import Form8804Extractor
from PIL import Image
import json

def test_form_8804_extraction():
    """Test Form 8804 extraction on a specific page."""
    
    print("="*70)
    print("Form 8804 Direct Extraction Test")
    print("="*70)
    
    # Initialize extractor
    extractor = Form8804Extractor()
    
    if not extractor.is_configured():
        print("❌ No extraction method configured!")
        return
    
    # Test with a sample image (you'll need to provide the path)
    pdf_path = Path(__file__).parent.parent / "PDFS" / "K1-Format-copy.pdf"
    
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}")
        print("\nPlease provide path to your Form 8804 PDF")
        return
    
    # Convert page 43 to image for testing
    try:
        import fitz
        doc = fitz.open(str(pdf_path))
        
        # Extract page 43 (0-indexed, so page 42)
        page_num = 42
        if page_num >= len(doc):
            print(f"❌ Page {page_num + 1} not found in PDF")
            return
        
        page = doc[page_num]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        doc.close()
        
        print(f"\n✅ Converted Page {page_num + 1} to image")
        
    except Exception as e:
        print(f"❌ Error converting PDF: {e}")
        return
    
    # Test extraction with Gemini
    print("\n" + "="*70)
    print("Testing Extraction with Gemini 2.5 Flash")
    print("="*70)
    
    try:
        result = extractor.extract(img, model="gemini-2.5-flash")
        
        print("\n📦 RAW EXTRACTION RESULT:")
        print(json.dumps(result, indent=2))
        
        # Check for partner fields
        print("\n" + "="*70)
        print("VERIFICATION CHECKS")
        print("="*70)
        
        if "form_metadata" in result:
            metadata = result["form_metadata"]
            
            print(f"\n✅ form_metadata found:")
            print(f"   - form_type: {metadata.get('form_type', 'MISSING')}")
            print(f"   - tax_year: {metadata.get('tax_year', 'MISSING')}")
            print(f"   - partner_name: {metadata.get('partner_name', 'MISSING ❌')}")
            print(f"   - allocation_percentage: {metadata.get('allocation_percentage', 'MISSING ❌')}")
            print(f"   - partner_ein_ssn: {metadata.get('partner_ein_ssn', 'MISSING ❌')}")
            print(f"   - partnership_name: {metadata.get('partnership_name', 'MISSING')}")
            print(f"   - partnership_ein: {metadata.get('partnership_ein', 'MISSING')}")
            
            # Check if new fields are present
            has_partner_name = 'partner_name' in metadata and metadata['partner_name']
            has_allocation = 'allocation_percentage' in metadata and metadata['allocation_percentage']
            
            if has_partner_name and has_allocation:
                print("\n🎉 SUCCESS! Partner fields extracted correctly!")
            elif has_partner_name or has_allocation:
                print("\n⚠️ PARTIAL: Some partner fields extracted, some missing")
            else:
                print("\n❌ FAILED: Partner name and allocation not extracted")
                print("   This means the AI prompt update didn't work as expected.")
        else:
            print("\n❌ ERROR: No form_metadata in result")
        
        if "error" in result:
            print(f"\n❌ Error in extraction: {result['error']}")
        
    except Exception as e:
        print(f"\n❌ Extraction failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("TEST COMPLETE")
    print("="*70)


if __name__ == "__main__":
    test_form_8804_extraction()
