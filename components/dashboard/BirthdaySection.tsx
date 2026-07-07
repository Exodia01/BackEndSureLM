import { useState, useEffect } from "react";
import { Phone, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";

interface BirthdayEntry {
  id: string;
  name: string;
  phone: string | null;
  dateOfBirth: string;
  daysUntil: number;
  isToday: boolean;
  wishSent: boolean;
  refreshedAt: string;
  lead: {
    status: string;
    issuances: { policyName: string; premiumAmount: number | null }[];
  };
}

function getAge(dob: string) {
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

function formatDOB(dob: string) {
  return new Date(dob).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const F = {
  serif: "'Instrument Serif', serif",
  sans:  "'DM Sans', sans-serif",
};

export function BirthdaySection() {
  const [birthdays, setBirthdays]   = useState<BirthdayEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<"today" | "week" | "upcoming">("today");

  const fetchBirthdays = async () => {
    try {
      const res  = await fetch("/api/birthdays");
      const json = await res.json();
      if (json.success) setBirthdays(json.data);
    } catch { console.error("Failed to fetch birthdays"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBirthdays(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/birthdays", { method: "POST" });
      await fetchBirthdays();
    } finally { setRefreshing(false); }
  };

  const markWishSent = async (id: string) => {
    await fetch("/api/birthdays", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBirthdays(prev => prev.map(b => b.id === id ? { ...b, wishSent: true } : b));
  };

  const todayList    = birthdays.filter(b => b.daysUntil === 0);
  const weekList     = birthdays.filter(b => b.daysUntil > 0 && b.daysUntil <= 7);
  const upcomingList = birthdays.filter(b => b.daysUntil > 7);
  const activeList   = tab === "today" ? todayList : tab === "week" ? weekList : upcomingList;

  const lastRefreshed = birthdays[0]?.refreshedAt
    ? new Date(birthdays[0].refreshedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Birthdays Today",  value: todayList.length,                        accent: "#f43f5e", lightBg: "#fff1f2" },
          { label: "This Week",        value: weekList.length,                          accent: "#f97316", lightBg: "#fff7ed" },
          { label: "Wishes Sent",      value: birthdays.filter(b => b.wishSent).length, accent: "#059669", lightBg: "#d1fae5" },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            padding: "20px 22px",
            overflow: "hidden",
            position: "relative",
          }}>
            {/* accent dot */}
            <div style={{
              position: "absolute", top: 18, right: 18,
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: s.accent, opacity: 0.5,
            }} />
            <p style={{
              fontFamily: F.serif, fontWeight: 400, fontSize: 40,
              letterSpacing: "-0.03em", color: s.accent, lineHeight: 1, margin: 0,
            }}>{s.value}</p>
            <p style={{
              fontFamily: F.sans, fontWeight: 400, fontSize: 13,
              color: "#0c1a12", marginTop: 6, marginBottom: 0,
            }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs + Refresh ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "today",    label: `Today (${todayList.length})` },
            { key: "week",     label: `This Week (${weekList.length})` },
            { key: "upcoming", label: `Upcoming (${upcomingList.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              style={{
                fontFamily:      F.sans,
                fontWeight:      400,
                fontSize:        13,
                padding:         "7px 16px",
                borderRadius:    999,
                border:          tab === t.key ? "none" : "1px solid rgba(0,0,0,0.08)",
                backgroundColor: tab === t.key ? "#0c1a12" : "#fff",
                color:           tab === t.key ? "#fff" : "#64748b",
                cursor:          "pointer",
                transition:      "all 0.15s ease",
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefreshed && (
            <span style={{ fontFamily: F.sans, fontWeight: 300, fontSize: 12, color: "#94a3b8" }}>
              Refreshed {lastRefreshed}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              display:         "inline-flex", alignItems: "center", gap: 6,
              fontFamily:      F.sans, fontWeight: 400, fontSize: 12,
              backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)",
              color:           "#64748b", padding: "7px 14px", borderRadius: 999,
              cursor:          "pointer", transition: "background 0.15s ease",
            }}
          >
            {refreshing
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Table / empty / loading ── */}
      {loading ? (
        <div style={{
          backgroundColor: "#fff", borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.06)", padding: 48,
          display: "flex", justifyContent: "center",
        }}>
          <Loader2 size={20} color="#059669" style={{ animation: "spin 1s linear infinite" }} />
        </div>

      ) : activeList.length === 0 ? (
        <div style={{
          backgroundColor: "#fff", borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.06)", padding: "48px 24px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 32, margin: "0 0 10px" }}>🎂</p>
          <p style={{ fontFamily: F.sans, fontWeight: 300, fontSize: 14, color: "#94a3b8", margin: 0 }}>
            No birthdays {tab === "today" ? "today" : tab === "week" ? "this week" : "upcoming"}
          </p>
        </div>

      ) : (
        <div style={{
          backgroundColor: "#fff", borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden",
        }}>
          {/* header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr",
            gap: 12, padding: "12px 20px",
            backgroundColor: "#f8faf9", borderBottom: "1px solid rgba(0,0,0,0.05)",
          }}>
            {["Customer", "Date of Birth", "Policy", "Days Until", "Action"].map(h => (
              <span key={h} style={{
                fontFamily: F.sans, fontWeight: 500, fontSize: 11,
                letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8",
              }}>{h}</span>
            ))}
          </div>

          {/* rows */}
          <div>
            {activeList.map((b, i) => (
              <div
                key={b.id}
                style={{
                  display:       "grid",
                  gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr",
                  gap:           12,
                  padding:       "14px 20px",
                  alignItems:    "center",
                  borderTop:     i === 0 ? "none" : "1px solid rgba(0,0,0,0.04)",
                  opacity:       b.wishSent ? 0.55 : 1,
                  transition:    "background 0.12s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f8faf9")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    backgroundColor: "#fff1f2", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontFamily: F.serif, fontSize: 14, color: "#f43f5e" }}>
                      {b.name[0]}
                    </span>
                  </div>
                  <div>
                    <p style={{
                      fontFamily: F.sans, fontWeight: 500, fontSize: 13,
                      color: "#0c1a12", margin: 0,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {b.name}
                      {b.isToday && <span>🎂</span>}
                      {b.wishSent && <CheckCircle2 size={13} color="#059669" />}
                    </p>
                    {b.phone && (
                      <p style={{ fontFamily: F.sans, fontWeight: 300, fontSize: 11, color: "#94a3b8", margin: 0 }}>
                        {b.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* DOB */}
                <div>
                  <p style={{ fontFamily: F.sans, fontWeight: 400, fontSize: 13, color: "#0c1a12", margin: 0 }}>
                    {formatDOB(b.dateOfBirth)}
                  </p>
                  <p style={{ fontFamily: F.sans, fontWeight: 300, fontSize: 11, color: "#94a3b8", margin: 0 }}>
                    Turning {getAge(b.dateOfBirth)}
                  </p>
                </div>

                {/* Policy */}
                <div>
                  {b.lead.issuances.length > 0 ? (
                    <span style={{
                      fontFamily: F.sans, fontWeight: 400, fontSize: 11,
                      backgroundColor: "#d1fae5", color: "#059669",
                      padding: "4px 10px", borderRadius: 999,
                    }}>
                      {b.lead.issuances[0].policyName.split(" ").slice(0, 3).join(" ")}
                    </span>
                  ) : (
                    <span style={{ fontFamily: F.sans, fontWeight: 300, fontSize: 12, color: "#94a3b8" }}>
                      No policy
                    </span>
                  )}
                </div>

                {/* Days until */}
                <div>
                  {b.daysUntil === 0 ? (
                    <span style={{
                      fontFamily: F.sans, fontWeight: 500, fontSize: 11,
                      backgroundColor: "#fff1f2", color: "#f43f5e",
                      padding: "4px 10px", borderRadius: 999,
                    }}>Today 🎉</span>
                  ) : (
                    <span style={{
                      fontFamily: F.sans, fontWeight: 400, fontSize: 11,
                      backgroundColor: b.daysUntil <= 7 ? "#fff7ed" : "#f0fdf4",
                      color:           b.daysUntil <= 7 ? "#f97316" : "#059669",
                      padding: "4px 10px", borderRadius: 999,
                    }}>{b.daysUntil} days</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => markWishSent(b.id)}
                    disabled={b.wishSent}
                    style={{
                      fontFamily:      F.sans, fontWeight: 400, fontSize: 12,
                      padding:         "6px 12px", borderRadius: 999, border: "none",
                      backgroundColor: b.wishSent ? "rgba(0,0,0,0.05)" : "#0c1a12",
                      color:           b.wishSent ? "#94a3b8" : "#fff",
                      cursor:          b.wishSent ? "default" : "pointer",
                      transition:      "background 0.15s ease",
                    }}
                  >
                    {b.wishSent ? "Sent ✓" : "💬 Wish"}
                  </button>

                  {b.phone && (
                    <a
                      href={`tel:${b.phone}`}
                      style={{
                        display:         "inline-flex", alignItems: "center",
                        padding:         "6px 10px", borderRadius: 999,
                        border:          "1px solid rgba(0,0,0,0.08)",
                        color:           "#64748b", textDecoration: "none",
                        transition:      "background 0.15s ease",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f8faf9")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Phone size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}