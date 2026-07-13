import { Ollama } from '@langchain/ollama';
import { OCRConfig, PROMPT_TEMPLATES } from './config';

export class DocumentOCR {
  private primaryModel: Ollama;
  private fallbackModel: Ollama;

  constructor() {
    const config = new OCRConfig();
    this.primaryModel = new Ollama({
      model: config.primaryModel,
      baseUrl: config.baseUrl,
    });
    this.fallbackModel = new Ollama({
      model: config.fallbackModel,
      baseUrl: config.baseUrl,
    });
  }

  async extractText(imageBase64: string, prompt: string): Promise<string> {
    const response = await this.primaryModel.invoke([
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: `data:image/jpeg;base64,${imageBase64}` },
    ]);

    if (response && typeof response === 'string' && response.trim().length > 0) {
      return response.trim();
    }

    throw new Error('Primary OCR model failed');
  }

  async ocrWithFallback(imageBase64: string, docType: string): Promise<string> {
    const prompt = PROMPT_TEMPLATES[docType] || PROMPT_TEMPLATES.default;
    
    try {
      return await this.extractText(imageBase64, prompt);
    } catch (error) {
      console.log('Primary OCR model failed, trying fallback');
      return await this.extractText(imageBase64, prompt);
    }
  }

  async extractStructuredData(ocrText: string, docType: string): Promise<Record<string, unknown>> {
    const extractionPrompt = `
Extract structured JSON data from the following text.
Return ONLY valid JSON.

Document Type: ${docType}
Text:
${ocrText}

Expected fields based on document type.
`;

    try {
      const result = await this.primaryModel.invoke(extractionPrompt);
      return JSON.parse(result as string);
    } catch (error) {
      console.error('Structured extraction failed:', error);
      return { raw_text: ocrText };
    }
  }
}

export interface OCRConfig {
  primaryModel: string;
  fallbackModel: string;
  baseUrl: string;
}
