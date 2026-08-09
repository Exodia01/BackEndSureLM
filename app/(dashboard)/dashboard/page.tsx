"use client";

import { KeycloakSession } from "@/lib/auth/session";
import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatArea from "@/components/dashboard/ChatArea";

interface Lead {
  id: string;
  householdName: string;
  lastMessage: string;
  time: string;
  unread: number;
}

// ── Empty‑state illustration ────────────────────────────────────────────────
function EmptyState() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (!wrapRef.current) return;

      const els = wrapRef.current.querySelectorAll(".fade-rise");
      gsap.fromTo(
        els,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.12,
          delay: 0.1,
        }
      );

      cleanup = () => ScrollTrigger.getAll().forEach((t) => t.kill());
    })();

    return () => cleanup?.();
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        background: "#f8faf9",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Decorative ring */}
      <div
        className="fade-rise"
        style={{
          position: "relative",
          width: 100,
          height: 100,
          marginBottom: 28,
        }}
      >
        {/* Outer glow ring */}
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: "1px solid rgba(5,150,105,0.15)",
            background: "radial-gradient(circle, rgba(5,150,105,0.06) 0%, transparent 70%)",
          }}
        />
        {/* Middle ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(5,150,105,0.2)",
            background: "rgba(5,150,105,0.08)",
          }}
        />
        {/* Icon container */}
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #059669, #047857)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(5,150,105,0.35)",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      </div>

      {/* Label */}
      <p
        className="fade-rise"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#059669",
          marginBottom: 12,
        }}
      >
        Conversations
      </p>

      {/* Headline */}
      <h2
        className="fade-rise"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "clamp(26px, 4vw, 38px)",
          letterSpacing: "-0.02em",
          color: "#0c1a12",
          margin: 0,
          marginBottom: 4,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        No household selected
      </h2>

      <p
        className="fade-rise"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontWeight: 400,
          fontSize: "clamp(22px, 3vw, 32px)",
          letterSpacing: "-0.02em",
          color: "#94a3b8",
          margin: 0,
          marginBottom: 24,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        pick up where you left off
      </p>

      {/* Body */}
      <p
        className="fade-rise"
        style={{
          fontWeight: 300,
          fontSize: 14,
          lineHeight: 1.75,
          color: "#64748b",
          maxWidth: 300,
          textAlign: "center",
          margin: 0,
          marginBottom: 32,
        }}
      >
        Select a household from the sidebar, or tap{" "}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "#0c1a12",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            verticalAlign: "middle",
            position: "relative",
            top: -1,
          }}
        >
          +
        </span>{" "}
        to start a new conversation.
      </p>
      </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<{ sub: string; name?: string } | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return (
    <>
      {/* Load Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #f8faf9;
          -webkit-font-smoothing: antialiased;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 99px; }
      `}</style>

      <div
        style={{
          display: "flex",
          height: "100vh",
          background: "#f8faf9",
          overflow: "hidden",
        }}
      >
        <Sidebar
          user={{
            sub: user?.sub,
            name: user?.name ?? "Agent",
          }}
          activeLead={activeLead}
          onSelectLead={setActiveLead}
        />

        {activeLead ? (
          <ChatArea key={activeLead.id} lead={activeLead} />
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}