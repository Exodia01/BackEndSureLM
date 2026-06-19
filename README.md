# SureLM - Indian Insurance Ecosystem Platform

> AI-powered hybrid retrieval system for insurance policy recommendations, document processing, and agent assistance across India

[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)](https://github.com/Exodia01/BackEndSureLM) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

SureLM is a comprehensive platform that empowers grassroots agents to bring financial protection to households across India. The platform bridges the gap between Insurers/Banks and rural/semi-urban communities through:

- **Hybrid AI Retrieval**: PostgreSQL FTS + Qdrant Vector Search + User History
- **Multilingual AI Support**: Ollama LLMs with regional language capabilities
- **Document Processing**: OCR for Indian KYC documents (Aadhaar, PAN, etc.)
- **CRM Dashboard**: Lead management, birthdays, premiums, and reminders

---

## 🌟 Features

### Hybrid Retrieval System
- **PostgreSQL Full-Text Search** - Lexical matching for exact terms
- **Qdrant Vector Search** - Semantic similarity search with embeddings
- **User History Lookup** - Personalized context from agent's past interactions
- **Concurrent Execution** - All retrieval methods parallelized with `Promise.all()`

### AI-Powered Decision Support
- Policy recommendations based on household data (income, family size, occupation)
- Step-by-step claims guidance
- Multilingual explanations in regional languages
- Fallback LLM for reliability

### Document Processing
- OCR extraction from images (PDF)
- Support for Indian KYC: Aadhaar, PAN, Voter ID, Ration Card, Income Certificate
- Format validation and confidence scoring
- Document-image compression

### Agent CRM Dashboard
- Lead management with status tracking
- Birthday notifications and wish system
- Premium due alerts (urgent & upcoming)
- Follow-up reminders

---

## 🏗️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19, shadcn/ui |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon adapter via Prisma) |
| Vector DB | Qdrant |
| AI/LLM | Ollama (qwen2.5:7b + llama3.2:3b fallback) |
| Vision | Ollama (minicpm-v, llava:7b for OCR) |
| Embeddings | Ollama API (nomic-embed-text) |
| Auth | Clerk authentication |
| PDF Processing | pdfjs-dist |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- npm or pnpm

### Step 1: Start Infrastructure (PostgreSQL + Qdrant)
```bash
docker-compose up -d
```

### Step 2: Configure Environment Variables
Copy `.env.example` and set:
```bash
DATABASE_URL=postgresql://admin:localpg2024@localhost:5432/surelm
QDRANT_URL=http://localhost:6333
OLLAMA_HOST=http://localhost:11434/v1
PRIMARY_MODEL_NAME=qwen2.5-coder:1.5b
FALLBACK_MODEL_NAME=llama3.2:3b
```

**Note:** OCR vision models (`minicpm-v`, `llava:7b`) are hardcoded in `app/api/ocr/route.ts` and don't need env vars.

### Step 3: Install Dependencies & Run Migrations
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### Step 4: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Directory Structure

```
lib/
├── ai/                    # AI orchestration layer
│   ├── extractRequirements.ts
│   ├── checkCompleteness.ts
│   ├── hybridRetrieval.ts
│   ├── retrievePolicies.ts
│   └── generateRecommendations.ts
├── retrieval/             # Search implementations
│   ├── postgres.ts        # PostgreSQL queries
│   ├── hybrid.ts          # Hybrid search logic
│   └── vector/            # Qdrant integration
│       ├── index.ts
│       ├── types.ts
│       └── qdrantStorage.ts
├── qdrant.ts              # Qdrant client utils
└── db.ts                  # Prisma client

prisma/
├── schema.prisma          # Database models
└── migrations/            # Schema migrations

app/
├── (dashboard)/           # Authenticated routes
│   ├── dashboard/         # Main dashboard layout
│   └── crm/               # CRM interface
├── (marketing)/           # Public landing pages
└── api/                   # API endpoints
    ├── chat/route.ts      # AI conversational agent
    ├── ocr/route.ts       # Document processing
    └── crm/route.ts       # Lead management

components/
├── ui/                    # shadcn/ui components
├── dashboard/             # CRM-related UI
└── landing/               # Marketing page sections
```

---

## 🔍 Hybrid Retrieval System

### Architecture

```
User Query
    ↓
┌─────────────────────────────────────────────┐
│ Concurrent Execution (Promise.all)         │
├─────────────────────────────────────────────┤
│ 1. PostgreSQL FTS                         │
│    - Exact term matching                  │
│    - Policy names, riders, exclusions     │
├─────────────────────────────────────────────┤
│ 2. Qdrant Vector Search                   │
│    - Semantic similarity                  │
│    - Natural language queries             │
├─────────────────────────────────────────────┤
│ 3. User History Lookup                    │
│    - Agent's past policy issuances        │
└─────────────────────────────────────────────┘
    ↓
├─────────────────────────────────────────────┤
│ Hybrid Reranker                           │
│ - Re-rank combined results                │
│ - Calculate relevance scores              │
└─────────────────────────────────────────────┘
    ↓
LLM Context Building
    ↓
Policy Recommendations + Explanations
```

### API Methods

#### `postgresFullTextSearch(query, limit)`
```typescript
import { postgresFullTextSearch } from "@/lib/ai/hybridRetrieval";

const results = await postgresFullTextSearch("term life insurance", 10);
// Returns: RetrievalResult[]
```

#### `semanticSearch(vector, filter?)`
```typescript
import { semanticSearch } from "@/lib/qdrant";

const vector = [/* 768-dim embedding */];
const results = await semanticSearch(vector, {
  must: [{ key: "policy_type", match: { value: "life" } }]
});
```

#### `hybridRetrieve(query, agentId?, vector?)`
```typescript
import { hybridRetrieve } from "@/lib/ai/hybridRetrieval";

const results = await hybridRetrieve(
  "best health insurance for farmers",
  "agent-123",
  [/* optional vector embedding */]
);
```

### Result Types

```typescript
interface RetrievalResult {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

interface RerankResult extends RetrievalResult {
  rerankedScore?: number;
  relevance?: "high" | "medium" | "low";
}
```

---

## 📊 Database Schema

### Key Models (from `prisma/schema.prisma`)

**User & AgentProfile**
```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  role      Role     @default(AGENT)
  agentProfile AgentProfile?
  leads     PolicyLead[]
}

model AgentProfile {
  id       String   @id @default(cuid())
  userId   String   @unique
  isActive Boolean  @default(true)
}
```

**PolicyLead & PolicyIssuance**
```prisma
model PolicyLead {
  id           String        @id @default(cuid())
  agentId      String
  householdName String
  phone       String?
  income      Int?
  familySize  Int?
  status      LeadStatus    @default(NEW)
  followUpAt  DateTime?
  issuances   PolicyIssuance[]
}

model PolicyIssuance {
  id             String         @id @default(cuid())
  leadId         String
  policyName     String
  premiumAmount  Int?
  issuedAt       DateTime       @default(now())
  status         IssuanceStatus @default(ACTIVE)
}
```

**Conversation & Document**
```prisma
model Message {
  id        String   @id @default(cuid())
  leadId    String
  role      MessageRole
  content   String
}

model Document {
  id        String   @id @default(cuid())
  filename  String
  chunks    Chunk[]
}

model Chunk {
  id         String   @id @default(cuid())
  documentId String
  content    String
  chunkOrder Int
}
```

---

## 🔌 API Endpoints

### `/api/chat` (POST)
**AI Conversational Agent**

```typescript
// Request
{
  messages: [
    { role: "user", content: "What's the best life insurance for farmers?" }
  ]
}

// Response (streaming or fallback text)
```

**Features:**
- Ollama LLM with primary/fallback models
- Streaming responses via ReadableStream
- Fallback if primary model fails

### `/api/ocr` (POST)
**Document Processing with Vision Models**

Processes images/PDFs for:
- Aadhaar card extraction
- PAN card verification
- Income certificates
- Address proofs

**Vision Models:**
- Primary: `minicpm-v` (Multimodal vision model)
- Fallback: `llava:7b` (Vision-language model)

### `/api/crm` (GET, POST, PATCH)
**Lead Management**

- Fetch leads with filters and search
- Update household info
- Change status (NEW → CONTACTED → POLICY_ISSUED)
- Set follow-up dates

---

## 🛠️ Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `QDRANT_URL` | ✅ | Qdrant vector DB endpoint |
| `OLLAMA_HOST` | ✅ | Ollama server URL (e.g., `http://localhost:11434/v1`) |
| `PRIMARY_MODEL_NAME` | ✅ | Main LLM model (default: `qwen2.5-coder:1.5b`) |
| `FALLBACK_MODEL_NAME` | ⚠️ | Fallback LLM model (default: `llama3.2:3b`) |
| `VISION_PRIMARY_MODEL` | ✅ | OCR vision model (default: `minicpm-v`) |
| `VISION_FALLBACK_MODEL` | ⚠️ | Fallback OCR model (default: `llava:7b`) |
| `CLERK_WEBHOOK_SECRET` | ✅ | Clerk authentication secret |

---

## 🧪 Development

### Running Tests
```bash
# Database connectivity test
npm run test-db

# Integration tests (PowerShell)
.\run-test.ps1
.\run-e2e-validation.ps1
```

### Code Quality
```bash
# Linting
npm run lint

# Build
npm run build

# Start production server
npm start
```

### Prisma Commands
```bash
# Generate client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_feature

# Push schema without migrations
npx prisma db push
```

---

## 🚢 Deployment Checklist

1. **Environment Variables**
   - Set in production (no defaults)
   - Database: Neon/AWS RDS/Supabase
   - Vector DB: Qdrant cloud or self-hosted
   - AI: Ollama endpoint or API key

2. **Database**
   - Enable backups
   - Configure read replicas if needed

3. **Vector DB**
   - Create collections: `policies`, `content_chunks`
   - Set vector dimensions (768 for sentence-transformers)

4. **AI/LLM**
   - Verify model availability (`curl $OLLAMA_HOST/v1/models`)
   - Monitor token usage & costs

5. **Build Commands**
   ```bash
   npm ci --only=production
   npx prisma generate
   npm run build
   npm start
   ```

---

## 📝 License

MIT License - See `LICENSE` file for details.

---

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For inquiries, contact the development team or open an issue in the repository.
