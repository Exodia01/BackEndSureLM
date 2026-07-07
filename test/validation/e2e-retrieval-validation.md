# End-to-End Retrieval Validation Report

## Summary

| Metric | Value |
|--------|-------|
| Total Brochures | 5 |
| Processed Successfully | 5 |
| Failed to Process | 0 |
| Total Stages | 11 |
| Passed | 11 |
| Failed | 0 |
| Duration | 53.16s |

## Service Status

| Service | Status |
|---------|--------|
| Qdrant | ✓ Connected |
| PostgreSQL | ✓ Connected |
| Ollama | ✓ Available (nomic-embed-text) |

## Stage Results

| Stage | Status | Duration |
|-------|--------|----------|
| Service Health Check | PASS | 0.37s |
| Process PDF: Kotak-e-Term-Plan-Brochure.pdf | PASS | 12.61s |
| Retrieval Tests for Kotak-e-Term-Plan-Brochure | PASS | 0.26s |
| Process PDF: Kotak-Fortune-Maximiser-Policy-Document.pdf | PASS | 9.26s |
| Retrieval Tests for Kotak-Fortune-Maximiser-Policy-Document | PASS | 0.27s |
| Process PDF: Kotak-platinum-Brochure.pdf | PASS | 6.75s |
| Retrieval Tests for Kotak-platinum-Brochure | PASS | 0.31s |
| Process PDF: KotakHealthShieldBrochure-30112020-min.pdf | PASS | 12.45s |
| Retrieval Tests for KotakHealthShieldBrochure-30112020-min | PASS | 0.51s |
| Process PDF: Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf | PASS | 5.00s |
| Retrieval Tests for Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020 | PASS | 0.23s |

## Retrieval Test Results

### Query: "What is the premium payment term?"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.9312 | cmr5dsd1u000xu8hwfphj07r3 |
| 2 | 0.8679 | cmr5dsd1t000wu8hw6z4reai7 |
| 3 | 0.6406 | cmr5dsd1r000vu8hwuad1doup |
| 4 | 0.5874 | cmr5dsd3b0020u8hwpz45cqfc |
| 5 | 0.5371 | cmr5dsd3c0021u8hw26a451ht |
| 6 | 0.5367 | cmr5dsd1i000ou8hw9vyqx1fe |
| 7 | 0.5303 | cmr5dsd1v000yu8hw0phnv6em |
| 8 | 0.5088 | cmr5dsd3l0028u8hwbquffspe |
| 9 | 0.4428 | cmr5dsd240014u8hwt39jotfv |
| 10 | 0.4058 | cmr5dsd0k0004u8hwwpehazjb |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0091 | 1 |
| 2 | -0.0173 | 2 |
| 3 | -0.0226 | 3 |
| 4 | -0.0275 | 4 |
| 5 | -0.0320 | 5 |
| 6 | -0.0362 | 6 |
| 7 | -0.0401 | 7 |
| 8 | -0.0435 | 8 |
| 9 | -0.0466 | 9 |
| 10 | -0.0493 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "pre-existing conditions"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.8099 | cmr5dsd38001yu8hwn0tviz3d |
| 2 | 0.7245 | cmr5dsd34001uu8hwgylkfaye |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0091 | 1 |
| 2 | -0.0173 | 2 |
| 3 | -0.0226 | 3 |
| 4 | -0.0275 | 4 |
| 5 | -0.0320 | 5 |
| 6 | -0.0362 | 6 |
| 7 | -0.0401 | 7 |
| 8 | -0.0435 | 8 |
| 9 | -0.0466 | 9 |
| 10 | -0.0493 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "maturity benefit"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.1385 | cmr5dsd3u002fu8hwo3v6xh8t |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0091 | 1 |
| 2 | -0.0173 | 2 |
| 3 | -0.0226 | 3 |
| 4 | -0.0275 | 4 |
| 5 | -0.0320 | 5 |
| 6 | -0.0362 | 6 |
| 7 | -0.0401 | 7 |
| 8 | -0.0435 | 8 |
| 9 | -0.0466 | 9 |
| 10 | -0.0493 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "eligibility criteria"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.1759 | cmr5dsd1r000vu8hwuad1doup |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0091 | 1 |
| 2 | -0.0173 | 2 |
| 3 | -0.0226 | 3 |
| 4 | -0.0275 | 4 |
| 5 | -0.0320 | 5 |
| 6 | -0.0362 | 6 |
| 7 | -0.0401 | 7 |
| 8 | -0.0435 | 8 |
| 9 | -0.0466 | 9 |
| 10 | -0.0493 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "What is the premium payment term?"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.6942 | cmr5dsl2z0035u8hwtzmgnuk7 |
| 2 | 0.6930 | cmr5dsl3q003du8hwzpa3ufke |
| 3 | 0.6404 | cmr5dsl3o003cu8hwnu95rexj |
| 4 | 0.5983 | cmr5dsl790066u8hweidsnh62 |
| 5 | 0.3053 | cmr5dsl53004iu8hwarvdxu31 |
| 6 | 0.2955 | cmr5dsl5z0056u8hwg1jkcjii |
| 7 | 0.2002 | cmr5dsl57004lu8hw3si793l7 |
| 8 | 0.1811 | cmr5dsl4e003xu8hwbao4mc43 |
| 9 | 0.1781 | cmr5dsl4g003zu8hwlg5gfme4 |
| 10 | 0.0991 | cmr5dsl52004hu8hwfwzldor9 |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0142 | 2 |
| 2 | 0.0094 | 3 |
| 3 | 0.0052 | 1 |
| 4 | 0.0046 | 4 |
| 5 | -0.0001 | 5 |
| 6 | -0.0048 | 6 |
| 7 | -0.0093 | 7 |
| 8 | -0.0137 | 8 |
| 9 | -0.0179 | 9 |
| 10 | -0.0220 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "pre-existing conditions"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0142 | 2 |
| 2 | 0.0094 | 3 |
| 3 | 0.0052 | 1 |
| 4 | 0.0046 | 4 |
| 5 | -0.0001 | 5 |
| 6 | -0.0048 | 6 |
| 7 | -0.0093 | 7 |
| 8 | -0.0137 | 8 |
| 9 | -0.0179 | 9 |
| 10 | -0.0220 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "maturity benefit"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.2371 | cmr5dsl4l0043u8hw5rlmeq3b |
| 2 | 0.2275 | cmr5dsl6z005xu8hwftp0vmdw |
| 3 | 0.1677 | cmr5dsl3v003hu8hwvozsdzen |
| 4 | 0.1187 | cmr5dsl1z002ru8hwhm7ygbo9 |
| 5 | 0.0992 | cmr5dsl4j0042u8hwsg3f50en |
| 6 | 0.0915 | cmr5dsl8x007ku8hwzec3ju3n |
| 7 | 0.0518 | cmr5dsl50004gu8hwqjt4mkbi |
| 8 | 0.0297 | cmr5dsl5p004zu8hwayzxemkb |
| 9 | 0.0172 | cmr5dsl4z004fu8hwn22oy3kz |
| 10 | 0.0158 | cmr5dsl3h0038u8hwleorg5re |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0142 | 2 |
| 2 | 0.0094 | 3 |
| 3 | 0.0052 | 1 |
| 4 | 0.0046 | 4 |
| 5 | -0.0001 | 5 |
| 6 | -0.0048 | 6 |
| 7 | -0.0093 | 7 |
| 8 | -0.0137 | 8 |
| 9 | -0.0179 | 9 |
| 10 | -0.0220 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "eligibility criteria"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0142 | 2 |
| 2 | 0.0094 | 3 |
| 3 | 0.0052 | 1 |
| 4 | 0.0046 | 4 |
| 5 | -0.0001 | 5 |
| 6 | -0.0048 | 6 |
| 7 | -0.0093 | 7 |
| 8 | -0.0137 | 8 |
| 9 | -0.0179 | 9 |
| 10 | -0.0220 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "What is the premium payment term?"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.5067 | cmr5dsrfg0094u8hwgtw7ngqb |
| 2 | 0.5007 | cmr5dsrfo0098u8hwco0zj46e |
| 3 | 0.4826 | cmr5dsrf4008tu8hwo08rcxc1 |
| 4 | 0.3220 | cmr5dsrff0093u8hw5yg9xakm |
| 5 | 0.3185 | cmr5dsrfp0099u8hwdsw7v7re |
| 6 | 0.3183 | cmr5dsre90084u8hwc536cmji |
| 7 | 0.2683 | cmr5dsrf2008su8hwetngqs1a |
| 8 | 0.2673 | cmr5dsrez008qu8hwe8e1so24 |
| 9 | 0.1988 | cmr5dsrgu00a6u8hwjqcxtcua |
| 10 | 0.0991 | cmr5dsrex008ou8hwleybc2x7 |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0030 | 1 |
| 2 | -0.0051 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0176 | 4 |
| 5 | -0.0235 | 5 |
| 6 | -0.0290 | 6 |
| 7 | -0.0342 | 7 |
| 8 | -0.0391 | 8 |
| 9 | -0.0437 | 9 |
| 10 | -0.0478 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "pre-existing conditions"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0030 | 1 |
| 2 | -0.0051 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0176 | 4 |
| 5 | -0.0235 | 5 |
| 6 | -0.0290 | 6 |
| 7 | -0.0342 | 7 |
| 8 | -0.0391 | 8 |
| 9 | -0.0437 | 9 |
| 10 | -0.0478 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "maturity benefit"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.3380 | cmr5dsrf7008wu8hw9f15yca5 |
| 2 | 0.2181 | cmr5dsrhy00b2u8hwhhxahj2c |
| 3 | 0.1889 | cmr5dsrh600agu8hw5stwcbdk |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0030 | 1 |
| 2 | -0.0051 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0176 | 4 |
| 5 | -0.0235 | 5 |
| 6 | -0.0290 | 6 |
| 7 | -0.0342 | 7 |
| 8 | -0.0391 | 8 |
| 9 | -0.0437 | 9 |
| 10 | -0.0478 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "eligibility criteria"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0030 | 1 |
| 2 | -0.0051 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0176 | 4 |
| 5 | -0.0235 | 5 |
| 6 | -0.0290 | 6 |
| 7 | -0.0342 | 7 |
| 8 | -0.0391 | 8 |
| 9 | -0.0437 | 9 |
| 10 | -0.0478 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "What is the premium payment term?"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.8795 | cmr5dt1kn00czu8hwwthv3d30 |
| 2 | 0.3354 | cmr5dt1zw00g9u8hwk6iackkb |
| 3 | 0.0985 | cmr5dt1zk00g5u8hwcl2sjidr |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0034 | 1 |
| 2 | -0.0085 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0142 | 4 |
| 5 | -0.0168 | 5 |
| 6 | -0.0192 | 6 |
| 7 | -0.0214 | 7 |
| 8 | -0.0234 | 8 |
| 9 | -0.0253 | 9 |
| 10 | -0.0269 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "pre-existing conditions"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.9433 | cmr5dt1zb00g3u8hwpqnwkgvh |
| 2 | 0.4636 | cmr5dt1zg00g4u8hwlm94kros |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0034 | 1 |
| 2 | -0.0085 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0142 | 4 |
| 5 | -0.0168 | 5 |
| 6 | -0.0192 | 6 |
| 7 | -0.0214 | 7 |
| 8 | -0.0234 | 8 |
| 9 | -0.0253 | 9 |
| 10 | -0.0269 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "maturity benefit"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.2657 | cmr5dt1zk00g5u8hwcl2sjidr |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0034 | 1 |
| 2 | -0.0085 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0142 | 4 |
| 5 | -0.0168 | 5 |
| 6 | -0.0192 | 6 |
| 7 | -0.0214 | 7 |
| 8 | -0.0234 | 8 |
| 9 | -0.0253 | 9 |
| 10 | -0.0269 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "eligibility criteria"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0991 | cmr5dt1kn00czu8hwwthv3d30 |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0034 | 1 |
| 2 | -0.0085 | 2 |
| 3 | -0.0115 | 3 |
| 4 | -0.0142 | 4 |
| 5 | -0.0168 | 5 |
| 6 | -0.0192 | 6 |
| 7 | -0.0214 | 7 |
| 8 | -0.0234 | 8 |
| 9 | -0.0253 | 9 |
| 10 | -0.0269 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "What is the premium payment term?"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.9116 | cmr5dt75x00h9u8hwu4ok211x |
| 2 | 0.8445 | cmr5dt75c00gru8hw6ospbzwj |
| 3 | 0.6413 | cmr5dt75r00h3u8hw7lp67yel |
| 4 | 0.5796 | cmr5dt75a00gqu8hwsrtt7blb |
| 5 | 0.5476 | cmr5dt75e00gtu8hwa51sen15 |
| 6 | 0.5115 | cmr5dt75i00gwu8hwbxc83jvq |
| 7 | 0.4674 | cmr5dt76900hku8hw5zpnesc0 |
| 8 | 0.4647 | cmr5dt76v00i4u8hw4y9xla35 |
| 9 | 0.4647 | cmr5dt75y00hau8hwbl8cd7li |
| 10 | 0.3676 | cmr5dt75n00h0u8hwzzbhr4w1 |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0092 | 1 |
| 2 | -0.0037 | 2 |
| 3 | -0.0144 | 3 |
| 4 | -0.0247 | 4 |
| 5 | -0.0346 | 5 |
| 6 | -0.0440 | 6 |
| 7 | -0.0528 | 7 |
| 8 | -0.0612 | 8 |
| 9 | -0.0690 | 9 |
| 10 | -0.0763 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "pre-existing conditions"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0092 | 1 |
| 2 | -0.0037 | 2 |
| 3 | -0.0144 | 3 |
| 4 | -0.0247 | 4 |
| 5 | -0.0346 | 5 |
| 6 | -0.0440 | 6 |
| 7 | -0.0528 | 7 |
| 8 | -0.0612 | 8 |
| 9 | -0.0690 | 9 |
| 10 | -0.0763 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "maturity benefit"

**FTS Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.4582 | cmr5dt76700hiu8hwndif584h |
| 2 | 0.3549 | cmr5dt75o00h1u8hwij2e2wzv |
| 3 | 0.2569 | cmr5dt75d00gsu8hwqsr018ah |
| 4 | 0.1878 | cmr5dt76300heu8hwb8mh0ezm |
| 5 | 0.1369 | cmr5dt76v00i4u8hw4y9xla35 |
| 6 | 0.1096 | cmr5dt76600hhu8hwhq5dc8mj |
| 7 | 0.0915 | cmr5dt75l00gyu8hwfksh8d9n |
| 8 | 0.0538 | cmr5dt76h00hru8hw9plmeas4 |
| 9 | 0.0087 | cmr5dt75a00gqu8hwsrtt7blb |
| 10 | 0.0022 | cmr5dt75y00hau8hwbl8cd7li |

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0092 | 1 |
| 2 | -0.0037 | 2 |
| 3 | -0.0144 | 3 |
| 4 | -0.0247 | 4 |
| 5 | -0.0346 | 5 |
| 6 | -0.0440 | 6 |
| 7 | -0.0528 | 7 |
| 8 | -0.0612 | 8 |
| 9 | -0.0690 | 9 |
| 10 | -0.0763 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---

### Query: "eligibility criteria"

**FTS Results (Top 10):**

*No results*

**Vector Search Results (Top 10):**

| Rank | Score | Chunk ID |
|------|-------|----------|
| 1 | 0.0092 | 1 |
| 2 | -0.0037 | 2 |
| 3 | -0.0144 | 3 |
| 4 | -0.0247 | 4 |
| 5 | -0.0346 | 5 |
| 6 | -0.0440 | 6 |
| 7 | -0.0528 | 7 |
| 8 | -0.0612 | 8 |
| 9 | -0.0690 | 9 |
| 10 | -0.0763 | 10 |

**RRF Merged & Reranked (Top 10):**

| Rank | Source | RRFS Score | Relevance |
|------|--------|------------|-----------|
| 1 | postgres_fts | 0.0164 | high |
| 2 | postgres_fts | 0.0161 | high |
| 3 | postgres_fts | 0.0159 | high |
| 4 | postgres_fts | 0.0156 | high |
| 5 | postgres_fts | 0.0154 | high |
| 6 | postgres_fts | 0.0152 | high |
| 7 | postgres_fts | 0.0149 | high |
| 8 | postgres_fts | 0.0147 | high |
| 9 | postgres_fts | 0.0145 | high |
| 10 | postgres_fts | 0.0143 | high |

---


## Citations (Sample Chunks)

**Query:** "What is the premium payment term?"

| Text | Source | Relevance |
|------|--------|-----------|
| not be available for Online Channel)
The following modal loadings shall be used to calculate the instalment
premium in case of Regular and Limited Premium Payment Options:
Premium Payment Term Premium... | postgres_fts | high |
| 7 and 15 Pay shall not be available for Online Channel
Single Pay:
One Time Payment Min: 5 Years
Max:
Life Option: Highest of 40
Years or 75 Years less Age at Entry or
85 Years less Age at Entry
Life ... | postgres_fts | high |
| r 75 Years less Age at Entry
or 85 years less Age at Entry
Life Plus Option: Higher of 40 Years or
75 Years less Age at Entry
Premium Payment Term Policy Term
Eligibility:
18 years
23 years
Eligibilit... | postgres_fts | high |
| e due date for payment of premium for the yearly,

-- 15 of 20 --

half-yearly and quarterly mode. For the monthly mode there is a grace period of 15 days. During
this period the policy will be consid... | postgres_fts | high |
| ular/Limited/Single) and premium payment mode of the rider should be same as that of
Base Plan. For more details on the Rider, please refer to the rider brochure.
11. Lapse:
Regular & Limited Premium ... | postgres_fts | high |

---

*Report generated by e2e-retrieval-validation.ts*
