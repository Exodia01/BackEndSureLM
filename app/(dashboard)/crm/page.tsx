"use client";

import { useState, useEffect } from "react";
import { KeycloakSession } from "@/lib/auth/session";
import { BirthdaySection } from "@/components/dashboard/BirthdaySection";
import Link from "next/link";
import {
  LayoutDashboard, Gift, AlertTriangle,
  ShieldCheck, Users, Bell, Phone,
  Search, X, Loader2,
  CheckCircle2, Calendar, MessageSquare,
} from "lucide-react";

type LeadStatus = "NEW" | "CONTACTED" | "POLICY_ISSUED" | "REJECTED";
type ReminderType = "FOLLOWUP" | "BIRTHDAY";
type ActivePage = "dashboard" | "birthdays" | "premiums" | "leads";

interface Reminder { id: string; type: ReminderType; scheduledAt: string; note: string | null; isDone: boolean; }
interface Issuance { id: string; policyName: string; policyProvider: string | null; premiumAmount: number | null; status: string; expiresAt: string | null; }
interface Lead {
  id: string; householdName: string; phone: string | null; income: number | null;
  familySize: number | null; status: LeadStatus; notes: string | null;
  dateOfBirth: string | null; followUpAt: string | null; createdAt: string;
  issuances: Issuance[]; reminders: Reminder[];
  isBirthdayToday: boolean; isBirthdayThisWeek: boolean;
  hasPremiumDue: boolean; hasPremiumDueUrgent: boolean; premiumsDue: Issuance[];
}
interface Stats {
  total: number; birthdaysToday: number; birthdaysThisWeek: number;
  premiumsDueCount: number; premiumsDueUrgentCount: number;
  policiesIssued: number; activeReminders: number;
}

const STATUS_META: Record<LeadStatus, { label: string; bg: string; color: string; dot: string }> = {
  NEW:           { label: "New",           bg: "rgba(59,130,246,0.08)",  color: "#3b82f6", dot: "#3b82f6" },
  CONTACTED:     { label: "Contacted",     bg: "rgba(245,158,11,0.09)",  color: "#d97706", dot: "#d97706" },
  POLICY_ISSUED: { label: "Policy Issued", bg: "rgba(5,150,105,0.09)",   color: "#059669", dot: "#059669" },
  REJECTED:      { label: "Rejected",      bg: "rgba(239,68,68,0.08)",   color: "#ef4444", dot: "#ef4444" },
};

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function fmtDate(d: string | null) { if (!d) return null; return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function getAge(d: string) { return new Date().getFullYear() - new Date(d).getFullYear(); }

// ── Shared Avatar ─────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2.8, flexShrink: 0,
      background: `hsl(${hue},38%,88%)`, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: size * 0.36,
      color: `hsl(${hue},45%,32%)`, letterSpacing: "0.02em",
    }}>{initials}</div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────
function StatusPill({ status }: { status: LeadStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: m.bg, color: m.color,
      fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans',sans-serif",
      padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

export default function CRMPage() {
  const [user, setUser] = useState<{ sub: string; name?: string; realmRoles?: string[] } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editIncome, setEditIncome] = useState("");
  const [editFamilySize, setEditFamilySize] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDOB, setEditDOB] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "ALL">("ALL");
  const [filterPolicy, setFilterPolicy] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "date" | "status">("date");
  const [premiumTab, setPremiumTab] = useState<"urgent" | "soon">("urgent");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/crm");
      const json = await res.json();
      if (json.success) { setLeads(json.data.leads); setStats(json.data.stats); }
    } catch { console.error("fetch failed"); }
    finally { setLoading(false); }
  };

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setEditPhone(lead.phone ?? "");
    setEditIncome(lead.income?.toString() ?? "");
    setEditFamilySize(lead.familySize?.toString() ?? "");
    setEditNotes(lead.notes ?? "");
    setEditDOB(lead.dateOfBirth ? lead.dateOfBirth.split("T")[0] : "");
    setEditFollowUp(lead.followUpAt ? lead.followUpAt.split("T")[0] : "");
    setEditStatus(lead.status);
  };

  const saveLead = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLead.id, phone: editPhone, income: editIncome, familySize: editFamilySize, notes: editNotes, dateOfBirth: editDOB, followUpAt: editFollowUp, status: editStatus }),
      });
      await fetchData();
      setSelectedLead(null);
    } catch { console.error("save failed"); }
    finally { setSaving(false); }
  };

  const markReminderDone = async (reminderId: string) => {
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderId }) });
    await fetchData();
  };

  const allPolicyTypes = Array.from(new Set(leads.flatMap(l => l.issuances.map(i => i.policyName))));
  const filteredLeads = leads
    .filter(l => filterStatus === "ALL" || l.status === filterStatus)
    .filter(l => filterPolicy === "ALL" || l.issuances.some(i => i.policyName === filterPolicy))
    .filter(l => l.householdName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "name" ? a.householdName.localeCompare(b.householdName) : sortBy === "status" ? a.status.localeCompare(b.status) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const birthdaysToday = leads.filter(l => l.isBirthdayToday);
  const premiumsUrgent = leads.filter(l => l.hasPremiumDueUrgent);
  const premiumsSoon   = leads.filter(l => l.hasPremiumDue && !l.hasPremiumDueUrgent);

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

  const navItems = [
    { id: "dashboard" as ActivePage, label: "Dashboard",          icon: LayoutDashboard, badge: 0 },
    { id: "birthdays" as ActivePage, label: "Birthdays",          icon: Gift,            badge: stats?.birthdaysToday ?? 0 },
    { id: "premiums"  as ActivePage, label: "Premium Due",        icon: AlertTriangle,   badge: stats?.premiumsDueCount ?? 0 },
    { id: "leads"     as ActivePage, label: "All Leads",          icon: Users,           badge: 0 },
  ];

  // ── input style shared ───
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
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:99px;}
        .nav-btn:hover{background:rgba(255,255,255,0.06)!important;}
        .nav-btn.active{background:rgba(74,222,128,0.12)!important;}
        .card-hover:hover{border-color:rgba(5,150,105,0.25)!important;box-shadow:0 4px 20px rgba(0,0,0,0.06)!important;}
        .crm-input:focus{border-color:rgba(5,150,105,0.45)!important;box-shadow:0 0 0 3px rgba(5,150,105,0.08)!important;}
        .save-btn:hover:not(:disabled){background:#047857!important;transform:translateY(-1px);}
        .pill-btn:hover{background:rgba(255,255,255,0.08)!important;}
        .tab-btn:hover{background:#f8faf9!important;}
        select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px!important;}
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'DM Sans',sans-serif" }}>

        {/* ══ Sidebar ══════════════════════════════════════════════════════ */}
        <div style={{
          width: 240, flexShrink: 0,
          background: "#0c1a12",
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Logo */}
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
              Agent CRM
            </p>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "14px 10px" }}>
            <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "0 10px", marginBottom: 8 }}>
              Navigation
            </p>
            {navItems.map(item => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`nav-btn${isActive ? " active" : ""}`}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 10px", borderRadius: 10,
                    background: isActive ? "rgba(74,222,128,0.12)" : "none",
                    border: "none", cursor: "pointer",
                    marginBottom: 2, transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: isActive ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <item.icon size={14} color={isActive ? "#4ade80" : "rgba(255,255,255,0.4)"} />
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: isActive ? 500 : 400,
                      color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                    }}>
                      {item.label}
                    </span>
                  </div>
                  {item.badge > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 99,
                      background: isActive ? "rgba(74,222,128,0.25)" : "#ef4444",
                      color: "#fff", fontSize: 9, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px",
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={{ padding: "10px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link
              href="/dashboard"
              className="pill-btn"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10,
                textDecoration: "none", transition: "background 0.15s",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MessageSquare size={14} color="rgba(255,255,255,0.4)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.45)" }}>Chat Interface</span>
            </Link>
          </div>
        </div>

        {/* ══ Main ═════════════════════════════════════════════════════════ */}
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
                {{ dashboard: "Dashboard", birthdays: "Birthday Reminders", premiums: "Premium Due", leads: "All Leads" }[activePage]}
              </p>
              <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
                {activePage === "birthdays" && `${stats?.birthdaysToday ?? 0} customers celebrating today`}
                {activePage === "premiums"  && `${stats?.premiumsDueCount ?? 0} policies due in next 30 days`}
                {activePage === "dashboard" && new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {activePage === "leads"     && `${filteredLeads.length} households`}
              </p>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#f8faf9", borderRadius: 12,
              padding: "8px 14px", border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <Avatar name={user?.name ?? "Agent"} size={30} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12" }}>{user?.name ?? "Agent"}</p>
                <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8" }}>Field Agent</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
                <Loader2 size={22} color="#059669" className="animate-spin" />
              </div>
            ) : (
              <>

                {/* ── DASHBOARD ─────────────────────────────────────────── */}
                {activePage === "dashboard" && stats && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                    {/* Greeting banner — dark bento card */}
                    <div style={{
                      background: "#0c1a12", borderRadius: 20, padding: "24px 28px",
                      border: "1px solid rgba(255,255,255,0.04)",
                      position: "relative", overflow: "hidden",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4ade80", marginBottom: 8 }}>
                        Today&apos;s Brief
                      </p>
                      <h2 style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 28, letterSpacing: "-0.02em", color: "#fff", marginBottom: 6 }}>
                        {greeting()}, {user?.name ?? "Agent"}
                      </h2>
                      <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                        {stats.birthdaysToday} birthday{stats.birthdaysToday !== 1 ? "s" : ""} · {stats.premiumsDueCount} premium{stats.premiumsDueCount !== 1 ? "s" : ""} due · {stats.activeReminders} reminder{stats.activeReminders !== 1 ? "s" : ""}
                      </p>
                      {/* Ghost number */}
                      <p style={{ position: "absolute", right: 24, bottom: -8, fontFamily: "'Instrument Serif',serif", fontSize: 96, color: "rgba(74,222,128,0.06)", lineHeight: 1, userSelect: "none" }}>
                        {new Date().getDate()}
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                      {[
                        { label: "Total Households", value: stats.total,           sub: "All villages",    icon: Users,         iconColor: "#3b82f6", iconBg: "rgba(59,130,246,0.09)" },
                        { label: "Birthdays Today",  value: stats.birthdaysToday,  sub: "Action needed",   icon: Gift,          iconColor: "#ec4899", iconBg: "rgba(236,72,153,0.09)" },
                        { label: "Premiums Due",     value: stats.premiumsDueCount,sub: "Next 30 days",    icon: AlertTriangle, iconColor: "#d97706", iconBg: "rgba(245,158,11,0.09)" },
                        { label: "Policies Issued",  value: stats.policiesIssued,  sub: "Total active",    icon: ShieldCheck,   iconColor: "#059669", iconBg: "rgba(5,150,105,0.09)"  },
                      ].map(s => (
                        <div key={s.label} className="card-hover" style={{
                          background: "#fff", borderRadius: 16,
                          border: "1px solid rgba(0,0,0,0.05)",
                          padding: "16px", transition: "border-color 0.2s, box-shadow 0.2s",
                        }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                            <s.icon size={16} color={s.iconColor} />
                          </div>
                          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 32, color: "#0c1a12", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: "#0c1a12", marginTop: 6 }}>{s.label}</p>
                          <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8", marginTop: 2 }}>{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Quick actions */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#059669", marginBottom: 14 }}>
                        Actions Needed Today
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {birthdaysToday.map(l => (
                          <ActionCard key={l.id} emoji="🎂" title={`${l.householdName} turns ${l.dateOfBirth ? getAge(l.dateOfBirth) : ""} today`} sub={`${l.phone ?? "No phone"} · ${l.issuances[0]?.policyName ?? "No policy"}`} tag="Birthday" tagColor="#ec4899" tagBg="rgba(236,72,153,0.08)">
                            <SmallBtn bg="#0c1a12" color="#fff" onClick={() => openLead(l)}>Send Wish</SmallBtn>
                            {l.phone && <SmallBtn as="a" href={`tel:${l.phone}`} bg="#f8faf9" color="#0c1a12" border><Phone size={11} />Call</SmallBtn>}
                          </ActionCard>
                        ))}
                        {premiumsUrgent.slice(0, 3).map(l => (
                          <ActionCard key={l.id} emoji="⚠️" title={`${l.householdName} — Premium Due`} sub={`${l.premiumsDue[0]?.policyName} · ${l.premiumsDue[0]?.expiresAt ? `${daysUntil(l.premiumsDue[0].expiresAt)} days left` : ""}`} tag="Urgent" tagColor="#ef4444" tagBg="rgba(239,68,68,0.08)">
                            {l.phone && <SmallBtn as="a" href={`tel:${l.phone}`} bg="#ef4444" color="#fff"><Phone size={11} />Call Now</SmallBtn>}
                            <SmallBtn bg="#f8faf9" color="#0c1a12" border onClick={() => openLead(l)}>Remind</SmallBtn>
                          </ActionCard>
                        ))}
                        {leads.flatMap(l => l.reminders.map(r => ({ ...r, lead: l }))).slice(0, 2).map(r => (
                          <ActionCard key={r.id} emoji="📋" title={`${r.lead.householdName} — ${r.type === "BIRTHDAY" ? "Birthday" : "Follow-up"}`} sub={`${r.note ?? "No note"} · ${fmtDate(r.scheduledAt)}`}>
                            <SmallBtn bg="#f8faf9" color="#0c1a12" border onClick={() => markReminderDone(r.id)}><CheckCircle2 size={11} />Done</SmallBtn>
                          </ActionCard>
                        ))}
                        {birthdaysToday.length === 0 && premiumsUrgent.length === 0 && (
                          <div style={{ background: "#fff", borderRadius: 16, padding: "40px 24px", textAlign: "center", border: "1px solid rgba(0,0,0,0.05)" }}>
                            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 36, marginBottom: 8 }}>🎉</p>
                            <p style={{ fontSize: 13, fontWeight: 300, color: "#94a3b8" }}>No urgent actions today</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BIRTHDAYS ─────────────────────────────────────────── */}
                {activePage === "birthdays" && <BirthdaySection />}

                {/* ── PREMIUMS ──────────────────────────────────────────── */}
                {activePage === "premiums" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                      {[
                        { label: "Due This Week",   value: stats?.premiumsDueUrgentCount ?? 0, sub: "Urgent action", color: "#ef4444" },
                        { label: "Due This Month",  value: stats?.premiumsDueCount ?? 0,        sub: "Monitor closely", color: "#d97706" },
                        { label: "Avg Renewal",     value: "—",                                 sub: "Score", color: "#059669" },
                      ].map(s => (
                        <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.05)" }}>
                          <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 34, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12", marginTop: 6 }}>{s.label}</p>
                          <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8", marginTop: 2 }}>{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tabs */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {[
                        { key: "urgent", label: `Urgent  (${premiumsUrgent.length})` },
                        { key: "soon",   label: `Soon  (${premiumsSoon.length})` },
                      ].map(t => (
                        <button key={t.key} className="tab-btn" onClick={() => setPremiumTab(t.key as "urgent" | "soon")} style={{
                          padding: "7px 16px", borderRadius: 999,
                          background: premiumTab === t.key ? "#0c1a12" : "#fff",
                          color: premiumTab === t.key ? "#fff" : "#64748b",
                          border: `1px solid ${premiumTab === t.key ? "transparent" : "rgba(0,0,0,0.08)"}`,
                          fontSize: 12, fontWeight: 500,
                          fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
                          transition: "background 0.15s, color 0.15s",
                        }}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(premiumTab === "urgent" ? premiumsUrgent : premiumsSoon).map(l => (
                        <div key={l.id} className="card-hover" style={{
                          background: "#fff", borderRadius: 16, padding: "18px 20px",
                          border: "1px solid rgba(0,0,0,0.05)",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={l.householdName} size={36} />
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 500, color: "#0c1a12" }}>{l.householdName}</p>
                                {l.notes && <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>{l.notes.split(",")[0]}</p>}
                              </div>
                            </div>
                            {l.premiumsDue[0]?.expiresAt && (
                              <span style={{
                                fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 999,
                                background: daysUntil(l.premiumsDue[0].expiresAt) <= 7 ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.09)",
                                color: daysUntil(l.premiumsDue[0].expiresAt) <= 7 ? "#ef4444" : "#d97706",
                              }}>
                                Due in {daysUntil(l.premiumsDue[0].expiresAt)} days
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                            {l.premiumsDue[0] && <Chip>{l.premiumsDue[0].policyName}</Chip>}
                            {l.premiumsDue[0]?.premiumAmount && <Chip>₹{l.premiumsDue[0].premiumAmount}</Chip>}
                            {l.phone && <Chip><Phone size={10} />{l.phone}</Chip>}
                          </div>

                          <div style={{ display: "flex", gap: 8 }}>
                            {l.phone && <SmallBtn as="a" href={`tel:${l.phone}`} bg="#ef4444" color="#fff" flex><Phone size={12} />Call Now</SmallBtn>}
                            <SmallBtn bg="#f8faf9" color="#0c1a12" border flex onClick={() => openLead(l)}>Send Reminder</SmallBtn>
                            <SmallBtn bg="#f8faf9" color="#0c1a12" border flex onClick={() => openLead(l)}><Calendar size={12} />Visit</SmallBtn>
                          </div>
                        </div>
                      ))}
                      {(premiumTab === "urgent" ? premiumsUrgent : premiumsSoon).length === 0 && (
                        <EmptyState emoji="✅" text={`No ${premiumTab === "urgent" ? "urgent" : "upcoming"} premiums due`} />
                      )}
                    </div>
                  </div>
                )}

                {/* ── ALL LEADS ─────────────────────────────────────────── */}
                {activePage === "leads" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Filters */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div style={{
                        flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8,
                        background: "#fff", borderRadius: 12, padding: "9px 14px",
                        border: "1px solid rgba(0,0,0,0.07)",
                      }}>
                        <Search size={14} color="#94a3b8" />
                        <input type="text" placeholder="Search households…" value={search}
                          onChange={e => setSearch(e.target.value)}
                          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 300, color: "#0c1a12", fontFamily: "'DM Sans',sans-serif", flex: 1 }}
                        />
                        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={12} color="#94a3b8" /></button>}
                      </div>
                      {[
                        { value: filterStatus, onChange: (v: string) => setFilterStatus(v as LeadStatus | "ALL"), options: [["ALL","All Statuses"],["NEW","New"],["CONTACTED","Contacted"],["POLICY_ISSUED","Policy Issued"],["REJECTED","Rejected"]] },
                        { value: filterPolicy, onChange: (v: string) => setFilterPolicy(v), options: [["ALL","All Policies"], ...allPolicyTypes.map(p => [p, p])] },
                        { value: sortBy, onChange: (v: string) => setSortBy(v as "name"|"date"|"status"), options: [["date","Recent"],["name","Name"],["status","Status"]] },
                      ].map((sel, i) => (
                        <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)} style={{
                          background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12,
                          padding: "9px 14px", fontSize: 12, fontWeight: 400, color: "#0c1a12",
                          fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer",
                        }}>
                          {(sel.options as [string,string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ))}
                    </div>

                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>
                      {filteredLeads.length} Households
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {filteredLeads.map(l => (
                        <button key={l.id} onClick={() => openLead(l)} className="card-hover" style={{
                          width: "100%", background: "#fff", borderRadius: 14,
                          padding: "14px 16px", border: "1px solid rgba(0,0,0,0.05)",
                          cursor: "pointer", textAlign: "left",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                          display: "flex", alignItems: "center", gap: 12,
                        }}>
                          <Avatar name={l.householdName} size={40} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "#0c1a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.householdName}</p>
                              {l.isBirthdayToday && <span style={{ fontSize: 12 }}>🎂</span>}
                              {l.hasPremiumDueUrgent && <span style={{ fontSize: 9, fontWeight: 500, background: "rgba(239,68,68,0.09)", color: "#ef4444", padding: "2px 7px", borderRadius: 999 }}>Due</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {l.phone && <span style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>{l.phone}</span>}
                              {l.familySize && <span style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>· Family of {l.familySize}</span>}
                              {l.income && <span style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>· ₹{l.income.toLocaleString()}/mo</span>}
                            </div>
                            {l.issuances.length > 0 && (
                              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                {l.issuances.map(i => <Chip key={i.id}>{i.policyName}</Chip>)}
                              </div>
                            )}
                          </div>
                          <StatusPill status={l.status} />
                        </button>
                      ))}
                      {filteredLeads.length === 0 && <EmptyState emoji="🔍" text="No households match your filters" />}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ Lead Detail Modal ════════════════════════════════════════════ */}
      {selectedLead && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectedLead(null); }} style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(12,26,18,0.5)", backdropFilter: "blur(8px)",
          padding: 16, fontFamily: "'DM Sans',sans-serif",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 24,
            boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
            width: "100%", maxWidth: 440,
            maxHeight: "90vh", overflow: "hidden",
            display: "flex", flexDirection: "column",
            border: "1px solid rgba(0,0,0,0.06)",
          }}>
            {/* Modal header */}
            <div style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", gap: 12,
              flexShrink: 0,
            }}>
              <Avatar name={selectedLead.householdName} size={40} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: 20, letterSpacing: "-0.01em", color: "#0c1a12" }}>{selectedLead.householdName}</p>
                <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>Edit household details</p>
              </div>
              <button onClick={() => setSelectedLead(null)} style={{
                width: 30, height: 30, borderRadius: 99,
                background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={14} color="#64748b" />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

              {/* Status buttons */}
              <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Status</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {(["NEW", "CONTACTED", "POLICY_ISSUED", "REJECTED"] as LeadStatus[]).map(s => {
                  const m = STATUS_META[s];
                  const active = editStatus === s;
                  return (
                    <button key={s} onClick={() => setEditStatus(s)} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 999,
                      background: active ? m.bg : "#f8faf9",
                      color: active ? m.color : "#94a3b8",
                      border: `1px solid ${active ? m.color + "40" : "rgba(0,0,0,0.07)"}`,
                      fontSize: 11, fontWeight: 500,
                      fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? m.dot : "#cbd5e1" }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Fields grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {[
                  { label: "Phone",             value: editPhone,      setter: setEditPhone,      type: "tel",    placeholder: "9845000000" },
                  { label: "Family Size",        value: editFamilySize, setter: setEditFamilySize, type: "number", placeholder: "4" },
                  { label: "Monthly Income (₹)", value: editIncome,     setter: setEditIncome,     type: "number", placeholder: "8000" },
                  { label: "Date of Birth",      value: editDOB,        setter: setEditDOB,        type: "date",   placeholder: "" },
                ].map(f => (
                  <div key={f.label}>
                    <p style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", marginBottom: 5 }}>{f.label}</p>
                    <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} className="crm-input" style={inputStyle} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", marginBottom: 5 }}>Follow-up Date</p>
                <input type="date" value={editFollowUp} onChange={e => setEditFollowUp(e.target.value)} className="crm-input" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", marginBottom: 5 }}>Notes</p>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="crm-input" style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }} />
              </div>

              {/* Issued policies */}
              {selectedLead.issuances.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Issued Policies</p>
                  {selectedLead.issuances.map(i => (
                    <div key={i.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(5,150,105,0.06)", borderRadius: 10, padding: "9px 12px", marginBottom: 6,
                      border: "1px solid rgba(5,150,105,0.12)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircle2 size={13} color="#059669" />
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12" }}>{i.policyName}</p>
                      </div>
                      {i.premiumAmount && <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8" }}>₹{i.premiumAmount}/yr</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Reminders */}
              {selectedLead.reminders.length > 0 && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Active Reminders</p>
                  {selectedLead.reminders.map(r => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(59,130,246,0.06)", borderRadius: 10, padding: "9px 12px", marginBottom: 6,
                      border: "1px solid rgba(59,130,246,0.12)",
                    }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#0c1a12" }}>{r.type === "BIRTHDAY" ? "🎂 Birthday" : "📞 Follow-up"}</p>
                        <p style={{ fontSize: 10, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>{fmtDate(r.scheduledAt)}{r.note ? ` · ${r.note}` : ""}</p>
                      </div>
                      <button onClick={() => markReminderDone(r.id)} style={{
                        width: 26, height: 26, borderRadius: 99,
                        background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <CheckCircle2 size={13} color="#3b82f6" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 20px 18px", borderTop: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <button onClick={saveLead} disabled={saving} className="save-btn" style={{
                width: "100%", background: "#059669", color: "#fff",
                border: "none", borderRadius: 999, padding: "13px 24px",
                fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans',sans-serif",
                cursor: saving ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s, transform 0.15s",
              }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Micro-components ────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(0,0,0,0.04)", borderRadius: 7,
      padding: "3px 9px", fontSize: 11, fontWeight: 300, color: "#64748b",
      fontFamily: "'DM Sans',sans-serif",
    }}>
      {children}
    </span>
  );
}

function SmallBtn({ children, bg, color, border, flex, as: Tag = "button", ...rest }: any) {
  return (
    <Tag style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "7px 14px", borderRadius: 999,
      background: bg, color, fontSize: 12, fontWeight: 500,
      fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
      border: border ? "1px solid rgba(0,0,0,0.08)" : "none",
      textDecoration: "none", flex: flex ? 1 : undefined,
      justifyContent: "center", transition: "opacity 0.15s",
      whiteSpace: "nowrap",
    }} {...rest}>
      {children}
    </Tag>
  );
}

function ActionCard({ emoji, title, sub, tag, tagColor, tagBg, children }: any) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "14px 16px",
      border: "1px solid rgba(0,0,0,0.05)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 15 }}>{emoji}</span>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0c1a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
          {tag && <span style={{ fontSize: 9, fontWeight: 500, background: tagBg, color: tagColor, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{tag}</span>}
        </div>
        <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", paddingLeft: 23 }}>{sub}</p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", textAlign: "center", border: "1px solid rgba(0,0,0,0.05)" }}>
      <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 40, marginBottom: 10 }}>{emoji}</p>
      <p style={{ fontSize: 13, fontWeight: 300, color: "#94a3b8" }}>{text}</p>
    </div>
  );
}
