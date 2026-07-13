"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { Plus, Search, X, Loader2, Trash2, MoreVertical, MessageSquare } from "lucide-react";
import Link from "next/link";

interface Lead {
  id: string;
  householdName: string;
  lastMessage: string;
  time: string;
  unread: number;
}

interface SidebarProps {
  user: { name: string; avatar: string };
  onSelectLead?: (lead: Lead | null) => void;
  activeLead?: Lead | null;
}

// ── Tiny avatar with initials ────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // deterministic hue from name
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.8,
        background: `hsl(${hue}, 38%, 88%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        fontSize: size * 0.36,
        color: `hsl(${hue}, 45%, 32%)`,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

export default function Sidebar({ user, onSelectLead, activeLead }: SidebarProps) {
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads");
      const json = await res.json();
      if (json.success) {
        setLeads(
          json.data.map((l: any) => ({
            id: l.id,
            householdName: l.householdName,
            lastMessage: l.notes ?? "New conversation",
            time: new Date(l.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            unread: 0,
          }))
        );
      }
    } catch { console.error("Failed to fetch leads"); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!householdName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdName: householdName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        const newLead: Lead = {
          id: json.data.id,
          householdName: json.data.householdName,
          lastMessage: "New conversation",
          time: "Now",
          unread: 0,
        };
        setLeads((p) => [newLead, ...p]);
        onSelectLead?.(newLead);
      }
    } catch { console.error("Failed to create lead"); }
    finally { setHouseholdName(""); setShowModal(false); setCreating(false); }
  };

  const handleDelete = async (lead: Lead) => {
    setDeletingId(lead.id);
    setMenuOpenId(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setLeads((p) => p.filter((l) => l.id !== lead.id));
        if (activeLead?.id === lead.id) onSelectLead?.(null);
      }
    } catch { console.error("Failed to delete lead"); }
    finally { setDeletingId(null); }
  };

  const filtered = leads.filter((l) =>
    l.householdName.toLowerCase().includes(search.toLowerCase())
  );

  // ── styles ────────────────────────────────────────────────────────────────
  const S = {
    sidebar: {
      width: 300,
      display: "flex",
      flexDirection: "column" as const,
      height: "100vh",
      background: "#fff",
      borderRight: "1px solid rgba(0,0,0,0.06)",
      fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0,
    },

    // ── top header ──
    header: {
      padding: "18px 16px 14px",
      borderBottom: "1px solid rgba(0,0,0,0.05)",
    },
    crmLink: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      color: "#059669",
      textDecoration: "none",
      marginBottom: 14,
      padding: "4px 10px",
      background: "rgba(5,150,105,0.07)",
      borderRadius: 999,
    },
    headerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    userInfo: { display: "flex", alignItems: "center", gap: 10 },
    userName: {
      fontSize: 13,
      fontWeight: 500,
      color: "#0c1a12",
      lineHeight: 1.3,
    },
    userRole: { fontSize: 11, color: "#94a3b8", fontWeight: 300 },
    plusBtn: {
      width: 34,
      height: 34,
      borderRadius: 999,
      background: "#0c1a12",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "transform 0.15s, background 0.15s",
      flexShrink: 0,
    },

    // ── search ──
    searchWrap: {
      padding: "10px 14px",
      borderBottom: "1px solid rgba(0,0,0,0.04)",
    },
    searchInner: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "#f8faf9",
      borderRadius: 12,
      padding: "8px 12px",
      border: "1px solid rgba(0,0,0,0.05)",
    },
    searchInput: {
      background: "transparent",
      border: "none",
      outline: "none",
      fontSize: 13,
      fontWeight: 300,
      color: "#0c1a12",
      width: "100%",
      fontFamily: "'DM Sans', sans-serif",
    },

    // ── list ──
    list: { flex: 1, overflowY: "auto" as const },

    // ── bottom ──
    bottom: {
      padding: "14px 16px",
      borderTop: "1px solid rgba(0,0,0,0.05)",
      textAlign: "center" as const,
    },
    brand: {
      fontFamily: "'Instrument Serif', serif",
      fontSize: 13,
      color: "#cbd5e1",
      letterSpacing: "-0.01em",
    },
    brandAccent: { color: "#059669" },

    // ── modal backdrop ──
    backdrop: {
      position: "fixed" as const,
      inset: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    backdropOverlay: {
      position: "absolute" as const,
      inset: 0,
      background: "rgba(12,26,18,0.45)",
      backdropFilter: "blur(6px)",
    },
    modal: {
      position: "relative" as const,
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
      width: "100%",
      maxWidth: 400,
      margin: "0 16px",
      padding: "32px 28px 28px",
      border: "1px solid rgba(0,0,0,0.06)",
    },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        .lead-row { transition: background 0.12s; }
        .lead-row:hover { background: #f8faf9; }
        .lead-row.active { background: rgba(5,150,105,0.07); border-left: 2px solid #059669; }
        .menu-btn { opacity: 0; transition: opacity 0.15s; }
        .lead-row:hover .menu-btn { opacity: 1; }
        .plus-btn:hover { background: #059669 !important; transform: translateY(-1px); }
        .modal-input:focus { outline: none; border-color: #059669; box-shadow: 0 0 0 3px rgba(5,150,105,0.12); }
        .submit-btn:hover:not(:disabled) { background: #047857 !important; transform: translateY(-1px); }
        .crm-link:hover { background: rgba(5,150,105,0.12) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 99px; }
      `}</style>

      <div style={S.sidebar}>

        {/* ── Header ── */}
        <div style={S.header}>
          <Link href="/crm" style={S.crmLink} className="crm-link">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            CRM
          </Link>

          <div style={S.headerRow}>
            <div style={S.userInfo}>
              <button onClick={() => logout()} style={{width:36,height:36,borderRadius:99,background:'#059669',border:'none',cursor:'pointer'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/></svg>
              </button>
              <div>
                <p style={S.userName}>{user.name}</p>
                <p style={S.userRole}>Agent</p>
              </div>
            </div>
            <button
              style={S.plusBtn}
              className="plus-btn"
              onClick={() => setShowModal(true)}
              title="New household"
            >
              <Plus size={15} color="#fff" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ── Search ── */}
        <div style={S.searchWrap}>
          <div style={S.searchInner}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search households…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={S.searchInput}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={12} color="#94a3b8" />
              </button>
            )}
          </div>
        </div>

        {/* ── Lead list ── */}
        <div style={S.list}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 120 }}>
              <Loader2 size={18} color="#059669" className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "40px 24px", gap: 8, textAlign: "center",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(5,150,105,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageSquare size={18} color="#059669" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#0c1a12", marginTop: 4 }}>
                No households yet
              </p>
              <p style={{ fontSize: 12, fontWeight: 300, color: "#94a3b8" }}>
                Tap + to add one
              </p>
            </div>
          ) : (
            filtered.map((lead) => (
              <div
                key={lead.id}
                className={`lead-row${activeLead?.id === lead.id ? " active" : ""}`}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(0,0,0,0.03)",
                  paddingLeft: activeLead?.id === lead.id ? 0 : 2,
                }}
              >
                <button
                  onClick={() => onSelectLead?.(lead)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "11px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                  }}
                >
                  {deletingId === lead.id ? (
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "#f8faf9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Loader2 size={14} color="#059669" className="animate-spin" />
                    </div>
                  ) : (
                    <Avatar name={lead.householdName} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 500, color: "#0c1a12",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {lead.householdName}
                      </p>
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 300, flexShrink: 0, marginLeft: 8 }}>
                        {lead.time}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 11, fontWeight: 300, color: "#94a3b8",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {lead.lastMessage}
                    </p>
                  </div>

                  {lead.unread > 0 && (
                    <span style={{
                      width: 18, height: 18, borderRadius: 99,
                      background: "#059669", color: "#fff",
                      fontSize: 10, fontWeight: 500,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {lead.unread}
                    </span>
                  )}
                </button>

                {/* 3-dot menu */}
                <div
                  style={{ position: "relative", paddingRight: 10 }}
                  ref={menuOpenId === lead.id ? menuRef : null}
                >
                  <button
                    className="menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === lead.id ? null : lead.id);
                    }}
                    style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: "none", border: "1px solid rgba(0,0,0,0.07)",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <MoreVertical size={13} color="#94a3b8" />
                  </button>

                  {menuOpenId === lead.id && (
                    <div style={{
                      position: "absolute", right: 0, top: 32, zIndex: 20,
                      background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
                      borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                      padding: "4px 0", width: 148, overflow: "hidden",
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(lead); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center",
                          gap: 8, padding: "9px 14px", background: "none",
                          border: "none", cursor: "pointer",
                          fontSize: 13, color: "#ef4444", fontWeight: 400,
                          fontFamily: "'DM Sans', sans-serif",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <Trash2 size={13} />
                        Delete household
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Branding ── */}
        <div style={S.bottom}>
          <p style={S.brand}>
            Sure<span style={S.brandAccent}>LM</span>
            <span style={{ color: "#e2e8f0", margin: "0 6px" }}>·</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: "#cbd5e1", letterSpacing: "0.05em" }}>
              Agent Platform
            </span>
          </p>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div style={S.backdrop}>
          <div style={S.backdropOverlay} onClick={() => setShowModal(false)} />
          <div style={S.modal}>
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 30, height: 30, borderRadius: 99,
                background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={14} color="#64748b" />
            </button>

            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "#0c1a12",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Plus size={20} color="#4ade80" />
            </div>

            {/* Heading */}
            <p style={{
              fontSize: 10, fontWeight: 500, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "#059669", marginBottom: 6,
            }}>
              New Household
            </p>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif",
              fontWeight: 400, fontSize: 28,
              letterSpacing: "-0.02em", color: "#0c1a12",
              marginBottom: 4,
            }}>
              Start a conversation
            </h2>
            <p style={{
              fontSize: 14, fontWeight: 300, color: "#94a3b8",
              lineHeight: 1.6, marginBottom: 24,
              fontStyle: "italic",
              fontFamily: "'Instrument Serif', serif",
            }}>
              enter the household name below
            </p>

            <input
              type="text"
              autoFocus
              placeholder="e.g. Ramesh Kumar"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="modal-input"
              style={{
                width: "100%",
                background: "#f8faf9",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 14,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 400,
                color: "#0c1a12",
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 14,
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={handleCreate}
              disabled={!householdName.trim() || creating}
              className="submit-btn"
              style={{
                width: "100%",
                background: householdName.trim() && !creating ? "#059669" : "#e2e8f0",
                color: householdName.trim() && !creating ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: 999,
                padding: "13px 26px",
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: householdName.trim() && !creating ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.15s, transform 0.15s",
              }}
            >
              {creating && <Loader2 size={15} className="animate-spin" />}
              Start Conversation
            </button>
          </div>
        </div>
      )}
    </>
  );
}