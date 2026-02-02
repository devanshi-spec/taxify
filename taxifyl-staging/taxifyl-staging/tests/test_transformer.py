"""
Automated Tests for US Tax Form Extractor
==========================================
Run with: python -m pytest tests/test_transformer.py -v
Or: python tests/test_transformer.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json


# Sample AI output (mimics what Gemini returns)
SAMPLE_AI_OUTPUT = {
    "year": "2024",
    "employee_ssn": "123-45-6789",
    "employer_ein": "91-1234567",
    "employer_name": "TEST CORPORATION",
    "employer_address": "123 Main St, City, ST 12345",
    "control_number": "ABC123",
    "employee_name": "JOHN DOE",
    "employee_address": "456 Oak Ave, Town, ST 67890",
    "box_1": 75000.50,
    "box_2": 15000.00,
    "box_3": 75000.50,
    "box_4": 4650.00,
    "box_5": 75000.50,
    "box_6": 1087.50,
    "box_7": 0.00,
    "box_8": 0.00,
    "box_10": 0.00,
    "box_11": 0.00,
    "box_12a_code": "D",
    "box_12a_amount": 5000.00,
    "box_12b_code": "DD",
    "box_12b_amount": 12000.00,
    "box_12c_code": "",
    "box_12c_amount": 0.00,
    "box_12d_code": "",
    "box_12d_amount": 0.00,
    "box_13_statutory": False,
    "box_13_retirement": True,
    "box_13_sick_pay": False,
    "box_14": "HEALTH 500.00",
    "box_15": "NY",
    "box_16": 75000.50,
    "box_17": 5000.00,
    "box_18": 0.00,
    "box_19": 0.00,
    "box_20": ""
}


def test_flatten_dict():
    """Test the flatten_dict function."""
    from app import flatten_dict
    
    nested = {
        "a": 1,
        "b": {
            "c": 2,
            "d": {
                "e": 3
            }
        },
        "f": [{"g": 4}, {"h": 5}]
    }
    
    flat = flatten_dict(nested)
    print("Flattened dict:", flat)
    
    assert "a" in flat
    assert flat["a"] == 1
    assert "b_c" in flat
    assert flat["b_c"] == 2
    assert "b_d_e" in flat
    assert flat["b_d_e"] == 3
    
    print("✅ flatten_dict test passed!")


def test_transform_to_w2_structure():
    """Test the W-2 transformer with sample AI output."""
    from app import transform_to_w2_structure, flatten_dict
    
    # First, check if flatten works on the sample
    flat = flatten_dict(SAMPLE_AI_OUTPUT)
    print("\n=== Flattened AI Output ===")
    for k, v in sorted(flat.items()):
        print(f"  {k}: {v}")
    
    # Now transform
    result = transform_to_w2_structure(SAMPLE_AI_OUTPUT)
    
    print("\n=== Transformed Result ===")
    print(json.dumps(result, indent=2))
    
    # Validate structure
    assert isinstance(result, list), "Result should be a list"
    assert len(result) == 1, "Result should have 1 item"
    
    forms = result[0].get("forms", [])
    assert len(forms) == 1, "Should have 1 form"
    
    form = forms[0]
    header = form.get("form_header", {})
    assert header.get("form_number") == "W-2"
    assert header.get("year") == "2024"
    
    boxes = form.get("boxes", [])
    assert len(boxes) == 4, "Should have 4 box groups"
    
    # Check identification plane
    id_plane = boxes[0].get("identification_plane", [])
    assert len(id_plane) == 5, "Should have 5 identification items"
    
    # Check SSN value
    ssn_data = id_plane[0].get("data", [{}])[0]
    print(f"\nSSN data: {ssn_data}")
    assert ssn_data.get("value") == "123-45-6789", f"SSN should be 123-45-6789, got: {ssn_data.get('value')}"
    
    # Check federal tax plane
    fed_plane = boxes[1].get("federal_tax_plane", [])
    box1_data = fed_plane[0].get("data", [{}])[0]
    print(f"Box 1 data: {box1_data}")
    assert box1_data.get("value") == 75000.50, f"Box 1 should be 75000.50, got: {box1_data.get('value')}"
    
    print("\n✅ transform_to_w2_structure test passed!")


def test_transform_with_nested_ai_output():
    """Test transformer with nested AI output (sometimes AI returns nested JSON)."""
    from app import transform_to_w2_structure
    
    nested_output = {
        "document_type": "W-2",
        "tax_year": "2024",
        "employee": {
            "ssn": "987-65-4321",
            "name": "JANE SMITH",
            "address": "789 Pine Rd"
        },
        "employer": {
            "ein": "12-3456789",
            "name": "ACME INC",
            "address": "100 Business Way"
        },
        "wages": {
            "box_1": 50000.00,
            "box_2": 10000.00,
            "box_3": 50000.00,
            "box_4": 3100.00,
            "box_5": 50000.00,
            "box_6": 725.00
        }
    }
    
    result = transform_to_w2_structure(nested_output)
    print("\n=== Nested Transform Result ===")
    print(json.dumps(result, indent=2))
    
    forms = result[0].get("forms", [])
    form = forms[0]
    boxes = form.get("boxes", [])
    
    # Check it found the SSN
    id_plane = boxes[0].get("identification_plane", [])
    ssn_data = id_plane[0].get("data", [{}])[0]
    print(f"Nested SSN: {ssn_data.get('value')}")
    
    # Check it found box_1
    fed_plane = boxes[1].get("federal_tax_plane", [])
    box1_data = fed_plane[0].get("data", [{}])[0]
    print(f"Nested Box 1: {box1_data.get('value')}")
    
    assert box1_data.get("value") == 50000.00
    
    print("\n✅ Nested transform test passed!")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Running US Tax Form Extractor Tests")
    print("=" * 60)
    
    try:
        test_flatten_dict()
        test_transform_to_w2_structure()
        test_transform_with_nested_ai_output()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        return True
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
