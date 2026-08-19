import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import fs from "node:fs/promises";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function extractPDF(filePath: string): Promise<string[]> {
  const pdfBuffer = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
  const pdf: PDFDocumentProxy = await loadingTask.promise;
  
  const textPages: string[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(" ");
    textPages.push(`[Page ${pageNum}]\n${text}`);
    await page.cleanup();
  }
  
  await pdf.destroy();
  
  return textPages;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  const response = await fetch(`${ollamaHost}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}
