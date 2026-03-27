import { useState, useEffect, useRef, useCallback } from "react";
import { updateProblem } from "../utils/storage";
import { runTests } from "../utils/runner";
import "./DebugPage.css";

// ─── Syntax highlighter C++ minimal ──────────────────────────────────────────
const KW = new Set([
  "int","long","short","char","float","double","bool","void","unsigned","signed",
  "if","else","for","while","do","return","break","continue","switch","case","default",
  "struct","class","public","private","protected","new","delete","nullptr","true","false",
  "include","define","pragma","ifdef","endif","namespace","using","template","typename",
  "const","static","auto","register","volatile","extern","inline","virtual","override",
  "cout","cin","endl","string","vector","map","set","pair","queue","stack","priority_queue",
  "sort","min","max","swap","abs","sqrt","pow","printf","scanf","main",
]);

// Escape HTML chars FIRST, then highlight on the escaped string
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightCpp(code) {
  const lines = code.split("\n");
  return lines.map((line, li) => {
    const spans = [];
    let i = 0;

    // push: takes raw text, escapes it, wraps in span
    const push = (cls, txt) => spans.push(
      cls ? `<span class="${cls}">${esc(txt)}</span>` : esc(txt)
    );

    while (i < line.length) {
      // Comment //
      if (line[i] === "/" && line[i+1] === "/") {
        push("hl-comment", line.slice(i)); break;
      }
      // Preprocessor # (whole line)
      if (i === 0 && line[i] === "#") {
        const space = line.indexOf(" ");
        if (space === -1) { push("hl-pp", line); break; }
        push("hl-pp", line.slice(0, space));
        // rest of #include line — highlight the <header> as a string
        const rest = line.slice(space);
        const ltIdx = rest.indexOf("<");
        const gtIdx = rest.lastIndexOf(">");
        if (ltIdx !== -1 && gtIdx > ltIdx) {
          push(null, rest.slice(0, ltIdx));
          push("hl-string", rest.slice(ltIdx, gtIdx + 1));
          push(null, rest.slice(gtIdx + 1));
        } else {
          push("hl-string", rest);
        }
        break;
      }
      // String "..."
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && !(line[j] === '"' && line[j-1] !== "\\")) j++;
        push("hl-string", line.slice(i, j + 1)); i = j + 1; continue;
      }
      // Char '...'
      if (line[i] === "'") {
        let j = i + 1;
        while (j < line.length && !(line[j] === "'" && line[j-1] !== "\\")) j++;
        push("hl-string", line.slice(i, j + 1)); i = j + 1; continue;
      }
      // Number
      if (/\d/.test(line[i]) && (i === 0 || /\W/.test(line[i-1]))) {
        let j = i;
        while (j < line.length && /[\d.xXa-fA-FuUlL]/.test(line[j])) j++;
        push("hl-number", line.slice(i, j)); i = j; continue;
      }
      // Word — keyword or identifier
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /\w/.test(line[j])) j++;
        const word = line.slice(i, j);
        push(KW.has(word) ? "hl-kw" : "hl-id", word);
        i = j; continue;
      }
      // << >> operators (2-char)
      if ((line[i] === "<" && line[i+1] === "<") || (line[i] === ">" && line[i+1] === ">")) {
        push("hl-op", line.slice(i, i + 2)); i += 2; continue;
      }
      // Single char operator/punctuation — escape individually
      push("hl-op", line[i]); i++;
    }

    return `<div class="hl-line" data-line="${li+1}">${spans.join("") || "\u00a0"}</div>`;
  }).join("");
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DebugPage({ problem, onBack, onSettings, geminiKey }) {
  const [code, setCode]       = useState(problem.buggyCode || problem.correctCode || "");
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [activeTab, setActiveTab] = useState("problem");
  const [hint, setHint]       = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  // Sync scroll between textarea and highlight layer
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop  = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.innerHTML = highlightCpp(code);
    }
  }, [code]);

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = e.target.selectionStart, en = e.target.selectionEnd;
      const next = code.slice(0, s) + "  " + code.slice(en);
      setCode(next);
      requestAnimationFrame(() => {
        textareaRef.current.selectionStart = s + 2;
        textareaRef.current.selectionEnd   = s + 2;
      });
    }
  };

  const handleSubmit = async () => {
    setRunning(true); setRunError(""); setResults(null);
    try {
      const res = await runTests(problem, code, geminiKey);
      setResults(res);
      setActiveTab("tests");
      if (res.every(r => r.passed)) {
        updateProblem(problem.id, { solved: true, solvedCode: code });
      }
    } catch (e) { setRunError(e.message); }
    setRunning(false);
  };

  const handleHint = async () => {
    if (!geminiKey) { setHint("Adaugă token Gemini în Settings."); setShowHint(true); return; }
    setHintLoading(true); setShowHint(true); setHint("");
    try {
      const model = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `Analizezi codul C++ al unui student pentru problema "${problem.title}".
Cerinta: ${problem.statement}
Cod student:\n${code}
Da un HINT scurt (1-2 propozitii) care orienteaza studentul spre bug fara sa il dezvaluie direct. Raspunde doar cu hintul, in romana.`
            }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 150 },
          }),
        }
      );
      const d = await resp.json();
      setHint(d.candidates?.[0]?.content?.parts?.[0]?.text || "Nu s-a putut genera un hint.");
    } catch (e) { setHint("Eroare: " + e.message); }
    setHintLoading(false);
  };

  const passed = results ? results.filter(r => r.passed).length : 0;
  const total  = results?.length || 0;
  const allPassed = results && total > 0 && passed === total;

  return (
    <div className="debug-page">
      <header className="debug-header">
        <div className="debug-header-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Înapoi</button>
          <div className="debug-title">
            <span className="debug-logo">[DBG]</span>
            <span className="debug-sep">/</span>
            <span className="debug-problem-name">{problem.title}</span>
          </div>
        </div>
        <div className="debug-header-right">
          {problem.solved && <span className="solved-badge">✓ Rezolvată</span>}
          <button className="btn btn-ghost btn-sm" onClick={onSettings}>⚙</button>
        </div>
      </header>

      <div className="debug-layout">
        {/* ── Left: cerinta + teste ── */}
        <div className="debug-left">
          <div className="panel-tabs">
            <button className={"panel-tab" + (activeTab==="problem" ? " active" : "")} onClick={() => setActiveTab("problem")}>
              Cerință
            </button>
            <button className={"panel-tab" + (activeTab==="tests" ? " active" : "")} onClick={() => setActiveTab("tests")}>
              Teste {results && <span className="tab-badge">{passed}/{total}</span>}
            </button>
          </div>

          {activeTab === "problem" && (
            <div className="problem-statement">
              {[
                ["Cerința", problem.statement],
                ["Date de intrare", problem.inputSpec],
                ["Date de ieșire", problem.outputSpec],
                ["Restricții", problem.constraints],
              ].filter(([,v]) => v).map(([label, text]) => (
                <div key={label} className="statement-section">
                  <div className="statement-label">{label}</div>
                  <div className="statement-text">{text}</div>
                </div>
              ))}

              {problem.examples?.length > 0 && (
                <div className="statement-section">
                  <div className="statement-label">Exemple</div>
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="example-block">
                      <div className="example-row">
                        <div className="example-col">
                          <div className="example-col-label">Intrare</div>
                          <pre className="example-val">{ex.input}</pre>
                        </div>
                        <div className="example-col">
                          <div className="example-col-label">Ieșire</div>
                          <pre className="example-val">{ex.output}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hint-section">
                <button className="btn btn-ghost btn-sm" onClick={handleHint} disabled={hintLoading}>
                  {hintLoading ? <><span className="spinner" style={{width:12,height:12}}/> Generare hint...</> : "💡 Hint AI"}
                </button>
                {showHint && hint && (
                  <div className="hint-box"><span className="hint-label">Hint:</span> {hint}</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "tests" && (
            <div className="tests-panel">
              {!results ? (
                <div className="tests-empty">
                  <div className="tests-empty-icon">▶</div>
                  <div>Apasă Submit — Gemini generează și verifică testele</div>
                </div>
              ) : (
                <div className="tests-list">
                  <div className={"tests-summary " + (allPassed ? "all-pass" : "some-fail")}>
                    {allPassed ? `✓ Toate ${total} teste trecute! Felicitări!` : `${passed}/${total} teste trecute`}
                  </div>
                  {results.map((r, i) => (
                    <div key={i} className={"test-result " + (r.passed ? "pass" : "fail")}>
                      <div className="test-result-header">
                        <span className={"test-status " + (r.passed ? "pass" : "fail")}>
                          {r.passed ? "✓" : "✗"} Test #{i+1}
                        </span>
                      </div>
                      <div className="test-io">
                        {[["Input", r.input], ["Expected", r.expected], ["Got", r.actual]].map(([lbl, val]) => (
                          <div key={lbl} className="test-io-row">
                            <span className="test-io-label">{lbl}:</span>
                            <pre className={"test-io-val" + (lbl==="Got" && !r.passed ? " wrong" : "")}>{val}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: editor cu syntax highlight ── */}
        <div className="debug-right">
          <div className="editor-header">
            <div className="editor-header-left">
              <span className="editor-lang">C++</span>
              <span className="editor-filename">main.cpp</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode(problem.buggyCode || problem.correctCode || "")}>
              ↺ Reset
            </button>
          </div>

          <div className="editor-wrapper">
            {/* Highlight layer (underneath) */}
            <div
              className="hl-layer"
              ref={highlightRef}
              aria-hidden="true"
            />
            {/* Transparent textarea (on top) */}
            <textarea
              ref={textareaRef}
              className="code-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="editor-footer">
            <div className="editor-footer-left">
              {runError && <div className="run-error">{runError}</div>}
              {results && (
                <div className={"run-summary " + (allPassed ? "pass" : "fail")}>
                  {allPassed ? `✓ ${passed}/${total} teste trecute` : `✗ ${passed}/${total} teste trecute`}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={running}>
              {running
                ? <><span className="spinner" style={{width:14,height:14,flexShrink:0}}/> Evaluare...</>
                : <><span>▶</span> Submit</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
