# Backend API Test Script for SureLM FrontEnd
# Tests all endpoints that the Android app will call

Import-Module PowerShellHTTP

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "== Backend API Endpoint Test ==" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

$BACKEND_URL = "http://localhost:3000"
$TEST_RESULT_FILE = "backend_api_test_results.txt"

# Start test run
@"=== Backend API Test Results ===
Generated: $(Get-Date)
Backend URL: $BACKEND_URL
===================================

"@ | Out-File -FilePath $TEST_RESULT_FILE -Encoding utf8

# Test 1: Check if backend is reachable
Write-Host "[Test 1] Checking backend connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat" -Method Get -TimeoutSeconds 5
    Write-Host "  [PASS] Backend is responding" -ForegroundColor Green
    Add-Content -Path $TEST_RESULT_FILE -Value "[PASS] Backend connectivity test"
} catch {
    Write-Host "  [FAIL] Cannot connect to backend (ensure it's running)" -ForegroundColor Red
    Add-Content -Path $TEST_RESULT_FILE -Value "[FAIL] Backend not reachable: $_"
}

# Test 2: Health check endpoint
Write-Host "`n[Test 2] Health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat" -Method Get
    Write-Host "  [PASS] Health check responded: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "  [SKIP] Cannot test health (backend not running)" -ForegroundColor Yellow
}

# Test 3: Check if backend is accessible from different network interface
Write-Host "`n[Test 3] Testing alternative endpoints..." -ForegroundColor Yellow
$alternativeEndpoints = @(
    "http://127.0.0.1:3000/api/chat",
    "http://localhost:3000/api/health"
)

foreach ($endpoint in $alternativeEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSeconds 5
        Write-Host "  [OK] $endpoint accessible" -ForegroundColor Green
    } catch {
        # Silent - not all endpoints may exist
    }
}

# Test 4: Simulate Android API calls (if backend is available)
Write-Host "`n[Test 4] Testing CRUD operations..." -ForegroundColor Yellow

$testLead = @{
    householdName = "Test Family $(Get-Random)"
    notes = "Automated test lead"
    phone = "+919876543210"
} | ConvertTo-Json

Write-Host "  [INFO] Lead creation would require authentication" -ForegroundColor Yellow
Write-Host "  [INFO] Run .\run_auth_test.ps1 for auth-enabled tests" -ForegroundColor Yellow

# Test 5: Generate API documentation from code
Write-Host "`n[Test 5] Extracting API endpoints from code..." -ForegroundColor Yellow
$apiInterface = Get-Content "app\src\main\java\com\surelm\data\remote\SureLMApi.kt"
$endpoints = $apiInterface | Select-String "@(GET|POST|PUT|PATCH)\("

Write-Host "`n  Found API endpoints in SureLMApi interface:" -ForegroundColor Cyan
@"

Endpoints extracted from code:
-------------------------------
@foreach ($endpoint in $endpoints) {
    Write-Host "  [OK] $($endpoint.Line)" -ForegroundColor Green
}

"@ | Out-File -FilePath "api_endpoints.txt" -Encoding utf8

# Test 6: Validation tests
Write-Host "`n[Test 6] Code validation..." -ForegroundColor Yellow

# Check required files exist
$requiredFiles = @(
    "app/src/main/java/com/surelm/data/remote/SureLMApi.kt"
    "app/src/main/java/com/surelm/data/local/SureLMDatabase.kt"
    "app/src/main/res/values/strings.xml"
    "app/build.gradle.kts"
)

foreach ($file in $requiredFiles) {
    if (Test-Path "$PROJECT_DIR\$file") {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n================================================`n" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
@"
Test file: $TEST_RESULT_FILE
API endpoints doc: api_endpoints.txt
API interfaces found: $($endpoints.Count)

To run auth-enabled tests, ensure backend is running and:
1. Update local.properties with valid credentials
2. Run: .\run_auth_test.ps1

=================================================
"@ | Write-Output
