"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Rocket, X, History, CheckCircle2 } from "lucide-react";

interface VersionEntry {
  id: string;
  policyId: string;
  versionNum: number;
  label: string | null;
  publishedBy: string | null;
  publishedAt: string;
  createdAt: string;
  isCurrent: boolean;
  snapshot: {
    id: string;
    requirements: unknown[];
  } | null;
}

interface PolicyVersionHistoryProps {
  policyId: string;
  canAdmin: boolean;
  onChanged: () => void;
}

export default function PolicyVersionHistory({ policyId, canAdmin, onChanged }: PolicyVersionHistoryProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [label, setLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const fetchVersions = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/versions`);
      const json = await res.json();
      if (json.versions) {
        setVersions(json.versions);
        onChanged();
      } else if (json.error) {
        setError(json.error);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [policyId, onChanged]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchVersions();
        setShowPublish(false);
        setLabel("");
        notify(`Version v${json.version.versionNum} published`);
      } else {
        setError(json.error ?? "Failed to publish version");
      }
    } catch { setError("Failed to publish version"); }
    finally { setPublishing(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#f8faf9",
    border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12,
    padding: "10px 14px", fontSize: 13, fontWeight: 300,
    color: "#0c1a12", fontFamily: "'DM Sans',sans-serif",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        .reload-btn:hover{background:#f8faf9!important;}
        .publish-btn:hover{background:#047857!important;}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, color: "#0c1a12" }}>
            Version History
          </p>
          <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
            {versions.length} version{versions.length !== 1 ? "s" : ""} · current version is authoritative
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setLoading(true); fetchVersions(); }}
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
          {canAdmin && (
            <button
              onClick={() => setShowPublish(true)}
              className="publish-btn"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#059669", border: "none", borderRadius: 10,
                padding: "8px 14px", cursor: "pointer",
                fontSize: 12, fontWeight: 500, color: "#fff",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Rocket size={13} /> Publish Version
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 14, padding: "12px 16px", marginBottom: 12,
          fontSize: 12, fontWeight: 400, color: "#b91c1c",
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 160 }}>
          <Loader2 size={20} color="#059669" className="animate-spin" />
        </div>
      ) : versions.length === 0 ? (
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
            <History size={20} color="#059669" />
          </div>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, color: "#0c1a12" }}>
            No versions published
          </p>
          <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8", maxWidth: 300, margin: "6px auto 0", lineHeight: 1.6 }}>
            Publish a version once the approved requirements are complete. Publishing snapshots them immutably and marks the version current.
          </p>
        </div>
      ) : (
        <div>
          {versions.map((v) => (
            <div key={v.id} style={{
              background: v.isCurrent ? "rgba(5,150,105,0.04)" : "#fff",
              borderRadius: 14,
              border: v.isCurrent ? "1px solid rgba(5,150,105,0.2)" : "1px solid rgba(0,0,0,0.05)",
              padding: "14px 16px", marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 8,
                    background: v.isCurrent ? "rgba(5,150,105,0.12)" : "rgba(12,26,18,0.05)",
                    color: v.isCurrent ? "#047857" : "#334155",
                  }}>
                    v{v.versionNum}
                  </span>
                  {v.isCurrent && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                      padding: "3px 8px", borderRadius: 99,
                      background: "rgba(5,150,105,0.12)", color: "#059669",
                    }}>
                      <CheckCircle2 size={10} /> CURRENT
                    </span>
                  )}
                  {v.label && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.label}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>
                  {v.snapshot
                    ? `${(v.snapshot.requirements ?? []).length} requirement(s) snapshot`
                    : "no snapshot"}
                  {" · "}published {new Date(v.publishedAt).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish modal */}
      {showPublish && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(12,26,18,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setShowPublish(false)} />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 24,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            width: "100%", maxWidth: 420, margin: "0 16px",
            padding: "32px 28px 28px", border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setShowPublish(false)}
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
              Publish Version
            </p>
            <h2 style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 26, letterSpacing: "-0.02em", color: "#0c1a12", marginBottom: 4 }}>
              Snapshot &amp; release
            </h2>
            <p style={{ fontSize: 13, fontWeight: 300, color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>
              Publishing requires at least one approved requirement. The approved requirements are copied into an immutable snapshot and this version becomes the current, retrievable policy definition.
            </p>

            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Version label (optional)"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <button
              onClick={publish}
              disabled={publishing}
              className="publish-btn"
              style={{
                width: "100%",
                background: publishing ? "#e2e8f0" : "#059669",
                color: publishing ? "#94a3b8" : "#fff",
                border: "none", borderRadius: 999,
                padding: "13px 26px", fontSize: 15, fontWeight: 500,
                fontFamily: "'DM Sans',sans-serif",
                cursor: publishing ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {publishing && <Loader2 size={15} className="animate-spin" />}
              Publish Version
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
