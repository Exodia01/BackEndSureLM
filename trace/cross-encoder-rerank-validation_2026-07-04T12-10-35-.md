# Cross-Encoder Reranker Validation Report

**Timestamp:** 2026-07-04T12:10:36.885Z

**Feature Flag Status:** ⚠ MOCK (no HUGGINGFACE_API_KEY)

## Summary

| Metric | Value |
|--------|-------|
| Queries Tested | 5 |
| Total Latency | 1.50s |
| Avg RRFS Latency | 0.00ms |
| Avg Rerank Latency | 158.20ms |
| Avg Score Change | 0.1532 |
| Rank Changes | 40 |

## Latency Comparison (per query)

| Query | RRFS (ms) | Rerank (ms) | Added (ms) |
|-------|-----------|-------------|------------|
| "What is the premium payment term?" | 0.00 | 167.00 | +167.00 |
| "pre-existing conditions" | 0.00 | 164.00 | +164.00 |
| "maturity benefit" | 0.00 | 153.00 | +153.00 |
| "eligibility criteria" | 0.00 | 152.00 | +152.00 |
| "coverage for critical illness" | 0.00 | 155.00 | +155.00 |

## Query Results Comparison

### Query: "What is the premium payment term?"

**Result Overlap:** 5/5 chunks in common

**RRFS Top 5:**

| Rank | Chunk ID | RRFS Score |
|------|----------|------------|
| 1 | chunk-1 | 0.0164 |
| 2 | chunk-2 | 0.0164 |
| 3 | chunk-3 | 0.0161 |
| 4 | chunk-4 | 0.0161 |
| 5 | chunk-5 | 0.0159 |

**Cross-Encoder Reranked Top 5:**

| Rank | Chunk ID | Reranked Score | Change |
|------|----------|----------------|--------|
| 1 | chunk-1 | 0.2564 | +0.2400 ↑ |
| 2 | chunk-5 | 0.2437 | +0.2279 ↑ |
| 3 | chunk-2 | 0.2096 | +0.1932 ↑ |
| 4 | chunk-3 | 0.1393 | +0.1231 ↑ |
| 5 | chunk-4 | 0.0401 | +0.0240 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2564 | +0.2400 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2096 | +0.1932 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1393 | +0.1231 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0401 | +0.0240 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2437 | +0.2279 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-2 | 2 | 5 | ↓ DOWN |
| chunk-5 | 3 | 2 | ↑ UP |
| chunk-3 | 3 | 2 | ↑ UP |
| chunk-2 | 4 | 3 | ↑ UP |
| chunk-4 | 4 | 3 | ↑ UP |
| chunk-3 | 5 | 4 | ↑ UP |
| chunk-5 | 5 | 4 | ↑ UP |
| chunk-4 | 2 | 5 | ↓ DOWN |

**Reranking Impact:**
- **Improved scores:** 5 chunks
- **Decreased scores:** 0 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

### Query: "pre-existing conditions"

**Result Overlap:** 5/5 chunks in common

**RRFS Top 5:**

| Rank | Chunk ID | RRFS Score |
|------|----------|------------|
| 1 | chunk-1 | 0.0164 |
| 2 | chunk-2 | 0.0164 |
| 3 | chunk-3 | 0.0161 |
| 4 | chunk-4 | 0.0161 |
| 5 | chunk-5 | 0.0159 |

**Cross-Encoder Reranked Top 5:**

| Rank | Chunk ID | Reranked Score | Change |
|------|----------|----------------|--------|
| 1 | chunk-3 | 0.2985 | +0.2823 ↑ |
| 2 | chunk-4 | 0.2144 | +0.1983 ↑ |
| 3 | chunk-1 | 0.1522 | +0.1358 ↑ |
| 4 | chunk-2 | 0.0854 | +0.0690 ↑ |
| 5 | chunk-5 | 0.0258 | +0.0099 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1522 | +0.1358 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0854 | +0.0690 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2985 | +0.2823 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2144 | +0.1983 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0258 | +0.0099 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-1 | 1 | 3 | ↓ DOWN |
| chunk-3 | 3 | 1 | ↑ UP |
| chunk-2 | 2 | 4 | ↓ DOWN |
| chunk-4 | 4 | 2 | ↑ UP |
| chunk-3 | 3 | 1 | ↑ UP |
| chunk-1 | 1 | 3 | ↓ DOWN |
| chunk-4 | 4 | 2 | ↑ UP |
| chunk-2 | 2 | 4 | ↓ DOWN |

**Reranking Impact:**
- **Improved scores:** 5 chunks
- **Decreased scores:** 0 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

### Query: "maturity benefit"

**Result Overlap:** 5/5 chunks in common

**RRFS Top 5:**

| Rank | Chunk ID | RRFS Score |
|------|----------|------------|
| 1 | chunk-1 | 0.0164 |
| 2 | chunk-2 | 0.0164 |
| 3 | chunk-3 | 0.0161 |
| 4 | chunk-4 | 0.0161 |
| 5 | chunk-5 | 0.0159 |

**Cross-Encoder Reranked Top 5:**

| Rank | Chunk ID | Reranked Score | Change |
|------|----------|----------------|--------|
| 1 | chunk-1 | 0.2336 | +0.2172 ↑ |
| 2 | chunk-2 | 0.1978 | +0.1814 ↑ |
| 3 | chunk-3 | 0.1614 | +0.1453 ↑ |
| 4 | chunk-5 | 0.0377 | +0.0218 ↑ |
| 5 | chunk-4 | 0.0339 | +0.0177 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2336 | +0.2172 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1978 | +0.1814 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1614 | +0.1453 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0339 | +0.0177 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0377 | +0.0218 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 4 | 5 | ↓ DOWN |
| chunk-5 | 5 | 4 | ↑ UP |
| chunk-5 | 5 | 4 | ↑ UP |
| chunk-4 | 4 | 5 | ↓ DOWN |

**Reranking Impact:**
- **Improved scores:** 5 chunks
- **Decreased scores:** 0 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

### Query: "eligibility criteria"

**Result Overlap:** 5/5 chunks in common

**RRFS Top 5:**

| Rank | Chunk ID | RRFS Score |
|------|----------|------------|
| 1 | chunk-1 | 0.0164 |
| 2 | chunk-2 | 0.0164 |
| 3 | chunk-3 | 0.0161 |
| 4 | chunk-4 | 0.0161 |
| 5 | chunk-5 | 0.0159 |

**Cross-Encoder Reranked Top 5:**

| Rank | Chunk ID | Reranked Score | Change |
|------|----------|----------------|--------|
| 1 | chunk-4 | 0.2627 | +0.2466 ↑ |
| 2 | chunk-3 | 0.2550 | +0.2389 ↑ |
| 3 | chunk-5 | 0.2461 | +0.2302 ↑ |
| 4 | chunk-1 | 0.1131 | +0.0967 ↑ |
| 5 | chunk-2 | 0.0165 | +0.0001 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1131 | +0.0967 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0165 | +0.0001 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2550 | +0.2389 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2627 | +0.2466 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2461 | +0.2302 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-1 | 1 | 4 | ↓ DOWN |
| chunk-4 | 4 | 1 | ↑ UP |
| chunk-2 | 2 | 3 | ↓ DOWN |
| chunk-3 | 5 | 2 | ↑ UP |
| chunk-3 | 3 | 5 | ↓ DOWN |
| chunk-5 | 2 | 3 | ↓ DOWN |
| chunk-4 | 4 | 1 | ↑ UP |
| chunk-1 | 1 | 4 | ↓ DOWN |
| chunk-5 | 5 | 2 | ↑ UP |
| chunk-2 | 3 | 5 | ↓ DOWN |

**Reranking Impact:**
- **Improved scores:** 5 chunks
- **Decreased scores:** 0 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

### Query: "coverage for critical illness"

**Result Overlap:** 5/5 chunks in common

**RRFS Top 5:**

| Rank | Chunk ID | RRFS Score |
|------|----------|------------|
| 1 | chunk-1 | 0.0164 |
| 2 | chunk-2 | 0.0164 |
| 3 | chunk-3 | 0.0161 |
| 4 | chunk-4 | 0.0161 |
| 5 | chunk-5 | 0.0159 |

**Cross-Encoder Reranked Top 5:**

| Rank | Chunk ID | Reranked Score | Change |
|------|----------|----------------|--------|
| 1 | chunk-3 | 0.2433 | +0.2272 ↑ |
| 2 | chunk-5 | 0.2330 | +0.2171 ↑ |
| 3 | chunk-2 | 0.2101 | +0.1937 ↑ |
| 4 | chunk-1 | 0.1626 | +0.1462 ↑ |
| 5 | chunk-4 | 0.1614 | +0.1453 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1626 | +0.1462 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2101 | +0.1937 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2433 | +0.2272 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1614 | +0.1453 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2330 | +0.2171 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-1 | 1 | 3 | ↓ DOWN |
| chunk-3 | 4 | 1 | ↑ UP |
| chunk-2 | 2 | 5 | ↓ DOWN |
| chunk-5 | 3 | 2 | ↑ UP |
| chunk-3 | 3 | 2 | ↑ UP |
| chunk-2 | 1 | 3 | ↓ DOWN |
| chunk-4 | 4 | 1 | ↑ UP |
| chunk-1 | 5 | 4 | ↑ UP |
| chunk-5 | 5 | 4 | ↑ UP |
| chunk-4 | 2 | 5 | ↓ DOWN |

**Reranking Impact:**
- **Improved scores:** 5 chunks
- **Decreased scores:** 0 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

## Overall Statistics

| Metric | Value |
|--------|-------|
| Queries with rank changes | 5/5 |
| Total ranks moved UP | 22 |
| Total ranks moved DOWN | 18 |

## Score Change Summary (All Queries Combined)

| Category | Count |
|----------|-------|
| Scores IMPROVED (↑) | 25 |
| Scores DECREASED (↓) | 0 |
| Scores UNCHANGED (-) | 0 |

---

*Report generated by test-rerank-validation.ts*
