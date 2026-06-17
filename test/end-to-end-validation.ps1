$env:DATABASE_URL="postgresql://admin:localpg2024@localhost:5432/surelm"
$env:QDRANT_URL="http://localhost:6333"

cd S:\BackEndSureLM

Write-Host "=== End-to-End Hybrid Retrieval Validation ===" -ForegroundColor Cyan
Write-Host ""

try {
    $result = npx tsx test/integration/end-to-end-validation.ts 2>&1
    
    Write-Host $result
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== VALIDATION COMPLETE ===" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "=== VALIDATION FAILED ===" -ForegroundColor Red
        Write-Host "Error code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "=== VALIDATION ERROR ===" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
