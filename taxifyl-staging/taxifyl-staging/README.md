# US Tax Form Extractor

AI-powered tax form extraction tool that automatically detects and extracts structured data from US tax forms (W-2, 1099-INT, 1099-NEC, etc.).

## Features

- 🔍 **Auto-Detection** - Automatically identifies form types (W-2, 1099-INT, 1099-NEC, etc.)
- 🤖 **AI-Powered Extraction** - Uses Google Gemini or Groq LLaMA Vision for accurate data extraction
- 📊 **Structured Output** - Returns data in consistent, plane-based JSON structure
- 🎨 **Modern UI** - Beautiful Streamlit interface with dark theme and glassmorphism
- ✅ **Validation** - Built-in validation and JSON comparison tools

## Supported Forms

| Form | Description |
|------|-------------|
| W-2 | Wage and Tax Statement |
| 1099-INT | Interest Income |
| 1099-NEC | Nonemployee Compensation |
| 1099-MISC | Miscellaneous Income |
| 1099-R | Distributions From Pensions |
| 1099-K | Payment Card Transactions |
| 1098 | Mortgage Interest Statement |

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/us_tax_form_extractor.git
cd us_tax_form_extractor

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Create a `.env` file with your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

## Usage

```bash
# Run the Streamlit app
streamlit run app.py
```

Then open http://localhost:8502 in your browser.

## Project Structure

```
us_tax_form_extractor/
├── app.py              # Main Streamlit application
├── requirements.txt    # Python dependencies
├── .env               # API keys (not in repo)
├── .gitignore         # Git ignore rules
├── forms/             # Form-specific modules
│   ├── w2/           # W-2 form logic
│   └── form_1099int/ # 1099-INT form logic
├── services/          # Shared services
├── config/           # Configuration files
├── logs/             # Extraction logs
└── tests/            # Automated tests
```

## Running Tests

```bash
python tests/test_transformer.py
```

## Output Format

The extractor returns a standardized JSON structure:

```json
[
  {
    "forms": [
      {
        "form_header": {
          "form_number": "W-2",
          "year": "2024",
          "type": "Wage and Tax Statement"
        },
        "boxes": [
          {"identification_plane": [...]},
          {"federal_tax_plane": [...]},
          {"boxes": [{"supplemental_plane": [...]}]},
          {"state_local_plane": [...]}
        ]
      }
    ]
  }
]
```

## License

Private - All rights reserved.
