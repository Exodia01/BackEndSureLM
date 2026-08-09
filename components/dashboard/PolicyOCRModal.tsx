// components/dashboard/PolicyOCRModal.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { X, Upload, CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";

interface Policy {
  name: string;
  provider: string;
  premium: string;
  coverage: string;
  tag: string;
}

interface Props {
  policy: Policy;
  householdName: string;
  leadId: string;
  onSuccess: (policy: Policy) => void;
  onClose: () => void;
}

type DocStatus = "pending" | "uploading" | "processing" | "valid" | "invalid" | "review";

interface DocState {
  docType: "Aadhaar Card" | "PAN Card";
  status: DocStatus;
  preview: string | null;
  message: string;
}

interface ChecklistRequirement {
  ruleKey: string;
  label: string;
  evidenceDocType: string | null;
  satisfied: boolean;
  evidenceDocumentId: string | null;
  reason: string;
}

interface ChecklistDocument {
  id: string;
  docType: string;
  status: string;
  requirementRuleKey: string | null;
}

interface ChecklistData {
  application: { id: string; status: string };
  evaluation: {
    satisfied: boolean;
    hasReviewRequired: boolean;
    hasFailedDocuments: boolean;
    hasDocuments: boolean;
    canApprove: boolean;
    blockers: string[];
    requirements: ChecklistRequirement[];
  };
  documents: ChecklistDocument[];
}

const DOC_TYPE_KEY: Record<DocState["docType"], string> = {
  "Aadhaar Card": "AADHAAR",
  "PAN Card": "PAN",
};

const TERMINAL = new Set(["VALIDATED", "REVIEW_REQUIRED", "OCR_FAILED", "EXTRACTION_FAILED", "VALIDATION_FAILED"]);

const STATUS_LABEL: Record<DocStatus, string> = {
  pending: "Waiting for upload…",
  uploading: "Uploading…",
  processing: "Processing…",
  valid: "Verified",
  invalid: "Failed",
  review: "Needs review",
};

const statusColor: Record<DocStatus, { border: string; headerBg: string; icon: string }> = {
  pending:   { border: "rgba(0,0,0,0.08)", headerBg: "#f8faf9", icon: "#cbd5e1" },
  uploading: { border: "rgba(5,150,105,0.3)", headerBg: "rgba(5,150,105,0.06)", icon: "#059669" },
  processing:{ border: "rgba(5,150,105,0.3)", headerBg: "rgba(5,150,105,0.06)", icon: "#059669" },
  valid:     { border: "rgba(5,150,105,0.35)", headerBg: "rgba(5,150,105,0.07)", icon: "#059669" },
  invalid:   { border: "rgba(239,68,68,0.35)", headerBg: "rgba(239,68,68,0.06)", icon: "#ef4444" },
  review:    { border: "rgba(234,179,8,0.35)", headerBg: "rgba(234,179,8,0.06)", icon: "#d97706" },
};

function StatusIcon({ status }: { status: DocStatus }) {
  if (status === "uploading" || status === "processing") return <Loader2 size={13} color="#059669" className="animate-spin" />;
  if (status === "valid") return <CheckCircle2 size={13} color="#059669" />;
  if (status === "invalid") return <XCircle size={13} color="#ef4444" />;
  if (status === "review") return <CheckCircle2 size={13} color="#d97706" />;
  return <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #cbd5e1" }} />;
}

function toLocalDocType(docType: string): string {
  if (docType === "AADHAAR") return "Aadhaar Card";
  if (docType === "PAN") return "PAN Card";
  return docType;
}

export default function PolicyOCRModal({ policy, householdName, leadId, onSuccess, onClose }: Props) {
  const [docs, setDocs] = useState<DocState[]>(() => [
    { docType: "Aadhaar Card", status: "pending", preview: null, message: "" },
    { docType: "PAN Card", status: "pending", preview: null, message: "" },
  ]);
  const [issuing, setIssuing] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const appIdRef = useRef<string | null>(null);
  const appPromiseRef = useRef<Promise<string> | null>(null);

  const setDoc = useCallback((idx: number, patch: Partial<DocState>) => {
    setDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }, []);

  const loadChecklist = useCallback(async () => {
    const appId = appIdRef.current;
    if (!appId) return;
    try {
      const res = await fetch(`/api/applications/${appId}/checklist`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load checklist");
      setChecklist(json.data);
      setChecklistError(null);
      setDocs((prev) =>
        prev.map((d) => {
          const matched = json.data.documents.find(
            (cd: ChecklistDocument) => toLocalDocType(cd.docType) === d.docType
          );
          if (!matched) return d;
          if (matched.status === "VALIDATED") return { ...d, status: "valid", message: "Verified" };
          if (matched.status === "REVIEW_REQUIRED") return { ...d, status: "review", message: "Needs manual review — document flagged." };
          if (matched.status === "REJECTED" || matched.status === "VALIDATION_FAILED" || matched.status === "OCR_FAILED" || matched.status === "EXTRACTION_FAILED") {
            return { ...d, status: "invalid", message: "Validation failed. Please try again." };
          }
          return d;
        })
      );
    } catch (error) {
      setChecklistError((error as Error).message);
    }
  }, []);

  const ensureApplication = useCallback(async (): Promise<string> => {
    if (appIdRef.current) return appIdRef.current;
    if (!appPromiseRef.current) {
      appPromiseRef.current = (async () => {
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, policyName: policy.name, policyProvider: policy.provider }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to create application");
        appIdRef.current = json.data.id;
        return json.data.id;
      })().finally(() => {
        appPromiseRef.current = null;
      });
    }
    return appPromiseRef.current;
  }, [leadId, policy.name, policy.provider]);

  const pollDocument = async (docId: string): Promise<void> => {
    // Poll the lifecycle until a terminal state or timeout (~2 min).
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const res = await fetch(`/api/documents/${docId}`);
      const json = await res.json();
      if (!json.success) continue;
      const doc = json.data;
      if (TERMINAL.has(doc.status)) {
        if (doc.status === "VALIDATED") return;
        if (doc.status === "REVIEW_REQUIRED") throw new Error("REVIEW_REQUIRED");
        throw new Error(doc.status);
      }
    }
    throw new Error("TIMEOUT");
  };

  const handleFileSelect = async (idx: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setDoc(idx, { preview, status: "uploading", message: STATUS_LABEL.uploading });

    try {
      const applicationId = await ensureApplication();
      await loadChecklist();

      const formData = new FormData();
      formData.append("applicationId", applicationId);
      formData.append("expectedDocType", DOC_TYPE_KEY[docs[idx].docType]);
      formData.append("file", file);

      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Upload failed");

      setDoc(idx, { status: "processing", message: STATUS_LABEL.processing });
      await pollDocument(json.data.id);
      setDoc(idx, { status: "valid", message: "Verified" });
      await loadChecklist();
    } catch (error) {
      const reason = (error as Error).message;
      if (reason === "REVIEW_REQUIRED") {
        setDoc(idx, { status: "review", message: "Needs manual review — document flagged." });
      } else if (reason === "TIMEOUT") {
        setDoc(idx, { status: "processing", message: "Still processing… check back shortly." });
      } else {
        setDoc(idx, { status: "invalid", message: "Validation failed. Please try again." });
      }
      await loadChecklist();
    }
  };

  const submitReview = async (doc: ChecklistDocument, verdict: "approve" | "reject") => {
    if (reviewingDoc) return;
    const notes = verdict === "reject" ? (rejectNotes[doc.id] ?? "").trim() : "";
    if (verdict === "reject" && !notes) return;
    setReviewingDoc(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, notes: notes || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Review failed");
      setRejectNotes((p) => {
        const next = { ...p };
        delete next[doc.id];
        return next;
      });
      setRejectingDoc((p) => (p === doc.id ? null : p));
      await loadChecklist();
    } catch (error) {
      setChecklistError((error as Error).message);
    } finally {
      setReviewingDoc(null);
    }
  };

  const allValid = docs.every((d) => d.status === "valid");
  const validCount = docs.filter((d) => d.status === "valid").length;
  const anyUploading = docs.some((d) => d.status === "uploading" || d.status === "processing");

  const handleIssue = async () => {
    if (!allValid || issuing) return;
    setIssuing(true);
    try {
      await onSuccess(policy);
    } finally {
      setIssuing(false);
      await loadChecklist();
    }
  };

  const reviewDocs = checklist?.documents.filter((d) => d.status === "REVIEW_REQUIRED") ?? [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        .upload-zone:hover { border-color: rgba(5,150,105,0.5) !important; background: rgba(5,150,105,0.03) !important; }
        .upload-zone:hover .upload-icon { color: #059669 !important; }
        .issue-btn:hover:not(:disabled) { background: #047857 !important; transform: translateY(-1px); }
        .retry-btn:hover { text-decoration: underline; }
        .review-btn:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(12,26,18,0.5)",
          backdropFilter: "blur(8px)",
          padding: 16,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
            width: "100%",
            maxWidth: 440,
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: "22px 22px 18px",
            borderBottom: "1px solid rgba(0,0,0,0.05)",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: "#0c1a12",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}>
                <ShieldCheck size={18} color="#4ade80" />
              </div>

              <p style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "#059669", marginBottom: 5,
              }}>
                KYC Verification
              </p>

              <h2 style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400, fontSize: 24,
                letterSpacing: "-0.02em", color: "#0c1a12",
                margin: 0, marginBottom: 2, lineHeight: 1.2,
              }}>
                {policy.name}
              </h2>
              <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8" }}>
                {householdName}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: 99,
                  background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={14} color="#64748b" />
              </button>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: validCount === docs.length
                  ? "rgba(5,150,105,0.09)"
                  : "rgba(0,0,0,0.04)",
                borderRadius: 999,
                padding: "4px 10px",
                border: `1px solid ${validCount === docs.length ? "rgba(5,150,105,0.2)" : "rgba(0,0,0,0.06)"}`,
              }}>
                {docs.map((d, i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: d.status === "valid"
                      ? "#059669"
                      : d.status === "invalid"
                      ? "#ef4444"
                      : d.status === "review"
                      ? "#d97706"
                      : d.status === "uploading" || d.status === "processing"
                      ? "#059669"
                      : "#cbd5e1",
                    transition: "background 0.2s",
                  }} />
                ))}
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: validCount === docs.length ? "#059669" : "#94a3b8",
                  marginLeft: 2,
                }}>
                  {validCount}/{docs.length}
                </span>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {/* Doc cards */}
            <div style={{ padding: "18px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {docs.map((doc, idx) => {
                const colors = statusColor[doc.status];
                return (
                  <div
                    key={doc.docType}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 16,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{
                      background: colors.headerBg,
                      padding: "9px 11px",
                      display: "flex", alignItems: "center", gap: 7,
                      borderBottom: `1px solid ${colors.border}`,
                    }}>
                      <StatusIcon status={doc.status} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#0c1a12", lineHeight: 1.3 }}>
                        {doc.docType}
                      </span>
                    </div>

                    <div style={{
                      padding: 10, background: "#fff",
                      flex: 1, display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      {doc.preview ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.preview}
                            alt="Document preview"
                            style={{
                              width: "100%", height: 80,
                              objectFit: "cover",
                              borderRadius: 10,
                              border: "1px solid rgba(0,0,0,0.06)",
                              display: "block",
                            }}
                          />

                          {doc.status === "valid" && (
                            <p style={{ fontSize: 11, fontWeight: 400, color: "#059669", lineHeight: 1.4 }}>
                              ✓ {doc.message}
                            </p>
                          )}

                          {doc.status === "invalid" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <p style={{ fontSize: 11, fontWeight: 300, color: "#ef4444", lineHeight: 1.4 }}>
                                {doc.message}
                              </p>
                              <button
                                className="retry-btn"
                                onClick={() => fileInputRefs.current[idx]?.click()}
                                style={{
                                  background: "none", border: "none",
                                  fontSize: 11, fontWeight: 500,
                                  color: "#ef4444", cursor: "pointer",
                                  textAlign: "left", padding: 0,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                Try again →
                              </button>
                            </div>
                          )}

                          {(doc.status === "uploading" || doc.status === "processing") && (
                            <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>
                              {doc.message}
                            </p>
                          )}

                          {doc.status === "review" && (
                            <p style={{ fontSize: 11, fontWeight: 400, color: "#d97706", lineHeight: 1.4 }}>
                              {doc.message}
                            </p>
                          )}
                        </>
                      ) : (
                        <button
                          className="upload-zone"
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          style={{
                            width: "100%", height: 80,
                            border: "1.5px dashed rgba(0,0,0,0.12)",
                            borderRadius: 10,
                            background: "none",
                            cursor: "pointer",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 5,
                            transition: "border-color 0.2s, background 0.2s",
                          }}
                        >
                          <Upload size={15} color="#94a3b8" className="upload-icon" style={{ transition: "color 0.2s" }} />
                          <span style={{
                            fontSize: 11, fontWeight: 400, color: "#94a3b8",
                            fontFamily: "'DM Sans', sans-serif",
                            transition: "color 0.2s",
                          }}>
                            Upload
                          </span>
                        </button>
                      )}
                    </div>

                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(idx, file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* ── Checklist panel ── */}
            {checklist && (
              <div style={{ padding: "18px 18px 0" }}>
                <div style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "11px 14px",
                    background: "#f8faf9",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "#0c1a12",
                    }}>
                      Application Checklist
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                      color: checklist.application.status === "APPROVED" || checklist.application.status === "ISSUED"
                        ? "#059669"
                        : "#64748b",
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.08)",
                      padding: "3px 9px", borderRadius: 999,
                    }}>
                      {checklist.application.status}
                    </span>
                  </div>

                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                    {checklist.evaluation.requirements.map((req) => (
                      <div key={req.ruleKey} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                        {req.satisfied ? (
                          <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                        ) : (
                          <XCircle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12", lineHeight: 1.4 }}>
                            {req.label}
                          </p>
                          <p style={{ fontSize: 11, fontWeight: 300, color: req.satisfied ? "#059669" : "#b45309", lineHeight: 1.45 }}>
                            {req.satisfied
                              ? `Evidence: ${req.evidenceDocType ?? "—"}`
                              : req.reason}
                          </p>
                        </div>
                      </div>
                    ))}

                    {!checklist.evaluation.canApprove && checklist.evaluation.blockers.length > 0 && (
                      <div style={{
                        background: "rgba(217,119,6,0.07)",
                        border: "1px solid rgba(217,119,6,0.18)",
                        borderRadius: 10,
                        padding: "8px 10px",
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b45309", marginBottom: 4 }}>
                          Blocking approval
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                          {checklist.evaluation.blockers.map((b, i) => (
                            <li key={i} style={{ fontSize: 11, fontWeight: 300, color: "#92400e", lineHeight: 1.45 }}>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {reviewDocs.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d97706", marginTop: 2 }}>
                          Documents awaiting review
                        </p>
                        {reviewDocs.map((doc) => (
                          <div key={doc.id} style={{
                            border: "1px solid rgba(217,119,6,0.3)",
                            borderRadius: 12,
                            padding: "9px 11px",
                            display: "flex", flexDirection: "column", gap: 8,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12" }}>
                                {toLocalDocType(doc.docType)}
                              </span>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  className="review-btn"
                                  disabled={reviewingDoc === doc.id}
                                  onClick={() => submitReview(doc, "approve")}
                                  style={{
                                    background: "#059669", color: "#fff",
                                    border: "none", borderRadius: 999,
                                    padding: "6px 12px",
                                    fontSize: 11, fontWeight: 500,
                                    fontFamily: "'DM Sans', sans-serif",
                                    cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 5,
                                  }}
                                >
                                  {reviewingDoc === doc.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                  Approve
                                </button>
                                <button
                                  className="review-btn"
                                  disabled={reviewingDoc === doc.id}
                                  onClick={() => setRejectingDoc((p) => (p === doc.id ? null : doc.id))}
                                  style={{
                                    background: "#fff", color: "#dc2626",
                                    border: "1px solid rgba(220,38,38,0.35)", borderRadius: 999,
                                    padding: "6px 12px",
                                    fontSize: 11, fontWeight: 500,
                                    fontFamily: "'DM Sans', sans-serif",
                                    cursor: "pointer",
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>

                            {rejectingDoc === doc.id && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <textarea
                                  value={rejectNotes[doc.id] ?? ""}
                                  onChange={(e) => setRejectNotes((p) => ({ ...p, [doc.id]: e.target.value }))}
                                  placeholder="Reason for rejection (required)"
                                  rows={2}
                                  style={{
                                    fontSize: 11, fontWeight: 300,
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    resize: "none",
                                    outline: "none",
                                    fontFamily: "'DM Sans', sans-serif",
                                    color: "#0c1a12",
                                  }}
                                />
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  <button
                                    onClick={() => setRejectingDoc(null)}
                                    style={{
                                      background: "none", border: "none",
                                      fontSize: 11, fontWeight: 500, color: "#64748b",
                                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={!(rejectNotes[doc.id] ?? "").trim()}
                                    onClick={() => submitReview(doc, "reject")}
                                    style={{
                                      background: "#dc2626", color: "#fff",
                                      border: "none", borderRadius: 999,
                                      padding: "6px 12px",
                                      fontSize: 11, fontWeight: 500,
                                      fontFamily: "'DM Sans', sans-serif",
                                      cursor: (rejectNotes[doc.id] ?? "").trim() ? "pointer" : "default",
                                      opacity: (rejectNotes[doc.id] ?? "").trim() ? 1 : 0.5,
                                    }}
                                  >
                                    {reviewingDoc === doc.id ? <Loader2 size={11} className="animate-spin" /> : "Confirm Reject"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {checklistError && (
                      <p style={{ fontSize: 11, fontWeight: 300, color: "#ef4444", lineHeight: 1.4 }}>
                        {checklistError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: "16px 18px 20px", borderTop: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
            {allValid ? (
              <button
                onClick={handleIssue}
                disabled={issuing}
                className="issue-btn"
                style={{
                  width: "100%",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "13px 24px",
                  fontSize: 14, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: issuing ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.15s, transform 0.15s",
                }}
              >
                {issuing
                  ? <><Loader2 size={15} className="animate-spin" /> Issuing Policy…</>
                  : <><ShieldCheck size={15} /> Issue Policy</>
                }
              </button>
            ) : (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>
                  {anyUploading
                    ? "Validating documents…"
                    : "Upload both documents to proceed"
                  }
                </p>
                <div style={{
                  height: 3, background: "rgba(0,0,0,0.05)",
                  borderRadius: 99, marginTop: 10, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${(validCount / docs.length) * 100}%`,
                    background: "#059669",
                    borderRadius: 99,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
