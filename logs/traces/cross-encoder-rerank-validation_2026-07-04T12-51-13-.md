# Cross-Encoder Reranker Validation Report

**Timestamp:** 2026-07-04T12:51:14.781Z

**Feature Flag Status:** ⚠ MOCK (no HUGGINGFACE_API_KEY)

## Summary

| Metric | Value |
|--------|-------|
| Queries Tested | 5 |
| Total Latency | 1.23s |
| Avg RRFS Latency | 0.00ms |
| Avg Rerank Latency | 154.80ms |
| Avg Score Change | 0.1147 |
| Rank Changes | 22 |

## Latency Comparison (per query)

| Query | RRFS (ms) | Rerank (ms) | Added (ms) |
|-------|-----------|-------------|------------|
| "What is the premium payment term?" | 0.00 | 162.00 | +162.00 |
| "pre-existing conditions" | 0.00 | 152.00 | +152.00 |
| "maturity benefit" | 0.00 | 155.00 | +155.00 |
| "eligibility criteria" | 0.00 | 151.00 | +151.00 |
| "coverage for critical illness" | 0.00 | 154.00 | +154.00 |

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
| 1 | chunk-2 | 0.1619 | +0.1455 ↑ |
| 2 | chunk-4 | 0.0610 | +0.0449 ↑ |
| 3 | chunk-1 | 0.0516 | +0.0352 ↑ |
| 4 | chunk-3 | 0.0424 | +0.0262 ↑ |
| 5 | chunk-5 | 0.0171 | +0.0013 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0516 | +0.0352 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1619 | +0.1455 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0424 | +0.0262 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0610 | +0.0449 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0171 | +0.0013 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-2 | 1 | 2 | ↓ DOWN |
| chunk-4 | 2 | 4 | ↓ DOWN |
| chunk-1 | 3 | 1 | ↑ UP |
| chunk-3 | 4 | 3 | ↑ UP |

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
| 1 | chunk-3 | 0.2953 | +0.2791 ↑ |
| 2 | chunk-5 | 0.2857 | +0.2698 ↑ |
| 3 | chunk-2 | 0.1225 | +0.1061 ↑ |
| 4 | chunk-1 | 0.0403 | +0.0239 ↑ |
| 5 | chunk-4 | 0.0189 | +0.0028 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0403 | +0.0239 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1225 | +0.1061 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2953 | +0.2791 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0189 | +0.0028 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2857 | +0.2698 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-3 | 1 | 3 | ↓ DOWN |
| chunk-5 | 2 | 5 | ↓ DOWN |
| chunk-2 | 3 | 2 | ↑ UP |
| chunk-1 | 4 | 1 | ↑ UP |
| chunk-4 | 5 | 4 | ↑ UP |

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
| 1 | chunk-2 | 0.1853 | +0.1689 ↑ |
| 2 | chunk-4 | 0.0812 | +0.0651 ↑ |
| 3 | chunk-1 | 0.0413 | +0.0249 ↑ |
| 4 | chunk-3 | 0.0352 | +0.0191 ↑ |
| 5 | chunk-5 | 0.0164 | +0.0005 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0413 | +0.0249 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1853 | +0.1689 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0352 | +0.0191 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0812 | +0.0651 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0164 | +0.0005 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-2 | 1 | 2 | ↓ DOWN |
| chunk-4 | 2 | 4 | ↓ DOWN |
| chunk-1 | 3 | 1 | ↑ UP |
| chunk-3 | 4 | 3 | ↑ UP |

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
| 1 | chunk-2 | 0.2779 | +0.2615 ↑ |
| 2 | chunk-1 | 0.1737 | +0.1573 ↑ |
| 3 | chunk-4 | 0.1422 | +0.1261 ↑ |
| 4 | chunk-3 | 0.1413 | +0.1252 ↑ |
| 5 | chunk-5 | 0.1196 | +0.1037 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1737 | +0.1573 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2779 | +0.2615 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1413 | +0.1252 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1422 | +0.1261 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1196 | +0.1037 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-2 | 1 | 2 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-4 | 3 | 4 | ↓ DOWN |
| chunk-3 | 4 | 3 | ↑ UP |

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
| 1 | chunk-4 | 0.2945 | +0.2783 ↑ |
| 2 | chunk-5 | 0.2769 | +0.2611 ↑ |
| 3 | chunk-2 | 0.2033 | +0.1869 ↑ |
| 4 | chunk-1 | 0.1443 | +0.1279 ↑ |
| 5 | chunk-3 | 0.0426 | +0.0264 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1443 | +0.1279 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2033 | +0.1869 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.0426 | +0.0264 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2945 | +0.2783 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.2769 | +0.2611 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-5 | 2 | 5 | ↓ DOWN |
| chunk-2 | 3 | 2 | ↑ UP |
| chunk-1 | 4 | 1 | ↑ UP |
| chunk-3 | 5 | 3 | ↑ UP |

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
| Total ranks moved UP | 12 |
| Total ranks moved DOWN | 10 |

## Score Change Summary (All Queries Combined)

| Category | Count |
|----------|-------|
| Scores IMPROVED (↑) | 25 |
| Scores DECREASED (↓) | 0 |
| Scores UNCHANGED (-) | 0 |

---

*Report generated by test-rerank-validation.ts*
