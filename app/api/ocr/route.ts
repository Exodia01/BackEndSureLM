import { Ollama } from "@langchain/ollama";
import { NextRequest, NextResponse } from "next/server";

const primaryModel = new Ollama({
  model: "minicpm-v",
  baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

const fallbackModel = new Ollama({
  model: "llava:7b",
  baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

async function extractTextWithModel(
  model: Ollama,
  imageBase64: string
): Promise<{ text: string; confidence: number }> {
  const prompt = `
Extract all visible text from this document/image.
Return ONLY the extracted text. If no text is visible, return empty string.
`;

  const response = await model.invoke([
    { type: "text", text: prompt },
    {
      type: "image_url",
      image_url: `data:image/jpeg;base64,${imageBase64}`,
    },
  ]);

  console.log("RAW RESPONSE:", response);

  if (response && typeof response === "string" && response.trim().length > 0) {
    return {
      text: response.trim(),
      confidence: 0.9,
    };
  }

  throw new Error("Empty or invalid response from model");
}

async function extractStructuredData(
  model: Ollama,
  ocrText: string
): Promise<Record<string, unknown>> {
  const prompt = `
Extract structured JSON data from this OCR text.
Return ONLY valid JSON.

OCR Text:
${ocrText.substring(0, 2000)}

Return fields based on document type (or extract what you can):
- name, dob, gender, father/husband name
- address, aadhaar_number, pan_number

If field not found, use null.
`;

  try {
    const response = await model.invoke(prompt);
    if (!response) return {};

    const jsonStr = (response as string).replace(/```json|```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Structured extraction failed:", error);
    return { raw_text: ocrText };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, docType } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid 'image' field (base64 string required)",
        },
        { status: 400 }
      );
    }

    let result = await extractTextWithModel(primaryModel, image);

    if (!result.text || result.confidence < 0.5) {
      console.log(
        "Primary model failed or low confidence - trying fallback"
      );

      result = await extractTextWithModel(fallbackModel, image);
    }

    // Extract structured data
    const structuredData = await extractStructuredData(primaryModel, result.text);

    return NextResponse.json({
      success: true,
      text: result.text,
      confidence: result.confidence,
      structuredData,
      valid: true,
    });
  } catch (error) {
    console.error("OCR error:", error);

    try {
      const fallbackResult = await extractTextWithModel(
        fallbackModel,
        (await req.json()).image
      );

      const structuredData = await extractStructuredData(fallbackModel, fallbackResult.text);

      return NextResponse.json({
        success: true,
        text: fallbackResult.text,
        confidence: fallbackResult.confidence,
        structuredData,
        valid: fallbackResult.confidence >= 0.5,
      });
    } catch (fallbackError) {
      console.error("Fallback model also failed:", fallbackError);

      return NextResponse.json({
        success: true,
        text: "",
        confidence: 0,
        structuredData: {},
        valid: false,
        reason: "Both vision models failed to extract text from image",
      });
    }
  }
}
