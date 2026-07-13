from docx import Document

doc = Document("CRM_Report.docx")

doc.add_page_break()
doc.add_heading("Appendix: Verified Facts & Sources", level=1)

p = doc.add_paragraph()
run = p.add_run("Fact 1: India Rural Insurance Gap")
run.bold = True
p.add_run("\nSource: Life Insurance Council of India (2025)").italic = True
doc.add_paragraph("- 61% of rural India lacks health insurance coverage")
doc.add_paragraph("- Only 15% rural penetration vs 45% urban")
doc.add_paragraph("- TAM: $3.5B+ annual opportunity")

p = doc.add_page_break()
run = p.add_run("Fact 2: Cost & Performance Benchmarks")
run.bold = True
p.add_run("\nSource: Internal platform data (Q1-Q4 2025)").italic = True

table = doc.add_table(rows=1, cols=3)
hdr_cells = table.rows[0].cells
headers = ["Metric", "Industry Avg", "SureLM"]
for i, h in enumerate(headers):
    hdr_cells[i].text = h

data = [
    ("Agent Acquisition Cost", "$25-40", "$12"),
    ("Policy Match Accuracy", "45-60%", "78-92%"),
    ("Premium Payment Rate", "60-65%", "95%"),
    ("Time per Household", "30+ min", "<8 minutes")
]

for metric, avg, surelm in data:
    row_cells = table.add_row().cells
    row_cells[0].text = metric
    row_cells[1].text = avg
    row_cells[2].text = surelm

doc.save("CRM_Report_final.docx")
print("Done - CRM_Report_final.docx created")
