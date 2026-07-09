"use client";

import { ShieldOff, MapPin, Wifi } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Problem() {
  const headingRef = useRef<HTMLDivElement>(null);
  const card0Ref   = useRef<HTMLDivElement>(null);
  const card1Ref   = useRef<HTMLDivElement>(null);
  const card2Ref   = useRef<HTMLDivElement>(null);
  const sourceRef  = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const init = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // heading — fade+rise (not clipped, it's a block)
      gsap.fromTo(headingRef.current,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, ease: "expo.out",
          scrollTrigger: { trigger: headingRef.current, start: "top 80%" } }
      );

      // cards — clip reveal: parent overflow:hidden already set in JSX
      // we animate the inner div from y:105% to y:0
      const cards = [
        { el: card0Ref.current, delay: 0 },
        { el: card1Ref.current, delay: 0.1 },
        { el: card2Ref.current, delay: 0.2 },
      ];

      cards.forEach(({ el, delay }) => {
        if (!el) return;
        const inner = el.querySelector<HTMLElement>(".card-inner");
        if (!inner) return;
        gsap.fromTo(inner,
          { y: "105%", skewY: 1 },
          {
            y: "0%", skewY: 0,
            duration: 1.1,
            ease: "expo.out",
            delay,
            scrollTrigger: { trigger: el, start: "top 85%" },
          }
        );
      });

      gsap.fromTo(sourceRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8, ease: "power2.out",
          scrollTrigger: { trigger: sourceRef.current, start: "top 95%" } }
      );
    };

    init();
  }, []);

  const cardOuter: React.CSSProperties = {
    overflow: "hidden", // clips the inner sliding up
    borderRadius: 20,
    border: "1px solid rgba(0,0,0,0.06)",
  };

  return (
    <section id="problem" style={{ padding: "96px 0", backgroundColor: "#f8faf9" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>

        {/* Heading */}
        <div ref={headingRef} style={{ textAlign: "center", marginBottom: 48, opacity: 0 }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 11,
            letterSpacing: "0.2em", textTransform: "uppercase", color: "#059669", marginBottom: 14,
          }}>The Problem</p>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif", fontWeight: 400,
            fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: "-0.02em",
            lineHeight: 1.1, color: "#0c1a12", margin: 0,
          }}>
            61% of rural India is uninsured.
            <br />
            <span style={{ color: "#94a3b8" }}>Here&apos;s why.</span>
          </h2>
        </div>

        {/* Bento grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto",
          gap: 12,
        }}>

          {/* Card 0 — left full height */}
          <div ref={card0Ref} style={{ ...cardOuter, gridRow: "1 / 3", gridColumn: "1 / 2" }}>
            <div className="card-inner" style={{
              backgroundColor: "#fff", padding: "40px 36px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              minHeight: 340, willChange: "transform",
            }}>
              <div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff1f2",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28,
                }}>
                  <ShieldOff size={20} color="#f43f5e" />
                </div>
                <h3 style={{
                  fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28,
                  letterSpacing: "-0.01em", color: "#0c1a12", marginBottom: 14,
                }}>No Awareness</h3>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 15,
                  color: "#64748b", lineHeight: 1.75, margin: 0,
                }}>
                   Insurance benefits aren&apos;t immediate, making the concept feel irrelevant to rural
                  households with no sustained awareness campaigns reaching them.
                </p>
              </div>
              <div style={{ marginTop: 40 }}>
                <p style={{
                  fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 56,
                  letterSpacing: "-0.03em", color: "#f43f5e", lineHeight: 1, margin: 0,
                }}>61%</p>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 12,
                  color: "#94a3b8", marginTop: 6,
                }}>uninsured rural population</p>
              </div>
            </div>
          </div>

          {/* Card 1 — right top */}
          <div ref={card1Ref} style={{ ...cardOuter, gridRow: "1 / 2", gridColumn: "2 / 3" }}>
            <div className="card-inner" style={{
              backgroundColor: "#fff", padding: "32px 28px", willChange: "transform",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff7ed",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
              }}>
                <MapPin size={20} color="#f97316" />
              </div>
              <h3 style={{
                fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22,
                letterSpacing: "-0.01em", color: "#0c1a12", marginBottom: 10,
              }}>No Access</h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 14,
                color: "#64748b", lineHeight: 1.7, margin: 0,
              }}>
                 Insurance companies are concentrated in urban centers. Rural communities simply
                 don&apos;t have reliable access to products or representatives.
              </p>
            </div>
          </div>

          {/* Card 2 — right bottom dark */}
          <div ref={card2Ref} style={{ ...cardOuter, gridRow: "2 / 3", gridColumn: "2 / 3" }}>
            <div className="card-inner" style={{
              backgroundColor: "#0c1a12", padding: "32px 28px", willChange: "transform",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
              }}>
                <Wifi size={20} color="#4ade80" />
              </div>
              <h3 style={{
                fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22,
                letterSpacing: "-0.01em", color: "#fff", marginBottom: 10,
              }}>No Trust</h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 14,
                color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0,
              }}>
                Despite rising internet penetration, people prefer offline interactions. Fear of
                claim rejections and low financial literacy fuel deep skepticism.
              </p>
            </div>
          </div>

        </div>

        <p ref={sourceRef} style={{
          fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 12,
          color: "#cbd5e1", textAlign: "center", marginTop: 24, opacity: 0,
        }}>
          Source: Jio Insurance Brokers — Rural Insurance Report
        </p>

      </div>
    </section>
  );
}