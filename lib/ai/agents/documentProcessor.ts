import { db } from "../../db";
import { createCollection, upsert as qdrantUpsert, semanticSearch, POLICY_KNOWLEDGE_COLLECTION } from "../../qdrant";

export const EMBEDDING_MODEL = "nomic-embed-text";
const VECTOR_SIZE = 768;
const COLLECTION_NAME = POLICY_KNOWLEDGE_COLLECTION;

export async function detectCategory(text: string): Promise<string | undefined> {
  const headerPatterns = [
    { regex: /^#\s*(Death\s+Benefit|Death).*$/i, category: "death_benefit" },
    { regex: /^#\s*(Maturity\s+Benefit|Maturity|Survival\s+Benefit).*$/i, category: "maturity_survival_benefit" },
    { regex: /^#\s*(Eligibility|Entry\s+Age|Eligible).*$/i, category: "eligibility" },
    { regex: /^#\s*(Premium|Payment|Rate|Cost|Amount).*$/i, category: "premium_payment" },
    { regex: /^#\s*(Bonuses?|Reversionary|Cash|Terminal).*$/i, category: "bonuses" },
    { regex: /^#\s*(Riders?|Additional\s+Protection|Optional).*$/i, category: "riders" },
    { regex: /^#\s*(Surrender|Encashment|Maturity).*$/i, category: "surrender_maturity" },
    { regex: /^#\s*(Loan|Policy\s+Loan).*$/i, category: "policy_loan" },
    { regex: /^#\s*(Revival|Lapse|Reinstatement).*$/i, category: "revival_lapse" },
    { regex: /^#\s*([Uu]nderwriting|[Cc]laims?|Exclusions|Conditions).*$/i, category: "claims_conditions" },
    { regex: /^#\s*(Tax|Section\s+80C|Section\s+10).*$/i, category: "tax_benefits" },
    { regex: /^#\s*(Free\s+Look|Assignment|Nomination|Health).*$/i, category: "policy_features" },
  ];

  const lines = text.split("\n").slice(0, 50);
  for (const line of lines) {
    for (const { regex, category } of headerPatterns) {
      if (regex.test(line)) {
        return category;
      }
    }
  }

  return undefined;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function generateEmbeddingsSequentially(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  console.log(`[embeddings] Generating ${texts.length} embeddings sequentially...`);

  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await generateEmbedding(texts[i]);
      embeddings.push(embedding);

      if ((i + 1) % 50 === 0) {
        console.log(`[embeddings] Generated ${i + 1}/${texts.length} embeddings`);
      }
    } catch (error) {
      console.warn(`[embeddings] Failed for chunk ${i}:`, error);
      embeddings.push(new Array(VECTOR_SIZE).fill(0));
    }
  }

  return embeddings;
}

export async function processBrochure(
  brochureId: string,
  fileData: ArrayBuffer,
  filename: string
): Promise<{ chunksCreated: number; totalPages: number }> {
  const { extractPDFText, chunkText } = await import("../../pdf/batchProcess");

  console.log(`[processBrochure] Starting processing for brochure ${brochureId}`);

  const { pages, totalPages } = await extractPDFText(fileData);
  console.log(`[processBrochure] Extracted ${pages.length} pages`);

  const chunks = chunkText(pages);
  console.log(`[processBrochure] Created ${chunks.length} chunks`);

    const chunksWithCategories = chunks.map((chunk) => ({
      content: chunk.content,
      // category removed - not needed for processing
      page: chunk.metadata?.[0]?.page as number | undefined,
    }));

  console.log("[processBrochure] Generating embeddings...");
  const embeddingStartTime = Date.now();
  const embeddings = await generateEmbeddingsSequentially(chunksWithCategories.map((c) => c.content));
  const embeddingDuration = Date.now() - embeddingStartTime;
  console.log(`[processBrochure] Embeddings generated in ${embeddingDuration}ms`);

  console.log("[processBrochure] Storing chunks in database...");

  await db.$transaction(
    chunksWithCategories.map((chunk, index) =>
      db.chunk.create({
        data: {
          brochureId,
          content: chunk.content,
          chunkOrder: index,
          pageNumber: chunk.page ?? null,
          // category removed - not needed for processing
          metadata: { original_page: chunk.page },
        },
      })
    )
  );

  console.log("[processBrochure] Upserting vectors to Qdrant...");
  const qdrantStartTime = Date.now();
  await upsertToQdrant(brochureId, chunksWithCategories, embeddings);
  const qdrantDuration = Date.now() - qdrantStartTime;
  console.log(`[processBrochure] Qdrant upsert completed in ${qdrantDuration}ms`);

  await db.brochure.update({
    where: { id: brochureId },
    data: {
      totalPages,
      currentPage: pages.length,
      status: "READY",
    },
  });

  console.log(`[processBrochure] Completed: ${chunks.length} chunks stored`);

  return { chunksCreated: chunks.length, totalPages };
}

export async function upsertToQdrant(
  brochureId: string,
  chunksWithCategories: Array<{ content: string; page?: number }>,
  embeddings: number[][]
): Promise<number> {
  const points = chunksWithCategories.map((chunk, index) => ({
    id: `${brochureId}-${index}`,
    vector: embeddings[index] || new Array(VECTOR_SIZE).fill(0),
    payload: {
      brochure_id: brochureId,
      chunk_index: index,
      content: chunk.content,
      // category removed - not needed for processing
      page_num: chunk.page ?? null,
      version_num: 1,
    },
  }));

  try {
    await qdrantUpsert(COLLECTION_NAME, points as any);
    console.log(`[upsertToQdrant] Upserted ${points.length} points to Qdrant`);
    return points.length;
  } catch (error) {
    console.warn("[upsertToQdrant] Failed to upsert to Qdrant:", error);
    
    await createCollection(COLLECTION_NAME, VECTOR_SIZE, {
      brochure_id: "keyword",
      chunk_index: "integer",
      page_num: "integer",
      version_num: "integer",
    });

    await qdrantUpsert(COLLECTION_NAME, points as any);
    return points.length;
  }
}

export async function processDocument(
  fileData: ArrayBuffer,
  filename: string
): Promise<{ chunksCreated: number; totalPages: number }> {
  const { extractPDFText, chunkText } = await import("../../pdf/batchProcess");

  console.log(`[processDocument] Starting document processing for ${filename}`);

  const { pages, totalPages } = await extractPDFText(fileData);
  console.log(`[processDocument] Extracted ${pages.length} pages`);

  const chunks = chunkText(pages);
  console.log(`[processDocument] Created ${chunks.length} chunks`);

  return {
    chunksCreated: chunks.length,
    totalPages,
  };
}
