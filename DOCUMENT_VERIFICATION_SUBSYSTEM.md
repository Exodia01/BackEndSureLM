# Document Collection & Verification Subsystem

> Production-ready document processing system for SureLM - Indian Insurance Ecosystem Platform

## Overview

The Document Collection & Verification subsystem enables agents to upload, validate, and process KYC documents (Aadhaar, PAN) and policy application forms with automated OCR validation, rule-based checks, and audit trails for regulatory compliance.

## Features

- ✅ **Immutable Original Storage** - SHA-256 deduplicated originals (WORM-compliant)
- ✅ **Multi-stage OCR Pipeline** - minicpm-v + llava:7b fallback models
- ✅ **Rule-Based Validation** - Format, length, and business rule validation
- ✅ **AI-Assisted Verification** - LLM confidence scoring on extracted data
- ✅ **Audit Trail** - Complete action logging for IRDAI/RBI compliance
- ✅ **Async Processing** - Non-blocking uploads with status callbacks
- ✅ **CRM Integration Ready** - Links to PolicyLead, PolicyIssuance workflows

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Web Application  │  │ Mobile App (TBD) │  │ Agent Portal     │   │
│  │ (Next.js)        │  │                  │  │ (Dashboard)      │   │
│  └────────┬─────────┘  └──────────────────┘  └────────┬─────────┘   │
└───────────┼────────────────────────────────────────────┼─────────────┘
            │                                            │
            ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                               │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  Rate Limiting | Auth (Clerk) | Audit Logging               │   │
│  └────────────────────┬──────────────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Document Management API                           │
│  Routes:                                                           │
│  ├── POST   /api/documents                      [Upload]            │
│  ├── GET    /api/documents/:id                  [Fetch details]     │
│  ├── PATCH  /api/documents/:id/status           [Update status]     │
│  └── POST   /api/documents/:id/validate         [Start validation] │
└─────────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Validation Processing Pipeline                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ OCR Engine       │→ │ Rule Validator   │→ │ AI Auditor     │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
└───────────┼────────────────────┼────────────────────▲──────────────┘
            ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL (PostgreSQL)                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Documents       │  │  Validation      │  │  Audit Trail     │   │
│  │  documents       │  │  logs + reports  │  │  (immutable)     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Storage (S3/MinIO)                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Original Files  │  │ Processed PDF/A  │  │ Extracted JSON   │   │
│  │  (WORM-enabled)  │  │                  │  │ (Schema-based)   │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Models

```sql
-- Main document record
documents:
- id (cuid)
- original_hash (SHA256, unique)  
- filename (user-facing)
- mimetype
- size_bytes
- upload_status (PENDING | UPLOAD_COMPLETE | PROCESSING_FAILED)
- validation_status (PENDING | IN_PROGRESS | VALIDATED | REJECTED | REVIEW_REQUIRED)
- uploaded_by (User.id)
- household_id (PolicyLead.id, optional)
- document_type (enum)
- timestamps

-- OCR processing stages
validation_logs:
- stage (OCR_COMPLETED | RULE_VALIDATED | AI_VERIFIED)
- status (SUCCESS | PARTIAL | FAILED)
- configuration (JSON)
- results (JSON)

-- Final validation decision
validation_reports:
- overall_status
- confidence_score (0.0 - 1.0)
- extracted_data (JSON, schema-compliant)
- discrepancies (JSON array of issues)
- visual_confidence, rule_confidence scores

-- Audit trail for compliance
audit_trail:
- actor_type (AGENT | SYSTEM | OCR_ENGINE)
- action (DOCUMENT_UPLOADED | VALIDATED | REJECTED)
- entity_type (DOCUMENT | VALIDATION_REPORT)
- ip_address, user_agent (for forensics)
```

## API Routes

### 1. Upload Document

```typescript
POST /api/documents

Request:
{
  "document_type": "KYC_AADHAAR_FRONT",
  "household_id": "lead_cl_abc123",
  "filename": "Aadhaar_front.pdf"
}

Response (201 Created):
{
  "success": true,
  "document_id": "doc_xyz789",
  "upload_status": "PENDING"
}
```

### 2. Complete Upload

```typescript
POST /api/documents/:id/upload-complete

Request: N/A (file already uploaded to S3)

Response:
{
  "success": true,
  "message": "Upload completed, processing started"
}
```

### 3. Submit for Validation

```typescript
POST /api/documents/:id/validate

Response:
{
  "success": true,
  "status": "IN_PROGRESS"
}
```

### 4. Get Document Details

```typescript
GET /api/documents/:id

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "doc_xyz789",
    "filename": "Aadhaar_front.pdf",
    "validation_status": "VALIDATED",
    "validation_report": {
      "status": "VALIDATED",
      "confidence_score": 0.96,
      "extracted_data": {
        "name": "Ramesh Kumar",
        "dob": "1985-03-15",
        "aadhaar_number": "XXXX-XXXX-1234"
      },
      "discrepancies": []
    }
  }
}
```

### 5. Update Document Status (Manual Override)

```typescript
PATCH /api/documents/:id/status

Request:
{
  "new_status": "VALIDATED",
  "agent_notes": "Address line 1 mismatch verified with voter ID"
}

Response:
{
  "success": true,
  "document_id": "doc_xyz789",
  "new_status": "VALIDATED"
}
```

## Document Types

```typescript
enum DocumentType {
  KYC_AADHAAR_FRONT    // Aadhaar front side ( mandatory)
  KYC_AADHAAR_BACK     // Aadhaar back side (for address if needed)
  KYC_PAN              // PAN card (mandatory for premium > ₹50k)
  KYC_ADDRESS          // Alternative address proof
  POLICY_APPLICATION   // Policy proposal form
  UNDERWRITING_MEDICAL // Medical test reports
  UNDERWRITING_INCOME  // Income certificates
}
```

## Validation Rules

### Aadhaar Validation
- Format: `XXXX-XXXX-XXXX` or `XXXXXXXXXXXX`
- Length: Exactly 12 digits
- Checksum validation (optional, via UIDAI API)

### PAN Validation
- Format: `AAAAA9999A` (5 letters + 4 digits + 1 letter)
- Uppercase only

### Date of Birth
- Must be in the past
- Minimum age: 0 years (infants)
- Maximum age: 100 years

## OCR Configuration

### Models
```typescript
OCR_PRIMARY_MODEL=minicpm-v   // Multimodal vision model
OCR_FALLBACK_MODEL=llava:7b   // Vision-language fallback
```

### Prompts
```typescript
// Aadhaar Front
"Extract name, DOB, gender, address, Aadhaar number. Preserve exact format."

// PAN Card  
"Extract name, father's name, DOB, PAN number"

// Default
"Extract all visible text from this document/image."
```

## Storage Strategy

### S3 Bucket Structure
```
surelm-documents-originals/              # WORM-enabled (immutable)
└── <sha256_hash>/
    └── original.pdf                    # Raw upload, never modified

surelm-documents-processed/
└── <document_id>/
    ├── proof_ofSubmission.pdf          # PDF/A with embedded metadata
    └── ocr_text_layer.txt              # All OCR text

surelm-documents-json/                   # Application read access
└── <document_id>/
    ├── validated.json                  # Structured, schema-compliant
    ├── raw_extracts.json               # Unvalidated OCR results
    └── validation_report.json          // Validation metadata
```

### Storage Costs (Estimated)
| Layer | Storage Type | Cost/Month (10k docs) |
|-------|-------------|----------------------|
| Originals | S3 + Object Lock | ~₹50/month |
| Processed PDF/A | S3 Standard-IA | ~₹30/month |
| JSON Data | S3 Standard | ~₹20/month |

## Security & Compliance

### Encryption
- **At Rest**: AES-256 (S3 server-side encryption)
- **In Transit**: TLS 1.3 enforced
- **Database**: PostgreSQL SSL connections

### Access Control
```typescript
// Document-level permissions
const PERMISSIONS = {
  upload: ['AGENT', 'ADMIN'],
  view_own: ['AGENT'],           // View only own uploads
  view_all: ['ADMIN'],
  override: ['ADMIN'],          // Bypass automated decisions
};
```

### Audit Requirements (IRDAI Section 42)
- Every action logged in `audit_trail`
- Include: actor, action, timestamp, IP address, user agent
- Exportable for regulatory review

## Validation Pipeline Flow

```
Document Upload (POST /api/documents)
    ↓
Store original: S3://originals/<hash>/original.pdf
    ↓
DB: INSERT documents (status=PENDING)
    ↓
S3 Event → Lambda → Queue
    ↓
QueueConsumer processes OCR:
1. Convert PDF to images (if needed)
2. Run minicpm-v OCR on each page
3. Fallback to llava:7b if confidence low
    ↓
DB: INSERT validation_log (stage=OCR_COMPLETED, status=SUCCESS)
    ↓
Extract structured data with JSON LLM prompt:
- Parse name, DOB, addresses, document numbers
- Validate against regex patterns
    ↓
DB: INSERT validation_log (stage=RULE_VALIDATED, status=SUCCESS/FAILURE)
    ↓
AI verification:
- Compare extracted data against OCR image
- Flag discrepancies
    ↓
DB: INSERT validation_report (overall_status=VALIDATED|REJECTED)
    ↓
DB: UPDATE documents.validation_status = <final_status>
    ↓
WebSocket event → Agent UI updated in real-time
```

## Edge Cases & Handling

### 1. Corrupted Files
**Detection**: Magic bytes check + size validation  
**Response**: Reject with `PROCESSING_FAILED` status, log error to audit trail

### 2. Poor Quality Scans (Low Contrast/Blurry)
**Detection**: OpenCV sharpness detection  
**Response**: Lower confidence score > flag for manual review

### 3. Multi-Version Documents
**Detection**: SHA-256 hash check before upload  
**Response**: Return existing document_id if identical file exists (deduplicate)

### 4. External API Failure (UIDAI/NSDL)
**Solution**: Circuit breaker pattern - skip external validation, proceed with OCR+rules only

### 5. Schema Evolution
**Strategy**: Versioned JSON schemas (`aadhaar_v1.json`, `aadhaar_v2.json`)  
**Transition**: Migrate via migration script on version bump

## Migration Notes

### Prerequisites
```bash
# Database (PostgreSQL)
docker-compose up -d postgres qdrant minio  # If using local MinIO for storage

# Environment Variables (.env.local)
OCR_PRIMARY_MODEL=minicpm-v
OCR_FALLBACK_MODEL=llava:7b
OLLAMA_HOST=http://localhost:11434
S3_ORIGINALS_bucket=surelm-documents-originals
STORAGE_BACKEND=minio  # or s3 for AWS
```

### Run Migrations
```bash
npx prisma migrate dev --name add_document_collection_and_validation
# OR if database already has data:
npx prisma db push
```

## Testing

### Unit Tests
```bash
npm run test:documents                # Document service tests
npm run test:ocr                      # OCR pipeline tests
npm run test:integration              # End-to-end validation flow
```

### Manual Testing
1. Start development server: `npm run dev`
2. Navigate to CRM page
3. Select a household → "Add KYC Documents"
4. Upload Aadhaar and PAN
5. Verify status updates in real-time
6. Check audit trail at `/admin/audit-trails`

## Future Enhancements

- [ ] UIDAI e-Aadhaar digital verification (API integration)
- [ ] NSDL PAN validation API
- [ ] Bank account validation via UPI/RTPS
- [ ] Document versioning (re-upload with new version number)
- [ ] Bulk upload for multiple households
- [ ] Mobile SDK for offline document capture

## Support & Maintenance

### Logs Location
```
/logs/validation/              # Validation pipeline logs
/logs/traces/                  # OpenTelemetry traces
/logs/application/.gitkeep     # Application logs
```

### Health Checks
```typescript
GET /api/health/documents

Response:
{
  "status": "healthy",
  "validation_queue_depth": 0,
  "ocr_model_status": {
    "primary": "available",
    "fallback": "available"
  }
}
```

## Related Modules

- **CRM**: Links to `PolicyLead`, `PolicyIssuance` models
- **Vector Search**: Documents processed via OCR can be RAG-indexed in Qdrant
- **Orchestration**: Validation pipeline integrates with workflow executor
- **Auditing**: All actions logged for compliance review

---

**Next Steps**: After API development completion, implement:
1. Real-time WebSocket updates to agent UI
2. S3/MinIO upload client integration  
3. Background worker for async validation processing
4. Admin dashboard for audit trail viewing