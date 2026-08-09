"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Loader2, X, ShieldCheck } from "lucide-react";

export interface PolicySummary {
  id: string;
  name: string;
  provider: string | null;
  category: string | null;
  allowReuse: boolean;
  isActive: boolean;
  currentVersionId: string | null;
  _count?: { brochures: number; versions: number };
}

interface BrochureLink {
  id: string;
  brochure: {
    id: string;
    basename: string;
    originalName: string;
    status: string;
    versionNum: number;
  };
}

interface PolicyDetail extends PolicySummary {
  brochures: { brochure: BrochureLink["brochure"] }[];
}

interface PolicyManagerProps {
  selectedId?: string;
  onSelect: (p: PolicySummary | null) => void;
  canAdmin: boolean;
  onChanged: () => void;
}

export default function PolicyManager({ selectedId, onSelect, canAdmin, onChanged }: PolicyManagerProps) {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState("");
  const [brochures, setBrochures] = useState<BrochureLink[]>([]);
  const [available, setAvailable] = useState<{ id: string; basename: string; status: string }[]>([]);
  const [linkBrochureId, setLinkBrochureId] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/policies?includeInactive=true");
      const json = await res.json();
      if (json.policies) {
        setPolicies(json.policies);
        onChanged();
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [onChanged]);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/policies/${id}`);
      const json = await res.json();
      if (json.policy) {
        setDetail(json.policy);
        const current = json.policy;
        onSelect({
          id: current.id,
          name: current.name,
          provider: current.provider,
          category: current.category,
          allowReuse: current.allowReuse,
          isActive: current.isActive,
          currentVersionId: current.currentVersionId,
          _count: current._count,
        });
      }
    } catch { /* ignore */ }
  }, [onSelect]);

  const fetchBrochures = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/policies/${id}/brochures`);
      const json = await res.json();
      if (json.brochures) setBrochures(json.brochures);
    } catch { /* ignore */ }
  }, []);

  const fetchAvailable = useCallback(async () => {
    try {
      const res = await fetch("/api/brochures?limit=100");
      const json = await res.json();
      if (json.brochures) setAvailable(json.brochures);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const openDetail = async (p: PolicySummary) => {
    onSelect(p);
    setDetail(p as PolicyDetail);
    await Promise.all([fetchDetail(p.id), fetchBrochures(p.id)]);
  };

  const openLinkModal = async () => {
    await fetchAvailable();
    setShowLink(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), provider: provider || null, category: category || null }),
      });
      const json = await res.json();
      if (json.policy) {
        await fetchPolicies();
        await openDetail(json.policy);
        setShowCreate(false);
        setName(""); setProvider(""); setCategory("");
        notify("Policy created");
      } else {
        notify(json.error ?? "Failed to create policy");
      }
    } catch { notify("Failed to create policy"); }
    finally { setCreating(false); }
  };

  const handleLink = async () => {
    if (!linkBrochureId || !detail) return;
    try {
      const res = await fetch(`/api/policies/${detail.id}/brochures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brochureId: linkBrochureId }),
      });
      const json = await res.json();
      if (json.link || json.message) {
        await Promise.all([fetchBrochures(detail.id), fetchDetail(detail.id)]);
        setShowLink(false); setLinkBrochureId("");
        notify(json.link ? "Brochure linked" : json.message);
      }
    } catch { notify("Failed to link brochure"); }
  };

  const filtered = policies.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.provider ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#f8faf9",
    border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12,
    padding: "10px 14px", fontSize: 13, fontWeight: 300,
    color: "#0c1a12", fontFamily: "'DM Sans',sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <>
      <style>{`
        .policy-row{transition:background 0.12s;}
        .policy-row:hover{background:#f8faf9;}
        .policy-row.active{background:rgba(5,150,105,0.07);border-left:2px solid #059669;}
        .modal-input:focus{outline:none;border-color:#059669;box-shadow:0 0 0 3px rgba(5,150,105,0.12);}
        .submit-btn:hover:not(:disabled){background:#047857!important;transform:translateY(-1px);}
      `}</style>

      <div style={{
        background: "#fff", borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 18px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 18, color: "#0c1a12" }}>
              Policies
            </p>
            <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
              {policies.length} on file
            </p>
          </div>
          {canAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: "#0c1a12", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="New policy"
            >
              <Plus size={14} color="#4ade80" />
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f8faf9", borderRadius: 12,
            padding: "8px 12px", border: "1px solid rgba(0,0,0,0.05)",
          }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search policies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "transparent", border: "none", outline: "none",
                fontSize: 13, fontWeight: 300, color: "#0c1a12", width: "100%",
                fontFamily: "'DM Sans',sans-serif",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={12} color="#94a3b8" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 120 }}>
              <Loader2 size={18} color="#059669" className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
                background: "rgba(5,150,105,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShieldCheck size={18} color="#059669" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#0c1a12" }}>No policies found</p>
              <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8", marginTop: 2 }}>
                {canAdmin ? "Tap + to create one" : "Nothing matches your search"}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => openDetail(p)}
                className={`policy-row${selectedId === p.id ? " active" : ""}`}
                style={{
                  width: "100%", textAlign: "left",
                  padding: selectedId === p.id ? "12px 14px" : "12px 16px",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: "1px solid rgba(0,0,0,0.03)",
                  display: "flex", flexDirection: "column", gap: 3,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0c1a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                  <span style={{
                    flexShrink: 0, marginLeft: 8,
                    fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                    padding: "3px 7px", borderRadius: 99,
                    background: p.isActive ? "rgba(5,150,105,0.09)" : "rgba(239,68,68,0.08)",
                    color: p.isActive ? "#059669" : "#dc2626",
                  }}>
                    {p.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>
                  {p.provider ?? "Unknown provider"}
                  {p.currentVersionId ? " · published" : " · no version"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Linked brochures strip */}
      {detail && (
        <div style={{
          background: "#fff", borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.05)",
          marginTop: 14, padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
              Linked Brochures
            </p>
            {canAdmin && (
              <button
                onClick={openLinkModal}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "none", border: "1px solid rgba(5,150,105,0.3)",
                  borderRadius: 999, padding: "4px 11px",
                  cursor: "pointer", fontSize: 11, fontWeight: 500,
                  color: "#059669", fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <Plus size={12} /> Link
              </button>
            )}
          </div>
          {brochures.length === 0 ? (
            <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8" }}>
              No brochures linked. Link a processed brochure to extract requirements.
            </p>
          ) : (
            brochures.map((b) => (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 0", borderTop: "1px solid rgba(0,0,0,0.03)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.brochure.basename}
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8" }}>
                    v{b.brochure.versionNum} · {b.brochure.originalName}
                  </p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                  padding: "3px 7px", borderRadius: 99, flexShrink: 0, marginLeft: 8,
                  background: b.brochure.status === "READY" ? "rgba(5,150,105,0.09)" : "rgba(245,158,11,0.09)",
                  color: b.brochure.status === "READY" ? "#059669" : "#d97706",
                }}>
                  {b.brochure.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(12,26,18,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setShowCreate(false)} />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 24,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            width: "100%", maxWidth: 400, margin: "0 16px",
            padding: "32px 28px 28px", border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setShowCreate(false)}
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
              New Policy
            </p>
            <h2 style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 28, letterSpacing: "-0.02em", color: "#0c1a12", marginBottom: 20 }}>
              Add a policy
            </h2>

            <input
              type="text"
              autoFocus
              placeholder="Policy name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="modal-input"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <input
              type="text"
              placeholder="Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="modal-input"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <input
              type="text"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="modal-input"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="submit-btn"
              style={{
                width: "100%",
                background: name.trim() && !creating ? "#059669" : "#e2e8f0",
                color: name.trim() && !creating ? "#fff" : "#94a3b8",
                border: "none", borderRadius: 999,
                padding: "13px 26px", fontSize: 15, fontWeight: 500,
                fontFamily: "'DM Sans',sans-serif",
                cursor: name.trim() && !creating ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {creating && <Loader2 size={15} className="animate-spin" />}
              Create Policy
            </button>
          </div>
        </div>
      )}

      {/* Link brochure modal */}
      {showLink && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(12,26,18,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setShowLink(false)} />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 24,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            width: "100%", maxWidth: 400, margin: "0 16px",
            padding: "32px 28px 28px", border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <button
              onClick={() => setShowLink(false)}
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
              Link Brochure
            </p>
            <h2 style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 26, letterSpacing: "-0.02em", color: "#0c1a12", marginBottom: 4 }}>
              {detail?.name}
            </h2>
            <p style={{ fontSize: 13, fontWeight: 300, color: "#94a3b8", marginBottom: 18 }}>
              Attach a processed brochure so requirements can be extracted
            </p>

            <select
              value={linkBrochureId}
              onChange={(e) => setLinkBrochureId(e.target.value)}
              style={{ ...inputStyle, marginBottom: 18 }}
            >
              <option value="">Select brochure…</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.basename} ({b.status.toLowerCase()})
                </option>
              ))}
            </select>

            <button
              onClick={handleLink}
              disabled={!linkBrochureId}
              className="submit-btn"
              style={{
                width: "100%",
                background: linkBrochureId ? "#059669" : "#e2e8f0",
                color: linkBrochureId ? "#fff" : "#94a3b8",
                border: "none", borderRadius: 999,
                padding: "13px 26px", fontSize: 15, fontWeight: 500,
                fontFamily: "'DM Sans',sans-serif",
                cursor: linkBrochureId ? "pointer" : "default",
              }}
            >
              Link Brochure
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
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
