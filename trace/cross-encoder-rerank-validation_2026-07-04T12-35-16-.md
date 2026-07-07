# Cross-Encoder Reranker Validation Report

**Timestamp:** 2026-07-04T12:35:19.235Z

**Feature Flag Status:** ⚠ MOCK (no HUGGINGFACE_API_KEY)

## Summary

| Metric | Value |
|--------|-------|
| Queries Tested | 5 |
| Total Latency | 2.55s |
| Avg RRFS Latency | 0.20ms |
| Avg Rerank Latency | 158.60ms |
| Avg Score Change | 0.1421 |
| Rank Changes | 19 |

## Latency Comparison (per query)

| Query | RRFS (ms) | Rerank (ms) | Added (ms) |
|-------|-----------|-------------|------------|
| "What is the premium payment term?" | 1.00 | 153.00 | +152.00 |
| "pre-existing conditions" | 0.00 | 156.00 | +156.00 |
| "maturity benefit" | 0.00 | 165.00 | +165.00 |
| "eligibility criteria" | 0.00 | 163.00 | +163.00 |
| "coverage for critical illness" | 0.00 | 156.00 | +156.00 |

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
| 1 | chunk-1 | 0.2918 | +0.2754 ↑ |
| 2 | chunk-2 | 0.2776 | +0.2612 ↑ |
| 3 | chunk-3 | 0.2737 | +0.2576 ↑ |
| 4 | chunk-5 | 0.1126 | +0.0968 ↑ |
| 5 | chunk-4 | 0.0760 | +0.0599 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2918 | +0.2754 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2776 | +0.2612 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2737 | +0.2576 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0760 | +0.0599 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1126 | +0.0968 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-4 | 5 | 4 | ↑ UP |

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
| 1 | chunk-3 | 0.0972 | +0.0811 ↑ |
| 2 | chunk-1 | 0.0745 | +0.0582 ↑ |
| 3 | chunk-4 | 0.0501 | +0.0340 ↑ |
| 4 | chunk-5 | 0.0426 | +0.0267 ↑ |
| 5 | chunk-2 | 0.0319 | +0.0155 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0745 | +0.0582 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0319 | +0.0155 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0972 | +0.0811 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0501 | +0.0340 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0426 | +0.0267 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-3 | 1 | 3 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-4 | 3 | 4 | ↓ DOWN |
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-2 | 5 | 2 | ↑ UP |

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
| 1 | chunk-4 | 0.2902 | +0.2741 ↑ |
| 2 | chunk-1 | 0.2452 | +0.2288 ↑ |
| 3 | chunk-3 | 0.2334 | +0.2173 ↑ |
| 4 | chunk-2 | 0.1967 | +0.1803 ↑ |
| 5 | chunk-5 | 0.1461 | +0.1302 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2452 | +0.2288 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1967 | +0.1803 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2334 | +0.2173 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2902 | +0.2741 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1461 | +0.1302 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-2 | 4 | 2 | ↑ UP |

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
| 1 | chunk-5 | 0.2998 | +0.2839 ↑ |
| 2 | chunk-3 | 0.2660 | +0.2498 ↑ |
| 3 | chunk-4 | 0.2098 | +0.1937 ↑ |
| 4 | chunk-2 | 0.1837 | +0.1673 ↑ |
| 5 | chunk-1 | 0.0201 | +0.0037 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0201 | +0.0037 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1837 | +0.1673 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2660 | +0.2498 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2098 | +0.1937 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2998 | +0.2839 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-5 | 1 | 5 | ↓ DOWN |
| chunk-3 | 2 | 3 | ↓ DOWN |
| chunk-4 | 3 | 4 | ↓ DOWN |
| chunk-2 | 4 | 2 | ↑ UP |
| chunk-1 | 5 | 1 | ↑ UP |

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
| 1 | chunk-4 | 0.2294 | +0.2132 ↑ |
| 2 | chunk-2 | 0.1690 | +0.1526 ↑ |
| 3 | chunk-5 | 0.0967 | +0.0808 ↑ |
| 4 | chunk-3 | 0.0233 | +0.0071 ↑ |
| 5 | chunk-1 | 0.0200 | +0.0036 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0200 | +0.0036 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1690 | +0.1526 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0233 | +0.0071 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2294 | +0.2132 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0967 | +0.0808 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-5 | 3 | 5 | ↓ DOWN |
| chunk-3 | 4 | 3 | ↑ UP |
| chunk-1 | 5 | 1 | ↑ UP |

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
| Total ranks moved UP | 9 |
| Total ranks moved DOWN | 10 |

## Score Change Summary (All Queries Combined)

| Category | Count |
|----------|-------|
| Scores IMPROVED (↑) | 25 |
| Scores DECREASED (↓) | 0 |
| Scores UNCHANGED (-) | 0 |

---

*Report generated by test-rerank-validation.ts*
