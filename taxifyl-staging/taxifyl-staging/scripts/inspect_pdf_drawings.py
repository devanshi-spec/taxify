"""Debug script to analyze PDF drawings structure."""
import fitz
import sys
import os
import tkinter as tk
from tkinter import filedialog

def pick_pdf_file() -> str:
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    file_path = filedialog.askopenfilename(
        title="Select a PDF file",
        filetypes=[("PDF files", "*.pdf")]
    )
    root.destroy()
    return file_path

def analyze_pdf(pdf_path, page_num=0):
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    
    print(f"\n{'='*60}")
    print(f"Analyzing: {os.path.basename(pdf_path)} - Page {page_num + 1}")
    print(f"{'='*60}")
    print(f"Page Size: {page.rect} ({page.rect.width}x{page.rect.height} points)")
    
    drawings = page.get_drawings()
    print(f"Total Drawings: {len(drawings)}")
    
    # Categorize by type
    types = {}
    for d in drawings:
        t = d.get("type", "unknown")
        types[t] = types.get(t, 0) + 1
    print(f"Drawing Types: {types}")
    
    # Find large drawings
    print(f"\n--- Large Drawings (area > 10000) ---")
    large_count = 0
    for i, d in enumerate(drawings):
        r = d["rect"]
        area = r.width * r.height
        if area > 10000:
            large_count += 1
            if large_count <= 20:  # Show first 20
                print(f"  [{i}] Type={d['type']} Rect={r} Area={area:.0f} Fill={d.get('fill')} Color={d.get('color')}")
    
    print(f"\nTotal large drawings: {large_count}")
    
    # Find distinct Y positions (to detect horizontal bands/rows)
    print(f"\n--- Distinct Y Positions (forms might be on these rows) ---")
    y_positions = set()
    for d in drawings:
        r = d["rect"]
        if r.height > 50:  # Only significant heights
            y_positions.add(round(r.y0, -1))  # Round to nearest 10
            y_positions.add(round(r.y1, -1))
    
    sorted_y = sorted(y_positions)
    print(f"  Y positions: {sorted_y[:20]}...")  # First 20
    
    # Look for filled rectangles (likely form backgrounds)
    print(f"\n--- Filled Rectangles ---")
    filled_count = 0
    for i, d in enumerate(drawings):
        if d.get("fill") is not None:
            r = d["rect"]
            if r.width > 100 and r.height > 50:
                filled_count += 1
                if filled_count <= 10:
                    print(f"  [{i}] {r} Fill={d.get('fill')}")
    
    print(f"\nTotal filled rects: {filled_count}")
    
    doc.close()

if __name__ == "__main__":
    print("📂 Opening file picker...")
    pdf_path = pick_pdf_file()
    if pdf_path:
        analyze_pdf(pdf_path, 0)  # Analyze page 1
    else:
        print("❌ No file selected")
