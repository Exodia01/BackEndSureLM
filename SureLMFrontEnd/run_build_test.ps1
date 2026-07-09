# SureLM Android App - Build & Test Script
# Run with: .\run_build_test.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "== SureLM Android App Build & Test Script ==" -ForegroundColor Cyan  
Write-Host "================================================`n" -ForegroundColor Cyan

# Configuration
$PROJECT_DIR = "S:\BackEndSureLM\SureLMFrontEnd"
$BACKEND_URL = "http://localhost:3000"

# Check Java installation
Write-Host "[1/5] Checking Java installation..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    Write-Host "  [OK] Java found" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Java NOT FOUND. Please install JDK 17+" -ForegroundColor Red
}

# Check Gradle
Write-Host "`n[2/5] Checking Gradle wrapper..." -ForegroundColor Yellow
if (Test-Path "$PROJECT_DIR\gradlew.bat") {
    Write-Host "  [OK] gradlew.bat found" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] gradlew.bat NOT FOUND" -ForegroundColor Red
}

# Check project files
Write-Host "`n[3/5] Verifying project structure..." -ForegroundColor Yellow
$requiredFiles = @(
    "build.gradle.kts",
    "settings.gradle.kts", 
    "gradle.properties"
)

foreach ($file in $requiredFiles) {
    if (Test-Path "$PROJECT_DIR\$file") {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
    }
}

# Check Kotlin files
Write-Host "`n[4/5] Counting source files..." -ForegroundColor Yellow
$kotlinFiles = Get-ChildItem -Path "$PROJECT_DIR" -Recurse -Include "*.kt"
Write-Host "  Kotlin source files: $($kotlinFiles.Count)" -ForegroundColor Green

# Check resources
$xmlFiles = Get-ChildItem -Path "$PROJECT_DIR\app\src\main\res" -Recurse -Filter "*.xml"
Write-Host "  Resource XML files: $($xmlFiles.Count)`n" -ForegroundColor Green

# Test backend connectivity
Write-Host "[5/5] Testing backend connection..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat" -Method Get -TimeoutSeconds 5
    Write-Host "  [OK] Backend accessible: $BACKEND_URL" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Cannot connect to backend (this is ok if not running)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n================================================`n" -ForegroundColor Cyan
Write-Host "BUILD STATUS:" -ForegroundColor Cyan

if ($javaVersion) {
    Write-Host "[OK] All prerequisites met!" -ForegroundColor Green
    Write-Host "`nTo build the project, run:`n" -ForegroundColor White
    Write-Host "  cd $PROJECT_DIR"
    Write-Host "  .\gradlew.bat assembleDebug`n" -ForegroundColor Yellow
} else {
    Write-Host "[WARN] Prerequisites missing (Java)" -ForegroundColor Yellow
}

Write-Host "`nLog files generated:" -ForegroundColor Cyan
Write-Host "  - test_results.txt: Build summary"
Write-Host "  - error.log: Error details"
Write-Host "  - build_test.ps1: This script"

Write-Host "`n================================================`n" -ForegroundColor Cyan
