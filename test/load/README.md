# Concurrent Query Load Test

This directory contains load testing utilities for hybrid retrieval queries.

## Files

- `concurrent-load-test.ts` - Main load test implementation
- `run-concurrent-load.ps1` - PowerShell runner script

## Quick Start

### Prerequisites

Ensure the following services are running:
- PostgreSQL on port 5432
- Qdrant on port 6333
- Environment variables configured in `.env`

### Running Tests

#### Using PowerShell (Recommended)

```powershell
cd S:\BackEndSureLM
.\test\run-concurrent-load.ps1

# With custom parameters:
.\test\run-concurrent-load.ps1 -ConcurrentQueries 20 -Iterations 3
```

#### Using npm/tsx directly

```bash
# Run with default parameters (10 queries, 5 iterations)
npm run test-load

# Or use tsx directly
npx tsx test/load/concurrent-load-test.ts
```

## Configuration

Set these environment variables to customize the test:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONCURRENT_QUERIES` | 10 | Number of concurrent queries per iteration |
| `LOOP_ITERATIONS` | 5 | Number of iterations to run |
| `TEST_COLLECTION` | "policies" | Qdrant collection name |

## Test Output

The test generates a detailed report including:

```
=== Load Test Results ===
Total queries executed: 50
Successful: 50 | Failed: 0
Queries/sec: 24.36

Latency Statistics (ms):
  Min:  120
  Max:  450
  Avg:  215.89
  P50:  200
  P95:  350
  P99:  400

Source Hit Rates:
  PostgreSQL FTS: 76%
  Vector Search:  92%
```

## Test Features

### 1. Automatic Test Environment Setup
- Creates test documents and chunks in PostgreSQL
- Generates vector embeddings for chunks
- Stores vectors in Qdrant collection

### 2. Concurrent Query Execution
- Executes hybrid searches with configurable concurrency
- Uses `Promise.all()` for parallel execution
- Measures latency for each query

### 3. Result Validation
- Tracks successful vs failed queries
- Validates result structure
- Checks source distribution (FTS vs Vector)

### 4. Performance Metrics
Min/Max/Avg Latency
- P50, P95, P99 percentiles
- Queries per second throughput

## Customization Examples

### High Concurrency Test (Stress Test)
```powershell
.\test\run-concurrent-load.ps1 -ConcurrentQueries 50 -Iterations 2
```

### Slow But Thorough Test
```bash
CONCURRENT_QUERIES=5 LOOP_ITERATIONS=10 npx tsx test/load/concurrent-load-test.ts
```

## Performance Benchmarks

Typical results on development machine:
- 10 concurrent queries, 5 iterations: ~24 queries/sec
- Latency P95: <500ms for cached data

## Troubleshooting

### Qdrant Unavailable
If you see connection errors to Qdrant:
1. Ensure Docker is running: `docker ps`
2. Check container status: `docker-compose ps`
3. Restart services: `docker-compose restart qdrant`

### Database Connection Failures
Verify environment variables in `.env`:
```
DATABASE_URL=postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm
QDRANT_URL=http://localhost:6333
```

### Low Query Throughput
- Increase `CONCURRENT_QUERIES` carefully (start with 10)
- Ensure Qdrant has sufficient memory
- Consider reducing vector dimension if using custom models
