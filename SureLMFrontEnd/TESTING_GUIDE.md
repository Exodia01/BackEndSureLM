# SureLM Android App - Build & Test Documentation

## Prerequisites (Required)

Before building, you must install these components:

### 1. Java Development Kit (JDK)
- **Version**: JDK 17 or later
- **Download**: https://adoptium.net/
- **Environment Variable**: `JAVA_HOME` must be set

### 2. Android SDK
- **Location**: `C:\Users\[USER]\AppData\Local\Android\Sdk`
- **Or**: Install via Android Studio

### 3. Android Studio
- **Version**: Hedgehog (2023.1.1) or later
- **Download**: https://developer.android.com/studio

## Build Process

### Step 1: Environment Setup

```bash
# Set environment variables
set JAVA_HOME=C:\Program Files\Java\jdk-17
set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk

# Add to PATH
set PATH=%PATH%;%JAVA_HOME%\bin;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
```

### Step 2: Open in Android Studio

1. Launch Android Studio
2. Click "Open" → Select `S:\BackEndSureLM\SureLMFrontEnd`
3. Wait for Gradle sync to complete

### Step 3: Configure Backend URL

Edit `local.properties` file:
```properties
API_BASE_URL=http://YOUR_BACKEND_IP:3000
CLERK_JWT_SECRET=your-clerk-secret-here
```

For local development (emulator): `http://10.0.2.2:3000`

## Build Commands

### From Command Line:
```bash
cd S:\BackEndSureLM\SureLMFrontEnd
.\gradlew.bat assembleDebug
```

### From Android Studio:
- Click "Build" → "Make Project"
- Or click "Run" to build and deploy to connected device/emulator

## Test Implementation

The app includes test-friendly structure:

### Unit Testing
```kotlin
// Example: LeadRepository tests
 @Test
 fun `getLeads returns leads from database`() = runTest {
     val repository = LeadRepositoryImpl(...)
     // Test implementation
 }
```

### Instrumented Tests (Espresso)
```kotlin
// Example: UI test for lead screen
@Test
fun testLeadListDisplaysNewButton() {
    // Espresso test
}
```

## Testing Checklist

### ✅ Basic Build Verification
- [ ] Java 17+ installed and configured
- [ ] Android SDK 34 (API 34) installed
- [ ] Gradle wrapper functional
- [ ] All Kotlin files compile without errors

### ✅ Backend Integration Tests
```bash
# Test API endpoints manually with curl
curl http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test query"}]}'
```

### ✅ UI Automated Tests
- Espresso tests for lead list screen
- Jetpack Compose testing utilities

## Detailed Test Log Format

### Success Log (`test_results.txt`)
```
=== SureLM Android Build Test ===
Timestamp: 2026-07-08 14:30:00
Status: SUCCESS

--- Components Verified ---
[✓] Gradle Configuration Files (4 files)
[✓] Kotlin Source Files (39 files)  
[✓] Resource Files (19 files)
[✓] API Client Setup
[✓] Database Schema
[✓] Theme Configuration

--- Build Status ---
Build Type: DEBUG
APK Path: app/build/outputs/apk/debug/app-debug.apk
```

### Error Log (`error.log`)
```
Timestamp: 2026-07-08 14:30:15
Error Level: CRITICAL

java.exe not found in PATH
Resolution: Install JDK 17 and set JAVA_HOME
```

## Common Issues & Solutions

### Issue 1: "SDK location not found"
**Solution**: Set `ANDROID_HOME` environment variable

### Issue 2: "Gradle sync failed"  
**Solution**: 
- Check internet connection
- Run `gradlew.bat --refresh-dependencies`
- Invalidate caches in Android Studio

### Issue 3: API connection refused
**Solution**:
- Ensure backend is running on port 3000
- Use `10.0.2.2` for emulator access to host PC
- Verify `local.properties` has correct URL

## Runtime Requirements

### Minimum Device Configuration
- Android 8.0 (API 26) or later
- 2GB RAM minimum
- Internet connection (for backend sync)

### Backend Dependencies
- PostgreSQL database running
- Qdrant vector DB accessible
- Ollama AI server available

## Next Steps for Full Testing

1. **Backend Service Check**
   ```bash
   # Verify your SureLM backend is running:
   curl http://localhost:3000/api/chat/health
   ```

2. **Install on Device**
   ```bash
   ./gradlew installDebug
   adb shell am start -n com.surelm/.presentation.MainActivity
   ```

3. **Test Login Flow**
   - App opens with splash screen
   - Enter Clerk authentication credentials
   - Verify lead list loads

4. **Test Offline Mode**
   - Disable network
   - Open app → should see cached data
   - Enable network → auto-sync

## Log Files Generated

1. `test.log` - Build process log
2. `error.log` - Critical errors only
3. `test_results.txt` - Summary results

---

For full API documentation, see:
- `README.md` in project root
- Backend API docs at `SureLM/README-partner.md`

## Support

If you encounter issues:
1. Check `error.log` for detailed messages
2. Verify all prerequisites are installed
3. Run with `--debug` flag: `./gradlew assembleDebug --debug`

---
© 2026 SureLM. All rights reserved.