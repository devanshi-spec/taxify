"""
Visualize Bounding Boxes Script
===============================
Detects form borders using text blocks and line analysis.
Works with DIGITAL PDFs only.
"""

import os
import fitz  # PyMuPDF
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import filedialog

# Configuration
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "bounding_box")
DPI = 300

# Colors for forms
FORM_COLORS = ["#00FF00", "#FF6600", "#0066FF", "#FF00FF", "#FFFF00", "#00FFFF"]


def is_scanned_pdf(doc) -> bool:
    """Check if PDF is scanned (no text layer)."""
    total_text = 0
    for page in doc:
        total_text += len(page.get_text().strip())
        if total_text > 100:
            return False
    return True


def find_form_regions(page, scale_x, scale_y):
    """
    Find form regions by analyzing horizontal separator lines.
    W-2 forms typically have thick black borders that create distinct regions.
    """
    drawings = page.get_drawings()
    
    # Find all horizontal lines that span significant width
    horizontal_lines = []
    page_width = page.rect.width
    
    for d in drawings:
        rect = d["rect"]
        # Check if it's a horizontal line (very thin height, wide)
        if rect.height < 3 and rect.width > page_width * 0.3:
            horizontal_lines.append(rect.y0)
    
    # Find all vertical lines
    vertical_lines = []
    page_height = page.rect.height
    
    for d in drawings:
        rect = d["rect"]
        # Check if it's a vertical line
        if rect.width < 3 and rect.height > page_height * 0.2:
            vertical_lines.append(rect.x0)
    
    # Cluster horizontal lines to find form boundaries
    horizontal_lines = sorted(set([round(y, 0) for y in horizontal_lines]))
    vertical_lines = sorted(set([round(x, 0) for x in vertical_lines]))
    
    print(f"   📏 Found {len(horizontal_lines)} horizontal lines, {len(vertical_lines)} vertical lines")
    
    # If we have clear horizontal dividers, use them
    # For W-2 layout: typically top form ends around y=380-400, bottom forms below
    
    forms = []
    
    # Try to detect the W-2 specific layout
    # Look for the main dividing line around middle of page
    mid_y = page.rect.height / 2
    
    # Find lines near the middle that could be form separators
    separator_y = None
    for y in horizontal_lines:
        if mid_y - 100 < y < mid_y + 100:
            separator_y = y
            break
    
    if separator_y:
        # Two-row layout detected
        # Top section
        forms.append({
            "x": 0,
            "y": 0,
            "width": int(page.rect.width * scale_x),
            "height": int(separator_y * scale_y)
        })
        
        # Bottom section - might be split into columns
        bottom_y = int(separator_y * scale_y)
        bottom_height = int((page.rect.height - separator_y) * scale_y)
        
        # Check for vertical dividers in bottom section
        bottom_verticals = [x for x in vertical_lines if x > 50 and x < page.rect.width - 50]
        
        if len(bottom_verticals) >= 2:
            # Multiple columns in bottom
            cols = sorted(bottom_verticals)
            # Create forms for each column
            prev_x = 0
            for i, x in enumerate(cols[:3]):  # Max 3 columns
                col_width = int(x * scale_x) - prev_x
                if col_width > 100:
                    forms.append({
                        "x": prev_x,
                        "y": bottom_y,
                        "width": col_width,
                        "height": bottom_height
                    })
                prev_x = int(x * scale_x)
            # Last column
            if prev_x < int(page.rect.width * scale_x) - 100:
                forms.append({
                    "x": prev_x,
                    "y": bottom_y,
                    "width": int(page.rect.width * scale_x) - prev_x,
                    "height": bottom_height
                })
        else:
            # Single bottom form
            forms.append({
                "x": 0,
                "y": bottom_y,
                "width": int(page.rect.width * scale_x),
                "height": bottom_height
            })
    else:
        # No clear separator - try using text blocks
        print(f"   📝 Using text block analysis...")
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])
        
        # Find distinct form regions by clustering text blocks
        text_blocks = []
        for block in blocks:
            if block.get("type") == 0:  # Text block
                bbox = block.get("bbox", [0, 0, 0, 0])
                if bbox[2] - bbox[0] > 50:  # Minimum width
                    text_blocks.append(bbox)
        
        if text_blocks:
            # Find the extent of all text
            min_x = min(b[0] for b in text_blocks)
            min_y = min(b[1] for b in text_blocks)
            max_x = max(b[2] for b in text_blocks)
            max_y = max(b[3] for b in text_blocks)
            
            forms.append({
                "x": int(min_x * scale_x),
                "y": int(min_y * scale_y),
                "width": int((max_x - min_x) * scale_x),
                "height": int((max_y - min_y) * scale_y)
            })
    
    return forms


def pick_pdf_file() -> str:
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    file_path = filedialog.askopenfilename(
        title="Select a PDF file",
        filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
    )
    root.destroy()
    return file_path


def visualize_bounding_boxes(pdf_path: str):
    print(f"\n🚀 Starting Bounding Box Visualization")
    print(f"📄 File: {os.path.basename(pdf_path)}")
    
    doc = fitz.open(pdf_path)
    
    print(f"🔍 Checking PDF type...")
    if is_scanned_pdf(doc):
        print(f"\n❌ SCANNED PDF - Cannot detect form borders")
        doc.close()
        return
    
    print(f"✅ Digital PDF detected")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    
    for page_num, page in enumerate(doc):
        print(f"\n📄 Processing page {page_num + 1}...")
        
        # Render page
        pix = page.get_pixmap(dpi=DPI)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        scale_x = pix.width / page.rect.width
        scale_y = pix.height / page.rect.height
        
        print(f"   📐 Page: {pix.width}x{pix.height}px")
        
        # Find forms
        forms = find_form_regions(page, scale_x, scale_y)
        print(f"   🔍 Detected {len(forms)} form region(s)")
        
        # Draw boxes
        draw = ImageDraw.Draw(img)
        
        for i, form in enumerate(forms):
            color = FORM_COLORS[i % len(FORM_COLORS)]
            x, y, w, h = form["x"], form["y"], form["width"], form["height"]
            
            # Thick border
            for offset in range(4):
                draw.rectangle([x + offset, y + offset, x + w - offset, y + h - offset], outline=color)
            
            # Label
            label = f"Form {i + 1}"
            draw.rectangle([x + 5, y + 5, x + 80, y + 25], fill=color)
            draw.text((x + 10, y + 7), label, fill="black")
            
            print(f"   ✏️  Form {i + 1}: [x={x}, y={y}, w={w}, h={h}]")
        
        # Save
        output_path = os.path.join(OUTPUT_DIR, f"{pdf_name}_page_{page_num + 1}_annotated.png")
        img.save(output_path)
        print(f"   💾 Saved: {output_path}")
    
    doc.close()
    print(f"\n✅ Done!")


if __name__ == "__main__":
    print("📂 Opening file picker...")
    selected_file = pick_pdf_file()
    if selected_file:
        visualize_bounding_boxes(selected_file)
    else:
        print("❌ No file selected")
