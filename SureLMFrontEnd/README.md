# SureLM Android App

Indian Insurance Ecosystem Platform - Mobile Application for grassroots agents

## Overview

SureLM Android app is designed to empower grassroots insurance agents in rural India with AI-powered policy recommendations, document processing, and CRM capabilities.

### Key Features
- 📊 Lead/Household management with offline sync
- 🤖 AI-powered policy recommendations (via `/api/chat`)
- 📸 Document OCR for KYC (Aadhaar, PAN, Voter ID)
- 🌍 Multilingual support (10 Indian languages)
- 🔗 Seamless backend integration

## Project Structure

```
SureLMFrontEnd/
├── app/                       # Main application module
│   ├── src/main/
│   │   ├── java/com/surelm/
│   │   │   ├── data/         # Data layer (repository, DTOs, local DB)
│   │   │   │   ├── local/    # Room database, DAOs
│   │   │   │   ├── remote/   # API client, Retrofit interfaces
│   │   │   │   └── repository/ # Repository implementations
│   │   │   ├── domain/       # Business models & use cases
│   │   │   ├── presentation/ # UI layer (ViewModels, Activities)
│   │   │   └── core/         # Shared utilities
│   │   ├── res/              # Resources (layout, values, draws)
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts      # App-level dependencies
├── docs/                     # Architecture documentation
└── README.md                 # This file
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Language** | Kotlin 1.9+ |
| **UI Framework** | Jetpack Compose |
| **Architecture** | MVVM + Clean Architecture |
| **DI** | Hilt (Dagger) |
| **Local DB** | Room SQLite |
| **Networking** | Retrofit2 + OkHttp |
| **Camera** | CameraX |

## Quick Start

### Prerequisites
- Android Studio Hedgehog or later
- JDK 17+
- Android SDK 34 (API 34)
- Minimum SDK: 26 (Android 8.0)

### Setup Steps

1. **Clone this repository**

2. **Update API Endpoint** (`local.properties`):
   ```
   API_BASE_URL=http://YOUR_BACKEND_IP:3000
   ```

3. **Build the project**:
   ```bash
   cd SureLMFrontEnd
   ./gradlew build
   ```

4. **Run on emulator/device**:
   ```bash
   ./gradlew installDebug
   ```

## API Integration

The app communicates with the SureLM backend at `/api` endpoints:

### Authentication
- Uses JWT tokens from Clerk authentication
- Token stored in Android DataStore (encrypted)

### Available Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/crm` | GET | Fetch agent's leads |
| `/api/leads` | POST | Create new lead |
| `/api/chat` | POST | AI policy recommendations |
| `/api/ocr` | POST | Document processing |

see `data/remote/SureLMApi.kt` for full API interface.

## Offline Architecture

The app implements an offline-first pattern:

1. All UI data comes from local Room database
2. Background sync service monitors network connectivity
3. Changes queued locally when offline
4. Automatic sync when online with conflict resolution

## Multilingual Support

All strings are localized in 10 Indian languages:
- Hindi (हिन्दी)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Bengali (বাংলা)
- Marathi (मराठी)
- Gujarati (ગુજરાતી)
- Urdu (اردو)
- Kannada (ಕನ್ನಡ)
- Odia (ଓଡ଼ିଆ)
- Malayalam (മലയാളം)

## Build Variants

```bash
./gradlew assembleDebug   # Debug build
./gradlew assembleRelease # Release build (signed)
```

## Testing

```bash
# Run unit tests
./gradlew test

# Run instrumented tests
./gradlew connectedAndroidTest
```

## Contribution Guidelines

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## Troubleshooting

### Build Errors
- Ensure JDK 17+ is configured in Android Studio
- Update Gradle plugin version if needed

### API Connection Issues
- Verify `API_BASE_URL` in `local.properties`
- Ensure backend server is running
- Check firewall/network settings

## License

MIT License - see LICENSE file for details.

## Support

For integration support:
- 📧 hello@surelm.com
- 🌐 www.surelm.com/developer

---

© 2026 SureLM. All rights reserved.