# Cross-Encoder Reranker Validation Report

**Timestamp:** 2026-07-04T12:49:15.676Z

**Feature Flag Status:** ⚠ MOCK (no HUGGINGFACE_API_KEY)

## Summary

| Metric | Value |
|--------|-------|
| Queries Tested | 5 |
| Total Latency | 1.31s |
| Avg RRFS Latency | 0.00ms |
| Avg Rerank Latency | 154.80ms |
| Avg Score Change | 0.1373 |
| Rank Changes | 23 |

## Latency Comparison (per query)

| Query | RRFS (ms) | Rerank (ms) | Added (ms) |
|-------|-----------|-------------|------------|
| "What is the premium payment term?" | 0.00 | 154.00 | +154.00 |
| "pre-existing conditions" | 0.00 | 156.00 | +156.00 |
| "maturity benefit" | 0.00 | 151.00 | +151.00 |
| "eligibility criteria" | 0.00 | 162.00 | +162.00 |
| "coverage for critical illness" | 0.00 | 151.00 | +151.00 |

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
| 1 | chunk-1 | 0.2717 | +0.2553 ↑ |
| 2 | chunk-5 | 0.2404 | +0.2245 ↑ |
| 3 | chunk-3 | 0.1533 | +0.1372 ↑ |
| 4 | chunk-2 | 0.1336 | +0.1172 ↑ |
| 5 | chunk-4 | 0.0067 | -0.0094 ↓ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2717 | +0.2553 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1336 | +0.1172 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1533 | +0.1372 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0067 | -0.0094 | ↓ DECREased |
| chunk-5 | 0.0159 | 0.2404 | +0.2245 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-5 | 2 | 5 | ↓ DOWN |
| chunk-2 | 4 | 2 | ↑ UP |
| chunk-4 | 5 | 4 | ↑ UP |

**Reranking Impact:**
- **Improved scores:** 4 chunks
- **Decreased scores:** 1 chunks
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
| 1 | chunk-3 | 0.2930 | +0.2769 ↑ |
| 2 | chunk-4 | 0.2628 | +0.2467 ↑ |
| 3 | chunk-2 | 0.0949 | +0.0785 ↑ |
| 4 | chunk-5 | 0.0669 | +0.0510 ↑ |
| 5 | chunk-1 | 0.0572 | +0.0408 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.0572 | +0.0408 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0949 | +0.0785 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2930 | +0.2769 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2628 | +0.2467 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0669 | +0.0510 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-3 | 1 | 3 | ↓ DOWN |
| chunk-4 | 2 | 4 | ↓ DOWN |
| chunk-2 | 3 | 2 | ↑ UP |
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-1 | 5 | 1 | ↑ UP |

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
| 1 | chunk-2 | 0.2956 | +0.2793 ↑ |
| 2 | chunk-3 | 0.2879 | +0.2717 ↑ |
| 3 | chunk-1 | 0.2019 | +0.1855 ↑ |
| 4 | chunk-5 | 0.0614 | +0.0455 ↑ |
| 5 | chunk-4 | 0.0208 | +0.0047 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.2019 | +0.1855 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.2956 | +0.2793 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.2879 | +0.2717 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.0208 | +0.0047 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.0614 | +0.0455 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-2 | 1 | 2 | ↓ DOWN |
| chunk-3 | 2 | 3 | ↓ DOWN |
| chunk-1 | 3 | 1 | ↑ UP |
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-4 | 5 | 4 | ↑ UP |

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
| 1 | chunk-4 | 0.2217 | +0.2056 ↑ |
| 2 | chunk-3 | 0.1865 | +0.1703 ↑ |
| 3 | chunk-1 | 0.1748 | +0.1584 ↑ |
| 4 | chunk-5 | 0.1424 | +0.1265 ↑ |
| 5 | chunk-2 | 0.0278 | +0.0114 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1748 | +0.1584 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.0278 | +0.0114 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1865 | +0.1703 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.2217 | +0.2056 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1424 | +0.1265 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-3 | 2 | 3 | ↓ DOWN |
| chunk-1 | 3 | 1 | ↑ UP |
| chunk-5 | 4 | 5 | ↓ DOWN |
| chunk-2 | 5 | 2 | ↑ UP |

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
| 1 | chunk-4 | 0.1460 | +0.1299 ↑ |
| 2 | chunk-1 | 0.1452 | +0.1288 ↑ |
| 3 | chunk-2 | 0.1155 | +0.0991 ↑ |
| 4 | chunk-5 | 0.1072 | +0.0913 ↑ |
| 5 | chunk-3 | 0.1040 | +0.0879 ↑ |

**Score Changes per Chunk:**

| Chunk ID | RRFS Score | Reranked Score | Δ Change | Direction |
|----------|------------|----------------|----------|-----------|
| chunk-1 | 0.0164 | 0.1452 | +0.1288 | ↑ IMPROVED |
| chunk-2 | 0.0164 | 0.1155 | +0.0991 | ↑ IMPROVED |
| chunk-3 | 0.0161 | 0.1040 | +0.0879 | ↑ IMPROVED |
| chunk-4 | 0.0161 | 0.1460 | +0.1299 | ↑ IMPROVED |
| chunk-5 | 0.0159 | 0.1072 | +0.0913 | ↑ IMPROVED |

**Rank Position Changes:**

| Chunk ID | Old Rank | New Rank | Direction |
|----------|----------|----------|-----------|
| chunk-4 | 1 | 4 | ↓ DOWN |
| chunk-1 | 2 | 1 | ↑ UP |
| chunk-2 | 3 | 2 | ↑ UP |
| chunk-5 | 4 | 5 | ↓ DOWN |
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
| Total ranks moved UP | 11 |
| Total ranks moved DOWN | 12 |

## Score Change Summary (All Queries Combined)

| Category | Count |
|----------|-------|
| Scores IMPROVED (↑) | 24 |
| Scores DECREASED (↓) | 1 |
| Scores UNCHANGED (-) | 0 |

---

*Report generated by test-rerank-validation.ts*
