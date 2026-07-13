import { Ollama } from '@langchain/ollama';

const ollama = new Ollama({
  model: 'minicpm-v',
  baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

export interface ExtractedData {
  text: string;
  structuredData: Record<string, unknown>;
}

async function extractStructuredData(text: string): Promise<Record<string, unknown>> {
  const prompt = `Extract JSON from text.
Text:
${text.substring(0, 2000)}

Return ONLY the JSON object.
`;

  try {
    const response = await ollama.invoke(prompt);
    if (!response) return {};

    const jsonStr = (response as string).replace(/```json|```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Structured extraction failed:', error);
    return { raw_text: text };
  }
}

export async function extractDocumentData(
  imageBase64: string,
  docType: string
): Promise<ExtractedData> {
  const AADHAAR_PROMPT = `Extract name, DOB, gender, father's/husband's name, address, and 12-digit Aadhaar number.
Return JSON with fields: name, dob, gender, father_husband_name, address, aadhaar_number`;

  const PAN_PROMPT = `Extract name, father's name, DOB, and PAN number (10 chars).
Return JSON with fields: name, father_name, dob, pan_number`;

  let prompt = 'Extract all visible text. Return original format.';
  if (docType.includes('aadhaar')) prompt = AADHAAR_PROMPT;
  else if (docType === 'pan') prompt = PAN_PROMPT;

  try {
    const response = await ollama.invoke([
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: `data:image/jpeg;base64,${imageBase64}` },
    ]);

    if (!response || typeof response !== 'string') throw new Error('Empty OCR response');

    const ocrText = (response as string).trim();
    const structuredData = await extractStructuredData(ocrText);

    return { text: ocrText, structuredData };
  } catch (error) {
    console.error(`OCR extraction failed for ${docType}:`, error);
    throw new Error('Failed to extract document data');
  }
}
