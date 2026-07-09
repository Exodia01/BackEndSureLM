"use client";

import { Brain, Globe, UserCheck, FileSearch, MessageSquare, BarChart3 } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Features() {
  const headingRef = useRef<HTMLDivElement>(null);
  const cardRefs   = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const init = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      gsap.fromTo(headingRef.current,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, ease: "expo.out",
          scrollTrigger: { trigger: headingRef.current, start: "top 80%" } }
      );

      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const inner = el.querySelector<HTMLElement>(".card-inner");
        if (!inner) return;
        gsap.fromTo(inner,
          { y: "105%", skewY: 1 },
          {
            y: "0%", skewY: 0,
            duration: 1.1,
            ease: "expo.out",
            delay: (i % 2) * 0.1,
            scrollTrigger: { trigger: el, start: "top 87%" },
          }
        );
      });
    };
    init();
  }, []);

  const clip = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    overflow: "hidden",
    borderRadius: 16,
    ...extra,
  });

  const iconBox = (bg: string) => ({
    width: 44, height: 44, borderRadius: 12, backgroundColor: bg,
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  } as React.CSSProperties);

  const title = (color = "#0c1a12") => ({
    fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22,
    letterSpacing: "-0.01em", color, marginBottom: 12, margin: "0 0 12px 0",
  } as React.CSSProperties);

  const body = (color = "#64748b") => ({
    fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 14,
    color, lineHeight: 1.8, margin: 0,
  } as React.CSSProperties);

  return (
    <section id="features" style={{ padding: "96px 0", backgroundColor: "#f8faf9" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>

        {/* Heading */}
        <div ref={headingRef} style={{ textAlign: "center", marginBottom: 40, opacity: 0 }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 11,
            letterSpacing: "0.2em", textTransform: "uppercase", color: "#059669", marginBottom: 14,
          }}>Features</p>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif", fontWeight: 400,
            fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: "-0.02em",
            lineHeight: 1.1, color: "#0c1a12", margin: 0,
          }}>
            Everything an agent needs
            <br />
            <span style={{ color: "#94a3b8" }}>to protect a community.</span>
          </h2>
        </div>

        {/* Outer wrapper box */}
        <div style={{
          backgroundColor: "#0c1a12",
          borderRadius: 28,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>

          {/* Row 1: wide + narrow */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 10 }}>

            {/* AI Policy Guru — dark wide */}
            <div ref={el => { cardRefs.current[0] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#12271d", padding: "36px 32px",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                height: "100%", minHeight: 260, willChange: "transform",
              }}>
                <div>
                  <div style={iconBox("rgba(255,255,255,0.08)")}>
                    <Brain size={20} color="#4ade80" />
                  </div>
                  <h3 style={title("#fff")}>AI Policy Guru</h3>
                  <p style={body("rgba(255,255,255,0.5)")}>
                    Real-time policy recommendations powered by LLMs and RAG — agents get
                    expert-level guidance instantly, in any language.
                  </p>
                </div>
                <div style={{
                  marginTop: 28, display: "inline-flex", alignItems: "center",
                  backgroundColor: "rgba(74,222,128,0.1)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 999, padding: "6px 14px", width: "fit-content",
                }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 12, color: "#4ade80" }}>
                    Powered by Llama 4 + RAG
                  </span>
                </div>
              </div>
            </div>

            {/* Multilingual — deep green narrow */}
            <div ref={el => { cardRefs.current[1] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#052e16", padding: "36px 30px",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                height: "100%", minHeight: 260, willChange: "transform",
              }}>
                <div>
                  <div style={iconBox("rgba(255,255,255,0.08)")}>
                    <Globe size={20} color="#86efac" />
                  </div>
                  <h3 style={title("#fff")}>Multilingual</h3>
                  <p style={body("rgba(255,255,255,0.45)")}>
                     Hindi, Tamil, Telugu, Marathi and more — every interaction delivered
                     in the user&apos;s mother tongue, naturally.
                  </p>
                </div>
                <div style={{ marginTop: 24, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["हिन्दी", "தமிழ்", "తెలుగు", "मराठी"].map(l => (
                    <span key={l} style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 999, padding: "4px 11px",
                    }}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: narrow + wide */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.55fr", gap: 10 }}>

            {/* Local Agent Network — white narrow */}
            <div ref={el => { cardRefs.current[2] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#fff", padding: "36px 30px",
                height: "100%", minHeight: 260, willChange: "transform",
              }}>
                <div style={iconBox("#d1fae5")}>
                  <UserCheck size={20} color="#059669" />
                </div>
                <h3 style={title()}>Local Agent Network</h3>
                <p style={body()}>
                  Empower farmers, kirana owners and domestic workers — existing community
                  members become trusted insurance educators overnight.
                </p>
              </div>
            </div>

            {/* Smart Document Processing — off-white wide */}
            <div ref={el => { cardRefs.current[3] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#f0fdf4", padding: "36px 36px",
                display: "flex", flexDirection: "column", justifyContent: "center",
                height: "100%", minHeight: 260, willChange: "transform",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, backgroundColor: "#d1fae5",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
                }}>
                  <FileSearch size={28} color="#059669" />
                </div>
                <h3 style={{ ...title(), fontSize: 24 }}>Smart Document Processing</h3>
                <p style={body()}>
                  OCR-based document extraction and validation — no manual data entry,
                  no errors, no claim rejections. All from a phone camera, in seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: wide + narrow */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 10 }}>

            {/* Claims Assistance — white wide */}
            <div ref={el => { cardRefs.current[4] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#fff", padding: "36px 32px",
                height: "100%", minHeight: 240, willChange: "transform",
              }}>
                <div style={iconBox("#fef3c7")}>
                  <MessageSquare size={20} color="#d97706" />
                </div>
                <h3 style={title()}>Claims Assistance</h3>
                <p style={body()}>
                  Step-by-step claims guidance in the local language. Agents support
                  families through every stage of the process — no one left behind.
                </p>
              </div>
            </div>

            {/* Agent Dashboard — dark narrow */}
            <div ref={el => { cardRefs.current[5] = el; }} style={clip()}>
              <div className="card-inner" style={{
                backgroundColor: "#12271d", padding: "36px 30px",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                height: "100%", minHeight: 240, willChange: "transform",
              }}>
                <div>
                  <div style={iconBox("rgba(255,255,255,0.08)")}>
                    <BarChart3 size={20} color="#4ade80" />
                  </div>
                  <h3 style={title("#fff")}>Agent Dashboard</h3>
                  <p style={body("rgba(255,255,255,0.45)")}>
                    Track leads, policies issued, and household status — everything
                    an agent needs in one clean interface.
                  </p>
                </div>
                <div style={{
                  fontFamily: "'Instrument Serif', serif", fontSize: 48,
                  letterSpacing: "-0.04em", color: "rgba(74,222,128,0.12)",
                  lineHeight: 1, userSelect: "none", marginTop: 16,
                }}>CRM</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}