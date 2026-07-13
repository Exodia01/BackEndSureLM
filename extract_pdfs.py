import os
import PyPDF2
from pathlib import Path

test_dirs = [
    r"S:\BackEndSureLM\test",
    r"S:\BackEndSureLM\test\resources"
]

pdf_files = []
for test_dir in test_dirs:
    if os.path.exists(test_dir):
        pdf_files.extend(Path(test_dir).glob("*.pdf"))

print(f"Found {len(pdf_files)} PDF files")

output_text = ""

for pdf_path in pdf_files:
    try:
        print(f"\nProcessing: {pdf_path.name}")
        output_text += f"\n\n{'='*80}\n"
        output_text += f"PDF: {pdf_path.name}\n"
        output_text += f"{'='*80}\n"
        
        with open(pdf_path, 'rb') as pdf:
            reader = PyPDF2.PdfReader(pdf)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            output_text += text[:10000]
            
    except Exception as e:
        output_text += f"Error: {str(e)}\n"

with open(r"S:\BackEndSureLM\pdf_extracted_content.txt", 'w', encoding='utf-8') as f:
    f.write(output_text)

print(f"\nExtracted content saved to S:\BackEndSureLM\pdf_extracted_content.txt")
print(f"Total characters: {len(output_text)}")
