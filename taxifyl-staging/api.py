# """
# FastAPI Backend for US Tax Form Extractor
# ==========================================
# Provides REST API endpoints for form extraction.
# """

# from fastapi import FastAPI, UploadFile, File, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from PIL import Image
# import io
# import os
# import json

# # Import extraction logic from app
# try:
#     from app import VisionClient, FormDetector, transform_to_w2_structure, pdf_to_images
# except ImportError:
#     VisionClient = None
#     FormDetector = None

# app = FastAPI(
#     title="US Tax Form Extractor API",
#     description="AI-powered extraction of US tax forms (W-2, 1099-INT, etc.)",
#     version="1.0.0"
# )

# # CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Initialize services
# vision_client = VisionClient() if VisionClient else None
# form_detector = FormDetector() if FormDetector else None


# @app.get("/")
# def root():
#     """Root endpoint."""
#     return {
#         "service": "US Tax Form Extractor API",
#         "version": "1.0.0",
#         "status": "running"
#     }


# @app.get("/health")
# def health_check():
#     """Health check endpoint."""
#     return {
#         "status": "healthy",
#         "gemini_ready": vision_client.gemini_ready if vision_client else False,
#         "groq_ready": vision_client.groq_client is not None if vision_client else False
#     }


# @app.post("/extract")
# async def extract_form(
#     file: UploadFile = File(...),
#     model: str = "gemini-2.5-flash"
# ):
#     """
#     Extract data from a tax form.
    
#     - **file**: PDF or image file (W-2, 1099-INT, etc.)
#     - **model**: AI model to use (gemini-2.5-flash, gemini-2.0-flash, meta-llama/llama-4-scout-17b-16e-instruct)
    
#     Returns extracted data in structured JSON format.
#     """
#     if not vision_client:
#         raise HTTPException(status_code=500, detail="Vision client not initialized")
    
#     try:
#         # Read file
#         content = await file.read()
        
#         # Convert to image
#         if file.content_type == "application/pdf":
#             images = pdf_to_images(content)
#             if not images:
#                 raise HTTPException(status_code=400, detail="Failed to process PDF")
#             img = images[0]
#         else:
#             img = Image.open(io.BytesIO(content))
        
#         # Detect form type
#         detection = form_detector.detect(img, file.filename)
#         form_type = detection["form_type"]
        
#         # Extract data
#         result = vision_client.extract(img, form_type, model)
        
#         return {
#             "success": True,
#             "filename": file.filename,
#             "form_type": form_type,
#             "model_used": model,
#             "data": result
#         }
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/supported-forms")
# def get_supported_forms():
#     """Get list of supported form types."""
#     return {
#         "forms": [
#             {"code": "W-2", "name": "Wage and Tax Statement"},
#             {"code": "1099-INT", "name": "Interest Income"},
#             {"code": "1099-NEC", "name": "Nonemployee Compensation"},
#             {"code": "1099-MISC", "name": "Miscellaneous Income"},
#             {"code": "1099-R", "name": "Distributions From Pensions"},
#             {"code": "1099-K", "name": "Payment Card Transactions"},
#             {"code": "1098", "name": "Mortgage Interest Statement"}
#         ]
#     }


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
import io
import os
import uuid
import fitz  # PyMuPDF
import json
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Any
from dotenv import load_dotenv

# Import history manager
from services.history_manager import history_manager

# Load Environment Variables
load_dotenv()

# --- CONFIGURATION ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini-2.5-pro")  # Model from .env

print(f"[Config] Using model: {DEFAULT_MODEL}")

# Supabase Buckets
UPLOADS_BUCKET = "uploads"
PAGES_BUCKET = "page-images"

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="US Tax Form Extractor - API 1")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILITY: RECURSIVE CAMELCASE CONVERTER ---
def to_camel(snake_str: str) -> str:
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def camelize_dict(data: Any) -> Any:
    if isinstance(data, dict):
        return {to_camel(k): camelize_dict(v) for k, v in data.items()}
    if isinstance(data, list):
        return [camelize_dict(i) for i in data]
    return data


# --- DIGITAL VS SCANNED DETECTION ---
def is_digital_pdf(pdf_bytes: bytes) -> bool:
    """
    Check if PDF has extractable text layer (digital) or is image-only (scanned).
    Uses existing text extraction - no extra AI call.
    
    Returns:
        True if digital (has text layer), False if scanned (image-only)
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_text_chars = 0
        for page in doc:
            text = page.get_text().strip()
            total_text_chars += len(text)
            if total_text_chars > 100:  # Has substantial text
                doc.close()
                return True
        doc.close()
        return False
    except Exception:
        return False  # Default to scanned if error

# --- THE UNIVERSAL SYSTEM PROMPT ---
SYSTEM_PROMPT = """
ROLE: Professional Tax Document Classifier.
TASK: Analyze the document and identify EVERY page that contains a tax form.
DETECTION: Identify the specific type of form found (e.g., "W-2", "1099-INT", "1098").
CAPABILITY: You must process digital text, scans, photos, and images.
RULES: 
- Identify the page number (starting from 1).
- Count the total number of distinct form copies visible on that page.
- List the specific form types found on that page in detected_types.
- Ignore pages that are only instructions, generic letters, or blank.
OUTPUT: You must return a valid JSON object matching the requested schema.
"""

import time  # For retry logic


# --- Form Region Model for Border Coordinates (API Output Only - NOT for Gemini) ---
# Note: These are NOT used in Gemini's response_schema because dict types cause errors
class FormRegion(BaseModel):
    """Bounding box for a detected form on a page (API output only)."""
    form_type: str
    form_index: int
    bbox: dict  # {"x": 0, "y": 0, "width": 612, "height": 396}


# --- Gemini Response Schema (Simple - No dict types) ---
# This is what Gemini uses for structured output
class GeminiPageResult(BaseModel):
    """Page result schema for Gemini response parsing."""
    page_number: int
    number_of_forms: int
    detected_types: List[str]

class DetectionResponse(BaseModel):
    """Schema for Gemini's response - uses simple types only."""
    relevant_pages: List[GeminiPageResult]

@app.post("/get-pages")
async def get_pages(file: UploadFile = File(...)):
    print(f"\n{'='*60}")
    print(f"[/get-pages] 🚀 Request received: {file.filename}")
    print(f"{'='*60}")
    start_time = datetime.now(timezone.utc)
    try:
        # Step 1: Read file
        print(f"[Step 1/5] 📖 Reading file...")
        content = await file.read()
        print(f"[Step 1/5] ✅ File read successfully - Size: {len(content):,} bytes")
        
        unique_id = str(uuid.uuid4())
        model_used = DEFAULT_MODEL  # From .env
        file_ext = file.filename.split('.')[-1].lower()
        
        # Detect if PDF is digital or scanned (no extra AI call)
        is_digital = False
        if file_ext == "pdf":
            is_digital = is_digital_pdf(content)
            print(f"[Step 1/5] 📑 Document type: {'📄 DIGITAL (text-based)' if is_digital else '🖼️ SCANNED (image-based)'}")
        else:
            # Images are always treated as scanned
            is_digital = False
            print(f"[Step 1/5] 🖼️ Image file detected - treating as scanned")
        
        # Step 2: Upload to Supabase
        print(f"[Step 2/5] ☁️  Uploading to Supabase storage...")
        supabase.storage.from_(UPLOADS_BUCKET).upload(f"{unique_id}.{file_ext}", content)
        print(f"[Step 2/5] ✅ File uploaded to Supabase: {unique_id}.{file_ext}")

        # Step 3: AI Detection
        print(f"[Step 3/5] 🤖 Running AI form detection with {model_used}...")
        mime_type = "application/pdf" if file_ext == "pdf" else f"image/{file_ext}"
        
        max_retries = 3
        retry_delay = 2
        response = None

        for attempt in range(max_retries):
            try:
                print(f"[Step 3/5] 🔄 API call attempt {attempt + 1}/{max_retries}...")
                response = client.models.generate_content(
                    model=model_used,
                    contents=[types.Part.from_bytes(data=content, mime_type=mime_type)],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        response_schema=DetectionResponse
                    )
                )
                print(f"[Step 3/5] ✅ AI detection successful!")
                break 
            except Exception as e:
                error_msg = str(e)
                print(f"[Step 3/5] ⚠️  Attempt {attempt + 1} failed: {error_msg[:80]}...")
                if ("503" in error_msg or "429" in error_msg) and attempt < max_retries - 1:
                    print(f"[Step 3/5] ⏳ Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                print(f"[Step 3/5] ❌ All retries failed!")
                raise e

        # Step 4: Process results
        print(f"[Step 4/5] 📊 Processing detection results...")
        usage_data = {
            "input_tokens": response.usage_metadata.prompt_token_count,
            "output_tokens": response.usage_metadata.candidates_token_count,
            "total_tokens": response.usage_metadata.total_token_count
        }
        
        print(f"[Step 4/5] 📈 Token Usage - Input: {usage_data['input_tokens']:,} | Output: {usage_data['output_tokens']:,} | Total: {usage_data['total_tokens']:,}")

        pages_to_process = response.parsed.relevant_pages if response.parsed else []
        print(f"[Step 4/5] ✅ Found {len(pages_to_process)} page(s) with tax forms")
        
        final_pages_list = []

        # Step 5: Upload page images
        print(f"[Step 5/5] 🖼️  Processing page images...")
        if file_ext == "pdf":
            doc = fitz.open(stream=content, filetype="pdf")
            for item in pages_to_process:
                p_num = item.page_number
                if p_num < 1 or p_num > len(doc): 
                    print(f"[Step 5/5] ⚠️  Skipping invalid page number: {p_num}")
                    continue
                
                print(f"[Step 5/5] 📄 Processing page {p_num}...")
                page = doc[p_num - 1]
                pix = page.get_pixmap(dpi=300) 
                img_bytes = pix.tobytes("png")
                
                img_path = f"{unique_id}_p{p_num}.png"
                supabase.storage.from_(PAGES_BUCKET).upload(img_path, img_bytes, {"content-type": "image/png"})
                print(f"[Step 5/5] ✅ Page {p_num} uploaded - Forms: {item.number_of_forms}, Types: {item.detected_types}")
                
                # Calculate form regions (bounding boxes for real-time border rendering)
                # Using page dimensions from the rendered image
                page_width = pix.width
                page_height = pix.height
                form_regions = []
                
                num_forms = item.number_of_forms
                if num_forms > 0:
                    # Calculate approximate regions for each form
                    # Assuming forms are stacked vertically on the page
                    form_height = page_height // num_forms
                    for i in range(num_forms):
                        form_type = item.detected_types[i] if i < len(item.detected_types) else item.detected_types[0] if item.detected_types else "Unknown"
                        form_regions.append({
                            "form_type": form_type,
                            "form_index": i,
                            "bbox": {
                                "x": 0,
                                "y": i * form_height,
                                "width": page_width,
                                "height": form_height
                            }
                        })
                
                final_pages_list.append({
                    "page_url": supabase.storage.from_(PAGES_BUCKET).get_public_url(img_path),
                    "page_number": p_num,
                    "number_of_forms": item.number_of_forms,
                    "detected_types": item.detected_types,
                    "is_digital": is_digital,
                    "form_regions": form_regions
                })
        else:
            img_path = f"{unique_id}_p1.png"
            supabase.storage.from_(PAGES_BUCKET).upload(img_path, content, {"content-type": f"image/{file_ext}"})
            detected_types = pages_to_process[0].detected_types if pages_to_process else ["Unknown"]
            num_forms = pages_to_process[0].number_of_forms if pages_to_process else 1
            print(f"[Step 5/5] ✅ Image uploaded - Types: {detected_types}")
            
            # For images, create simple form regions
            form_regions = []
            for i in range(num_forms):
                form_type = detected_types[i] if i < len(detected_types) else detected_types[0] if detected_types else "Unknown"
                form_regions.append({
                    "form_type": form_type,
                    "form_index": i,
                    "bbox": {
                        "x": 0,
                        "y": 0,
                        "width": 0,  # Will be determined by frontend based on image dimensions
                        "height": 0
                    }
                })
            
            final_pages_list.append({
                "page_url": supabase.storage.from_(PAGES_BUCKET).get_public_url(img_path),
                "page_number": 1,
                "number_of_forms": num_forms,
                "detected_types": detected_types,
                "is_digital": is_digital,
                "form_regions": form_regions
            })

        # Final summary
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()
        
        print(f"\n{'='*60}")
        print(f"[/get-pages] ✅ COMPLETED in {processing_time:.2f}s")
        print(f"[/get-pages] 📄 Pages detected: {len(final_pages_list)}")
        print(f"{'='*60}\n")
        
        raw_response = {
            "status": 200,
            "success": True,
            "message": "Detection complete and pages stored.",
            "data": { "pages": final_pages_list },
            "usage": {
                "model": model_used,
                "input_tokens": usage_data["input_tokens"],
                "output_tokens": usage_data["output_tokens"],
                "total_tokens": usage_data["total_tokens"],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "processing_time_seconds": round(processing_time, 3)
            }
        }
        
        return camelize_dict(raw_response)

    except Exception as e:
        import traceback
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()
        print(f"\n{'='*60}")
        print(f"[/get-pages] ❌ ERROR after {processing_time:.2f}s")
        print(f"[/get-pages] Error: {str(e)}")
        print(f"{'='*60}")
        traceback.print_exc()
        return camelize_dict({"status": 500, "success": False, "message": str(e), "data": None})



# =============================================================================
# API 2: THE DEEP EXTRACTOR (Multi-Form Support)
# =============================================================================
# Registry-driven structured data extraction from tax forms using Gemini 2.5 Flash
# Supports extracting multiple forms from a single page image

# --- Load Form Registry (Source of Truth) ---
REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "registry.json")

def load_registry() -> dict:
    """Load form registry from JSON file."""
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

def load_prompt_for_form(form_type: str, version: str = None) -> dict:
    """Load the prompt configuration for a specific form type and version."""
    registry = load_registry()

    # Get form configuration from registry
    form_config = registry.get(form_type)
    if not form_config:
        return None

    # Determine which version to use
    if version is None:
        version = form_config.get("current_version", "v1.0.0")

    # Ensure version has 'v' prefix if not present
    if not version.startswith('v'):
        version = f"v{version}"

    # Get the path to the prompt file for this version
    version_paths = form_config.get("versions", {})
    prompt_path = version_paths.get(version)

    if not prompt_path:
        return None

    # Load the prompt from the file
    try:
        # Resolve the path relative to the current file
        full_path = os.path.join(os.path.dirname(__file__), prompt_path)
        with open(full_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None

FORM_REGISTRY = load_registry()


# --- Pydantic Models for Multi-Form Structured Output ---
class BoxDetail(BaseModel):
    """Individual box/field extracted from the form."""
    label: str
    code: str
    value: Any


class FormInstance(BaseModel):
    """A single form instance extracted from the page."""
    form_name: str
    form_year: str
    copy_type: str  # Renamed from 'copy' to avoid shadowing BaseModel attribute
    box_details: List[BoxDetail]


class TaxFormData(BaseModel):
    """Container for multiple extracted forms from a single page."""
    extracted_forms: List[FormInstance]


class PageInput(BaseModel):
    """Input for a single page to extract."""
    page_url: str
    page_number: int
    detected_type: str


class BatchExtractRequest(BaseModel):
    """Request body for batch extraction - accepts multiple pages."""
    pages: List[PageInput]


class ExtractResponse(BaseModel):
    """Response model for extraction endpoint."""
    status: int
    success: bool
    message: str
    data: dict


# --- Deep Extractor Endpoint (Batch Support) ---
@app.post("/extract-form")
async def extract_form(request: BatchExtractRequest):
    """
    API 2: Deep Extractor with Batch Support
    
    Performs structured data extraction from tax form images using Gemini.
    Supports extracting from MULTIPLE pages in a single request (batch mode).
    Pages are automatically chunked into groups of 10 (HTTP URL limit).
    
    - **pages**: Array of page objects with page_url, page_number, detected_type
    
    Returns extracted data grouped by page in the 'pageResults' field.
    """
    print(f"\n{'='*60}")
    print(f"[/extract-form] 🚀 Batch extraction request received")
    print(f"[/extract-form] � Total pages: {len(request.pages)}")
    print(f"{'='*60}")
    start_time = datetime.now(timezone.utc)
    
    try:
        # Configuration
        MAX_PAGES_PER_BATCH = 10  # HTTP URL limit for Gemini
        model_used = DEFAULT_MODEL
        
        all_page_results = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_forms_extracted = 0
        
        # Group pages by detected_type for better prompting
        pages_by_type = {}
        for page in request.pages:
            form_type = page.detected_type
            if form_type not in pages_by_type:
                pages_by_type[form_type] = []
            pages_by_type[form_type].append(page)
        
        print(f"[Batch] 📊 Grouped into {len(pages_by_type)} form type(s): {list(pages_by_type.keys())}")
        
        # Process each form type separately (for optimal prompting)
        for form_type, pages in pages_by_type.items():
            print(f"\n[Batch] 🔄 Processing {len(pages)} page(s) of type: {form_type}")
            
            # Load prompt configuration for this form type
            form_config = load_prompt_for_form(form_type)
            if not form_config:
                print(f"[Batch] ⚠️ Unsupported form type: {form_type}, skipping...")
                for page in pages:
                    all_page_results.append({
                        "page_number": page.page_number,
                        "detected_type": form_type,
                        "extracted_forms": [],
                        "error": f"Unsupported form type: {form_type}"
                    })
                continue
            
            form_name = form_config["formName"]
            system_prompt = form_config["systemPrompt"]
            fields = form_config["fields"]
            field_list = "\n".join([f"- Code: {f['code']}, Label: {f['label']}" for f in fields])
            
            # Chunk pages into batches of MAX_PAGES_PER_BATCH
            for chunk_idx in range(0, len(pages), MAX_PAGES_PER_BATCH):
                chunk = pages[chunk_idx:chunk_idx + MAX_PAGES_PER_BATCH]
                chunk_page_numbers = [p.page_number for p in chunk]
                print(f"[Batch] 📦 Processing chunk: pages {chunk_page_numbers}")
                
                # Build multi-page extraction prompt
                page_list_str = ", ".join([f"Page {p.page_number}" for p in chunk])
                extraction_prompt = f"""
ROLE: Expert Tax Document Data Extractor.
TASK: Extract ALL data from EVERY {form_type} form ({form_name}) visible on the provided pages.

YOU ARE VIEWING {len(chunk)} PAGE(S): {page_list_str}
For EACH page, identify all forms and extract their data.

CRITICAL - PAGE TRACKING:
- The images are provided in order: first image = Page {chunk[0].page_number}, second image = Page {chunk[1].page_number if len(chunk) > 1 else chunk[0].page_number}, etc.
- You MUST include the correct page_number for each extracted form.

CRITICAL - MULTI-FORM DETECTION:
Each page may contain MULTIPLE copies of the same form (e.g., Copy A, Copy B, Copy C, Copy D).
Identify EVERY individual form on EACH page. Create a SEPARATE entry for each form found.

SPECIFIC INSTRUCTIONS:
{system_prompt}

MANDATORY FIELDS TO EXTRACT (EVERY field must be present in output):
{field_list}

EXTRACTION RULES:
1. Process each page and identify all forms on it.
2. For EACH form found, create a FormInstance with the correct page_number.
3. Extract the exact value shown for each field.
4. **CRITICAL - ALL FIELDS REQUIRED**: Include EVERY field in output.
   - If a field has a value, extract it.
   - If a field is empty/blank, return null.
   - If a numeric field is empty, return 0.0 or null.
   - If a checkbox is unchecked, return false.
5. For monetary values, extract as numbers (e.g., 50000.00 not "$50,000").
6. For checkboxes, use true/false.
7. Identify the tax year and copy type for each form.
8. Be precise - do not guess values that are not clearly visible.

OUTPUT: Return a valid JSON object with 'extracted_forms' array. Each form MUST include page_number field.
"""
                
                # Build contents array with multiple images
                contents = []
                for page in chunk:
                    contents.append(types.Part.from_uri(file_uri=page.page_url, mime_type="image/png"))
                contents.append(extraction_prompt)
                
                # Call Gemini API with retry logic
                max_retries = 3
                retry_delay = 2
                response = None
                last_error = None
                
                for attempt in range(max_retries):
                    try:
                        print(f"[Batch] 🤖 API call attempt {attempt + 1}/{max_retries}...")
                        response = client.models.generate_content(
                            model=model_used,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                system_instruction="You are an expert tax document data extractor. Extract forms from ALL provided pages. For each form, include the page_number it was found on. Return valid JSON.",
                                response_mime_type="application/json",
                                response_schema=TaxFormData,
                                temperature=0.1
                            )
                        )
                        print(f"[Batch] ✅ API call successful!")
                        break
                    except Exception as e:
                        last_error = e
                        error_str = str(e)
                        print(f"[Batch] ⚠️ Attempt {attempt + 1} failed: {error_str[:80]}...")
                        if ("503" in error_str or "429" in error_str or "overloaded" in error_str.lower()) and attempt < max_retries - 1:
                            print(f"[Batch] ⏳ Retrying in {retry_delay}s...")
                            time.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                        raise e
                
                if response is None:
                    raise last_error or Exception("Failed to get response from Gemini API")
                
                # Track token usage
                total_input_tokens += response.usage_metadata.prompt_token_count
                total_output_tokens += response.usage_metadata.candidates_token_count
                
                # Parse response
                chunk_forms = []
                if response.parsed:
                    for form_instance in response.parsed.extracted_forms:
                        chunk_forms.append({
                            "form_name": form_instance.form_name,
                            "form_year": form_instance.form_year,
                            "copy": form_instance.copy_type,
                            "box_details": [
                                {"label": box.label, "code": box.code, "value": box.value}
                                for box in form_instance.box_details
                            ]
                        })
                else:
                    # Fallback: try raw JSON parsing
                    try:
                        raw_text = response.text.strip()
                        if raw_text.startswith("```json"):
                            raw_text = raw_text[7:]
                        if raw_text.startswith("```"):
                            raw_text = raw_text[3:]
                        if raw_text.endswith("```"):
                            raw_text = raw_text[:-3]
                        parsed_json = json.loads(raw_text.strip())
                        if "extracted_forms" in parsed_json:
                            chunk_forms = parsed_json["extracted_forms"]
                    except json.JSONDecodeError:
                        print(f"[Batch] ❌ JSON parse error for chunk")
                
                print(f"[Batch] 📄 Extracted {len(chunk_forms)} form(s) from chunk")
                total_forms_extracted += len(chunk_forms)
                
                # Group forms by page number for response
                forms_by_page = {}
                for page in chunk:
                    forms_by_page[page.page_number] = {
                        "page_number": page.page_number,
                        "detected_type": form_type,
                        "extracted_forms": []
                    }
                
                # Distribute forms to pages (AI should include page_number, but fallback to first page)
                for form in chunk_forms:
                    # Try to get page_number from form, default to first page in chunk
                    page_num = form.get("page_number", chunk[0].page_number)
                    if page_num in forms_by_page:
                        forms_by_page[page_num]["extracted_forms"].append(form)
                    else:
                        # Fallback: add to first page
                        first_page = chunk[0].page_number
                        forms_by_page[first_page]["extracted_forms"].append(form)
                
                all_page_results.extend(forms_by_page.values())
        
        # Final summary
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()
        
        print(f"\n{'='*60}")
        print(f"[/extract-form] ✅ BATCH COMPLETED in {processing_time:.2f}s")
        print(f"[/extract-form] 📄 Total forms extracted: {total_forms_extracted}")
        print(f"[/extract-form] 📊 Total tokens: {total_input_tokens + total_output_tokens:,}")
        print(f"{'='*60}\n")
        
        extracted_forms_list = [
            form for page_result in all_page_results
            for form in page_result.get("extracted_forms", [])
        ]
        
        raw_response = {
            "status": 200,
            "success": True,
            "message": f"Successfully extracted {total_forms_extracted} form(s) from {len(request.pages)} page(s).",
            "data": {
                "page_results": all_page_results
            },
            "usage": {
                "model": model_used,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "processing_time_seconds": round(processing_time, 3),
                "pages_processed": len(request.pages),
                "api_calls_made": sum(1 for _ in range(0, len(request.pages), MAX_PAGES_PER_BATCH))
            }
        }
        
        # Save to history
        if extracted_forms_list:
            try:
                # Get unique form types from the request
                form_types = list(set(p.detected_type for p in request.pages))
                # Use first page URL to derive filename (or use a generic name)
                filename = f"extraction_{start_time.strftime('%Y%m%d_%H%M%S')}"
                history_manager.save_entry(
                    filename=filename,
                    form_types=form_types,
                    extracted_forms=extracted_forms_list,
                    usage=raw_response["usage"]
                )
                print(f"[/extract-form] 💾 Saved to history: {len(extracted_forms_list)} form(s)")
            except Exception as hist_err:
                print(f"[/extract-form] ⚠️ Failed to save history: {hist_err}")
        
        return camelize_dict(raw_response)
    
    except Exception as e:
        import traceback
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()
        print(f"\n{'='*60}")
        print(f"[/extract-form] ❌ ERROR after {processing_time:.2f}s")
        print(f"[/extract-form] Error: {str(e)}")
        print(f"{'='*60}")
        traceback.print_exc()
        return camelize_dict({
            "status": 500,
            "success": False,
            "message": str(e),
            "data": None
        })



# --- Health Check & Info Endpoints ---
@app.get("/")
def root():
    """Root endpoint with API info."""
    return camelize_dict({
        "service": "US Tax Form Extractor API",
        "version": "2.1.0",
        "endpoints": {
            "detection": "POST /get-pages - Upload PDF/image for form detection",
            "extraction": "POST /extract-form - Extract structured data (supports multi-form pages)"
        },
        "features": [
            "Multi-form extraction from single page",
            "Registry-driven field configuration",
            "Exponential backoff retry logic",
            "Token usage tracking"
        ],
        "status": "running"
    })


@app.get("/health")
def health_check():
    """Health check endpoint."""
    registry = load_registry()
    return camelize_dict({
        "status": "healthy",
        "gemini_configured": bool(GEMINI_API_KEY),
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
        "registry_loaded": len(registry) > 0,
        "supported_forms": list(registry.keys())
    })


# --- History Endpoint ---
@app.get("/get-files")
def get_files(limit: int = 50):
    """
    Get extraction history (recent forms first).
    
    - **limit**: Maximum number of entries to return (default 50)
    
    Returns list of previously extracted files with their form data.
    """
    print(f"\n{'='*60}")
    print(f"[/get-files] 📂 Fetching history (limit: {limit})")
    print(f"{'='*60}")
    
    try:
        files = history_manager.get_history(limit=limit)
        
        print(f"[/get-files] ✅ Retrieved {len(files)} file(s)")
        
        return camelize_dict({
            "status": 200,
            "success": True,
            "message": f"Retrieved {len(files)} file(s) from history.",
            "data": {
                "files": files
            }
        })
    except Exception as e:
        print(f"[/get-files] ❌ Error: {str(e)}")
        return camelize_dict({
            "status": 500,
            "success": False,
            "message": str(e),
            "data": None
        })





# @app.get("/supported-forms")
# def get_supported_forms():
#     """Get list of supported form types from registry."""
#     registry = load_registry()
#     forms = []
#     for code, config in registry.items():
#         # Load the current version of the form to get its details
#         form_details = load_prompt_for_form(code)
#         forms.append({
#             "code": code,
#             "name": form_details.get("formName", "") if form_details else "",
#             "fields_count": len(form_details.get("fields", [])) if form_details else 0,
#             "current_version": config.get("current_version", "")
#         })
#     return camelize_dict({
#         "status": 200,
#         "success": True,
#         "data": {"forms": forms}
#     })


# @app.get("/prompt-versions")
# def get_prompt_versions():
#     """Get list of available prompt versions for each form type."""
#     registry = load_registry()
#     versions_info = {}

#     for form_type, config in registry.items():
#         versions_info[form_type] = {
#             "current_version": config.get("current_version", ""),
#             "available_versions": list(config.get("versions", {}).keys())
#         }

#     return camelize_dict({
#         "status": 200,
#         "success": True,
#         "data": {"versions": versions_info}
#     })