"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, LayoutGrid, ShieldCheck } from "lucide-react";
import PolicyManager, { type PolicySummary } from "@/components/dashboard/PolicyManager";
import RequirementApproval from "@/components/dashboard/RequirementApproval";
import PolicyVersionHistory from "@/components/dashboard/PolicyVersionHistory";

interface Me {
  sub?: string;
  name?: string;
  email?: string;
  realmRoles?: string[];
}

export default function PoliciesPage() {
  const [user, setUser] = useState<Me | null>(null);
  const [selected, setSelected] = useState<PolicySummary | null>(null);
  const [tab, setTab] = useState<"requirements" | "versions">("requirements");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const isAdmin = user?.realmRoles?.includes("admin") ?? false;

  const onSelect = useCallback((p: PolicySummary | null) => {
    setSelected(p);
    setTab("requirements");
  }, []);

  const handleChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:99px;}
        .pill-btn:hover{background:rgba(255,255,255,0.08)!important;}
        .tab-btn:hover{background:#f8faf9!important;}
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'DM Sans',sans-serif" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div style={{
          width: 240, flexShrink: 0,
          background: "#0c1a12",
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{
              fontFamily: "'Instrument Serif',serif",
              fontWeight: 400, fontSize: 22,
              letterSpacing: "-0.02em", color: "#fff",
              marginBottom: 2,
            }}>
              Sure<span style={{ color: "#4ade80" }}>LM</span>
            </p>
            <p style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Policy Control
            </p>
          </div>

          <nav style={{ flex: 1, padding: "14px 10px" }}>
            <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "0 10px", marginBottom: 8 }}>
              Navigation
            </p>

            <div style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 10,
              background: "rgba(74,222,128,0.12)",
              marginBottom: 2,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={14} color="#4ade80" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Policies</span>
            </div>

            <Link
              href="/dashboard"
              className="pill-btn"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10,
                textDecoration: "none", transition: "background 0.15s",
                marginBottom: 2,
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={14} color="rgba(255,255,255,0.4)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.45)" }}>Chat Interface</span>
            </Link>

            <Link
              href="/crm"
              className="pill-btn"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10,
                textDecoration: "none", transition: "background 0.15s",
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LayoutGrid size={14} color="rgba(255,255,255,0.4)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.45)" }}>Agent CRM</span>
            </Link>
          </nav>
        </div>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8faf9" }}>

          {/* Top bar */}
          <div style={{
            background: "#fff",
            borderBottom: "1px solid rgba(0,0,0,0.05)",
            padding: "12px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, letterSpacing: "-0.01em", color: "#0c1a12" }}>
                {selected ? selected.name : "Policy Management"}
              </p>
              <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
                {selected
                  ? `${selected.provider ?? "Unknown provider"}${selected.category ? ` · ${selected.category}` : ""} · ${selected.isActive ? "Active" : "Inactive"}`
                  : "Select a policy to review requirements and versions"}
              </p>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#f8faf9", borderRadius: 12,
              padding: "8px 14px", border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                background: isAdmin ? "rgba(5,150,105,0.12)" : "rgba(245,158,11,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 11,
                color: isAdmin ? "#047857" : "#d97706",
              }}>
                {(user?.name ?? "Agent").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12" }}>{user?.name ?? "Agent"}</p>
                <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8" }}>{isAdmin ? "Administrator" : "Agent"}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Policy list */}
              <div style={{ width: 300, flexShrink: 0 }}>
                <PolicyManager
                  selectedId={selected?.id}
                  onSelect={onSelect}
                  canAdmin={isAdmin}
                  onChanged={handleChanged}
                />
              </div>

              {/* Detail */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {!selected ? (
                  <div style={{
                    background: "#fff", borderRadius: 18,
                    border: "1px solid rgba(0,0,0,0.05)",
                    padding: "60px 24px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: "rgba(5,150,105,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <ShieldCheck size={22} color="#059669" />
                    </div>
                    <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 22, color: "#0c1a12" }}>
                      No policy selected
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 300, color: "#94a3b8" }}>
                      Choose a policy from the list to review requirements &amp; versions
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: "flex", gap: 8, marginBottom: 16,
                      background: "#fff", border: "1px solid rgba(0,0,0,0.05)",
                      borderRadius: 14, padding: 4, width: "fit-content",
                    }}>
                      {([
                        { id: "requirements" as const, label: "Requirements" },
                        { id: "versions" as const, label: "Versions" },
                      ]).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className="tab-btn"
                          style={{
                            padding: "7px 16px", borderRadius: 10,
                            border: "none", cursor: "pointer",
                            background: tab === t.id ? "#0c1a12" : "transparent",
                            color: tab === t.id ? "#fff" : "#64748b",
                            fontSize: 12, fontWeight: 500,
                            fontFamily: "'DM Sans',sans-serif",
                            transition: "background 0.15s",
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {tab === "requirements" ? (
                      <RequirementApproval key={selected.id} policyId={selected.id} canAdmin={isAdmin} onChanged={handleChanged} />
                    ) : (
                      <PolicyVersionHistory key={selected.id} policyId={selected.id} canAdmin={isAdmin} onChanged={handleChanged} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!user && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "#f8faf9",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Loader2 size={24} color="#059669" className="animate-spin" />
        </div>
      )}
    </>
  );
}
