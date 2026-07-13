# Document Verification API Tests

## Endpoints Verified

### 1. Document Upload Endpoint
- POST /api/documents
- Expected: Creates document record with PENDING status
- Auth: Requires Clerk authentication

### 2. Get Documents List  
- GET /api/documents
- Expected: Returns all documents for authenticated user
- Auth: Requires Clerk authentication

### 3. Document Details
- GET /api/documents/:id
- Expected: Returns full document details with validation report
- Auth: User own resource or ADMIN role

### 4. Update Status (Manual Override)
- PATCH /api/documents/:id/status
- Expected: Updates validation status and logs review action
- Auth: ADMIN role required for override

### 5. Submit for Validation
- POST /api/documents/:id/validate  
- Expected: Triggers async validation pipeline
- Auth: Requires Clerk authentication

## Database Tables Created

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('document', 'validation_log', 'validation_report', 'audit_trail');
```

Expected tables:
- documents (main document metadata)
- validation_logs (processing stages)
- validation_reports (final decision with scores)
- audit_trail (compliance logging)

## Prisma Schema Verification

Run: `npx prisma validate`
Expected: No errors

Run: `npx prisma generate`  
Expected: Client generated successfully

## API Contract Compliance

All endpoints follow Next.js App Router patterns:
```typescript
export async function POST(req: NextRequest)
export async function GET(req: NextRequest, { params }: { params: { id: string } })
```

Error handling pattern:
```typescript
if (error) return NextResponse.json({ error }, { status: X });
return NextResponse.json({ success: true, data });
```

## Environment Requirements

Required .env variables:
- OCR_PRIMARY_MODEL=minicpm-v
- OCR_FALLBACK_MODEL=llava:7b  
- OLLAMA_HOST=http://localhost:11434
- DATABASE_URL (PostgreSQL connection)
- S3_ORIGINALS_BUCKET=surelm-documents-originals (optional, uses MinIO)

## Next Steps for Full Integration

1. **OCR Service**: Replace placeholder in `lib/documents/ocr.ts` with actual Ollama implementation
2. **Validation Worker**: Implement async queue processing (RabbitMQ/SQS)
3. **S3 Storage**: Integrate with AWS S3 or MinIO for file storage
4. **Frontend**: Connect document upload modal to new API routes
5. **WebSockets**: Add real-time status updates to agent UI

## Database Seed Script

Optional: Create test data
```typescript
// scripts/seed-documents.ts
const testDocument = await db.document.create({
  data: {
    originalHash: 'test_hash',
    filename: 'Aadhaar_test.pdf',
    mimetype: 'application/pdf',
    sizeBytes: 1024,
    uploadedBy: '<user_id>',
    documentType: 'KYC_AADHAAR_FRONT',
  }
});
```

## Notes

- All new files follow existing project conventions
- No breaking changes to existing schema (backward compatible)
- Migration-safe with Prisma migrations
