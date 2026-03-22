// app/api/chat/route.ts
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import Groq from "groq-sdk";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest } from "next/server";

// ── Clients ───────────────────────────────────────────────────────────────────
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION!,
  token: { token: process.env.AWS_BEARER_TOKEN_BEDROCK! },
});

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.Index(process.env.PINECONE_INDEX!);

// ── Constants ─────────────────────────────────────────────────────────────────
// How many recent messages to keep verbatim before summarizing the rest
const RECENT_WINDOW = 8;

const SYSTEM_PROMPT = `You are an AI insurance assistant for rural India, helping field agents recommend insurance policies to low-income households.

You have access to real insurance policy documents. Use them to give accurate, specific answers.

STRICT RULES:
- Always respond with valid JSON only. Zero plain text outside JSON.
- Never add markdown, code blocks, or extra explanation.

RULE 1 - RECOMMENDATION MODE:
Triggered when agent describes a household (income, family size, occupation, location, needs).
- ALWAYS recommend exactly 3 policies
- Use real policy names and figures from the provided documents
- Respond ONLY with:
{"type":"recommendation","analysis":"2 sentence analysis of household needs","policies":[{"name":"Exact policy name from documents","provider":"Provider name","premium":"₹X/month","coverage":"₹X lakh","tag":"Health/Crop/Life/Accident"},{"name":"...","provider":"...","premium":"...","coverage":"...","tag":"..."},{"name":"...","provider":"...","premium":"...","coverage":"...","tag":"..."}]}

RULE 2 - CONVERSATION MODE:
Triggered for follow-up questions, policy details, comparisons, greetings, anything else.
- Answer using specific details from the provided policy documents
- Give concrete numbers, facts, eligibility criteria from the documents
- If history contains [Policies shown to user: ...], ONLY explain those exact policies. Never substitute or add different ones.
- Respond ONLY with:
{"type":"message","content":"Specific, detailed answer using facts from the policy documents"}`;

const SUMMARY_PROMPT = `You are a conversation summarizer. Summarize the following insurance agent conversation history into 3-5 concise bullet points. 
Focus on: household details discussed, policies recommended, decisions made, and key questions asked.
Be brief. Plain text only, no JSON.`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoryMessage {
  role: "agent" | "ai";
  content: string;
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: [{ text: string }];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function retrieveContext(message: string, history: HistoryMessage[]): Promise<string> {
  try {
    const lastPoliciesInHistory = history
      .filter((m) => m.role === "ai" && m.content.includes("Policies shown to user:"))
      .slice(-1)[0]?.content ?? "";

    const searchQuery = lastPoliciesInHistory
      ? `${message} ${lastPoliciesInHistory.split("Policies shown to user:")[1] ?? ""}`
      : message;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (index as any).searchRecords({
      query: { topK: 8, inputs: { text: searchQuery } },
      fields: ["text", "source"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hits = results?.result?.hits as any[];
    if (!hits || hits.length === 0) return "";

    console.log("Retrieved", hits.length, "chunks — sources:", hits.map((h: any) => h.fields?.source));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return hits
      .map((h: any) => `[Source: ${h.fields?.source}]\n${h.fields?.text}`)
      .join("\n\n---\n\n");
  } catch (err) {
    console.error("Pinecone retrieval error:", err);
    return "";
  }
}

/**
 * Summarize old messages (everything outside the recent window) using Groq.
 * Returns a compact string like "• Family of 5, farmer…\n• Recommended PM Fasal Bima…"
 * Falls back to an empty string if summarization fails — never breaks the main flow.
 */
async function summarizeOldHistory(oldMessages: HistoryMessage[]): Promise<string> {
  if (oldMessages.length === 0) return "";

  const transcript = oldMessages
    .map((m) => `${m.role === "agent" ? "Agent" : "AI"}: ${m.content}`)
    .join("\n");

  try {
    const res = await groqClient.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: transcript },
      ],
      max_tokens: 300,
      temperature: 0,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("Summary generation failed (non-fatal):", err);
    return "";
  }
}

/**
 * Build the messages array for the LLM.
 * - If history is short (<= RECENT_WINDOW) → pass it all verbatim
 * - If history is long → summarize old messages, pass summary as first user/assistant
 *   exchange, then pass the recent window verbatim
 */
async function buildMessages(
  augmentedMessage: string,
  history: HistoryMessage[]
): Promise<BedrockMessage[]> {
  const recent = history.slice(-RECENT_WINDOW);
  const old    = history.slice(0, -RECENT_WINDOW);

  const recentMapped: BedrockMessage[] = recent.map((m) => ({
    role: m.role === "agent" ? "user" : "assistant",
    content: [{ text: m.content }],
  }));

  if (old.length === 0) {
    // Short conversation — no summarization needed
    return [
      ...recentMapped,
      { role: "user", content: [{ text: augmentedMessage }] },
    ];
  }

  // Long conversation — summarize old history first
  const summary = await summarizeOldHistory(old);
  const summaryBlock: BedrockMessage[] = summary
    ? [
        {
          role: "user",
          content: [{ text: `[Earlier conversation summary]\n${summary}` }],
        },
        {
          role: "assistant",
          content: [{ text: '{"type":"message","content":"Understood, I have context from our earlier conversation."}' }],
        },
      ]
    : [];

  return [
    ...summaryBlock,
    ...recentMapped,
    { role: "user", content: [{ text: augmentedMessage }] },
  ];
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

/**
 * Stream via Bedrock's ConverseStream API.
 * Yields text chunks as they arrive.
 */
async function* streamBedrock(
  messages: BedrockMessage[]
): AsyncGenerator<string> {
  const command = new ConverseStreamCommand({
    modelId: process.env.BEDROCK_MODEL_ID!,
    system: [{ text: SYSTEM_PROMPT }],
    messages,
    inferenceConfig: { maxTokens: 1500, temperature: 0.2 },
  });

  const response = await bedrockClient.send(command);
  if (!response.stream) return;

  for await (const event of response.stream) {
    const chunk = event.contentBlockDelta?.delta?.text;
    if (chunk) yield chunk;
  }
}

/**
 * Stream via Groq (already supports streaming natively).
 */
async function* streamGroq(
  augmentedMessage: string,
  history: HistoryMessage[]
): AsyncGenerator<string> {
  const recent = history.slice(-RECENT_WINDOW);

  const stream = await groqClient.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...recent.map((m) => ({
        role: (m.role === "agent" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: augmentedMessage },
    ],
    max_tokens: 1500,
    temperature: 0.2,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

/**
 * Parse and validate the accumulated JSON string from the stream.
 */
function parseAccumulated(
  raw: string
): { type: string; analysis?: string; policies?: unknown[]; content?: string } {
  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed: { type: string; analysis?: string; policies?: unknown[]; content?: string };

  try {
    parsed = JSON.parse(clean);
  } catch {
    parsed = { type: "message", content: clean };
  }

  // Unwrap double-encoded JSON
  if (parsed.type === "message" && parsed.content) {
    try {
      const inner = JSON.parse(parsed.content);
      if (inner.type) parsed = inner;
    } catch { /* fine */ }
  }

  // Guard: need at least 2 policies for a recommendation
  if (parsed.type === "recommendation" && Array.isArray(parsed.policies)) {
    if (parsed.policies.length < 2) {
      parsed = {
        type: "message",
        content: parsed.analysis ?? "Here are some policy suggestions based on the household profile.",
      };
    }
  }

  return parsed;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json() as {
      message: string;
      history: HistoryMessage[];
    };

    const context = await retrieveContext(message, history);
    const augmentedMessage = context
      ? `POLICY DOCUMENTS (use these for accurate info):\n\n${context}\n\n---\n\nAgent message: ${message}`
      : message;

    const messages = await buildMessages(augmentedMessage, history);

    // ── Build a ReadableStream that:
    //    1. Tries Bedrock streaming first
    //    2. Falls back to Groq streaming on any error
    //    3. Accumulates the full JSON, parses it, then sends ONE final JSON event
    //       (your existing ChatArea.tsx just needs to read the last SSE event)
    // ─────────────────────────────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encode = (s: string) => new TextEncoder().encode(s);
        let accumulated = "";
        let usedBedrock = true;

        const sendChunk = (text: string) => {
          accumulated += text;
          // Send raw token so the UI can show a typing effect (optional)
          controller.enqueue(encode(`data: ${JSON.stringify({ type: "token", token: text })}\n\n`));
        };

        try {
          // ── Try Bedrock first ────────────────────────────────────────────
          for await (const chunk of streamBedrock(messages)) {
            sendChunk(chunk);
          }
          console.log("Used Bedrock (streaming)");
        } catch (bedrockErr) {
          console.warn("Bedrock stream failed, falling back to Groq:", bedrockErr);
          usedBedrock = false;
          accumulated = ""; // reset — nothing was committed yet

          try {
            // ── Groq fallback ──────────────────────────────────────────────
            for await (const chunk of streamGroq(augmentedMessage, history)) {
              sendChunk(chunk);
            }
            console.log("Used Groq (streaming fallback)");
          } catch (groqErr) {
            console.error("Both LLMs failed:", groqErr);
            controller.enqueue(
              encode(
                `data: ${JSON.stringify({
                  type: "done",
                  success: false,
                  data: { type: "message", content: "Sorry, the AI is temporarily unavailable." },
                })}\n\n`
              )
            );
            controller.close();
            return;
          }
        }

        // ── Parse the full accumulated response ────────────────────────────
        const parsed = parseAccumulated(accumulated);

        // Send the final structured payload — ChatArea reads this event
        controller.enqueue(
          encode(`data: ${JSON.stringify({ type: "done", success: true, data: parsed })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI error:", error);
    return Response.json({ success: false, error: "AI unavailable" }, { status: 500 });
  }
}