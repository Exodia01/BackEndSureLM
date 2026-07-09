(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/SplashScreen.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SplashScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/compiler-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
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
    _s();
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["c"])(24);
    if ($[0] !== "89f0f4050e14ebf726a9d07899ccdcb434b34a924661bb8374968413e4fcb354") {
        for(let $i = 0; $i < 24; $i += 1){
            $[$i] = Symbol.for("react.memo_cache_sentinel");
        }
        $[0] = "89f0f4050e14ebf726a9d07899ccdcb434b34a924661bb8374968413e4fcb354";
    }
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [idx, setIdx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [anim, setAnim] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("in");
    const [stage, setStage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("phrases");
    const styleRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    let t0;
    let t1;
    if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
        t0 = ({
            "SplashScreen[useEffect()]": ()=>{
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
            }
        })["SplashScreen[useEffect()]"];
        t1 = [];
        $[1] = t0;
        $[2] = t1;
    } else {
        t0 = $[1];
        t1 = $[2];
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t0, t1);
    let t2;
    let t3;
    if ($[3] !== idx || $[4] !== ready || $[5] !== stage) {
        t2 = ({
            "SplashScreen[useEffect()]": ()=>{
                if (!ready || stage !== "phrases") {
                    return;
                }
                const holdTimer = setTimeout({
                    "SplashScreen[useEffect() > setTimeout()]": ()=>{
                        setAnim("out");
                        const transTimer = setTimeout({
                            "SplashScreen[useEffect() > setTimeout() > setTimeout()]": ()=>{
                                const next = idx + 1;
                                if (next < PHRASES.length) {
                                    setIdx(next);
                                    setAnim("in");
                                } else {
                                    setStage("logo");
                                }
                            }
                        }["SplashScreen[useEffect() > setTimeout() > setTimeout()]"], TRANS);
                        return ()=>clearTimeout(transTimer);
                    }
                }["SplashScreen[useEffect() > setTimeout()]"], HOLD);
                return ()=>clearTimeout(holdTimer);
            }
        })["SplashScreen[useEffect()]"];
        t3 = [
            ready,
            idx,
            stage
        ];
        $[3] = idx;
        $[4] = ready;
        $[5] = stage;
        $[6] = t2;
        $[7] = t3;
    } else {
        t2 = $[6];
        t3 = $[7];
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t2, t3);
    let t4;
    let t5;
    if ($[8] !== stage) {
        t4 = ({
            "SplashScreen[useEffect()]": ()=>{
                if (stage !== "logo") {
                    return;
                }
                const t1$0 = setTimeout({
                    "SplashScreen[useEffect() > setTimeout()]": ()=>setStage("slide")
                }["SplashScreen[useEffect() > setTimeout()]"], 2200);
                const t2$0 = setTimeout({
                    "SplashScreen[useEffect() > setTimeout()]": ()=>setStage("done")
                }["SplashScreen[useEffect() > setTimeout()]"], 3100);
                return ()=>{
                    clearTimeout(t1$0);
                    clearTimeout(t2$0);
                };
            }
        })["SplashScreen[useEffect()]"];
        t5 = [
            stage
        ];
        $[8] = stage;
        $[9] = t4;
        $[10] = t5;
    } else {
        t4 = $[9];
        t5 = $[10];
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t4, t5);
    if (!ready || stage === "done") {
        return null;
    }
    const isIn = anim === "in";
    const t6 = stage === "slide" ? "slideUp 0.9s cubic-bezier(0.76, 0, 0.24, 1) forwards" : "none";
    let t7;
    if ($[11] !== t6) {
        t7 = {
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#12271d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            animation: t6
        };
        $[11] = t6;
        $[12] = t7;
    } else {
        t7 = $[12];
    }
    let t8;
    if ($[13] !== idx || $[14] !== isIn || $[15] !== stage) {
        t8 = stage === "phrases" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            lineNumber: 166,
            columnNumber: 33
        }, this);
        $[13] = idx;
        $[14] = isIn;
        $[15] = stage;
        $[16] = t8;
    } else {
        t8 = $[16];
    }
    let t9;
    if ($[17] !== stage) {
        t9 = (stage === "logo" || stage === "slide") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                animation: "logoReveal 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards"
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        display: "flex",
                        alignItems: "baseline"
                    },
                    children: [
                        "Sure".split("").map(_SplashScreenAnonymous),
                        "LM".split("").map(_SplashScreenAnonymous2),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                            lineNumber: 197,
                            columnNumber: 101
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/SplashScreen.tsx",
                    lineNumber: 194,
                    columnNumber: 8
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    lineNumber: 205,
                    columnNumber: 20
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/SplashScreen.tsx",
            lineNumber: 188,
            columnNumber: 53
        }, this);
        $[17] = stage;
        $[18] = t9;
    } else {
        t9 = $[18];
    }
    let t10;
    if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
        t10 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            lineNumber: 222,
            columnNumber: 11
        }, this);
        $[19] = t10;
    } else {
        t10 = $[19];
    }
    let t11;
    if ($[20] !== t7 || $[21] !== t8 || $[22] !== t9) {
        t11 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: t7,
            children: [
                t8,
                t9,
                t10
            ]
        }, void 0, true, {
            fileName: "[project]/components/SplashScreen.tsx",
            lineNumber: 236,
            columnNumber: 11
        }, this);
        $[20] = t7;
        $[21] = t8;
        $[22] = t9;
        $[23] = t11;
    } else {
        t11 = $[23];
    }
    return t11;
}
_s(SplashScreen, "zm5YU8YobQtjWqqJa1WiSRqoAWc=");
_c = SplashScreen;
function _SplashScreenAnonymous2(c_0, i_0) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        style: {
            fontFamily: "'Geom', sans-serif",
            fontSize: "clamp(48px, 9vw, 84px)",
            fontWeight: 600,
            color: "#4ade80",
            letterSpacing: "-0.02em",
            lineHeight: 1
        },
        children: c_0
    }, i_0, false, {
        fileName: "[project]/components/SplashScreen.tsx",
        lineNumber: 247,
        columnNumber: 10
    }, this);
}
function _SplashScreenAnonymous(c, i) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
        lineNumber: 257,
        columnNumber: 10
    }, this);
}
var _c;
__turbopack_context__.k.register(_c, "SplashScreen");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=components_SplashScreen_tsx_b06c5fe2._.js.map