module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/components/SplashScreen.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SplashScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const KEYFRAMES = `
  @keyframes phraseIn {
    0%   { opacity: 0; transform: translateY(18px); filter: blur(8px); }
    60%  { filter: blur(0px); }
    100% { opacity: 1; transform: translateY(0px);  filter: blur(0px); }
  }
  @keyframes phraseOut {
    0%   { opacity: 1; transform: translateY(0px);   filter: blur(0px); }
    40%  { filter: blur(6px); }
    100% { opacity: 0; transform: translateY(-18px); filter: blur(8px); }
  }
  @keyframes logoReveal {
    0%   { opacity: 0; transform: translateY(28px); filter: blur(10px); }
    60%  { filter: blur(0px); }
    100% { opacity: 1; transform: translateY(0px);  filter: blur(0px); }
  }
  @keyframes tagReveal {
    0%   { opacity: 0; }
    100% { opacity: 0.4; }
  }
  @keyframes slideUp {
    0%   { transform: translateY(0vh); }
    100% { transform: translateY(-100vh); }
  }
`;
const PHRASES = [
    "तमसो मा ज्योतिर्गमय",
    "Ex tenebris lux",
    "ἐκ σκότους εἰς φῶς",
    "De la oscuridad a la luz",
    "無知から知へ",
    "ਹਨੇਰੇ ਤੋਂ ਰੌਸ਼ਨੀ ਵੱਲ",
    "ଅନ୍ଧକାରରୁ ଆଲୋକକୁ"
];
const HOLD = 500; // ms fully visible
const TRANS = 250; // ms per fade
function SplashScreen() {
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [idx, setIdx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [anim, setAnim] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("in");
    const [stage, setStage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("phrases");
    const styleRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // inject keyframes — fixed: cleanup returns void
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const el = document.createElement("style");
        el.textContent = KEYFRAMES;
        document.head.appendChild(el);
        styleRef.current = el;
        setReady(true);
        return ()=>{
            if (styleRef.current) {
                document.head.removeChild(styleRef.current);
                styleRef.current = null;
            }
        };
    }, []);
    // phrase sequencer
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!ready || stage !== "phrases") return;
        const holdTimer = setTimeout(()=>{
            setAnim("out");
            const transTimer = setTimeout(()=>{
                const next = idx + 1;
                if (next < PHRASES.length) {
                    setIdx(next);
                    setAnim("in");
                } else {
                    setStage("logo");
                }
            }, TRANS);
            return ()=>clearTimeout(transTimer);
        }, HOLD);
        return ()=>clearTimeout(holdTimer);
    }, [
        ready,
        idx,
        stage
    ]);
    // logo → slide
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (stage !== "logo") return;
        const t1 = setTimeout(()=>setStage("slide"), 2200);
        const t2 = setTimeout(()=>setStage("done"), 3100);
        return ()=>{
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [
        stage
    ]);
    if (!ready || stage === "done") return null;
    const isIn = anim === "in";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#12271d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            animation: stage === "slide" ? "slideUp 0.9s cubic-bezier(0.76, 0, 0.24, 1) forwards" : "none"
        },
        children: [
            stage === "phrases" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                style: {
                    fontFamily: "'Geom', sans-serif",
                    fontSize: "clamp(18px, 3vw, 30px)",
                    fontWeight: 400,
                    color: "#ffffff",
                    lineHeight: 1.6,
                    textAlign: "center",
                    maxWidth: 560,
                    padding: "0 40px",
                    display: "block",
                    willChange: "opacity, transform, filter",
                    animation: `${isIn ? "phraseIn" : "phraseOut"} ${TRANS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                },
                children: PHRASES[idx]
            }, idx, false, {
                fileName: "[project]/components/SplashScreen.tsx",
                lineNumber: 119,
                columnNumber: 9
            }, this),
            (stage === "logo" || stage === "slide") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                    animation: "logoReveal 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: "flex",
                            alignItems: "baseline"
                        },
                        children: [
                            "Sure".split("").map((c, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        fontFamily: "'Geom', sans-serif",
                                        fontSize: "clamp(48px, 9vw, 84px)",
                                        fontWeight: 600,
                                        color: "#ffffff",
                                        letterSpacing: "-0.02em",
                                        lineHeight: 1
                                    },
                                    children: c
                                }, i, false, {
                                    fileName: "[project]/components/SplashScreen.tsx",
                                    lineNumber: 150,
                                    columnNumber: 15
                                }, this)),
                            "LM".split("").map((c, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        fontFamily: "'Geom', sans-serif",
                                        fontSize: "clamp(48px, 9vw, 84px)",
                                        fontWeight: 600,
                                        color: "#4ade80",
                                        letterSpacing: "-0.02em",
                                        lineHeight: 1
                                    },
                                    children: c
                                }, i, false, {
                                    fileName: "[project]/components/SplashScreen.tsx",
                                    lineNumber: 160,
                                    columnNumber: 15
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: "#4ade80",
                                    marginLeft: 5,
                                    marginBottom: 12
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/SplashScreen.tsx",
                                lineNumber: 169,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/SplashScreen.tsx",
                        lineNumber: 148,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            fontFamily: "'Geom', sans-serif",
                            fontSize: 11,
                            letterSpacing: "0.28em",
                            textTransform: "uppercase",
                            color: "#ffffff",
                            margin: 0,
                            animation: "tagReveal 0.8s ease 0.5s forwards",
                            opacity: 0
                        },
                        children: "Rural Insurance · Powered by AI"
                    }, void 0, false, {
                        fileName: "[project]/components/SplashScreen.tsx",
                        lineNumber: 180,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/SplashScreen.tsx",
                lineNumber: 141,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.3), transparent)"
                }
            }, void 0, false, {
                fileName: "[project]/components/SplashScreen.tsx",
                lineNumber: 196,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/SplashScreen.tsx",
        lineNumber: 103,
        columnNumber: 5
    }, this);
}
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/dynamic-access-async-storage.external.js [external] (next/dist/server/app-render/dynamic-access-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/dynamic-access-async-storage.external.js", () => require("next/dist/server/app-render/dynamic-access-async-storage.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f711c865._.js.map