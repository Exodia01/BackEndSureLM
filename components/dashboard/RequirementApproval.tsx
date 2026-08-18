"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, Pencil, Trash2, RefreshCw, X, ShieldCheck } from "lucide-react";

interface Requirement {
  id: string;
  policyId: string;
  brochureId: string;
  isDraft: boolean;
  ruleKey: string;
  label: string;
  description: string | null;
  confidence: number;
  extractionMode: "EXPLICIT" | "INFERRED" | "UNCERTAIN";
  validationRules: Record<string, unknown> | null;
  provenance: Record<string, unknown> | null;
  sourceChunkIds: string[];
  maxAttempts: number;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RequirementApprovalProps {
  policyId: string;
  canAdmin: boolean;
  onChanged: () => void;
}

const MODE_META: Record<Requirement["extractionMode"], { label: string; color: string; bg: string }> = {
  EXPLICIT:  { label: "Explicit",  color: "#059669", bg: "rgba(5,150,105,0.09)" },
  INFERRED:  { label: "Inferred",  color: "#d97706", bg: "rgba(245,158,11,0.1)" },
  UNCERTAIN: { label: "Uncertain", color: "#dc2626", bg: "rgba(239,68,68,0.08)" },
};

export default function RequirementApproval({ policyId, canAdmin, onChanged }: RequirementApprovalProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch(`/api/policies/${policyId}/requirements?drafts=true`);
      const json = await res.json();
      if (json.requirements) setRequirements(json.requirements);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [policyId]);

  useEffect(() => { fetchRequirements(); }, [fetchRequirements]);

  const approve = async (r: Requirement) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/policies/${policyId}/requirements/${r.id}/approve`, { method: "POST" });
      const json = await res.json();
      if (json.requirement || json.success) {
        await fetchRequirements();
        onChanged();
        notify("Requirement approved");
      } else {
        notify(json.error ?? "Failed to approve");
      }
    } catch { notify("Failed to approve"); }
    finally { setBusyId(null); }
  };

  const reject = async (r: Requirement) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/policies/${policyId}/requirements/${r.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchRequirements();
        onChanged();
        notify("Draft rejected");
      } else {
        notify(json.error ?? "Failed to reject");
      }
    } catch { notify("Failed to reject"); }
    finally { setBusyId(null); }
  };

  const openEdit = (r: Requirement) => {
    setEditing(r);
    setEditLabel(r.label);
    setEditDescription(r.description ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      const res = await fetch(`/api/policies/${policyId}/requirements/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel, description: editDescription }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchRequirements();
        onChanged();
        setEditing(null);
        notify("Draft updated");
      } else {
        notify(json.error ?? "Failed to update");
      }
    } catch { notify("Failed to update"); }
    finally { setBusyId(null); }
  };

  const drafts = requirements.filter((r) => r.isDraft);
  const approved = requirements.filter((r) => !r.isDraft);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#f8faf9",
    border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12,
    padding: "10px 14px", fontSize: 13, fontWeight: 300,
    color: "#0c1a12", fontFamily: "'DM Sans',sans-serif",
    outline: "none", boxSizing: "border-box",
  };

  const renderRequirement = (r: Requirement) => {
    const meta = MODE_META[r.extractionMode] ?? MODE_META.UNCERTAIN;
    return (
      <div key={r.id} style={{
        background: "#fff", borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.05)",
        padding: "14px 16px", marginBottom: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 500,
                letterSpacing: "0.02em", padding: "3px 8px", borderRadius: 6,
                background: "rgba(12,26,18,0.05)", color: "#475569",
              }}>
                {r.ruleKey}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                background: meta.bg, color: meta.color,
              }}>
                {meta.label}
              </span>
              {r.isDraft ? (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                  background: "rgba(245,158,11,0.1)", color: "#d97706",
                }}>
                  DRAFT
                </span>
              ) : (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                  background: "rgba(5,150,105,0.09)", color: "#059669",
                }}>
                  APPROVED
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#0c1a12", marginBottom: 2 }}>
              {r.label}
            </p>
            {r.description && (
              <p style={{ fontSize: 12, fontWeight: 300, color: "#64748b", lineHeight: 1.55 }}>
                {r.description}
              </p>
            )}
            <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8", marginTop: 6 }}>
              confidence {(r.confidence * 100).toFixed(0)}% · {r.sourceChunkIds.length} source chunk{r.sourceChunkIds.length !== 1 ? "s" : ""}
              {r.approvedAt && ` · approved ${new Date(r.approvedAt).toLocaleDateString("en-IN")}`}
            </p>
          </div>

          {canAdmin && r.isDraft && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => openEdit(r)}
                disabled={busyId === r.id}
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Edit draft"
              >
                <Pencil size={13} color="#64748b" />
              </button>
              <button
                onClick={() => reject(r)}
                disabled={busyId === r.id}
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: "#fef2f2", border: "1px solid rgba(239,68,68,0.15)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Reject draft"
              >
                {busyId === r.id ? <Loader2 size={13} color="#ef4444" className="animate-spin" /> : <Trash2 size={13} color="#ef4444" />}
              </button>
              <button
                onClick={() => approve(r)}
                disabled={busyId === r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "#059669", border: "none", borderRadius: 9,
                  padding: "0 12px", cursor: "pointer",
                  fontSize: 12, fontWeight: 500, color: "#fff",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .reload-btn:hover{background:#f8faf9!important;}
        .save-btn:hover:not(:disabled){background:#047857!important;}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, color: "#0c1a12" }}>
            Requirement Approval
          </p>
          <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""} awaiting review · {approved.length} approved
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchRequirements(); }}
          className="reload-btn"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 10, padding: "8px 12px", cursor: "pointer",
            fontSize: 12, fontWeight: 400, color: "#64748b",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 160 }}>
          <Loader2 size={20} color="#059669" className="animate-spin" />
        </div>
      ) : requirements.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.05)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
            background: "rgba(5,150,105,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={20} color="#059669" />
          </div>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, color: "#0c1a12" }}>
            No requirements yet
          </p>
          <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8", maxWidth: 300, margin: "6px auto 0", lineHeight: 1.6 }}>
            Link a processed brochure to this policy, then extract requirements to populate drafts here.
          </p>
        </div>
      ) : (
        <div>
          {drafts.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
                Pending Drafts
              </p>
              {drafts.map(renderRequirement)}
            </>
          )}
          {approved.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", margin: drafts.length > 0 ? "16px 0 8px" : "0 0 8px" }}>
                Approved
              </p>
              {approved.map(renderRequirement)}
            </>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(12,26,18,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setEditing(null)} />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 24,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            width: "100%", maxWidth: 440, margin: "0 16px",
            padding: "32px 28px 28px", border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setEditing(null)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 30, height: 30, borderRadius: 99,
                background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={14} color="#64748b" />
            </button>

            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#059669", marginBottom: 6 }}>
              Edit Draft
            </p>
            <h2 style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 26, letterSpacing: "-0.02em", color: "#0c1a12", marginBottom: 4 }}>
              {editing.ruleKey}
            </h2>
            <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8", marginBottom: 20 }}>
              The stable rule key cannot be changed. Edit the label and description below.
            </p>

            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Label"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              rows={4}
              style={{ ...inputStyle, marginBottom: 18, resize: "vertical" }}
            />

            <button
              onClick={saveEdit}
              disabled={!editLabel.trim() || busyId === editing.id}
              className="save-btn"
              style={{
                width: "100%",
                background: editLabel.trim() && busyId !== editing.id ? "#059669" : "#e2e8f0",
                color: editLabel.trim() && busyId !== editing.id ? "#fff" : "#94a3b8",
                border: "none", borderRadius: 999,
                padding: "13px 26px", fontSize: 15, fontWeight: 500,
                fontFamily: "'DM Sans',sans-serif",
                cursor: editLabel.trim() && busyId !== editing.id ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {busyId === editing.id && <Loader2 size={15} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, background: "#0c1a12", color: "#fff",
          borderRadius: 999, padding: "10px 22px", fontSize: 13, fontWeight: 400,
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
