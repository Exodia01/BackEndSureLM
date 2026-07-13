import { NextRequest, NextResponse } from 'next/server';
import { Ollama } from '@langchain/ollama';

const primaryModel = new Ollama({
  model: process.env.OCR_PRIMARY_MODEL || 'minicpm-v',
  baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

const fallbackModel = new Ollama({
  model: process.env.OCR_FALLBACK_MODEL || 'llava:7b',
  baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

async function extractTextWithModel(
  model: Ollama,
  imageBase64: string,
  prompt: string
): Promise<{ text: string; confidence: number }> {
  const response = await model.invoke([
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: `data:image/jpeg;base64,${imageBase64}`,
    },
  ]);

  if (response && typeof response === 'string' && response.trim().length > 0) {
    return {
      text: response.trim(),
      confidence: 0.95,
    };
  }

  throw new Error('OCR model returned empty response');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, prompt = 'Extract all visible text from this document.' } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid 'image' field (base64 string required)" },
        { status: 400 }
      );
    }

    let result = await extractTextWithModel(primaryModel, image, prompt);

    if (!result.text || result.confidence < 0.5) {
      console.log('Primary OCR model failed, trying fallback');
      result = await extractTextWithModel(fallbackModel, image, prompt);
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      confidence: result.confidence,
      valid: result.confidence >= 0.5,
    });
  } catch (error) {
    console.error('OCR error:', error);

    try {
      const body = await req.json();
      const fallbackResult = await extractTextWithModel(
        fallbackModel,
        body.image,
        body.prompt || 'Extract all visible text from this document.'
      );

      return NextResponse.json({
        success: true,
        text: fallbackResult.text,
        confidence: fallbackResult.confidence,
        valid: fallbackResult.confidence >= 0.5,
      });
    } catch (fallbackError) {
      console.error('Both OCR models failed:', fallbackError);
      return NextResponse.json({
        success: false,
        error: 'Both OCR models failed to extract text from image',
      }, { status: 500 });
    }
  }
}
