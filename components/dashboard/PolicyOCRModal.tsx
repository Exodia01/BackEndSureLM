// components/dashboard/PolicyOCRModal.tsx
"use client";

import { useState } from "react";
import ChecklistModal, { DocumentItem } from "./ChecklistModal";

interface ChecklistItem {
  itemId: string;
  docType: string;
  label: string;
}

interface Policy {
  name: string;
  provider: string;
  premium: string;
  coverage: string;
  tag: string;
  checklistItems?: ChecklistItem[];
}

type DocStatus = "pending" | "uploading" | "valid" | "invalid";

interface DocState {
  docType: "Aadhaar Card" | "PAN Card";
  status: DocStatus;
  preview: string | null;
  extractedName: string;
  reason: string;
}

const INITIAL_DOCS: DocState[] = [
  { docType: "Aadhaar Card", status: "pending", preview: null, extractedName: "", reason: "" },
  { docType: "PAN Card",     status: "pending", preview: null, extractedName: "", reason: "" },
];

interface Props {
  leadId: string;
  policy: Policy;
  householdName: string;
  onSuccess: (policy: Policy) => void;
  onClose: () => void;
}

export default function PolicyOCRModal({ leadId, policy, householdName, onSuccess, onClose }: Props) {
  const docsData = policy.checklistItems && policy.checklistItems.length > 0
    ? policy.checklistItems.map((item): DocState => ({
        docType: item.docType as "Aadhaar Card" | "PAN Card",
        status: "pending",
        preview: null,
        extractedName: "",
        reason: ""
      }))
    : INITIAL_DOCS;

  const [docs, setDocs] = useState<DocState[]>(docsData);

  return (
    <ChecklistModal
      isOpen={true}
      onClose={onClose}
      mandatoryDocs={docs.map((doc, idx) => ({
        id: doc.docType === "Aadhaar Card" ? "aadhaar" : "pan",
        type: doc.docType === "Aadhaar Card" ? "aadhaar" as const : "pan" as const,
        name: doc.docType,
        isMandatory: true,
        status: doc.status
      }))}
      onSaveBatch={(validatedDocs) => {
        if (validatedDocs.length) onSuccess(policy);
      }}
    />
  );
}
