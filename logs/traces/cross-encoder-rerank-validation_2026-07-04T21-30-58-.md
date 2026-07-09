# Cross-Encoder Reranker Validation Report

**Timestamp:** 2026-07-04T21:31:00.403Z

**Feature Flag Status:** ⚠ MOCK (no HUGGINGFACE_API_KEY)

## Summary

| Metric | Value |
|--------|-------|
| Queries Tested | 5 |
| Total Latency | 1.90s |
| Avg RRFS Latency | 0.00ms |
| Avg Rerank Latency | 161.00ms |
| Avg Score Change | 0.1375 |
| Rank Changes | 19 |

## Latency Comparison (per query)

| Query | RRFS (ms) | Rerank (ms) | Added (ms) |
|-------|-----------|-------------|------------|
| "What is the premium payment term?" | 0.00 | 161.00 | +161.00 |
| "pre-existing conditions" | 0.00 | 158.00 | +158.00 |
| "maturity benefit" | 0.00 | 158.00 | +158.00 |
| "eligibility criteria" | 0.00 | 163.00 | +163.00 |
| "coverage for critical illness" | 0.00 | 165.00 | +165.00 |

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
| 1 | chunk-4 | 0.2849 | +0.2688 ↑ |
| 2 | chunk-1 | 0.2457 | +0.2293 ↑ |
| 3 | chunk-3 | 0.2443 | +0.2282 ↑ |
| 4 | chunk-5 | 0.1884 | +0.1725 ↑ |
| 5 | chunk-2 | 0.1800 | +0.1636 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2457 | +0.2293 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1800 | +0.1636 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2443 | +0.2282 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2849 | +0.2688 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1884 | +0.1725 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-2 | 5 | 2 | ↑ UP |

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
| 1 | chunk-1 | 0.2140 | +0.1976 ↑ |
| 2 | chunk-2 | 0.1449 | +0.1285 ↑ |
| 3 | chunk-5 | 0.1279 | +0.1121 ↑ |
| 4 | chunk-4 | 0.1119 | +0.0957 ↑ |
| 5 | chunk-3 | 0.0377 | +0.0216 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2140 | +0.1976 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1449 | +0.1285 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0377 | +0.0216 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1119 | +0.0957 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1279 | +0.1121 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-5 | 3 | 5 | ↓ DOWN |
| chunk-3 | 5 | 3 | ↑ UP |

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
| 1 | chunk-5 | 0.2474 | +0.2315 ↑ |
| 2 | chunk-1 | 0.2255 | +0.2091 ↑ |
| 3 | chunk-2 | 0.1115 | +0.0951 ↑ |
| 4 | chunk-4 | 0.1079 | +0.0918 ↑ |
| 5 | chunk-3 | 0.0960 | +0.0798 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2255 | +0.2091 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1115 | +0.0951 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0960 | +0.0798 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1079 | +0.0918 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2474 | +0.2315 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-5 | 1 | 5 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-2 | 3 | 2 | ↑ UP |
| chunk-3 | 5 | 3 | ↑ UP |

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
| 1 | chunk-4 | 0.2150 | +0.1988 ↑ |
| 2 | chunk-3 | 0.1729 | +0.1568 ↑ |
| 3 | chunk-1 | 0.1258 | +0.1094 ↑ |
| 4 | chunk-2 | 0.1011 | +0.0847 ↑ |
| 5 | chunk-5 | 0.0486 | +0.0328 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1258 | +0.1094 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1011 | +0.0847 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1729 | +0.1568 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2150 | +0.1988 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0486 | +0.0328 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-3 | 2 | 3 | ↓ DOWN |
| chunk-1 | 3 | 1 | ↑ UP |
| chunk-2 | 4 | 2 | ↑ UP |

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
| 1 | chunk-3 | 0.1967 | +0.1806 ↑ |
| 2 | chunk-4 | 0.1699 | +0.1538 ↑ |
| 3 | chunk-5 | 0.1249 | +0.1091 ↑ |
| 4 | chunk-1 | 0.0869 | +0.0705 ↑ |
| 5 | chunk-2 | 0.0013 | -0.0151 ↓ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0869 | +0.0705 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0013 | -0.0151 | ↓ DECREased |
| chunk-3 | 0.0161 | 0.1967 | +0.1806 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1699 | +0.1538 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1249 | +0.1091 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-3 | 1 | 3 | ↓ DOWN |
| chunk-4 | 2 | 4 | ↓ DOWN |
| chunk-5 | 3 | 5 | ↓ DOWN |
| chunk-1 | 4 | 1 | ↑ UP |
| chunk-2 | 5 | 2 | ↑ UP |

**Reranking Impact:**
- **Improved scores:** 4 chunks
- **Decreased scores:** 1 chunks
- **No change:** 0 chunks
- **Rank order changed:** YES

---

## Overall Statistics

| Metric | Value |
|--------|-------|
| Queries with rank changes | 5/5 |
| Total ranks moved UP | 10 |
| Total ranks moved DOWN | 9 |

## Score Change Summary (All Queries Combined)

| Category | Count |
|----------|-------|
| Scores IMPROVED (↑) | 24 |
| Scores DECREASED (↓) | 1 |
| Scores UNCHANGED (-) | 0 |

---

*Report generated by test-rerank-validation.ts*
