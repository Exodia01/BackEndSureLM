# SureLM — Controlled Architecture Remediation & Implementation Plan

**Repository:** `S:\BackEndSureLM`

**Purpose:** provide a controlled implementation plan for SureLM without scope drift, silo contamination, or accidental architectural changes.

**Operating principle:** the business contract is authoritative; repository state is evidence.

---

# 0. Locked Architecture

## Silo 1 — Internal policy knowledge

```text
ADMIN
 ↓
Brochure ingestion
 ↓
PDF storage
 ↓
Text extraction
 ↓
Chunking / categorization
 ↓
Embedding
 ↓
Qdrant: policy_knowledge
 ↓
Requirement extraction
 ↓
RequirementDefinition drafts
 ↓
ADMIN approval
 ↓
PolicyVersion
 ↓
RequirementSnapshot
```

## Silo 2 — Customer evidence

```text
Customer accepts policy
 ↓
Agreed PolicyVersion
 ↓
RequirementSnapshot
 ↓
ChecklistInstance
 ↓
ChecklistItem
 ↓
Customer document
 ↓
Attempt
 ↓
OCR / classification / extraction
 ↓
Identity matching
 ↓
Validation
 ↓
Requirement pass/fail
 ↓
Issuance gate
```

**Phase 2 implements Silo 1. Silo 2 remains deferred.**

---

# 1. Non-Negotiable Business Rules

1. Raw brochure ingestion is ADMIN-only.
2. Agents and customers cannot upload/manage internal brochures.
3. Policy requirements are part of Silo 1.
4. LLM extraction creates drafts, not authoritative requirements.
5. ADMIN approval is required before requirements can be versioned.
6. `allowReuse` defaults to `false`.
7. Maximum attempts per requirement are exactly `3`.
8. The maximum-attempt limit is stored in requirement metadata.
9. After three failures there is no manual override.
10. The terminal failure message is stored with the requirement.
11. Identity-match fields are defined by the requirement.
12. Missing identity data is handled conversationally before validation.
13. Policy versions are historical records.
14. Requirement snapshots are immutable.
15. Existing customer agreements never inherit later policy requirement changes.
16. Customer evidence does not become policy RAG knowledge by default.
17. OCR success is not validation success.

---

# 2. Phase 2 Scope

Phase 2 is the **Silo 1 policy-knowledge and requirement-definition phase**.

It delivers:

### Brochure ingestion

* ADMIN authorization;
* duplicate detection;
* filesystem PDF storage;
* PDF processing;
* text extraction;
* chunking;
* category detection;
* embedding generation;
* Qdrant indexing;
* READY status.

### Requirement extraction

* LLM-assisted extraction;
* draft requirements;
* source traceability;
* ADMIN approval/editing;
* approved requirement definitions.

### Policy lifecycle

* Policy creation;
* Policy ↔ Brochure linking;
* requirement management;
* PolicyVersion creation;
* immutable RequirementSnapshot creation.

### API boundary

* ADMIN-only mutation/admin APIs;
* authorized read-only policy/version metadata.

---

# 3. Phase 2 Does NOT Implement

Do not implement:

* customer document upload;
* ChecklistInstance;
* ChecklistItem validation;
* Attempt enforcement;
* customer OCR validation;
* customer document classification;
* identity matching implementation;
* issuance validation gate;
* customer portal;
* recommendation-engine redesign;
* chat protocol repair;
* CRM changes;
* retrieval-stack consolidation;
* broad authentication redesign;
* new admin dashboard UI.

Phase 2 is API-first.

---

# 4. Brochure Storage

Raw brochure PDFs move from database `Bytes` storage to filesystem storage.

Default:

```text
/data/pdfs/{hash}.pdf
```

The storage root should be configurable.

## Migration sequence

1. Add `filePath`.
2. Make existing `pdfData` nullable.
3. Migrate existing PDFs to filesystem.
4. Verify every migrated row.
5. Back up the Brochure table.
6. Drop `pdfData` only after verification.
7. Make `filePath` non-null.

Do not drop the source bytes before migration verification.

---

# 5. Canonical Brochure Pipeline

```text
POST /api/brochures
        ↓
ADMIN authorization
        ↓
uploadBrochure()
        ↓
hash / duplicate detection
        ↓
write /data/pdfs/{hash}.pdf
        ↓
Brochure(PENDING)
        ↓
processBrochure()
        ↓
extractPDFText()
        ↓
chunkText()
        ↓
detectCategory()
        ↓
generateEmbedding()
        ↓
Chunk rows + Qdrant upsert
        ↓
policy_knowledge
        ↓
Brochure(READY)
        ↓
requirement extraction
        ↓
RequirementDefinition drafts
```

Processing must be idempotent.

---

# 6. Qdrant Configuration

Canonical Phase 2 configuration:

```text
Collection: policy_knowledge
Embedding model: nomic-embed-text
Dimension: 768
```

Do not mix the new Silo 1 collection with legacy collections.

## Migration strategy

Reprocess existing `READY` brochures from their source PDFs.

Do not attempt a blind vector migration across collections/models with potentially incompatible dimensions.

Existing collections remain untouched until later retrieval consolidation.

---

# 7. Requirement Extraction

Requirement extraction is explicitly part of **Phase 2 / Silo 1**.

Preferred approach:

**Hybrid / Option C**

```text
Relevant brochure chunks
        ↓
LLM extraction
        ↓
Structured JSON
        ↓
RequirementDefinition
isDraft=true
        ↓
ADMIN review/edit
        ↓
ADMIN approval
        ↓
isDraft=false
```

The LLM should primarily inspect:

* eligibility;
* claims conditions;
* policy features;
* documentation requirements;
* application/KYC requirements explicitly stated by the source.

Initial product scope:

**Life insurance.**

Do not over-generalize the first extractor to every insurance product.

---

# 8. RequirementDefinition Contract

Conceptual schema:

```text
RequirementDefinition
├── policyId
├── documentType
├── category
├── description
├── isMandatory
├── displayOrder
├── allowReuse
├── validationRules
├── onMaxAttemptsMessage
├── isDraft
├── extractedFrom
├── createdAt
└── updatedAt
```

Required invariants:

```text
allowReuse = false by default

validationRules.maxAttempts = 3

LLM-generated draft:
isDraft = true

ADMIN-approved requirement:
isDraft = false
```

Expected `validationRules`:

```json
{
  "maxAttempts": 3,
  "identityMatch": ["name", "dateOfBirth"],
  "requiredFields": ["pan_number", "name", "dateOfBirth"],
  "ocrClassification": "PAN"
}
```

Keep the JSON extensible, but define a TypeScript/Zod representation of the expected shape so later validation logic is not built around untyped arbitrary JSON.

---

# 9. Requirement Extraction Authority

This is critical:

```text
LLM output
    ≠
authoritative policy requirement
```

Correct:

```text
LLM
 ↓
draft
 ↓
ADMIN review
 ↓
ADMIN approval
 ↓
authoritative RequirementDefinition
```

The extractor must not silently create a customer-facing policy requirement without approval.

---

# 10. Policy and Versioning

Canonical relationship:

```text
Policy
 ├── PolicyBrochure[]
 ├── RequirementDefinition[]
 └── PolicyVersion[]

PolicyVersion
 └── RequirementSnapshot[]
```

PolicyVersion creation copies only:

```text
RequirementDefinition.isDraft = false
```

Draft requirements are excluded.

---

# 11. RequirementSnapshot

`RequirementSnapshot` is the immutable Silo 1 → Silo 2 boundary.

Snapshot contains:

* documentType;
* category;
* description;
* isMandatory;
* displayOrder;
* allowReuse;
* validationRules;
* onMaxAttemptsMessage;
* snapshotAt.

Example:

```text
RequirementDefinition
        │
        ├── mutable for future versions
        │
        ▼
PolicyVersion
        │
        ▼
RequirementSnapshot
        │
        └── immutable
```

Test:

```text
Create requirement A
Create PolicyVersion
Create snapshot A

Modify requirement A

Snapshot A must remain unchanged
```

---

# 12. API Surface

## Brochures

```text
POST   /api/brochures
GET    /api/brochures
GET    /api/brochures/:id
DELETE /api/brochures/:id
POST   /api/brochures/batch
```

Administration operations are ADMIN-only.

## Policies

```text
POST   /api/policies
GET    /api/policies
PATCH  /api/policies/:id
```

Mutations are ADMIN-only.

GET exposes authorized metadata only.

## Requirements

```text
GET    /api/policies/:id/requirements
POST   /api/policies/:id/requirements
PATCH  /api/policies/:id/requirements/:requirementId
DELETE /api/policies/:id/requirements/:requirementId
```

ADMIN sees drafts and approved requirements.

Non-ADMIN consumers receive only approved information where authorized.

## Versions

```text
POST /api/policies/:id/versions
GET  /api/policies/:id/versions
```

POST is ADMIN-only.

## Policy ↔ Brochure

```text
POST   /api/policies/:id/brochures
GET    /api/policies/:id/brochures
DELETE /api/policies/:id/brochures/:brochureId
```

Mutation is ADMIN-only.

---

# 13. Authorization

Use defense in depth.

### Layer 1

Middleware protects ADMIN-only route groups.

### Layer 2

Sensitive handlers independently call:

```text
requireAdmin()
```

Expected behavior:

```text
No authentication → 401
AGENT → 403
ADMIN → allowed
```

Do not use Phase 2 as an excuse to redesign the entire authentication/session system.

---

# 14. BrochureStatus

Retain `ARCHIVED` as a valid lifecycle value because existing implementation references it.

Do not redesign brochure lifecycle semantics as unrelated cleanup.

---

# 15. Admin UI

Phase 2 is **API-first**.

Do not create a new admin dashboard.

A future phase can add:

* brochure manager;
* requirement editor;
* draft review UI;
* approval workflow.

For Phase 2, API tooling/scripts are sufficient.

---

# 16. Legacy Retrieval Protection

`lib/ai/hybridRetrieval.ts` is not the Silo 1 source of truth.

Keep it untouched/deprecated unless a narrow compatibility change is strictly required.

Do not perform the broad retrieval/vector consolidation in Phase 2.

Do not delete duplicate stacks merely because they are known architectural debt.

---

# 17. Protected Files / Areas

Keep these outside Phase 2 unless a strictly necessary compatibility change is demonstrated.

### Silo 2

```text
components/dashboard/PolicyOCRModal.tsx
components/dashboard/ChecklistUploadModal.tsx
app/api/ocr/route.ts
app/api/issuances/route.ts
```

### Chat / recommendations

```text
lib/ai/generateRecommendations.ts
lib/ai/retrievePolicies.ts
app/api/chat/route.ts
components/dashboard/ChatArea.tsx
```

### CRM

```text
app/api/crm/*
app/api/leads/*
app/api/messages/*
app/api/birthdays/*
app/api/reminders/*
```

### Auth session wiring

```text
lib/auth/session.ts
app/(auth)/sign-in/*
app/(auth)/sign-up/*
```

### Retrieval consolidation

```text
lib/retrieval/*
lib/vector/*
lib/ai/hybridRetrieval.ts
```

---

# 18. Tests

## Requirement extraction

`tests/unit/requirement-extraction.test.ts`

Verify:

* valid LLM JSON creates drafts;
* drafts have `isDraft=true`;
* `extractedFrom` is correct;
* invalid JSON creates no authoritative requirements;
* `maxAttempts` is 3;
* `allowReuse` defaults false.

## Policy versioning

`tests/unit/policy-versioning.test.ts`

Verify:

* approved requirements are copied;
* drafts are excluded;
* snapshot values match source at creation;
* later RequirementDefinition changes do not modify snapshots.

## Deduplication

`tests/unit/brochure-dedup.test.ts`

Verify:

```text
same hash
→ existing brochure
→ no duplicate processing
```

and:

```text
same basename + different hash
→ new version
```

## ADMIN guard

`tests/unit/auth-admin-guard.test.ts`

Verify:

```text
no token → 401
AGENT → 403
ADMIN → allowed
```

## Brochure pipeline

`tests/integration/brochure-pipeline.test.ts`

Verify:

```text
upload
→ Brochure
→ processing
→ Chunk rows
→ policy_knowledge Qdrant points
→ requirement drafts
```

## Policy API

`tests/integration/policy-api.test.ts`

Verify:

* ADMIN policy creation;
* AGENT rejection;
* requirement creation/edit/approval;
* version creation;
* snapshot creation;
* snapshot immutability.

## Brochure authorization

`tests/integration/brochure-auth.test.ts`

Verify:

```text
no token → 401
AGENT → 403
ADMIN → allowed
```

---

# 19. Migration Safety

## PDF migration

```text
Backup
 ↓
Write files
 ↓
Verify filesystem
 ↓
Verify hash/path
 ↓
Verify every row
 ↓
Drop BYTEA
```

Keep the original database column until verification is complete.

## Qdrant

Do not destroy legacy collections during migration.

Target:

```text
policy_knowledge
```

Reprocess source brochures.

Verify:

* collection exists;
* dimension is 768;
* expected points exist;
* payload metadata exists;
* processing is idempotent.

---

# 20. Phase 2 Verification

Minimum successful path:

```text
Schema validates
        ↓
Brochure upload is ADMIN-only
        ↓
PDF stored on filesystem
        ↓
Brochure processing completes
        ↓
Chunks exist
        ↓
Qdrant policy_knowledge contains points
        ↓
Requirement drafts are created
        ↓
ADMIN approves/edits drafts
        ↓
Approved requirements persist
        ↓
PolicyVersion created
        ↓
RequirementSnapshots created
        ↓
Snapshots remain unchanged after source edits
```

Also verify unrelated baseline failures independently.

Do not silently fix unrelated TypeScript errors.

---

# 21. Baseline Discipline

Known pre-existing TypeScript errors must remain separately tracked.

Every failure must be classified as either:

```text
introduced by Phase 2
```

or:

```text
pre-existing and independently verified
```

Do not label errors pre-existing without evidence.

Avoid destructive build/cleanup commands when they are not required for verification.

---

# 22. Phase 2 Acceptance Criteria

## Security

* brochure APIs reject unauthenticated callers;
* AGENT cannot administer brochures;
* ADMIN can perform permitted operations.

## Ingestion

* PDFs are stored on filesystem;
* duplicate detection works;
* processing works;
* chunks persist;
* Qdrant `policy_knowledge` contains 768-dimensional `nomic-embed-text` vectors.

## Requirements

* LLM extraction produces structured drafts;
* drafts retain source traceability;
* ADMIN can edit/approve;
* only approved requirements are versionable;
* `allowReuse=false` by default;
* `maxAttempts=3`;
* failure message persists.

## Versioning

* PolicyVersion can be created;
* RequirementSnapshot is created from approved requirements;
* snapshots remain immutable;
* historical requirements cannot be changed through current definitions.

## Boundaries

* no Silo 2 implementation;
* no customer evidence in policy RAG;
* no manual validation override;
* no unrelated architecture refactor.

---

# 23. Dependency-Ordered Implementation

```text
1. Prisma schema
       ↓
2. Filesystem brochure storage
       ↓
3. Brochure dedup / processing
       ↓
4. Qdrant policy_knowledge upsert
       ↓
5. ADMIN authorization
       ↓
6. Policy APIs
       ↓
7. Requirement APIs
       ↓
8. LLM requirement extraction
       ↓
9. ADMIN draft approval
       ↓
10. PolicyVersion + RequirementSnapshot
       ↓
11. Unit tests
       ↓
12. Integration tests
       ↓
13. Final verification
```

Do not reorder dependencies simply to make isolated files compile.

---

# 24. Absolute Anti-Drift Rules

OpenCode must NOT:

* merge Silo 1 and Silo 2;
* allow agents to upload brochures;
* make LLM output authoritative without ADMIN approval;
* version draft requirements;
* allow reuse by default;
* exceed three attempts in the future customer workflow;
* introduce manual overrides;
* mutate RequirementSnapshot;
* put customer documents into policy RAG;
* redesign authentication broadly;
* fix unrelated TypeScript errors;
* consolidate retrieval stacks during Phase 2;
* build the admin dashboard during Phase 2;
* create duplicate requirement sources of truth;
* create roadmap/architecture files unless explicitly requested;
* change business rules to fit existing implementation.

---

# 25. Final Target Architecture

```text
                    ADMIN
                      │
                      ▼
             POST /api/brochures
                      │
                      ▼
             BROCHURE INGESTION
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
       PostgreSQL             Qdrant
        Chunks              policy_knowledge
          │                       │
          └───────────┬───────────┘
                      ▼
             REQUIREMENT EXTRACTION
                      │
                      ▼
          RequirementDefinition
                 isDraft=true
                      │
                      ▼
                ADMIN REVIEW
                      │
                      ▼
          RequirementDefinition
                 isDraft=false
                      │
                      ▼
                PolicyVersion
                      │
                      ▼
          RequirementSnapshot
                 IMMUTABLE
                      │
                      │
              Silo 1 → Silo 2
                      │
                      ▼
             Customer accepts
                      │
                      ▼
              ChecklistInstance
                      │
                      ▼
             Customer documents
                      │
                      ▼
               OCR / validation
                      │
                      ▼
               Issuance gate
```

---

# 26. Founder-Control Principle

The repository must conform to the business architecture, not the other way around.

When existing code conflicts with this plan:

1. identify the conflict;
2. preserve the business rule;
3. make the smallest architectural correction required;
4. avoid unrelated refactoring;
5. record the deviation;
6. test the changed behavior.

**Do not weaken the business model to make the old implementation easier to preserve.**
