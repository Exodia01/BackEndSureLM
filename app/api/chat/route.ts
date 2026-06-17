import { Ollama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const BASE_URL = process.env.OLLAMA_HOST || "http://localhost:11434/v1";

const primaryModel = new Ollama({
  baseUrl: BASE_URL,
  model:process.env.PRIMARY_MODEL_NAME || "qwen3-coder-next:latest",
});

const fallbackModel = new Ollama({
  baseUrl: BASE_URL,
  model: process.env.FALLBACK_MODEL_NAME || "llama3:latest",
});

async function generateWithFallback(
  model: Ollama,
  prompt: string
): Promise<string> {
  try {
    const chain = model.pipe(new StringOutputParser());
    return await chain.invoke(prompt);
  } catch (error) {
    throw error;
  }
}

async function streamWithFallback(
  model: Ollama,
  prompt: string
): Promise<ReadableStream> {
  try {
    const chain = model.pipe(new StringOutputParser());
    const stream = await chain.stream(prompt);
    
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    
    return readableStream;
  } catch (error) {
    throw error;
  }
}

async function summarizeWithFallback(
  text: string,
  usePrimary: boolean = true
): Promise<string> {
  try {
    const prompt = `Summarize the following text in 3-5 sentences:

TEXT:
${text}`;

    if (usePrimary) {
      return await generateWithFallback(primaryModel, prompt);
    } else {
      return await generateWithFallback(fallbackModel, prompt);
    }
  } catch (error) {
    if (usePrimary) {
      return summarizeWithFallback(text, false);
    }
    throw error;
  }
}

async function chatWithFallback(
  messages: { role: "user" | "assistant"; content: string }[],
  usePrimary: boolean = true
): Promise<string> {
  try {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant."],
      ...messages.map((m) => [m.role, m.content]),
    ]);

    const model = usePrimary ? primaryModel : fallbackModel;
    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
    
    return await chain.invoke({});
  } catch (error) {
    if (usePrimary) {
      return chatWithFallback(messages, false);
    }
    throw error;
  }
}

async function streamChatWithFallback(
  messages: { role: "user" | "assistant"; content: string }[],
  usePrimary: boolean = true
): Promise<ReadableStream> {
  try {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant."],
      ...messages.map((m) => [m.role, m.content]),
    ]);

    const model = usePrimary ? primaryModel : fallbackModel;
    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
    
    return await streamWithFallback(model, 
      await promptTemplate.format({ messages })
    );
  } catch (error) {
    if (usePrimary) {
      return streamChatWithFallback(messages, false);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const stream = await streamChatWithFallback(messages);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    
    try {
      const { messages } = await request.json();
      const fallbackResponse = await chatWithFallback(messages, false);
      
      return new Response(fallbackResponse, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ error: "Both primary and fallback models failed" }),
        { status: 503 }
      );
    }
  }
}

export async function GET(request: Request) {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      ollama_primary: BASE_URL,
      ollama_fallback: BASE_URL,
    },
  };

  return Response.json(healthCheck);
}

export { summarizeWithFallback, chatWithFallback, streamChatWithFallback };
