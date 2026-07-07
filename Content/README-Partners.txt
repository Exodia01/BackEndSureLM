# 🛠️ SureLM - Technical Integration Guide  
### API Documentation & System Architecture for Developers

> **For IT Partners, Software Integrators & Technology Providers**

---

## 🔗 System Overview

SureLM provides a RESTful API and web platform for integrating insurance recommendation capabilities into your existing systems.

**Key Capabilities:**
- Policy recommendations based on household context
- Multi-language AI responses (Hindi, Tamil, Telugu, Bengali, Marathi)
- Document OCR and KYC extraction
- CRM and lead management

---

## 🏗️ Architecture Components

### Core Services:

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│  (Web, Mobile, API integrations)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
┌─────────────────┐   ▼       ┌──────────────────┐
│  Next.js App    │  API     │   External APIs  │
│  (React/TS)     │  Gateway │  (Clerk Auth)    │
└──┬──────────────┘   ▼       └──────────────────┘
   │                  │
┌──┴────────────────────────────────┐
│        AI Layer                 │
│  ├─ Hybrid Retrieval            │
│  │  ├─ SQL FTS                   │
│  │  ├─ Vector Search             │
│  │  └─ User History Lookup      │
│  └─ Local LLM (primary/fallback)│
└──┬──────────────────────────────┘
   │
┌──┴────────────────────────────────┐
│        Data Layer               │
│  ├─ SQL Database                 │
│  ├─ Vector DB                    │
│  └─ PDF Processing Service       │
└──────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Authentication

**Clerk Integration**
- Standard Clerk authentication via Next.js middleware
- `clerkId` mapped to internal user ID

**Endpoints:**
```
GET  /api/chat          - AI conversational agent
POST /api/chat          - Send message, get recommendation
GET  /api/crm           - Get agent's households/leads
PATCH /api/crm          - Update household details
POST /api/ocr           - Upload document for scanning
GET  /api/messages      - Chat history per lead
```

---

### API: Policy Recommendations (`/api/chat`)

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Best health insurance for a farmer with diabetes"
    }
  ],
  "model": "optional-model-name",
  "stream": true
}
```

**Response (streaming):**
```
HTTP/1.1 200 OK
Content-Type: text/plain

Policy Recommendations:

Based on your query about health insurance for diabetic farmers...
```

---

### API: CRM Lead Management (`/api/crm`)

**GET - Fetch Leads**
```http
GET /api/crm?limit=50&offset=0 HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "cuid",
        "householdName": "Sharma Family",
        "phone": "+91XXXXX",
        "income": 8000,
        "familySize": 4,
        "status": "NEW",
        "isBirthdayToday": true,
        "hasPremiumDue": false
      }
    ],
    "stats": {
      "total": 37,
      "birthdaysToday": 2,
      "premiumsDueUrgentCount": 5
    }
  }
}
```

**PATCH - Update Lead**
```json
{
  "leadId": "cuid",
  "status": "CONTACTED",
  "income": 10000,
  "familySize": 3,
  "notes": "Interest in health plan"
}
```

---

### API: Document Processing (`/api/ocr`)

**Request:**
```json
{
  "fileBase64": "JVBERi0xLjQKJcOkw7zDtsO...",
  "filename": "aadhaar_scan.pdf",
  "mimeType": "application/pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extractedText": "Aadhaar Number: XXXX-XXXX-1234\nName: Rajesh Kumar...",
    "confidence": 0.94,
    "documentType": "aadhaar",
    "fields": {
      "name": "Rajesh Kumar",
      "uid": "XXXX-XXXX-1234",
      "dob": "1985-03-15"
    }
  }
}
```

---

## 📊 Database Schema (Abstracted)

### Key Models:

**User & Agent:**
```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  role      Role
}
```

**Households (Leads):**
```prisma
model PolicyLead {
  id           String   @id @default(cuid())
  agentId      String
  householdName String
  phone        String?
  income       Int?
  familySize   Int?
  status       LeadStatus @default(NEW)
}
```

**Messages:**
```prisma
model Message {
  id        String   @id @default(cuid())
  leadId    String
  role      MessageRole
  content   String
}
```

---

## 🧠 AI/ML Integration

### Recommendation Pipeline:

1. **Query Embedding**
   - Convert text to standard embedding vector
   - Uses local embedding model

2. **Hybrid Search**
   - SQL full-text search for exact terms
   - Vector database for semantic matching
   - User history lookup (last 5 policies)

3. **Context Building**
   - Combine top results (re-ranked by relevance)
   - Add household-specific context

4. **LLM Response**
   - Primary: Open-weight local model
   - Fallback: Alternative open-weight local model

---

## 🔒 Security Considerations

### Data Encryption:
- SSL/TLS for all API communications
- Environment variables for sensitive config
- Password hashing (bcrypt) for Clerk auth

### Rate Limiting:
```typescript
// Example middleware protection
const rateLimit = createMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,     // 30 requests/minute
})
```

---

## 🔄 Integration Patterns

### Pattern 1: Embed in Existing App
```javascript
// In your mobile/web app
const recommendations = await fetch('/api/recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    household: { income: 8000, familySize: 4 }
  })
})
```

### Pattern 2: Bulk Lead Import
```python
# Python script to import leads from CSV
import requests

for row in csv_rows:
    response = requests.post(
        'https://api.surelm.com/crm',
        json={'householdName': row['name'], 'income': int(row['income'])},
        headers={'Authorization': f'Bearer {token}'}
    )
```

### Pattern 3: webhook Notifications
```typescript
// Set up webhooks for events
POST /webhook/lead_created
{
  "event": "LEAD_CREATED",
  "data": { "leadId": "cuid", "details": {...} }
}
```

---

## 📦 Deployment Requirements

### Infrastructure:
- SQL database (PostGIS optional)
- Vector DB for embeddings
- Local AI instance for embeddings + LLM inference
- Node.js 20+ runtime
- Docker/Docker Compose for local development

### Build Commands:
```bash
npm install
npx prisma generate
npm run build
npm start
```

---

## 🧪 Testing API Endpoints

**Example curl commands:**

```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Health insurance for farmers"}]}'

# Test CRM fetch
curl http://localhost:3000/api/crm?limit=5

# Test document upload (base64 encoded)
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"fileBase64":"...", "filename":"test.pdf"}'
```

---

## 📚 Additional Resources

**API Documentation:** https://api.surelm.com/docs  
**SDK Examples:** https://github.com/surelm/example-integrations  
**Community Forum:** https://community.surelm.com

---

For integration support:  
📧 hello@surelm.com  
🌐 www.surelm.com/developer

---

© 2026 SureLM. Developer-focused architecture.
