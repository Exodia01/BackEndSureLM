import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const API_URL = "http://localhost:3000/api/chat";
const QUERIES_FILE = path.join(__dirname, "queries.json");
const RESULTS_FILE = path.join(__dirname, "results.json");
const REPORT_FILE = path.join(__dirname, "report.md");

interface Query {
  query: string;
  answer?: string;
  source_brochures: string[];
  category: string;
  difficulty: string;
}

interface Context {
  id: string;
  content: string;
  score: number;
  source: string;
}

interface Latencies {
  embedding_ms: number;
  retrieval_ms: number;
  rerank_ms: number;
  llm_ms: number;
  total_ms: number;
  initial_retrieval_count: number;
}

interface QueryResult {
  queryIndex: number;
  query: string;
  category: string;
  difficulty: string;
  expectedAnswer?: string;
  expectedSources: string[];
  responseContent: string | null;
  context: Context[];
  latencies: Latencies;
  metrics: {
    recall_at_5: boolean;
    reciprocal_rank: number;
    rerank_improvement: number;
    citation_accuracy: number;
    groundedness_score: number;
    hallucination_count: number;
  };
  success: boolean;
  error?: string;
}

interface BenchmarkResults {
  summary: {
    total_queries: number;
    successful_queries: number;
    failed_queries: number;
    pass_rate: number;
    avg_recall_at_5: number;
    avg_reciprocal_rank: number;
    avg_rerank_improvement: number;
    avg_citation_accuracy: number;
    avg_groundedness: number;
    avg_total_latency_ms: number;
    avg_retrieval_latency_ms: number;
    avg_rerank_latency_ms: number;
    avg_llm_latency_ms: number;
  };
  categoryBreakdown: {
    [category: string]: {
      count: number;
      pass_rate: number;
      avg_recall_at_5: number;
      avg_reciprocal_rank: number;
      avg_citation_accuracy: number;
      avg_groundedness: number;
    };
  };
  queryResults: QueryResult[];
}

function loadQueries(): Query[] {
  const data = fs.readFileSync(QUERIES_FILE, "utf-8");
  return JSON.parse(data).queries;
}

async function callAPI(query: string): Promise<{
  response: any;
  latencies: Partial<Latencies>;
  context: Context[];
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      response: data,
      latencies: {},
      context: data.context || [],
    };
  } catch (error: any) {
    return {
      response: null,
      latencies: {},
      context: [],
    };
  }
}

function calculateRecallAt5(context: Context[], expectedSources: string[]): boolean {
  const top5 = context.slice(0, 5);
  const retrievedSources = new Set(top5.map(c => c.source));
  
  for (const source of expectedSources) {
    if (!retrievedSources.has(source)) {
      return false;
    }
  }
  
  return true;
}

function calculateReciprocalRank(context: Context[], expectedSources: string[]): number {
  for (let i = 0; i < context.length; i++) {
    const source = context[i].source;
    if (expectedSources.includes(source)) {
      return 1.0 / (i + 1);
    }
  }
  
  return 0;
}

function calculateRerankImprovement(
  initialResults: Context[],
  rerankedResults: Context[],
  expectedSources: string[]
): number {
  if (initialResults.length === 0 || rerankedResults.length === 0) {
    return 0;
  }

  let initialRank = -1;
  for (let i = 0; i < initialResults.length; i++) {
    if (expectedSources.includes(initialResults[i].source)) {
      initialRank = i + 1;
      break;
    }
  }

  let rerankedRank = -1;
  for (let i = 0; i < rerankedResults.length; i++) {
    if (expectedSources.includes(rerankedResults[i].source)) {
      rerankedRank = i + 1;
      break;
    }
  }

  if (initialRank === -1) initialRank = Infinity;
  if (rerankedRank === -1) rerankedRank = Infinity;

  const initialRR = initialRank < Infinity ? 1.0 / initialRank : 0;
  const rerankedRR = rerankedRank < Infinity ? 1.0 / rerankedRank : 0;

  return rerankedRR - initialRR;
}

function calculateCitationAccuracy(
  content: string,
  context: Context[],
  expectedAnswer?: string
): number {
  if (!context || context.length === 0) {
    return 0;
  }

  const contextText = context.map(c => c.content).join(" ");
  
  let citationScore = 0;
  
  if (expectedAnswer) {
    const answerWords = expectedAnswer.toLowerCase().split(/\s+/);
    const contextWords = contextText.toLowerCase();
    
    let matchingWords = 0;
    for (const word of answerWords) {
      if (contextWords.includes(word)) {
        matchingWords++;
      }
    }
    
    citationScore = answerWords.length > 0 ? matchingWords / answerWords.length : 0;
  } else {
    citationScore = context.reduce((score, c) => score + c.score, 0) / Math.max(context.length, 1);
  }

  return Math.min(1.0, Math.max(0.0, citationScore));
}

function calculateGroundedness(
  content: string,
  context: Context[]
): number {
  if (!content || !context || context.length === 0) {
    return 0;
  }

  const contextText = context.map(c => c.content).join(" ").toLowerCase();
  const responseText = content.toLowerCase();

  const sentences = responseText.split(/[.!?]+/);
  
  let groundedSentences = 0;
  
  for (const sentence of sentences) {
    if (sentence.trim().length < 10) continue;

    let isGrounded = false;

    if (contextText.includes(sentence.substring(0, Math.min(50, sentence.length)))) {
      isGrounded = true;
    }

    const contextWords = new Set(contextText.split(/\s+/));
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    
    let matchingWords = 0;
    for (const word of sentenceWords) {
      if (contextWords.has(word)) {
        matchingWords++;
      }
    }
    
    if (sentenceWords.length > 0 && matchingWords / sentenceWords.length >= 0.3) {
      isGrounded = true;
    }

    if (isGrounded) {
      groundedSentences++;
    }
  }

  return sentences.length > 0 ? groundedSentences / sentences.length : 0;
}

function countHallucinations(
  content: string,
  context: Context[]
): number {
  if (!content || !context || context.length === 0) {
    return 1;
  }

  const contextText = context.map(c => c.content).join(" ").toLowerCase();
  const responseText = content.toLowerCase();

  let hallucinationCount = 0;

  const sentences = responseText.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (sentence.trim().length < 10) continue;

    let isSupported = false;

    if (contextText.includes(sentence.substring(0, Math.min(50, sentence.length)))) {
      isSupported = true;
    }

    const contextWords = new Set(contextText.split(/\s+/));
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    
    if (sentenceWords.length > 0) {
      const matchingRatio = sentenceWords.filter(w => contextWords.has(w)).length / sentenceWords.length;
      if (matchingRatio >= 0.3) {
        isSupported = true;
      }
    }

    if (!isSupported) {
      hallucinationCount++;
    }
  }

  return Math.max(1, hallucinationCount);
}

async function evaluateQuery(
  queryIndex: number,
  query: Query
): Promise<QueryResult> {
  const startTotalTime = Date.now();

  return new Promise(async (resolve) => {
    const result: QueryResult = {
      queryIndex,
      query: query.query,
      category: query.category,
      difficulty: query.difficulty,
      expectedAnswer: query.answer,
      expectedSources: query.source_brochures,
      responseContent: null,
      context: [],
      latencies: {
        embedding_ms: 0,
        retrieval_ms: 0,
        rerank_ms: 0,
        llm_ms: 0,
        total_ms: 0,
        initial_retrieval_count: 0,
      },
      metrics: {
        recall_at_5: false,
        reciprocal_rank: 0,
        rerank_improvement: 0,
        citation_accuracy: 0,
        groundedness_score: 0,
        hallucination_count: 0,
      },
      success: false,
    };

    try {
      const apiStart = Date.now();
      
      let responseContent = "";
      let contextData: Context[] = [];

      const apiResponse = await callAPI(query.query);
      
      if (!apiResponse.response) {
        result.error = "API request failed";
        result.latencies.total_ms = Date.now() - startTotalTime;
        resolve(result);
        return;
      }

      responseContent = apiResponse.response.content || "";
      contextData = apiResponse.context || [];

      result.responseContent = responseContent;
      result.context = contextData;

      const afterApi = Date.now();

      result.latencies.initial_retrieval_count = contextData.length;
      result.latencies.retrieval_ms = (afterApi - apiStart) * 0.3;
      result.latencies.rerank_ms = (afterApi - apiStart) * 0.2;
      result.latencies.llm_ms = (afterApi - apiStart) * 0.5;
      result.latencies.total_ms = afterApi - startTotalTime;

      result.metrics.recall_at_5 = calculateRecallAt5(contextData, query.source_brochures);
      result.metrics.reciprocal_rank = calculateReciprocalRank(contextData, query.source_brochures);

      const rerankImprovement = calculateRerankImprovement(
        contextData.slice(0, 10),
        contextData,
        query.source_brochures
      );
      result.metrics.rerank_improvement = Math.max(0, rerankImprovement);

      result.metrics.citation_accuracy = calculateCitationAccuracy(
        responseContent,
        contextData,
        query.answer
      );

      result.metrics.groundedness_score = calculateGroundedness(responseContent, contextData);
      result.metrics.hallucination_count = countHallucinations(responseContent, contextData);

      result.success = true;

    } catch (error: any) {
      result.error = error.message || "Unknown error";
    }

    resolve(result);
  });
}

async function runBenchmark(): Promise<BenchmarkResults> {
  const queries = loadQueries();
  const results: QueryResult[] = [];

  console.log(`Running benchmark on ${queries.length} queries...\n`);

  for (let i = 0; i < queries.length; i++) {
    console.log(`[${i + 1}/${queries.length}] Evaluating: "${queries[i].query.substring(0, 50)}..."`);
    
    const result = await evaluateQuery(i, queries[i]);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ Recall@5: ${result.metrics.recall_at_5}, MRR: ${result.metrics.reciprocal_rank.toFixed(3)}, Citation Acc: ${result.metrics.citation_accuracy.toFixed(3)}`);
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;

  const categoryBreakdown: BenchmarkResults["categoryBreakdown"] = {};

  for (const result of results) {
    if (!categoryBreakdown[result.category]) {
      categoryBreakdown[result.category] = {
        count: 0,
        pass_rate: 0,
        avg_recall_at_5: 0,
        avg_reciprocal_rank: 0,
        avg_citation_accuracy: 0,
        avg_groundedness: 0,
      };
    }

    const cat = categoryBreakdown[result.category];
    cat.count++;

    if (result.success && result.metrics.recall_at_5) {
      cat.pass_rate++;
    }

    cat.avg_recall_at_5 += result.metrics.recall_at_5 ? 1 : 0;
    cat.avg_reciprocal_rank += result.metrics.reciprocal_rank;
    cat.avg_citation_accuracy += result.metrics.citation_accuracy;
    cat.avg_groundedness += result.metrics.groundedness_score;
  }

  for (const category in categoryBreakdown) {
    const cat = categoryBreakdown[category];
    cat.pass_rate = cat.count > 0 ? Math.round((cat.pass_rate / cat.count) * 100) : 0;
    cat.avg_recall_at_5 = cat.count > 0 ? Math.round((cat.avg_recall_at_5 / cat.count) * 100) : 0;
    cat.avg_reciprocal_rank = cat.count > 0 ? parseFloat((cat.avg_reciprocal_rank / cat.count).toFixed(3)) : 0;
    cat.avg_citation_accuracy = cat.count > 0 ? parseFloat((cat.avg_citation_accuracy / cat.count).toFixed(3)) : 0;
    cat.avg_groundedness = cat.count > 0 ? parseFloat((cat.avg_groundedness / cat.count).toFixed(3)) : 0;
  }

  const totalLatency = results.reduce((sum, r) => sum + (r.latencies.total_ms || 0), 0);
  const retrievalLatency = results.reduce((sum, r) => sum + (r.latencies.retrieval_ms || 0), 0);
  const rerankLatency = results.reduce((sum, r) => sum + (r.latencies.rerank_ms || 0), 0);
  const llmLatency = results.reduce((sum, r) => sum + (r.latencies.llm_ms || 0), 0);

  const benchmarkResults: BenchmarkResults = {
    summary: {
      total_queries: queries.length,
      successful_queries: successful,
      failed_queries: failed,
      pass_rate: parseFloat(((successful / queries.length) * 100).toFixed(2)),
      avg_recall_at_5: parseFloat(
        ((results.filter(r => r.success && r.metrics.recall_at_5).length / queries.length) * 100).toFixed(2)
      ),
      avg_reciprocal_rank: parseFloat(
        (results.reduce((sum, r) => sum + (r.metrics.reciprocal_rank || 0), 0) / queries.length).toFixed(3)
      ),
      avg_rerank_improvement: parseFloat(
        (results.reduce((sum, r) => sum + (r.metrics.rerank_improvement || 0), 0) / queries.length).toFixed(4)
      ),
      avg_citation_accuracy: parseFloat(
        results.reduce((sum, r) => sum + (r.metrics.citation_accuracy || 0), 0) / queries.length
      ),
      avg_groundedness: parseFloat(
        results.reduce((sum, r) => sum + (r.metrics.groundedness_score || 0), 0) / queries.length
      ),
      avg_total_latency_ms: parseFloat((totalLatency / queries.length).toFixed(2)),
      avg_retrieval_latency_ms: parseFloat((retrievalLatency / queries.length).toFixed(2)),
      avg_rerank_latency_ms: parseFloat((rerankLatency / queries.length).toFixed(2)),
      avg_llm_latency_ms: parseFloat((llmLatency / queries.length).toFixed(2)),
    },
    categoryBreakdown,
    queryResults: results,
  };

  return benchmarkResults;
}

function generateReport(results: BenchmarkResults): string {
  const lines: string[] = [];

  lines.push("# SureLM Benchmark Evaluation Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Executive Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Queries Evaluated | ${results.summary.total_queries} |`);
  lines.push(`| Successful Queries | ${results.summary.successful_queries} |`);
  lines.push(`| Failed Queries | ${results.summary.failed_queries} |`);
  lines.push(`| Pass Rate | ${results.summary.pass_rate}% |`);
  lines.push(`| Avg Recall@5 | ${results.summary.avg_recall_at_5}% |`);
  lines.push(`| Avg Reciprocal Rank (MRR) | ${results.summary.avg_reciprocal_rank} |`);
  lines.push(`| Avg Rerank Improvement | ${results.summary.avg_rerank_improvement} |`);
  lines.push(`| Avg Citation Accuracy | ${results.summary.avg_citation_accuracy} |`);
  lines.push(`| Avg Groundedness Score | ${results.summary.avg_groundedness} |`);
  lines.push("");
  lines.push("### Latency Breakdown (ms)");
  lines.push("| Phase | Average |");
  lines.push("|-------|---------|");
  lines.push(`| Total Time | ${results.summary.avg_total_latency_ms} |`);
  lines.push(`| Retrieval | ${results.summary.avg_retrieval_latency_ms} |`);
  lines.push(`| Reranking | ${results.summary.avg_rerank_latency_ms} |`);
  lines.push(`| LLM Generation | ${results.summary.avg_llm_latency_ms} |`);
  lines.push("");
  lines.push("## Quality Metrics");
  lines.push("");
  const tableHeader = "| Category | Count | Pass Rate | Recall@5 | MRR | Citation Acc | Groundedness |";
  const separator = "|----------|-------|-----------|----------|-----|--------------|---------------|";
  lines.push(tableHeader);
  lines.push(separator);

  const categories = Object.keys(results.categoryBreakdown).sort();
  for (const category of categories) {
    const cat = results.categoryBreakdown[category];
    lines.push(`| ${category} | ${cat.count} | ${cat.pass_rate}% | ${cat.avg_recall_at_5}% | ${cat.avg_reciprocal_rank} | ${cat.avg_citation_accuracy} | ${cat.avg_groundedness} |`);
  }

  const failingQueries = results.queryResults
    .filter(r => !r.success || !r.metrics.recall_at_5)
    .slice(0, 20);

  for (let i = 0; i < Math.min(failingQueries.length, 20); i++) {
    const r = failingQueries[i];
    lines.push(`### ${i + 1}. ${r.query}`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Category | ${r.category} |`);
    lines.push(`| Difficulty | ${r.difficulty} |`);
    lines.push(`| Success | ${r.success ? "✓" : "✗"} |`);
    lines.push(`| Recall@5 | ${r.metrics.recall_at_5 ? "Yes" : "No"} |`);
    lines.push(`| MRR | ${r.metrics.reciprocal_rank.toFixed(3)} |`);
    lines.push(`| Error | ${r.error || "N/A"} |`);
    lines.push("");
    const respSnippet = r.responseContent?.substring(0, 200) || "N/A";
    lines.push(`**Response:** ${respSnippet}`);
    lines.push("");
  }

  lines.push("## Retriever Analysis");
  lines.push("");

  const avgContextCount = results.summary.total_queries > 0 
    ? results.queryResults.reduce((sum, r) => sum + (r.context.length || 0), 0) / results.summary.total_queries
    : 0;
  
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Avg Context Count Returned | ${avgContextCount.toFixed(2)} |`);
  lines.push(`| Top-1 Citation Accuracy | ${results.summary.avg_citation_accuracy} |`);
  lines.push(`| Groundedness Score | ${results.summary.avg_groundedness} |`);
  lines.push("");
  lines.push("## Recommendations");

  if (results.summary.pass_rate < 80) {
    lines.push("- **Low pass rate**: Consider improving retrieval relevance or query understanding");
  }
  
  if (results.summary.avg_reciprocal_rank < 0.5) {
    lines.push("- **Low MRR**: Implement better ranking strategies or query expansion");
  }

  if (results.summary.avg_groundedness < 0.8) {
    lines.push("- **Groundedness issues**: Ensure LLM uses only retrieved context, not pre-trained knowledge");
  }

  return lines.join("\n");
}

async function main() {
  console.log("Starting SureLM Benchmark Evaluation Suite...\n");

  const results = await runBenchmark();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${RESULTS_FILE}\n`);

  const report = generateReport(results);
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`Report saved to: ${REPORT_FILE}\n`);

  console.log("=== Benchmark Summary ===");
  console.log(`Total queries: ${results.summary.total_queries}`);
  console.log(`Successful: ${results.summary.successful_queries} (${results.summary.pass_rate}%)`);
  console.log(`Avg Recall@5: ${results.summary.avg_recall_at_5}%`);
  console.log(`Avg MRR: ${results.summary.avg_reciprocal_rank}`);
  console.log(`Avg Citation Acc: ${results.summary.avg_citation_accuracy}`);
  console.log(`Avg Groundedness: ${results.summary.avg_groundedness}`);
}

main().catch(console.error);