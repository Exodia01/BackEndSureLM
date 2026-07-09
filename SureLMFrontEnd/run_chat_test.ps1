# Sample Chat API Test (Manual)
# Run this after starting your SureLM backend

Write-Host " === SureLM Backend Chat API Test ===`n" -ForegroundColor Cyan

$BACKEND_URL = "http://localhost:3000"

# Test 1: Basic chat request
Write-Host "[Test 1] Testing /api/chat with test query..." -ForegroundColor Yellow

$chatRequest = @{
    messages = @(
        @{
            role = "user"
            content = "What is the best health insurance for farmers?"
        }
    )
    sessionId = "test-session-001"
    stream = $false
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod `
        -Uri "$BACKEND_URL/api/chat" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $chatRequest `
        -TimeoutSec 30
    
    Write-Host "`n[SUCCESS] Chat API responded" -ForegroundColor Green
    Write-Host "`nResponse preview:" -ForegroundColor Cyan
    
    if ($response.data) {
        Write-Host "Data: $($response.data | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }
    
    if ($response.response) {
        Write-Host "`nResponse text (first 200 chars):" -ForegroundColor Yellow
        Write-Host "$($response.response.Substring(0, [Math]::Min(200, $response.response.Length)))..." -ForegroundColor White
    }
    
    # Save full response for detailed analysis
    $response | ConvertTo-Json -Depth 10 | Out-File "chat_api_response.json" -Encoding utf8
    Write-Host "`nFull response saved to: chat_api_response.json" -ForegroundColor Cyan
    
} catch {
    Write-Host "[FAILED] Chat API test failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Yellow
}

Write-Host "`n === Manual Test Instructions ===`n" -ForegroundColor Cyan
@"
1. Ensure backend is running:
   cd S:\BackEndSureLM
   npm run dev

2. Backend must be accessible at: $BACKEND_URL

3. If using Docker, verify all services are up:
   docker-compose ps

4. Test authentication (if required):
   Get a Clerk JWT token from backend logs
   
5. Add Authorization header to requests:
   -H "Authorization: Bearer YOUR_JWT_TOKEN"

To test with curl (bash/WSL):
-----------------------------
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Health insurance for farmers"}
    ],
    "stream": false
  }'

Android App Integration:
------------------------
1. Open app in Android Studio
2. Configure API endpoint in settings (default: http://10.0.2.2:3000)
3. Run the app on emulator/device
4. Test lead creation and list display

=================================================
"@ | Write-Output
