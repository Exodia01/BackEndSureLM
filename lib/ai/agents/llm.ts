import { generateEmbedding as generateOllamaEmbedding } from "../embeddings";

export async function generateLLMResponse(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  modelName?: string
): Promise<string> {
  const prompt = buildPrompt(messages);

  try {
    return await chatOllama(prompt, modelName);
  } catch (error) {
    console.warn(`[LLM] Primary model failed, trying fallback: ${(error as Error).message}`);
    
    try {
      return await chatOllama(prompt, process.env.FALLBACK_MODEL_NAME || "llama3:latest");
    } catch (fallbackError) {
      throw new Error(`LLM generation failed for both primary and fallback models`);
    }
  }
}

export async function streamLLMResponse(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  modelName?: string
): Promise<ReadableStream> {
  const prompt = buildPrompt(messages);

  try {
    return await streamOllama(prompt, modelName);
  } catch (error) {
    console.warn(`[LLM] Primary streaming failed, trying fallback: ${(error as Error).message}`);
    
    try {
      return await streamOllama(prompt, process.env.FALLBACK_MODEL_NAME || "llama3:latest");
    } catch (fallbackError) {
      throw new Error(`LLM streaming failed for both primary and fallback models`);
    }
  }
}

function buildPrompt(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
}

async function chatOllama(
  prompt: string,
  modelName?: string
): Promise<string> {
  const response = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName || process.env.PRIMARY_MODEL_NAME || "qwen2.5-coder:1.5b",
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama generate failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

async function streamOllama(
  prompt: string,
  modelName?: string
): Promise<ReadableStream> {
  const response = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/generate`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      model: modelName || process.env.PRIMARY_MODEL_NAME || "qwen2.5-coder:1.5b",
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama stream failed: ${response.statusText}`);
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      
      for await (const chunk of response.body as any) {
        const line = decoder.decode(chunk).trim();
        
        if (!line) continue;
        
        try {
          const data = JSON.parse(line);
          
          if (data.response) {
            controller.enqueue(data.response);
          }
          
          if (data.done) {
            controller.close();
          }
        } catch (error) {
          console.warn("[Ollama Stream] Parse error:", error);
        }
      }
    },
  });

  return readableStream;
}
