"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import PolicyOCRModal from "./PolicyOCRModal";

interface Message {
  id: string;
  role: "agent" | "ai";
  content: string;
  policies?: Policy[];
  timestamp: Date;
}

interface Policy {
  name: string;
  provider: string;
  premium: string;
  coverage: string;
  tag: string;
}

interface Lead {
  id: string;
  householdName: string;
  lastMessage: string;
  time: string;
  unread: number;
}

interface DbMessage {
  id: string;
  role: string;
  content: string;
  policies: Policy[] | null;
  createdAt: string;
}

interface ChatAreaProps {
  lead: Lead;
}

// SSE payload shapes
interface TokenEvent { type: "token"; token: string; }
interface DoneEvent  { type: "done";  success: boolean; data?: { type: string; analysis?: string; policies?: Policy[]; content?: string; }; }
type SSEEvent = TokenEvent | DoneEvent;

const WELCOME_MESSAGE = (name: string): Message => ({
  id: "welcome",
  role: "ai",
  content: `Hello! I'm your AI insurance assistant. Tell me about ${name}'s household — their income, family size, occupation, and any specific needs. I'll recommend the best policies for them.`,
  timestamp: new Date(),
});

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size / 2.8,
      background: `hsl(${hue}, 38%, 88%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 500, fontSize: size * 0.36,
      color: `hsl(${hue}, 45%, 32%)`,
      letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

// ── Policy card ───────────────────────────────────────────────────────────────
function PolicyCard({
  policy, issued, issuing, onIssue,
}: {
  policy: Policy; issued: boolean; issuing: boolean; onIssue: () => void;
}) {
  return (
    <div
      style={{
        background: issued ? "rgba(5,150,105,0.04)" : "#fff",
        border: `1px solid ${issued ? "rgba(5,150,105,0.25)" : "rgba(0,0,0,0.06)"}`,
        borderRadius: 20,
        padding: "16px 18px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: issued ? "none" : "0 2px 12px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => { if (!issued) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(5,150,105,0.3)"; }}
      onMouseLeave={(e) => { if (!issued) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.06)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 17, color: "#0c1a12", letterSpacing: "-0.01em", marginBottom: 2 }}>
            {policy.name}
          </p>
          <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
            {policy.provider}
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
          background: "rgba(5,150,105,0.09)", color: "#059669",
          padding: "3px 10px", borderRadius: 999, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
        }}>
          {policy.tag}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Premium</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#0c1a12", fontFamily: "'DM Sans', sans-serif" }}>{policy.premium}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Coverage</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#0c1a12", fontFamily: "'DM Sans', sans-serif" }}>{policy.coverage}</p>
        </div>
        <button
          onClick={onIssue}
          disabled={issued || issuing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 999,
            border: "none", cursor: issued || issuing ? "default" : "pointer",
            background: issued ? "rgba(5,150,105,0.1)" : "#0c1a12",
            color: issued ? "#059669" : "#fff",
            fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.15s, transform 0.15s", flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (!issued && !issuing) (e.currentTarget as HTMLButtonElement).style.background = "#059669"; }}
          onMouseLeave={(e) => { if (!issued && !issuing) (e.currentTarget as HTMLButtonElement).style.background = "#0c1a12"; }}
        >
          {issuing ? <Loader2 size={12} className="animate-spin" /> : issued ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
          {issued ? "Issued" : "Issue Policy"}
        </button>
      </div>

      {issued && (
        <p style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 48, fontWeight: 400,
          color: "rgba(5,150,105,0.07)", lineHeight: 1, marginTop: 4,
          letterSpacing: "-0.02em", userSelect: "none", textAlign: "right",
        }}>
          issued
        </p>
      )}
    </div>
  );
}

// ── Streaming cursor blink ────────────────────────────────────────────────────
function StreamingCursor() {
  return (
    <span style={{
      display: "inline-block", width: 2, height: 13,
      background: "#059669", marginLeft: 2,
      animation: "cursor-blink 0.8s step-end infinite",
      verticalAlign: "text-bottom", borderRadius: 1,
    }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatArea({ lead }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [issuingPolicy, setIssuingPolicy] = useState<string | null>(null);
  const [issuedPolicies, setIssuedPolicies] = useState<Set<string>>(new Set());
  const [ocrPolicy, setOcrPolicy] = useState<Policy | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setLoadingHistory(true);
    setIssuedPolicies(new Set());
    setStreamingId(null);
    loadAll();
  }, [lead.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const loadAll = async () => {
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/messages?leadId=${lead.id}`),
        fetch(`/api/issuances?leadId=${lead.id}`),
      ]);
      const [mJson, iJson] = await Promise.all([mRes.json(), iRes.json()]);

      if (mJson.success && mJson.data.length > 0) {
        setMessages(mJson.data.map((m: DbMessage) => ({
          id: m.id,
          role: m.role === "AGENT" ? "agent" : "ai",
          content: m.content,
          policies: m.policies ?? undefined,
          timestamp: new Date(m.createdAt),
        })));
      } else {
        setMessages([WELCOME_MESSAGE(lead.householdName)]);
      }

      if (iJson.success && iJson.data.length > 0) {
        setIssuedPolicies(new Set(iJson.data.map((i: { policyName: string }) => i.policyName)));
      }
    } catch {
      setMessages([WELCOME_MESSAGE(lead.householdName)]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveMessage = async (role: "agent" | "ai", content: string, policies?: Policy[]) => {
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, role, content, policies: policies ?? null }),
      });
    } catch { console.error("Failed to save message"); }
  };

  const issuePolicy = async (policy: Policy) => {
    if (issuingPolicy || issuedPolicies.has(policy.name)) return;
    setIssuingPolicy(policy.name);
    setOcrPolicy(null);
    try {
      const res = await fetch("/api/issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          policyName: policy.name,
          policyProvider: policy.provider,
          premiumAmount: policy.premium,
        }),
      });
      const json = await res.json();
      if (json.success) setIssuedPolicies((p) => new Set(p).add(policy.name));
    } catch { console.error("Failed to issue policy"); }
    finally { setIssuingPolicy(null); }
  };

  // ── Streaming sendMessage ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Build history with policy context annotations (same as before)
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role,
        content: m.policies?.length
          ? `${m.content}\n\n[Policies shown to user: ${m.policies.map((p) => `"${p.name}" by ${p.provider} (${p.premium}, ${p.coverage})`).join(" | ")}]`
          : m.content,
      }));

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "agent",
      content: input,
      timestamp: new Date(),
    };
    setMessages((p) => [...p, userMsg]);
    const sent = input;
    setInput("");
    setLoading(true);

    await saveMessage("agent", sent);

    // Add a placeholder AI message — tokens will fill it in
    const aiId = (Date.now() + 1).toString();
    setStreamingId(aiId);
    setMessages((p) => [...p, { id: aiId, role: "ai", content: "", timestamp: new Date() }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sent, history }),
      });

      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by "\n\n"
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data:")) continue;

          let payload: SSEEvent;
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch { continue; }

          if (payload.type === "token") {
            // Append token to the streaming placeholder
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId ? { ...m, content: m.content + payload.token } : m
              )
            );
          }

          if (payload.type === "done") {
            setStreamingId(null);

            if (!payload.success || !payload.data) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, content: "Sorry, I couldn't process that. Please try again." } : m
                )
              );
              break;
            }

            const d = payload.data;
            const isRec = d.type === "recommendation";
            const finalContent  = isRec ? (d.analysis ?? "") : (d.content ?? "");
            const finalPolicies = isRec ? d.policies : undefined;

            // Replace placeholder with final structured message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId ? { ...m, content: finalContent, policies: finalPolicies } : m
              )
            );

            await saveMessage("ai", finalContent, finalPolicies);
          }
        }
      }
    } catch {
      setStreamingId(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, content: "Sorry, I couldn't process that. Please try again." } : m
        )
      );
    } finally {
      setLoading(false);
      setStreamingId(null);
    }
  };

  const fmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const msgCount = messages.filter((m) => m.role === "agent").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        .chat-textarea::placeholder { color: #94a3b8; }
        .chat-textarea:focus { outline: none; }
        .send-btn:hover:not(:disabled) { background: #059669 !important; transform: translateY(-1px); }
        .send-btn:disabled { background: #e2e8f0 !important; cursor: default; }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 99px; }
      `}</style>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#f8faf9",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* OCR Modal */}
        {ocrPolicy && (
          <PolicyOCRModal
            policy={ocrPolicy}
            householdName={lead.householdName}
            onSuccess={issuePolicy}
            onClose={() => setOcrPolicy(null)}
          />
        )}

        {/* ── Header ── */}
        <div style={{
          background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.05)",
          padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <Avatar name={lead.householdName} size={38} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 18, letterSpacing: "-0.01em", color: "#0c1a12", lineHeight: 1.2 }}>
              {lead.householdName}
            </p>
            <p style={{ fontSize: 11, fontWeight: 300, color: "#94a3b8", marginTop: 1 }}>
              {loadingHistory
                ? "Loading…"
                : streamingId
                ? "Typing…"
                : msgCount === 0
                ? "New conversation"
                : `${msgCount} message${msgCount === 1 ? "" : "s"}`}
            </p>
          </div>

          {issuedPolicies.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(5,150,105,0.08)", color: "#059669",
              fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999,
              border: "1px solid rgba(5,150,105,0.15)",
            }}>
              <CheckCircle2 size={12} />
              {issuedPolicies.size} polic{issuedPolicies.size === 1 ? "y" : "ies"} issued
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "24px 24px 8px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {loadingHistory ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[72, 48, 96, 52].map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" }}>
                  <div style={{
                    height: h, width: i % 2 === 0 ? 280 : 200,
                    background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(5,150,105,0.08)",
                    borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                </div>
              ))}
            </div>
          ) : (
            messages.map((msg) => {
              const isStreaming = msg.id === streamingId;

              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "agent" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: 520, display: "flex", flexDirection: "column",
                    alignItems: msg.role === "agent" ? "flex-end" : "flex-start", gap: 4,
                  }}>
                    {/* AI label */}
                    {msg.role === "ai" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 7, background: "#0c1a12",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Sparkles size={11} color={isStreaming ? "#4ade80" : "#4ade80"} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>
                          {isStreaming ? "Typing…" : "AI Assistant"}
                        </span>
                      </div>
                    )}

                    {/* Bubble — shown even while empty so cursor is visible */}
                    {(msg.content || isStreaming) && (
                      <div style={{
                        padding: "11px 16px",
                        borderRadius: msg.role === "agent" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        fontSize: 13, fontWeight: 300, lineHeight: 1.75,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        minWidth: isStreaming && !msg.content ? 36 : undefined,
                        minHeight: isStreaming && !msg.content ? 44 : undefined,
                        display: "flex", alignItems: isStreaming && !msg.content ? "center" : undefined,
                        ...(msg.role === "agent"
                          ? { background: "#0c1a12", color: "rgba(255,255,255,0.88)" }
                          : { background: "#fff", color: "#374151", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }
                        ),
                      }}>
                        {msg.content}
                        {isStreaming && <StreamingCursor />}
                      </div>
                    )}

                    {/* Policy cards — only shown after streaming is done */}
                    {!isStreaming && msg.policies && msg.policies.length > 0 && (
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                        <p style={{
                          fontSize: 10, fontWeight: 500, letterSpacing: "0.18em",
                          textTransform: "uppercase", color: "#059669",
                          fontFamily: "'DM Sans', sans-serif", marginBottom: 2,
                        }}>
                          Recommended Policies
                        </p>
                        {msg.policies.map((policy) => (
                          <PolicyCard
                            key={policy.name}
                            policy={policy}
                            issued={issuedPolicies.has(policy.name)}
                            issuing={issuingPolicy === policy.name}
                            onIssue={() => !issuedPolicies.has(policy.name) && setOcrPolicy(policy)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Timestamp — hide while streaming */}
                    {!isStreaming && (
                      <p style={{ fontSize: 10, fontWeight: 300, color: "#cbd5e1", paddingInline: 4 }}>
                        {fmt(msg.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Bounce-dot indicator only shows before first token arrives */}
          {loading && !streamingId && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: "4px 18px 18px 18px", padding: "12px 18px",
                display: "flex", gap: 5, alignItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                {[0, 0.18, 0.36].map((delay, i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%", background: "#059669",
                    animation: `bounce-dot 1.1s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.05)", padding: "14px 20px 16px", flexShrink: 0 }}>
          <div
            style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              background: "#f8faf9", border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 18, padding: "10px 14px",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocusCapture={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(5,150,105,0.4)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(5,150,105,0.08)";
            }}
            onBlurCapture={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.07)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Describe ${lead.householdName}'s household…`}
              className="chat-textarea"
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", fontSize: 13, fontWeight: 300, color: "#0c1a12",
                fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                minHeight: 24, maxHeight: 120, overflow: "hidden",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="send-btn"
              style={{
                width: 34, height: 34, borderRadius: 999,
                background: input.trim() && !loading ? "#0c1a12" : "#e2e8f0",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s, transform 0.15s",
              }}
            >
              <Send size={14} color={input.trim() && !loading ? "#fff" : "#94a3b8"} />
            </button>
          </div>
          <p style={{ fontSize: 10, fontWeight: 300, color: "#cbd5e1", textAlign: "center", marginTop: 8, letterSpacing: "0.02em" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}