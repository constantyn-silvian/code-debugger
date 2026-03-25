import { useEffect, useRef } from "react";
import "./LandingPage.css";

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#@$%&";

function useGlitchText(text, active) {
  const ref = useRef(null);
  const frame = useRef(null);
  const iter = useRef(0);

  useEffect(() => {
    if (!active || !ref.current) return;
    iter.current = 0;
    const original = text;
    const interval = setInterval(() => {
      ref.current.textContent = original
        .split("")
        .map((char, i) => {
          if (i < iter.current) return original[i];
          if (char === " ") return " ";
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        })
        .join("");
      if (iter.current >= original.length) clearInterval(interval);
      iter.current += 1;
    }, 40);
    return () => clearInterval(interval);
  }, [text, active]);

  return ref;
}

export default function LandingPage({ onEnter, onSettings }) {
  const titleRef = useGlitchText("CODE DEBUGGER", true);

  return (
    <div className="landing">
      {/* Grid background */}
      <div className="landing-grid" />
      {/* Scanline effect */}
      <div className="scanline" />

      <nav className="landing-nav">
        <div className="nav-logo">
          <span className="logo-bracket">[</span>DBG<span className="logo-bracket">]</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onSettings}>
          ⚙ Settings
        </button>
      </nav>

      <main className="landing-main">
        <div className="landing-badge animate-fadeUp" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <span className="badge-dot" />
          PBINFO · COMPETITIVE PROGRAMMING
        </div>

        <h1 className="landing-title animate-fadeUp" style={{ animationDelay: "0.25s", opacity: 0 }}>
          <span ref={titleRef} className="title-glitch">CODE DEBUGGER</span>
          <span className="title-cursor" />
        </h1>

        <p className="landing-desc animate-fadeUp" style={{ animationDelay: "0.45s", opacity: 0 }}>
          Primești surse C++ de 100 de puncte de pe PBInfo,<br />
          sabotate de AI cu bug-uri subtile. Găsește greșelile,<br />
          repară codul, trece testele. Simplu. Brutal. Eficient.
        </p>

        <div className="landing-stats animate-fadeUp" style={{ animationDelay: "0.6s", opacity: 0 }}>
          <div className="stat">
            <span className="stat-num">∞</span>
            <span className="stat-label">Probleme PBInfo</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">AI</span>
            <span className="stat-label">Buguri Generate</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">100%</span>
            <span className="stat-label">Surse Corecte</span>
          </div>
        </div>

        <div className="landing-actions animate-fadeUp" style={{ animationDelay: "0.75s", opacity: 0 }}>
          <button className="btn btn-primary btn-lg landing-cta" onClick={onEnter}>
            <span>Start Debugging</span>
            <span className="cta-arrow">→</span>
          </button>
          <p className="landing-note">
            Necesită token Gemini API pentru generarea problemelor
          </p>
        </div>

        <div className="landing-preview animate-fadeUp" style={{ animationDelay: "0.9s", opacity: 0 }}>
          <div className="preview-bar">
            <span className="preview-dot red" />
            <span className="preview-dot yellow" />
            <span className="preview-dot green" />
            <span className="preview-filename">main.cpp</span>
          </div>
          <div className="preview-code">
            <div className="code-line">
              <span className="ln">1</span>
              <span className="kw">#include</span>
              <span className="str"> &lt;iostream&gt;</span>
            </div>
            <div className="code-line">
              <span className="ln">2</span>
              <span className="kw">using namespace </span>
              <span className="id">std</span><span className="punct">;</span>
            </div>
            <div className="code-line">
              <span className="ln">3</span>
            </div>
            <div className="code-line bug-line">
              <span className="ln">4</span>
              <span className="kw">int </span>
              <span className="id">main</span>
              <span className="punct">() {'{'}</span>
            </div>
            <div className="code-line">
              <span className="ln">5</span>
              <span className="indent" />
              <span className="kw">int </span>
              <span className="id">n</span>
              <span className="punct">, </span>
              <span className="id">s </span>
              <span className="punct">= </span>
              <span className="num bug-text">1</span>
              <span className="punct">;</span>
              <span className="bug-marker">← BUG</span>
            </div>
            <div className="code-line">
              <span className="ln">6</span>
              <span className="indent" />
              <span className="id">cin </span>
              <span className="punct">&gt;&gt; </span>
              <span className="id">n</span><span className="punct">;</span>
            </div>
            <div className="code-line bug-line">
              <span className="ln">7</span>
              <span className="indent" />
              <span className="kw">for</span>
              <span className="punct">(</span>
              <span className="kw">int </span>
              <span className="id">i </span>
              <span className="punct">= </span>
              <span className="num">1</span>
              <span className="punct">; </span>
              <span className="id">i </span>
              <span className="punct">&lt; </span>
              <span className="id">n</span>
              <span className="punct bug-text">; </span>
              <span className="id">i</span>
              <span className="punct bug-text">--</span>
              <span className="punct">)</span>
              <span className="bug-marker">← BUG</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <span>Inspirat de AcadNet Interoperabilitate Software</span>
        <span className="footer-sep">·</span>
        <span>PBInfo problems</span>
      </footer>
    </div>
  );
}
