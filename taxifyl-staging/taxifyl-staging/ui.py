"""
US Tax Form Extractor - Simple UI
==================================
Streamlit frontend that connects to the FastAPI backend for form detection and extraction.
"""

import streamlit as st
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# =============================================================================
# Page Configuration
# =============================================================================
st.set_page_config(
    page_title="Tax Form Extractor",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =============================================================================
# Custom CSS - Dark Theme
# =============================================================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { font-family: 'Inter', sans-serif; }
    
    .stApp { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); }
    
    .main-header {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        text-align: center;
    }
    .main-header h1 {
        background: linear-gradient(135deg, #818cf8, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0;
    }
    .main-header p { color: #94a3b8; font-size: 0.95rem; margin: 0.3rem 0 0 0; }
    
    .status-connected {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 8px;
        padding: 0.5rem 1rem;
        color: #4ade80;
        font-size: 0.85rem;
    }
    .status-disconnected {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        padding: 0.5rem 1rem;
        color: #fca5a5;
        font-size: 0.85rem;
    }
    
    .page-card {
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
    }
    
    .form-badge {
        display: inline-block;
        background: rgba(99, 102, 241, 0.2);
        border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        margin: 0.2rem;
        font-size: 0.8rem;
        color: #a5b4fc;
    }
    
    .file-badge {
        display: inline-block;
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        margin: 0.2rem;
        font-size: 0.75rem;
        color: #4ade80;
    }
    
    .result-card {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 0.75rem;
    }
    
    .box-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .box-label { color: #94a3b8; font-size: 0.85rem; }
    .box-code { color: #818cf8; font-weight: 600; font-size: 0.8rem; }
    .box-value { color: #e2e8f0; font-weight: 500; }
    
    .token-stat {
        background: rgba(30, 41, 59, 0.5);
        border-radius: 8px;
        padding: 0.5rem;
        text-align: center;
        margin: 0.25rem 0;
    }
    .token-value { color: #818cf8; font-size: 1.1rem; font-weight: 600; }
    .token-label { color: #64748b; font-size: 0.7rem; text-transform: uppercase; }
    
    .section-title {
        color: #e2e8f0;
        font-size: 1.1rem;
        font-weight: 600;
        margin: 1rem 0 0.75rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .doc-type-digital {
        display: inline-block;
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        font-size: 0.75rem;
        color: #4ade80;
        margin-bottom: 0.5rem;
    }
    .doc-type-scanned {
        display: inline-block;
        background: rgba(251, 191, 36, 0.2);
        border: 1px solid rgba(251, 191, 36, 0.4);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        font-size: 0.75rem;
        color: #fbbf24;
        margin-bottom: 0.5rem;
    }
    
    .progress-info {
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin: 0.5rem 0;
        color: #a5b4fc;
    }
</style>
""", unsafe_allow_html=True)


# =============================================================================
# Session State Initialization
# =============================================================================
if "detection_results" not in st.session_state:
    st.session_state.detection_results = {}  # {filename: result}
if "extraction_results" not in st.session_state:
    st.session_state.extraction_results = {}
if "processed_files" not in st.session_state:
    st.session_state.processed_files = set()  # Track which files have been processed


# =============================================================================
# Sidebar - Configuration
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Configuration")
    
    api_base_url = os.getenv("BACKEND_URL")
    
    st.markdown("---")
    st.markdown("### 📡 API Status")
    
    try:
        health_response = requests.get(f"{api_base_url}/health", timeout=5)
        if health_response.status_code == 200:
            health_data = health_response.json()
            st.markdown('<div class="status-connected">✅ Connected</div>', unsafe_allow_html=True)
            
            if health_data.get("supportedForms"):
                st.markdown("**Supported Forms:**")
                for form in health_data["supportedForms"]:
                    st.markdown(f"<span class='form-badge'>{form}</span>", unsafe_allow_html=True)
        else:
            st.markdown('<div class="status-disconnected">❌ API Error</div>', unsafe_allow_html=True)
    except requests.exceptions.ConnectionError:
        st.markdown('<div class="status-disconnected">❌ Not Connected</div>', unsafe_allow_html=True)
        st.caption("Start the API server with: `uvicorn api:app --port 8000`")
    except Exception as e:
        st.markdown(f'<div class="status-disconnected">❌ {str(e)[:30]}</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    if st.button("🔄 Reset Session", use_container_width=True):
        st.session_state.detection_results = {}
        st.session_state.extraction_results = {}
        st.session_state.processed_files = set()
        st.rerun()


# Main Header
# =============================================================================
st.markdown("""
<div class="main-header">
    <h1>📄 Tax Form Extractor</h1>
    <p>Upload PDFs or images - forms are detected automatically</p>
</div>
""", unsafe_allow_html=True)


# =============================================================================
# Main Tabs - Upload & History
# =============================================================================
tab_upload, tab_history = st.tabs(["📤 Upload & Extract", "📂 History"])


# =============================================================================
# Tab 1: Upload & Extract (existing functionality)
# =============================================================================
with tab_upload:
    col_upload, col_results = st.columns([1, 1])



# =============================================================================
# Left Column - Upload & Auto-Detection
# =============================================================================
with col_upload:
    st.markdown('<div class="section-title">📤 Upload Documents</div>', unsafe_allow_html=True)
    
    # MULTIPLE FILE UPLOAD
    uploaded_files = st.file_uploader(
        "Choose PDF or image files",
        type=["pdf", "png", "jpg", "jpeg"],
        accept_multiple_files=True,
        help="Upload tax form documents - detection starts automatically"
    )
    
    if uploaded_files:
        total_size = sum(f.size for f in uploaded_files)
        st.info(f"📎 **{len(uploaded_files)} file(s)** selected ({total_size / 1024:.1f} KB total)")
        
        # Check for new files that need detection
        current_file_names = {f.name for f in uploaded_files}
        new_files = [f for f in uploaded_files if f.name not in st.session_state.processed_files]
        
        # AUTO-DETECT: Run detection automatically for new files
        if new_files:
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            total_new = len(new_files)
            
            for file_idx, uploaded_file in enumerate(new_files):
                status_text.markdown(f'<div class="progress-info">🔍 Auto-detecting forms in: {uploaded_file.name} ({file_idx + 1}/{total_new})</div>', unsafe_allow_html=True)
                
                try:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    response = requests.post(f"{api_base_url}/get-pages", files=files, timeout=120)
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result.get("success"):
                            st.session_state.detection_results[uploaded_file.name] = result
                            st.session_state.processed_files.add(uploaded_file.name)
                        else:
                            st.warning(f"⚠️ {uploaded_file.name}: {result.get('message', 'Detection failed')}")
                    else:
                        st.error(f"❌ API Error for {uploaded_file.name}: {response.status_code}")
                        
                except requests.exceptions.ConnectionError:
                    st.error("❌ Cannot connect to API. Is the server running?")
                    break
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
                
                progress_bar.progress((file_idx + 1) / total_new)
            
            status_text.empty()
            progress_bar.empty()
            st.success(f"✅ Auto-detection complete for {len(new_files)} file(s)!")
            st.rerun()
    
    # Show Detection Results with Single Extract Button
    if st.session_state.detection_results:
        st.markdown('<div class="section-title">📋 Detected Forms</div>', unsafe_allow_html=True)
        
        # Collect all pages for batch extraction
        all_pages_to_extract = []
        total_forms = 0
        
        for filename, result in st.session_state.detection_results.items():
            pages = result.get("data", {}).get("pages", [])
            
            for page in pages:
                page_num = page.get("pageNumber", 1)
                detected_types = page.get("detectedTypes", [])
                page_url = page.get("pageUrl", "")
                is_digital = page.get("isDigital", True)
                
                total_forms += len(detected_types)
                
                # Add to batch extraction list
                if page_url and detected_types:
                    all_pages_to_extract.append({
                        "page_url": page_url,
                        "page_number": page_num,
                        "detected_type": detected_types[0]  # Primary form type
                    })
                
                # Display page info (without individual extract button)
                with st.expander(f"📄 {filename} - Page {page_num} ({len(detected_types)} forms)", expanded=True):
                    # Document type badge
                    if is_digital:
                        st.markdown('<span class="doc-type-digital">📄 DIGITAL</span>', unsafe_allow_html=True)
                    else:
                        st.markdown('<span class="doc-type-scanned">🖼️ SCANNED</span>', unsafe_allow_html=True)
                    
                    # Page thumbnail
                    if page_url:
                        st.image(page_url, caption=f"Page {page_num}", use_container_width=True)
                    
                    # Detected form types
                    st.markdown("**Detected Forms:**")
                    types_html = " ".join([f"<span class='form-badge'>{t}</span>" for t in detected_types])
                    st.markdown(types_html, unsafe_allow_html=True)
        
        st.info(f"📊 Total: **{total_forms}** form(s) detected across **{len(all_pages_to_extract)}** page(s)")
        
        # SINGLE EXTRACT BUTTON (dynamic label)
        if all_pages_to_extract and not st.session_state.extraction_results:
            # Dynamic button label
            if len(all_pages_to_extract) == 1:
                button_label = "📥 Extract Form"
            else:
                button_label = f"📥 Extract All {total_forms} Forms"
            
            if st.button(button_label, key="extract_all_forms", use_container_width=True, type="primary"):
                with st.spinner(f"Extracting {total_forms} form(s) from {len(all_pages_to_extract)} page(s)..."):
                    try:
                        payload = {"pages": all_pages_to_extract}
                        extract_response = requests.post(
                            f"{api_base_url}/extract-form",
                            json=payload,
                            timeout=300  # Longer timeout for batch
                        )
                        
                        if extract_response.status_code == 200:
                            extract_result = extract_response.json()
                            
                            if extract_result.get("success"):
                                # Store batch result
                                st.session_state.extraction_results["batch_extraction"] = extract_result
                                
                                # Calculate count from pageResults
                                data = extract_result.get("data", {})
                                count = 0
                                if "extractedForms" in data:
                                    count = len(data["extractedForms"])
                                else:
                                    count = sum(len(p.get("extractedForms", [])) for p in data.get("pageResults", []))
                                    
                                st.success(f"✅ Extraction complete! Extracted {count} form(s)")
                                st.rerun()
                            else:
                                st.error(f"❌ {extract_result.get('message', 'Extraction failed')}")
                        else:
                            st.error(f"❌ API Error: {extract_response.status_code}")
                            
                    except Exception as e:
                        st.error(f"❌ Error: {str(e)}")
        
        elif st.session_state.extraction_results:
            st.success("✅ Forms already extracted! See results on the right.")


# =============================================================================
# Right Column - Extraction Results
# =============================================================================
with col_results:
    st.markdown('<div class="section-title">📊 Extraction Results</div>', unsafe_allow_html=True)
    
    if not st.session_state.extraction_results:
        st.info("👆 Upload documents and click Extract on each detected form to see results.")
    else:
        tab_cards, tab_json = st.tabs(["📋 Cards View", "📄 JSON View"])
        
        with tab_cards:
            for extract_key, extract_result in st.session_state.extraction_results.items():
                data = extract_result.get("data", {})
                
                # Handle new API structure (flatten pageResults if extractedForms missing)
                extracted_forms = data.get("extractedForms")
                if not extracted_forms:
                    page_results = data.get("pageResults", [])
                    extracted_forms = [
                        form for page in page_results 
                        for form in page.get("extractedForms", [])
                    ]
                
                if not extracted_forms:
                    st.warning(f"No forms extracted for {extract_key}")
                    continue
                
                for idx, form in enumerate(extracted_forms):
                    form_name = form.get("formName", "Unknown")
                    form_year = form.get("formYear", "N/A")
                    copy_type = form.get("copy", "")
                    box_details = form.get("boxDetails", [])
                    
                    file_info = extract_key.split("_page")[0] if "_page" in extract_key else extract_key
                    
                    with st.expander(f"📄 {form_name} ({form_year}) - {file_info}", expanded=True):
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Form", form_name)
                        with col2:
                            st.metric("Year", form_year)
                        with col3:
                            st.metric("Fields", len(box_details))
                        
                        if box_details:
                            st.markdown("**Extracted Fields:**")
                            
                            for box in box_details:
                                label = box.get("label", "")
                                code = box.get("code", "")
                                value = box.get("value")
                                
                                if value is None:
                                    display_value = "—"
                                elif isinstance(value, bool):
                                    display_value = "✅ Yes" if value else "❌ No"
                                elif isinstance(value, (int, float)):
                                    display_value = f"${value:,.2f}" if value > 0 else str(value)
                                else:
                                    display_value = str(value)
                                
                                st.markdown(f"""
                                <div class="box-row">
                                    <span><span class="box-code">[{code}]</span> <span class="box-label">{label}</span></span>
                                    <span class="box-value">{display_value}</span>
                                </div>
                                """, unsafe_allow_html=True)
        
        with tab_json:
            all_results = {
                "totalFormsExtracted": sum(
                    len(r.get("data", {}).get("extractedForms", []))
                    for r in st.session_state.extraction_results.values()
                ),
                "extractions": st.session_state.extraction_results
            }
            
            json_str = json.dumps(all_results, indent=2)
            st.code(json_str, language="json")
            
            st.download_button(
                label="📥 Download JSON",
                data=json_str,
                file_name="extracted_forms.json",
                mime="application/json",
                use_container_width=True
            )


# =============================================================================
# Tab 2: History
# =============================================================================
with tab_history:
    st.markdown('<div class="section-title">📂 Recent Extractions</div>', unsafe_allow_html=True)
    
    # Fetch history from API
    try:
        history_response = requests.get(f"{api_base_url}/get-files?limit=50", timeout=10)
        
        if history_response.status_code == 200:
            history_data = history_response.json()
            
            if history_data.get("success"):
                files = history_data.get("data", {}).get("files", [])
                
                if not files:
                    st.info("📭 No extraction history yet. Upload and extract some forms to see them here!")
                else:
                    st.success(f"📊 **{len(files)}** recent extraction(s)")
                    
                    for file_entry in files:
                        file_id = file_entry.get("id", "")[:8]
                        filename = file_entry.get("filename", "Unknown")
                        extracted_at = file_entry.get("extractedAt", "")
                        form_types = file_entry.get("formTypes", [])
                        total_forms = file_entry.get("totalFormsExtracted", 0)
                        extracted_forms = file_entry.get("extractedForms", [])
                        
                        # Format date (Convert UTC to IST)
                        try:
                            from datetime import datetime, timezone, timedelta
                            # Define IST: UTC + 5:30
                            ist_timezone = timezone(timedelta(hours=5, minutes=30))
                            
                            # Parse UTC time
                            dt_utc = datetime.fromisoformat(extracted_at.replace("Z", "+00:00"))
                            
                            # Convert to IST
                            dt_ist = dt_utc.astimezone(ist_timezone)
                            date_str = dt_ist.strftime("%b %d, %Y at %I:%M %p")
                        except Exception as e:
                            date_str = extracted_at
                        
                        # Card for each history entry
                        form_types_str = ", ".join(form_types) if form_types else "Unknown"
                        with st.expander(f"📄 {filename} [{form_types_str}] - {date_str}", expanded=False):
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Forms", total_forms)
                            with col2:
                                types_str = ", ".join(form_types) if form_types else "N/A"
                                st.metric("Types", types_str)
                            with col3:
                                st.metric("ID", file_id)
                            
                            # Show form types as badges
                            if form_types:
                                types_html = " ".join([f"<span class='form-badge'>{t}</span>" for t in form_types])
                                st.markdown(types_html, unsafe_allow_html=True)
                            
                            # Show extracted data
                            if extracted_forms:
                                st.markdown("**Extracted Data:**")
                                for form in extracted_forms:
                                    form_name = form.get("formName", form.get("form_name", "Unknown"))
                                    form_year = form.get("formYear", form.get("form_year", "N/A"))
                                    st.markdown(f"• **{form_name}** ({form_year})")
                            
                            # JSON download for this entry
                            entry_json = json.dumps(file_entry, indent=2)
                            st.download_button(
                                label="📥 Download JSON",
                                data=entry_json,
                                file_name=f"{filename.replace('.', '_')}_{file_id}.json",
                                mime="application/json",
                                key=f"download_{file_id}",
                                use_container_width=True
                            )
            else:
                st.warning(f"⚠️ {history_data.get('message', 'Failed to fetch history')}")
        else:
            st.error(f"❌ API Error: {history_response.status_code}")
            
    except requests.exceptions.ConnectionError:
        st.warning("⚠️ Cannot connect to API. History requires the backend to be running.")
    except Exception as e:
        st.error(f"❌ Error: {str(e)}")


# =============================================================================
# Footer
# =============================================================================
st.markdown("---")
st.markdown(
    "<p style='text-align: center; color: #64748b; font-size: 0.8rem;'>"
    "Tax Form Extractor v2.4 • Powered by Gemini 2.5 • Auto-Detection + History"
    "</p>",
    unsafe_allow_html=True
)

