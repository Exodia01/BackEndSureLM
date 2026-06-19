# Concurrent Query Load Test Runner
# Usage: .\run-concurrent-load.ps1 [-ConcurrentQueries 10] [-Iterations 5]

param (
    [int]$ConcurrentQueries = 10,
    [int]$Iterations = 5,
    [string]$CollectionName = "policies"
)

Write-Host "`n=== Concurrent Query Load Test Runner ===" -ForegroundColor Cyan
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Concurrent Queries: $ConcurrentQueries"
Write-Host "  Iterations: $Iterations"
Write-Host "  Collection: $CollectionName`n" -ForegroundColor White

$env:CONCURRENT_QUERIES = $ConcurrentQueries.ToString()
$env:LOOP_ITERATIONS = $Iterations.ToString()
$env:TEST_COLLECTION = $CollectionName

try {
    Write-Host "Running load test..." -ForegroundColor Cyan
    npx tsx test/load/concurrent-load-test.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Load test completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Load test failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
catch {
    Write-Host "`n❌ Error running load test:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
