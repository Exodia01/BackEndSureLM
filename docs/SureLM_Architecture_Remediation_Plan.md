# SureLM — Business & System Context Contract

## Purpose

This document is the authoritative business-use-case contract for AI agents and engineers working on the SureLM codebase.

It defines the business boundaries, document silos, policy-requirement lifecycle, validation rules, and non-negotiable constraints.

**Business model is the source of truth. The repository is evidence of implementation. Never change the business model merely to fit existing code.**

---

# 1. SureLM Business Flow

SureLM is an insurance-distribution platform.

The relevant document-driven flow is:

```text
SureLM Core Team
      ↓
Internal insurance brochure / policy ingestion
      ↓
Policy knowledge + structured policy requirements
      ↓
Policy configuration + versioning
      ↓
Agent recommends policy
      ↓
Customer accepts policy
      ↓
Exact agreed Policy Version
      ↓
Immutable requirement snapshot
      ↓
Customer checklist
      ↓
Customer provides required documents
      ↓
Requirement-specific OCR / classification / extraction
      ↓
Identity matching + validation
      ↓
Checklist requirements pass
      ↓
Issuance readiness
```

This is an insurance workflow, not generic document management.

---

# 2. Two Fundamentally Different Document Silos

## Silo 1 — Internal Policy / Brochure Knowledge

### Owner

**SureLM core team / authorized internal backend processing.**

### Access

Insurance agents and customers must **not** upload, modify, or manage raw insurer brochures.

Raw brochure ingestion is **ADMIN-only**.

### Purpose

These documents teach SureLM about insurance products.

Examples:

* Insurance brochures
* Policy wording
* Eligibility rules
* Benefits
* Exclusions
* Claims conditions
* Terms and conditions
* Product-specific document requirements

### Processing

The Silo 1 pipeline may:

1. accept an insurer brochure;
2. store the source PDF;
3. extract text;
4. chunk the text;
5. classify chunks;
6. generate embeddings;
7. index policy knowledge;
8. extract structured policy requirements;
9. allow ADMIN review/editing of extracted requirements;
10. create an immutable policy version containing approved requirements.

A brochure is **policy knowledge**, not a customer document.

---

# 3. Silo 1 Requirement Lifecycle

Structured policy requirements are part of **Silo 1 / Phase 2**.

Canonical lifecycle:

```text
Brochure
   ↓
Extract / classify / chunk
   ↓
LLM-assisted requirement extraction
   ↓
RequirementDefinition
isDraft = true
   ↓
ADMIN review / edit
   ↓
ADMIN approval
isDraft = false
   ↓
PolicyVersion creation
   ↓
RequirementSnapshot
immutable
   ↓
Silo 2 consumes snapshot
```

The LLM is an **assistant**, not the authority.

LLM extraction creates draft requirements only.

ADMIN approval makes a requirement authoritative for versioning.

---

# 4. RequirementDefinition

A `RequirementDefinition` represents the current, mutable definition of a document requirement for a policy.

It defines:

* `documentType`
* `category`
* `description`
* `isMandatory`
* `displayOrder`
* `allowReuse`
* `validationRules`
* `onMaxAttemptsMessage`
* `isDraft`
* `extractedFrom`

### `allowReuse`

Default:

```text
false
```

A single uploaded customer document must not satisfy multiple checklist requirements unless explicitly permitted.

### `validationRules`

Expected structure:

```json
{
  "maxAttempts": 3,
  "identityMatch": ["name", "dateOfBirth"],
  "requiredFields": ["pan_number", "name", "dateOfBirth"],
  "ocrClassification": "PAN"
}
```

The structure remains extensible, but its expected shape must be documented and validated in code.

### `isDraft`

```text
true  = extracted/proposed but not authoritative
false = approved by ADMIN
```

### `extractedFrom`

Provides traceability to the brochure/source/chunk from which the requirement was derived.

---

# 5. RequirementSnapshot

`RequirementSnapshot` is the Silo 1 → Silo 2 contract.

When an ADMIN creates a `PolicyVersion`, approved `RequirementDefinition` records are copied into immutable snapshots.

Draft requirements must never enter a snapshot.

Example:

```text
Policy v1
requirements A, B, C

Customer accepts v1
        ↓
Snapshot A, B, C

Policy later changes to v2
requirements A, B, D

Existing v1 customer
        ↓
still requires A, B, C
```

Changing current policy requirements must never silently change an existing customer's agreed requirements.

---

# 6. Policy Versioning

Canonical Silo 1 relationship:

```text
Policy
  ↓
PolicyVersion
  ↓
RequirementSnapshot[]
```

Policy versions preserve historical truth.

The system must be able to determine:

* which policy was selected;
* which version applied;
* which requirements were in force;
* which snapshot generated the customer's checklist.

---

# 7. One Document Cannot Automatically Satisfy Multiple Requirements

Default:

```text
allowReuse = false
```

Example:

```text
Requirement A = PAN
Requirement B = Identity Proof

PAN upload
≠
automatic fulfillment of A + B
```

Reuse is permitted only when explicitly modelled.

---

# 8. Maximum Three Attempts

Every requirement has:

```text
maxAttempts = 3
```

Expected lifecycle:

```text
Attempt 1 → FAIL
Attempt 2 → FAIL
Attempt 3 → FAIL
              ↓
       TERMINAL FAILURE
```

The limit is defined in Silo 1 requirement metadata and enforced by Silo 2.

The system must not:

* silently reset attempts;
* create unlimited retries;
* bypass the limit;
* automatically accept after the limit.

---

# 9. No Manual Override

After the third failed attempt, the requirement reaches terminal failure.

The system displays the requirement's `onMaxAttemptsMessage`.

There is currently **no manual override**.

Default message:

> This document appears invalid. Please double-check or provide another document in the same category.

Do not introduce an override without explicit business approval.

---

# 10. Identity Data Before Validation

Identity matching requires sufficient customer/application information.

If required information is missing or ambiguous, it must be addressed during the conversational/customer-information phase **before document validation**.

```text
Customer wants Policy X
        ↓
Chat gathers required identity/application data
        ↓
Data sufficiently complete
        ↓
Customer checklist
        ↓
Document upload
        ↓
Identity validation
```

Do not invent missing customer information.

---

# 11. OCR Is Not Validation

OCR success does not mean a document is valid.

Validation must consider:

1. document type;
2. readability/usability;
3. required fields;
4. policy-specific validation rules;
5. identity matching.

Example:

```text
Requirement = PAN
Uploaded = Electricity Bill

→ DOCUMENT_TYPE_MISMATCH
→ Requirement fails
```

Example:

```text
Requirement = PAN
Uploaded = another person's PAN

→ IDENTITY_MISMATCH
→ Requirement fails
```

Canonical flow:

```text
Customer Upload
      ↓
Classification
      ↓
OCR / Extraction
      ↓
Required-field validation
      ↓
Identity matching
      ↓
Requirement decision
```

Never treat OCR success as document validation.

---

# 12. Roles

## ADMIN / Core Team

Controls:

* raw brochure ingestion;
* policy configuration;
* policy knowledge;
* requirement extraction;
* requirement approval;
* policy version creation;
* internal policy administration.

## AGENT

Uses SureLM for:

* policy discovery/recommendation;
* customer interaction;
* application workflow;
* policy selection.

Agents do not access raw brochure ingestion.

## CUSTOMER

Provides evidence required by the selected policy:

* PAN;
* Aadhaar;
* address proof;
* other policy-specific documents.

---

# 13. Authorization Boundary

```text
Raw brochure ingestion
        ↓
ADMIN only
```

Use defense in depth:

* middleware protection;
* explicit per-route authorization;
* `requireAdmin()` on sensitive administration APIs.

Authentication alone is not sufficient.

---

# 14. Silo Boundary

```text
                 SILO 1
       INTERNAL POLICY KNOWLEDGE
                 │
                 ▼
             BROCHURE
                 │
        parse / chunk / embed
                 │
                 ▼
        POLICY KNOWLEDGE
                 │
                 ▼
              POLICY
                 │
                 ▼
           POLICY VERSION
                 │
                 ▼
      REQUIREMENT SNAPSHOT
                 │
                 ▼
                 SILO 2
        CUSTOMER APPLICATION
                 │
                 ▼
           CHECKLIST
                 │
                 ▼
       CUSTOMER DOCUMENT
                 │
                 ▼
       ATTEMPT / VALIDATION
```

Silo 1 must not depend on customer checklist/document tables.

Silo 2 may reference the agreed Silo 1 version/snapshot.

---

# 15. Customer Documents Must Not Pollute Policy Knowledge

Customer documents are evidence for a specific application.

They must not become part of policy RAG knowledge by default.

Policy RAG answers questions about products and policies.

Customer evidence belongs to the customer/application workflow.

---

# 16. Auditability

The system should ultimately determine:

* source brochure;
* policy;
* policy version;
* requirement definition;
* requirement snapshot;
* customer/application;
* checklist;
* requirement being fulfilled;
* upload attempt number;
* validation result;
* rejection reason;
* identity-match result;
* timestamps.

Important business state must not exist only in UI state.

---

# 17. Phase Boundaries

## Phase 2 / Silo 1

Includes:

* brochure ingestion;
* filesystem PDF storage;
* extraction/chunking;
* policy knowledge indexing;
* requirement extraction;
* draft requirement creation;
* ADMIN approval;
* Policy creation;
* Policy ↔ Brochure linking;
* PolicyVersion creation;
* immutable RequirementSnapshot creation;
* Silo 1 authorization.

## Deferred to Phase 4 / Silo 2

Includes:

* customer document upload;
* ChecklistInstance;
* ChecklistItem;
* Attempt enforcement;
* OCR validation;
* classification;
* identity matching;
* validation gate;
* issuance gate.

Also deferred:

* recommendation-engine redesign;
* chat protocol repair;
* CRM redesign;
* retrieval-stack consolidation;
* broad authentication redesign;
* customer portal;
* admin dashboard UI.

---

# 18. Anti-Patterns

Do not:

* merge brochure and customer-document workflows;
* let agents upload internal brochures;
* make LLM extraction authoritative without ADMIN approval;
* version draft requirements;
* allow document reuse by default;
* allow unlimited retries;
* add manual overrides;
* mutate historical requirements;
* treat OCR as validation;
* put customer evidence into policy RAG;
* create a second source of truth for requirements;
* create duplicate OCR/validation pipelines;
* perform unrelated refactors during Silo 1 work.

---

# 19. Required AI Reasoning Before Changes

Before modifying document-related code, identify:

### Which silo?

```text
Silo 1 = internal policy/brochure source material
Silo 2 = customer evidence for a selected policy
```

### What is authoritative?

```text
Brochure
→ LLM draft
→ ADMIN approval
→ RequirementDefinition
→ PolicyVersion
→ immutable RequirementSnapshot
```

### Can this affect historical customers?

If yes, preserve the agreed policy version and snapshot.

### Is this a business rule or implementation detail?

Do not invent business rules from implementation convenience.

---

# 20. Canonical Business Architecture

```text
                 INTERNAL / ADMIN
                       │
                       ▼
                BROCHURE PDF
                       │
              extraction/chunking
                       │
                       ▼
               POLICY KNOWLEDGE
                       │
                       ▼
                 LLM EXTRACTION
                       │
                       ▼
            REQUIREMENT DEFINITION
                  isDraft=true
                       │
                       ▼
                ADMIN REVIEW
                       │
                       ▼
             APPROVED REQUIREMENT
                  isDraft=false
                       │
                       ▼
                POLICY VERSION
                       │
                       ▼
          IMMUTABLE REQUIREMENT
                SNAPSHOT
                       │
                       ▼
              CUSTOMER ACCEPTS
                       │
                       ▼
               CHECKLIST INSTANCE
                       │
                       ▼
            CUSTOMER DOCUMENTS
                       │
                       ▼
             OCR / CLASSIFICATION
                       │
                       ▼
              IDENTITY MATCHING
                       │
                       ▼
                VALIDATION
                       │
                 ┌─────┴─────┐
                 ▼           ▼
                PASS         FAIL
                             │
                       attempt 1 → 2 → 3
                             │
                             ▼
                     TERMINAL FAILURE
```
