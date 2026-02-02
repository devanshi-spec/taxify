# US Tax Form Extractor - System & User Flow Documentation

## Overview

The US Tax Form Extractor is an AI-powered application that automatically detects and extracts structured data from US tax forms (W-2, 1099-INT, 1099-NEC, etc.). The system combines computer vision, AI models, and structured data transformation to convert tax form images into standardized JSON format.

## System Architecture

### Components

1. **Frontend UI** (`app.py` / `ui.py`)
   - Streamlit-based web interface
   - Handles file uploads and displays results
   - Provides form detection visualization

2. **Backend API** (`api.py`)
   - FastAPI-based REST service
   - Handles form detection and extraction
   - Interfaces with AI models

3. **AI Services**
   - Google Gemini integration
   - Groq LLaMA Vision integration
   - Form-specific extraction prompts

4. **Data Processing Layer**
   - Form detector with OCR fallback
   - Transformation engines for each form type
   - Registry-driven field mapping

5. **Storage Layer**
   - Supabase for file storage
   - Registry.json for form definitions

## System Flow

### 1. Form Detection Flow

```
User Uploads File → FormDetector.detect() → OCR Analysis → Filename Analysis → Form Type Identified
```

1. **File Input**: User uploads PDF or image file
2. **OCR Analysis**: Tesseract extracts text from image
3. **Pattern Matching**: System searches for form-specific keywords in extracted text
4. **Filename Fallback**: If OCR fails, system analyzes filename for form indicators
5. **Form Classification**: Returns detected form type or "UNKNOWN"

### 2. AI Extraction Flow

```
Image → VisionClient.extract() → AI Model (Gemini/Groq) → Raw JSON → Transformer → Structured JSON
```

1. **Image Preprocessing**: Convert to appropriate format for AI model
2. **AI Processing**: Send image and form-specific prompt to AI model
3. **Raw Response**: Receive unstructured JSON from AI
4. **Transformation**: Apply form-specific transformer to standardize structure
5. **Validation**: Ensure output matches expected schema

### 3. Form-Specific Processing

#### W-2 Processing
- Uses `W2_PROMPT` for extraction
- Applies `transform_to_w2_structure()` for standardization
- Maps to 3-plane structure: identification, federal, state/local

#### 1099-INT Processing  
- Uses `INT_1099_PROMPT` for extraction
- Applies `transform_to_1099int_structure()` for standardization
- Handles multi-account statements

#### K-1 Processing
- Uses `K1_PROMPT` for extraction
- Applies `transform_to_k1_structure()` for standardization
- Supports multi-partner documents

## User Flow

### 1. Upload Phase
```
User opens app → Sees welcome screen → Uploads PDF/image → Preview appears
```

1. User accesses the Streamlit application
2. Uploads a tax form (PDF, PNG, JPG, JPEG)
3. System displays preview of the document
4. For PDFs, user can select specific page to process

### 2. Detection Phase
```
System analyzes document → Identifies form type → Displays detection result
```

1. System automatically detects form type using OCR and pattern matching
2. Displays detected form type with confidence indicator
3. For multi-page PDFs, shows page selection controls
4. For K-1/K-3/8805/8804 forms, performs specialized page scanning

### 3. Extraction Phase
```
User clicks Extract → AI processes image → Results displayed → Validation performed
```

1. User selects AI model from dropdown (Gemini, Groq LLaMA)
2. User clicks "Extract" button
3. System sends image to AI model with form-specific prompt
4. AI returns raw extraction results
5. System applies form-specific transformer
6. Structured results are displayed in tabular format

### 4. Review Phase
```
Results displayed → User reviews → Validation performed → Export available
```

1. Results shown in organized sections matching form structure
2. Tabbed interface with "Review" and "Validation" views
3. Validation checks performed on extracted data
4. JSON export functionality available
5. Debug view shows raw AI output

## Data Flow

### Input Processing
```
File Upload → PDF/Image Conversion → Page Selection → Image Preprocessing → AI Input
```

### Output Processing
```
AI Response → Raw JSON → Form Transformer → Standardized JSON → UI Rendering
```

## Key Features

### Auto-Detection
- OCR-based form recognition
- Filename pattern matching
- Multi-form support in single document

### Multi-Model Support
- Google Gemini integration
- Groq LLaMA Vision integration
- Configurable model selection

### Structured Output
- Plane-based JSON structure
- Consistent field mapping
- Form-specific transformations

### Validation & Debugging
- Built-in validation tools
- Raw AI output visibility
- JSON comparison utilities

## Error Handling

### Common Issues
- Unsupported form types
- Poor image quality
- API connectivity problems
- Invalid JSON responses

### Recovery Mechanisms
- Fallback to filename-based detection
- Multiple AI model options
- Detailed error messages
- Debug information for troubleshooting

## Performance Considerations

### Processing Time
- OCR analysis: ~1-2 seconds
- AI processing: ~5-15 seconds depending on complexity
- Transformation: ~0.5-1 seconds

### Resource Usage
- Memory usage scales with image resolution
- AI model requests consume API quota
- PDF processing requires additional memory for multi-page docs

## Integration Points

### External APIs
- Google Gemini API
- Groq API
- Supabase storage

### File Formats
- PDF (multi-page support)
- PNG, JPG, JPEG images
- Various resolutions and orientations

This system provides a robust, scalable solution for automated tax form data extraction with high accuracy and user-friendly interface.