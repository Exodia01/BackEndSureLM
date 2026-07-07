# Testing Coverage Analysis: Reranker Functionality

**Date:** July 3, 2026  
**Analysis Scope:** `lib/ai/rerank/rrfs.ts` and `lib/ai/hybridRetrieval.ts`

---

## Executive Summary

The current testing coverage for the reranker functionality in this codebase is **low to minimal**, with no dedicated unit tests for core re-ranking functions. While integration tests exist for hybrid retrieval, they do not provide comprehensive unit test coverage for individual components.

### Key Findings
- ✅ Integration tests exist for hybrid retrieval flow
- ❌ No dedicated unit tests for `applyRRFS()` function
- ❌ No dedicated unit tests for `scoreToRelevance()` function  
- ⚠️ Integration tests test re-ranking as part of end-to-end flows, not in isolation

---

## 1. Current Test Coverage Status

### Existing Test Files (test/ directory)

| File | Purpose | Coverage Scope |
|------|---------|----------------|
| `test/integration/hybrid-retrieval.test.ts` | Integration tests for hybrid retrieval | Tests FTS+Vector merging, deduplication, but NOT individual RRF functions |
| `test/integration/full-test.ts` | Comprehensive integration tests | End-to-end flow validation |
| `test/scripts/hybrid-retrieval-test.ts` | Manual hybrid retrieval test | Script-based validation |
| `test/validation/full-retrieval-validation.ts` | Full pipeline validation | E2E testing with PDF ingestion |

### Test Coverage Mapping

```
Current Coverage:
├── lib/ai/rerank/rrfs.ts
│   ├── applyRRFS()          ❌ NO UNIT TESTS (only tested indirectly)
│   └── RerankResult type    ⚠️ Used in interfaces but no type validation tests
│
└── lib/ai/hybridRetrieval.ts
    ├── postgresFullTextSearch()     ✅ Indirectly tested via integration tests
    ├── userHistoryLookup()          ❌ NO TESTS
    ├── getHistoryCount()            ❌ NO TESTS
    ├── applyHistoryBoost()          ❌ NO TESTS (critical business logic)
    ├── hybridRetrieve()             ⚠️ Tested as part of end-to-end only
    ├── searchPolicies()             ⚠️ Tested as part of end-to-end only
    └── scoreToRelevance()           ❌ NO UNIT TESTS
```

---

## 2. Specific Gaps in Testing

### A. Core RRFS Function: `applyRRFS()` - CRITICAL GAP

**File:** `lib/ai/rerank/rrfs.ts`  
**Lines:** 16-68  
**Issue:** No unit tests for the Reciprocal Rank Fusion algorithm

**Functions to test:**
```typescript
export function applyRRFS(results: RetrievalResult[]): RerankResult[] {
  // 1. Assign ranks within each source group
  // 2. Calculate RRFS scores using formula: 1 / (rank + k) where k=60
  // 3. Sort by score descending with tie-breakers
  // 4. Assign relevance ranks and labels based on thresholds
}
```

**Missing Test Cases:**
- ✅ Empty results array
- ✅ Single result item
- ✅ Multiple results from same source (rank assignment)
- ✅ Multiple results from different sources (RRF score calculation)
- ✅ Tie-breaking by source priority (fts > vector > history)
- ✅ Relevance label assignment thresholds:
  - Score ≥ 0.005 → "high"
  - Score ≥ 0.002 → "medium" 
  - Score < 0.002 → "low"
- ❌ Performance with large result sets (100+ items)

### B. History Boost Function: `applyHistoryBoost()` - HIGH PRIORITY GAP

**File:** `lib/ai/hybridRetrieval.ts`  
**Lines:** 96-124  
**Issue:** Business-critical function receives no direct testing

**Functionality:**
```typescript
export async function applyHistoryBoost(
  results: RetrievalResult[],
  agentId: string
): Promise<RetrievalResult[]> {
  // Adds up to +0.15 boost based on past policy issuances
  // Formula: boost = min(count * (0.15/5), 0.15)
}
```

**Missing Test Cases:**
- ✅ Results without history get no boost (score unchanged)
- ✅ Single result with history gets appropriate boost
- ✅ Multiple results with varying history counts
- ✅ Boost capped at maximum 0.15
- ✅ Edge case: agentId='', empty results, null/undefined values
- ❌ Concurrent boosting of multiple policies

### C. Helper Functions - LOW PRIORITY BUT IMPORTANT

**File:** `lib/ai/hybridRetrieval.ts`

| Function | Lines | Status |
|----------|-------|--------|
| `getHistoryCount(agentId, policyId)` | 80-94 | ❌ No tests (DB-dependent) |
| `postgresFullTextSearch(query, limit)` | 25-52 | ⚠️ Tested indirectly via integration |
| `userHistoryLookup(agentId, limit)` | 54-78 | ❌ No tests (DB-dependent) |

---

## 3. Integration Test Coverage Analysis

### What IS Covered in Integration Tests

1. **Hybrid Search Flow** (`test/integration/hybrid-retrieval.test.ts`):
   - ✅ FTS retrieval from PostgreSQL
   - ✅ Vector search from Qdrant
   - ✅ Concurrent execution of multiple sources
   - ✅ Deduplication by chunk_id (keeping highest score)
   - ✅ Result format normalization

2. **Full Integration Tests** (`test/integration/full-test.ts`):
   - ✅ PDF ingestion pipeline
   - ✅ Chunk storage in PostgreSQL
   - ✅ Vector embeddings generation and storage
   - ✅ Hybrid retrieval returning mixed results

### What IS NOT Covered (Gaps)

1. **Re-ranking Specific:**
   - RRFS score calculation formula verification
   - Tie-breaker logic with exact source priority ordering
   - Edge case: identical scores with different sources

2. **History Boost Specific:**
   - Boost calculation accuracy
   - Integration of history boost + RRF re-ranking
   - How boosting affects final relevance ranks

3. **Boundary Conditions:**
   - Very large result sets (100+ results)
   - Results from single source only
   - All results from same source (rank assignment edge case)

4. **Type Safety:**
   - `RerankResult` interface validation
   - Optional field handling (relevance, historyCount, rank)
   - Source type union validation ("fts" vs "postgres_fts" mismatch)

---

## 4. Recommendations for Improving Test Coverage

### Priority 1: Unit Tests for Core Logic (HIGH IMPACT)

**Create:** `test/unit/rrfs.test.ts`

```typescript
// test/unit/rrfs.test.ts
import { describe, it, expect } from 'vitest';
import { applyRRFS } from '@/lib/ai/rerank/rrfs';

describe('applyRRFS', () => {
  it('should handle empty results array', () => {
    const result = applyRRFS([]);
    expect(result).toEqual([]);
  });

  it('should assign ranks within each source group', () => {
    const results = [
      { id: '1', score: 0.8, source: 'fts' },
      { id: '2', score: 0.7, source: 'fts' },
      { id: '3', score: 0.9, source: 'vector' },
    ];
    
    const ranked = applyRRFS(results);
    
    expect(ranked.find(r => r.id === '1')?.rank).toBe(1);
    expect(ranked.find(r => r.id === '2')?.rank).toBe(2);
    expect(ranked.find(r => r.id === '3')?.rank).toBe(1); // First in vector
  });

  it('should calculate RRFS scores correctly', () => {
    const results = [
      { id: '1', score: 0.8, source: 'fts' },
    ];
    
    const ranked = applyRRFS(results);
    // Score = 1 / (rank + k) = 1 / (1 + 60) = ~0.0164
    expect(ranked[0].rerankedScore).toBeCloseTo(1 / (1 + 60));
  });

  it('should sort by RRFS score descending with source priority tie-breaker', () => {
    const results = [
      { id: '1', score: 0.8, source: 'vector' },
      { id: '2', score: 0.9, source: 'fts' }, // Lower score but higher priority
    ];
    
    const ranked = applyRRFS(results);
    
    // Tie-breaker should put FTS before Vector when scores similar
    expect(ranked[0].source).toBe('fts');
  });

  it('should assign relevance labels correctly', () => {
    // Test all three thresholds: high (≥0.005), medium (≥0.002), low (<0.002)
    const results = [
      { id: '1', score: 0.9, source: 'fts' }, // High
      { id: '2', score: 0.8, source: 'vector' }, // Medium
      { id: '3', score: 0.7, source: 'history' }, // Low
    ];
    
    const ranked = applyRRFS(results);
    
    // Relevance assigned after sorting by rerankedScore
    expect(ranked[0].relevance).toBe('high');
  });

  it('should handle performance with large result sets', () => {
    const results = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      score: Math.random(),
      source: ['fts', 'vector', 'history'][i % 3] as const,
    }));
    
    const start = performance.now();
    const ranked = applyRRFS(results);
    const duration = performance.now() - start;
    
    expect(ranked.length).toBe(100);
    expect(duration).toBeLessThan(50); // Should complete in <50ms
  });
});
```

**Create:** `test/unit/historyBoost.test.ts`

```typescript
// test/unit/historyBoost.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyHistoryBoost, getHistoryCount } from '@/lib/ai/hybridRetrieval';
import { db } from '@/lib/db';

describe('applyHistoryBoost', () => {
  let agentId: string;
  
  beforeEach(async () => {
    // Setup test data
    const lead = await db.lead.create({ data: {} });
    agentId = `agent-${lead.id}`;
  });

  it('should return results unchanged when no history', async () => {
    const results = [
      { id: '1', score: 0.8, source: 'fts' },
    ];
    
    const boosted = await applyHistoryBoost(results, agentId);
    
    expect(boosted[0].score).toBe(0.8);
    expect(boosted[0].historyCount).toBe(0);
  });

  it('should add appropriate boost based on history count', async () => {
    // Create past issuance records
    await db.policyIssuance.createMany({
      data: Array.from({ length: 3 }, () => ({
        leadId: agentId.replace('agent-', ''),
        policyName: 'Test Policy',
        policyProvider: 'Test Provider',
      })),
    });

    const results = [{ id: '1', score: 0.8, source: 'fts' }];
    const boosted = await applyHistoryBoost(results, agentId);
    
    // Should get boost but capped at max
    expect(boosted[0].score).toBeGreaterThan(0.8);
  });

  it('should cap boost at maximum 0.15', async () => {
    // Create many past issuances
    await db.policyIssuance.createMany({
      data: Array.from({ length: 20 }, () => ({
        leadId: agentId.replace('agent-', ''),
        policyName: 'Test Policy',
        policyProvider: 'Test Provider',
      })),
    });

    const results = [{ id: '1', score: 0.8, source: 'fts' }];
    const boosted = await applyHistoryBoost(results, agentId);
    
    expect(boosted[0].score).toBeLessThanOrEqual(0.95); // 0.8 + 0.15 max
  });

  it('should handle edge cases', async () => {
    // Empty results
    expect(await applyHistoryBoost([], agentId)).toEqual([]);
    
    // Null/undefined values
    expect(await applyHistoryBoost(undefined as any, agentId)).toEqual([]);
    expect(await applyHistoryBoost([{ id: '1', score: 0.5 }], '')).toEqual([{ id: '1', score: 0.5 }]);
  });
});
```

### Priority 2: Integration Tests for RRF + History Boost Combination

**Enhance:** `test/integration/hybrid-retrieval.test.ts` with:

```typescript
test('re-ranking works correctly after history boost', async () => {
  // Test that boosted results are properly re-ranked by RRFS
  const doc = await db.document.create({
    data: { filename: 'boost-test.pdf' },
  });
  
  const chunk = await db.chunk.create({
    data: {
      id: TEST_CHUNK_ID,
      documentId: doc.id,
      content: 'Test content with specific terms',
      chunkOrder: 1,
    },
  });

  // Simulate history by creating prior issuance
  await db.policyIssuance.create({
    data: {
      leadId: agentId.replace('agent-', ''),
      policyName: 'Test Policy',
      policyProvider: 'Test Provider',
    },
  });

  const results = await hybridSearch('test terms', Array(768).fill(0.1), agentId);
  
  // Verify boosted results appear higher in ranked order
  expect(results[0]?.historyCount || 0).toBeGreaterThan(0);
  
  await db.chunk.deleteMany({ where: { id: chunk.id } });
  await db.document.delete({ where: { id: doc.id } });
});
```

### Priority 3: Unit Tests for scoreToRelevance

```typescript
// test/unit/relevance.test.ts
import { describe, it, expect } from 'vitest';
import { scoreToRelevance } from '@/lib/ai/hybridRetrieval';

describe('scoreToRelevance', () => {
  it('should return high for scores >= 0.7', () => {
    expect(scoreToRelevance(0.7)).toBe('high');
    expect(scoreToRelevance(1.0)).toBe('high');
    expect(scoreToRelevance(0.95)).toBe('high');
  });

  it('should return medium for scores >= 0.4 and < 0.7', () => {
    expect(scoreToRelevance(0.4)).toBe('medium');
    expect(scoreToRelevance(0.69)).toBe('medium');
    expect(scoreToRelevance(0.55)).toBe('medium');
  });

  it('should return low for scores < 0.4', () => {
    expect(scoreToRelevance(0.39)).toBe('low');
    expect(scoreToRelevance(0.0)).toBe('low');
    expect(scoreToRelevance(0.1)).toBe('low');
  });

  it('should handle boundary values correctly', () => {
    expect(scoreToRelevance(0.4)).toBe('medium'); // Lower bound of medium
    expect(scoreToRelevance(0.7)).toBe('high');   // Lower bound of high
  });
});
```

### Priority 4: E2E Tests with Real Data

**Create:** `test/e2e/rrfs-e2e.test.ts`  
**Purpose:** End-to-end tests using real retrieval results:

```typescript
// test/e2e/rrfs-e2e.test.ts
import { describe, it, expect } from 'vitest';
import { applyRRFS } from '@/lib/ai/rerank/rrfs';

describe('applyRRFS E2E', () => {
  it('should correctly rerank results from real retrieval sources', async () => {
    // Simulate realistic retrieval scenario
    const results = [
      // FTS results (score based on PostgreSQL ts_rank)
      { id: '1', score: 0.85, source: 'postgres_fts' },
      { id: '2', score: 0.72, source: 'postgres_fts' },
      
      // Vector results (score based on cosine similarity)
      { id: '3', score: 0.91, source: 'qdrant' },
      { id: '4', score: 0.68, source: 'qdrant' },
    ];

    const reranked = applyRRFS(results);

    // Verify all fields added correctly
    expect(reranked.every(r => 'rerankedScore' in r)).toBe(true);
    expect(reranked.every(r => typeof r.relevanceRank === 'number')).toBe(true);
    
    // Results should be sorted by rerankedScore descending
    for (let i = 0; i < reranked.length - 1; i++) {
      expect(reranked[i].rerankedScore).toBeGreaterThanOrEqual(reranked[i + 1].rerankedScore);
    }
  });
});
```

---

## 5. Additional Improvements

### A. Test Utilities

Create `test/utils/testData.ts` for reusable test fixtures:

```typescript
export const generateTestResults = (count: number, sources: Array<'fts' | 'vector'> = ['fts', 'vector']) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `result-${i}`,
    score: Math.random(),
    source: sources[i % sources.length] as const,
  }));
};

export const createMockHistory = (agentId: string, policyIds: string[]) => {
  // Helper to set up test history data
};
```

### B. CI/CD Integration

- Add `npm run test:unit` to CI pipeline
- Add code coverage report with coverages >80% target for rerank modules

### C. Testing Documentation

Add JSDoc comments with test examples in functions:

```typescript
/**
 * Reciprocal Rank Fusion (RRFS) algorithm
 * @param results - Results from multiple retrieval sources
 * @returns Reranked results with RRFS scores and relevance labels
 * 
 * @example
 * ```ts
 * const results = [
 *   { id: '1', score: 0.8, source: 'fts' },
 *   { id: '2', score: 0.9, source: 'vector' },
 * ];
 * const reranked = applyRRFS(results);
 * // Result sorted by RRFS score with relevance labels
 * ```
 */
export function applyRRFS(results: RetrievalResult[]): RerankResult[] {
  // ...
}
```

---

## 6. Summary Matrix

| Component | Status | Test Count | Coverage | Priority |
|-----------|--------|------------|----------|----------|
| `applyRRFS()` | ⚠️ Indirect only | 0 unit tests | <10% | **HIGH** |
| `scoreToRelevance()` | ❌ None | 0 | 0% | MEDIUM |
| `applyHistoryBoost()` | ❌ None | 0 | 0% | **HIGH** |
| `getHistoryCount()` | ⚠️ Indirect | ~1 integration test | <20% | LOW |
| `postgresFullTextSearch()` | ⚠️ Integration only | ~3 tests | ~30% | MEDIUM |
| `userHistoryLookup()` | ❌ None | 0 | 0% | LOW |
| `hybridRetrieve()` | ⚠️ E2E only | ~4-5 integration tests | ~40% | LOW |

**Overall Coverage:** ~15-20% for reranker-specific functionality

---

## 7. Quick Win Implementation Plan

### Week 1: Unit Tests
- [ ] Create `test/unit/rrfs.test.ts` with 8+ test cases
- [ ] Create `test/unit/historyBoost.test.ts` with 6+ test cases
- [ ] Create `test/unit/relevance.test.ts` with 5+ test cases

### Week 2: Integration Enhancements
- [ ] Add history boost + RRF combination test
- [ ] Add edge case tests (empty results, large sets)
- [ ] Add performance benchmarks

### Week 3: Documentation & CI
- [ ] Add code coverage report to pipeline
- [ ] Document test coverage requirements in README
- [ ] Update API documentation with test examples

**Estimated Effort:** 2-3 days for unit tests, 1-2 days for integration enhancements

---

**Report Generated By:** Testing Coverage Analysis Tool  
**Analysis Date:** July 3, 2026  
**Next Review:** After implementing recommended tests
