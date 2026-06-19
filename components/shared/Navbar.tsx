"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const SPLASH_DURATION = 8.0;

export default function Navbar() {
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -24, opacity: 0, filter: "blur(6px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "expo.out",
        delay: SPLASH_DURATION + 0.1,
      }
    );
  }, []);

  return (
    // outer strip — full width, fixed, centers the pill
    <div
      style={{
        position:        "fixed",
        top:             20,
        left:            0,
        right:           0,
        zIndex:          9998,
        display:         "flex",
        justifyContent:  "center",
        padding:         "0 24px",
        pointerEvents:   "none",
      }}
    >
      {/* pill */}
      <nav
        ref={navRef}
        style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "space-between",
          width:           "100%",
          maxWidth:        820,
          height:          52,
          padding:         "0 20px",
          borderRadius:    999,
          backgroundColor: "rgba(255, 255, 255, 0.72)",
          backdropFilter:  "blur(18px) saturate(1.6)",
          WebkitBackdropFilter: "blur(18px) saturate(1.6)",
          border:          "1px solid rgba(0, 0, 0, 0.07)",
          boxShadow:       "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          opacity:         0,
          pointerEvents:   "all",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily:    "'Instrument Serif', serif",
            fontWeight:    400,
            fontSize:      20,
            letterSpacing: "-0.02em",
            color:         "#0c1a12",
            textDecoration: "none",
            flexShrink:    0,
          }}
        >
          Sure<span style={{ color: "#059669" }}>LM</span>
        </Link>

        {/* Nav links */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        32,
          }}
          className="hidden md:flex"
        >
          {["Problem", "Solution", "Features"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              style={{
                fontFamily:     "'DM Sans', sans-serif",
                fontWeight:     400,
                fontSize:       14,
                color:          "#64748b",
                textDecoration: "none",
                transition:     "color 0.15s ease",
                position:'relative',
                left:'50px'
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#0c1a12")}
              onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Link href="/sign-in">
            <button
              style={{
                fontFamily:      "'DM Sans', sans-serif",
                fontWeight:      400,
                fontSize:        14,
                color:           "#475569",
                background:      "none",
                border:          "none",
                cursor:          "pointer",
                padding:         "6px 12px",
                borderRadius:    999,
                transition:      "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                e.currentTarget.style.color = "#0c1a12";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#475569";
              }}
            >
              Sign in
            </button>
          </Link>

          <Link href="/sign-up">
            <button
              style={{
                fontFamily:      "'DM Sans', sans-serif",
                fontWeight:      500,
                fontSize:        14,
                color:           "#fff",
                backgroundColor: "#059669",
                border:          "none",
                cursor:          "pointer",
                padding:         "7px 16px",
                borderRadius:    999,
                transition:      "background 0.15s ease, transform 0.1s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#047857";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "#059669";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Get Started
            </button>
          </Link>
        </div>
      </nav>
    </div>
  );
}