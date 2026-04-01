import { useState, useEffect, useRef, useCallback } from "react";
import { updateProblem, regenerateProblem } from "../utils/storage";
import { runTests } from "../utils/runner";
import "./DebugPage.css";

// ─── C++ Syntax Highlighter ───────────────────────────────────────────────────
const KEYWORDS = new Set([
  "int","long","short","char","float","double","bool","void","unsigned","signed",
  "if","else","for","while","do","return","break","continue","switch","case","default",
  "struct","class","public","private","protected","new","delete","nullptr","true","false",
  "namespace","using","template","typename","const","static","auto","register",
  "volatile","extern","inline","virtual","override","this","sizeof","typedef","enum",
]);
const STD_IDS = new Set([
  "cout","cin","cerr","endl","string","vector","map","set","pair","queue","stack",
  "deque","list","unordered_map","unordered_set","priority_queue","bitset","array",
  "sort","reverse","find","min","max","swap","abs","sqrt","pow","ceil","floor",
  "printf","scanf","main","ios_base","sync_with_stdio","tie","make_pair","push_back",
  "pop_back","push","pop","top","front","back","size","empty","begin","end","insert",
  "erase","count","lower_bound","upper_bound","fill","accumulate","memset","memcpy",
]);
// Multi-char operators — order matters (longer first)
const MULTI_OPS = [
  "<<",">>","<=",">=","==","!=","&&","||","++","--","->","::","+=","-=","*=","/=","%=","**",
];

function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function highlightLine(line) {
  const out = [];
  let i = 0;

  const push = (cls, raw) => {
    const escaped = esc(raw);
    out.push(cls ? `<span class="${cls}">${escaped}</span>` : escaped);
  };

  while (i < line.length) {
    const ch = line[i];

    // Whitespace — emit as-is (already safe)
    if (ch === " " || ch === "\t") { out.push(ch === "\t" ? "  " : " "); i++; continue; }

    // Line comment //
    if (ch === "/" && line[i+1] === "/") { push("hl-cmt", line.slice(i)); break; }

    // Block comment start /* (single line portion)
    if (ch === "/" && line[i+1] === "*") {
      const end = line.indexOf("*/", i+2);
      if (end !== -1) { push("hl-cmt", line.slice(i, end+2)); i = end+2; }
      else { push("hl-cmt", line.slice(i)); break; }
      continue;
    }

    // Preprocessor line (starts at col 0)
    if (i === 0 && ch === "#") {
      // Highlight directive keyword
      const sp = line.search(/\s/, 1);
      if (sp === -1) { push("hl-pp", line); break; }
      push("hl-pp", line.slice(0, sp));
      // Highlight <header> or "header" as string
      const rest = line.slice(sp);
      const ltIdx = rest.indexOf("<");
      const gtIdx = rest.lastIndexOf(">");
      const q1 = rest.indexOf('"');
      const q2 = rest.lastIndexOf('"');
      if (ltIdx !== -1 && gtIdx > ltIdx) {
        push(null, rest.slice(0, ltIdx));
        push("hl-str", rest.slice(ltIdx, gtIdx+1));
        push(null, rest.slice(gtIdx+1));
      } else if (q1 !== -1 && q2 > q1) {
        push(null, rest.slice(0, q1));
        push("hl-str", rest.slice(q1, q2+1));
        push(null, rest.slice(q2+1));
      } else { push(null, rest); }
      break;
    }

    // String literal "..."
    if (ch === '"') {
      let j = i+1;
      while (j < line.length) {
        if (line[j] === '"' && line[j-1] !== "\\") { j++; break; }
        j++;
      }
      push("hl-str", line.slice(i, j)); i = j; continue;
    }

    // Char literal '.'
    if (ch === "'") {
      let j = i+1;
      while (j < line.length) {
        if (line[j] === "'" && line[j-1] !== "\\") { j++; break; }
        j++;
      }
      push("hl-str", line.slice(i, j)); i = j; continue;
    }

    // Number literal
    if (/\d/.test(ch) && (i === 0 || !/\w/.test(line[i-1]))) {
      let j = i;
      // hex
      if (line[i] === "0" && (line[i+1] === "x" || line[i+1] === "X")) {
        j += 2; while (j < line.length && /[0-9a-fA-F]/.test(line[j])) j++;
      } else {
        while (j < line.length && /[\d.eEfFuUlL]/.test(line[j])) j++;
      }
      push("hl-num", line.slice(i, j)); i = j; continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /\w/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (KEYWORDS.has(word))     push("hl-kw",  word);
      else if (STD_IDS.has(word)) push("hl-std", word);
      else                        push("hl-id",  word);
      i = j; continue;
    }

    // Multi-char operators — check longest match first
    let matched = false;
    for (const op of MULTI_OPS) {
      if (line.startsWith(op, i)) {
        push("hl-op", op); i += op.length; matched = true; break;
      }
    }
    if (matched) continue;

    // Single-char punctuation/operator
    push("hl-op", ch); i++;
  }

  return out.join("");
}

function highlightCpp(code) {
  return code.split("\n").map((line, li) => {
    const content = highlightLine(line);
    return `<div class="hl-line">${content || "\u00a0"}</div>`;
  }).join("");
}

// ─── DebugPage ────────────────────────────────────────────────────────────────
export default function DebugPage({ problem, onBack, onSettings, geminiKey }) {
  const [code, setCode]         = useState(problem.buggyCode || "");
  const [results, setResults]   = useState(null);
  const [running, setRunning]   = useState(false);
  const [runError, setRunError] = useState("");
  const [activeTab, setActiveTab] = useState("problem");
  const [hint, setHint]         = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError]   = useState("");
  const [regenStatus, setRegenStatus] = useState("");
  const [revealedTests, setRevealedTests] = useState({});
  const textareaRef  = useRef(null);
  const highlightRef = useRef(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop  = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    if (highlightRef.current)
      highlightRef.current.innerHTML = highlightCpp(code);
  }, [code]);

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = e.target.selectionStart, en = e.target.selectionEnd;
      setCode(code.slice(0, s) + "  " + code.slice(en));
      requestAnimationFrame(() => {
        textareaRef.current.selectionStart = s + 2;
        textareaRef.current.selectionEnd   = s + 2;
      });
    }
  };

  const handleSubmit = async () => {
    setRunning(true); setRunError(""); setResults(null);
    try {
      const res = await runTests(
        problem, code, geminiKey,
        (tests) => updateProblem(problem.id, { tests }) // salveaza testele daca au fost generate acum
      );
      setResults(res);
      setActiveTab("tests");
      if (res.every(r => r.passed))
        updateProblem(problem.id, { solved: true, solvedCode: code });
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
Cerinta: ${problem.statement?.slice(0, 300)}
Cod student:
${code.slice(0, 800)}
Da un HINT scurt (max 2 propozitii) care orienteaza studentul spre bug fara sa il dezvaluie direct. Raspunde in romana.`
            }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 120 },
          }),
        }
      );
      const d = await resp.json();
      setHint(d.candidates?.[0]?.content?.parts?.[0]?.text || "Nu s-a putut genera un hint.");
    } catch (e) { setHint("Eroare: " + e.message); }
    setHintLoading(false);
  };

  const handleRegenerate = async () => {
    if (!geminiKey) { setRegenError("Adaugă token Gemini în Settings."); return; }
    setRegenerating(true); setRegenError(""); setResults(null); setRevealedTests({});
    try {
      const updated = await regenerateProblem(geminiKey, problem, setRegenStatus);
      // Update code in editor with new buggy code
      setCode(updated.buggyCode || updated.correctCode || "");
      // Force re-render with new tests by updating problem ref
      problem.tests       = updated.tests;
      problem.correctCode = updated.correctCode;
      problem.buggyCode   = updated.buggyCode;
      problem.solved      = false;
      setRegenStatus("");
    } catch (e) { setRegenError(e.message); setRegenStatus(""); }
    setRegenerating(false);
  };

  const toggleRevealTest = (i) =>
    setRevealedTests(prev => ({ ...prev, [i]: !prev[i] }));

  const passed    = results ? results.filter(r => r.passed).length : 0;
  const total     = results?.length || 0;
  const allPassed = results && total > 0 && passed === total;

  const typeLabel = {
    debug:       "🐛 Debug",
    complete:    "✏️ Completează",
    rewrite_lib: "📦 Reimplementează",
  }[problem.problemType] || "🐛 Debug";

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
          <span className="debug-type-badge">{typeLabel}</span>
        </div>
        <div className="debug-regen-area">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerează codul și testele păstrând cerința"
          >
            {regenerating
              ? <><span className="spinner" style={{width:12,height:12,flexShrink:0}}/> {regenStatus || "Regenerare..."}</>
              : "↺ Regenerează"}
          </button>
          {regenError && <span className="regen-error">{regenError}</span>}
        </div>
        <div className="debug-header-right">
          {problem.solved && <span className="solved-badge">✓ Rezolvată</span>}
          <button className="btn btn-ghost btn-sm" onClick={onSettings}>⚙</button>
        </div>
      </header>

      <div className="debug-layout">
        {/* ── Left panel ── */}
        <div className="debug-left">
          <div className="panel-tabs">
            <button className={"panel-tab"+(activeTab==="problem"?" active":"")} onClick={()=>setActiveTab("problem")}>Cerință</button>
            <button className={"panel-tab"+(activeTab==="tests"?" active":"")} onClick={()=>setActiveTab("tests")}>
              Teste {results && <span className="tab-badge">{passed}/{total}</span>}
            </button>
          </div>

          {activeTab === "problem" && (
            <div className="problem-statement">
              {[["Cerința",problem.statement],["Date de intrare",problem.inputSpec],["Date de ieșire",problem.outputSpec],["Restricții",problem.constraints]]
                .filter(([,v])=>v).map(([label,text])=>(
                  <div key={label} className="statement-section">
                    <div className="statement-label">{label}</div>
                    <div className="statement-text">{text}</div>
                  </div>
              ))}

              {problem.examples?.length > 0 && (
                <div className="statement-section">
                  <div className="statement-label">Exemple</div>
                  {problem.examples.map((ex,i)=>(
                    <div key={i} className="example-block">
                      <div className="example-row">
                        <div className="example-col"><div className="example-col-label">Intrare</div><pre className="example-val">{ex.input}</pre></div>
                        <div className="example-col"><div className="example-col-label">Ieșire</div><pre className="example-val">{ex.output}</pre></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hint-section">
                <button className="btn btn-ghost btn-sm" onClick={handleHint} disabled={hintLoading}>
                  {hintLoading ? <><span className="spinner" style={{width:12,height:12}}/> Generare...</> : "💡 Hint AI"}
                </button>
                {showHint && hint && <div className="hint-box"><span className="hint-label">Hint:</span> {hint}</div>}
              </div>
            </div>
          )}

          {activeTab === "tests" && (
            <div className="tests-panel">
              {!results ? (
                <div className="tests-panel-inner">
                  {problem.tests?.length > 0 ? (
                    <>
                      <div className="tests-info">
                        {problem.tests.length} teste salvate — apasă Submit pentru a evalua
                      </div>
                      {problem.tests.map((t,i) => (
                        <div key={i} className="test-result neutral">
                          <div className="test-result-header">
                            <span className="test-status neutral">○ Test #{i+1}</span>
                          </div>
                          <div className="test-io">
                            <div className="test-io-row">
                              <span className="test-io-label">Input:</span>
                              <pre className="test-io-val">{t.input}</pre>
                            </div>
                            <div className="test-io-row">
                              <span className="test-io-label">Expected:</span>
                              <div className="reveal-row">
                                {revealedTests[`pre_${i}`] && <pre className="test-io-val">{t.expected}</pre>}
                                <button
                                  className={"reveal-btn" + (revealedTests[`pre_${i}`] ? " active" : "")}
                                  onClick={()=>toggleRevealTest(`pre_${i}`)}
                                  title={revealedTests[`pre_${i}`] ? "Ascunde expected" : "Arată expected output"}
                                >
                                  {revealedTests[`pre_${i}`] ? "🙈 ascunde" : "👁 arată"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="tests-empty">
                      <div className="tests-empty-icon">▶</div>
                      <div>Apasă Submit — testele se vor genera automat</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="tests-list">
                  <div className={"tests-summary "+(allPassed?"all-pass":"some-fail")}>
                    {allPassed ? `✓ Toate ${total} teste trecute! Felicitări!` : `${passed}/${total} teste trecute`}
                  </div>
                  {results.map((r,i)=>(
                    <div key={i} className={"test-result "+(r.passed?"pass":"fail")}>
                      <div className="test-result-header">
                        <span className={"test-status "+(r.passed?"pass":"fail")}>{r.passed?"✓":"✗"} Test #{i+1}</span>
                      </div>
                      <div className="test-io">
                        <div className="test-io-row">
                          <span className="test-io-label">Input:</span>
                          <pre className="test-io-val">{r.input}</pre>
                        </div>
                        <div className="test-io-row">
                          <span className="test-io-label">Expected:</span>
                          <div className="reveal-row">
                            {revealedTests[i] && <pre className="test-io-val">{r.expected}</pre>}
                            <button
                              className={"reveal-btn" + (revealedTests[i] ? " active" : "")}
                              onClick={()=>toggleRevealTest(i)}
                              title={revealedTests[i] ? "Ascunde expected" : "Arată expected output"}
                            >
                              {revealedTests[i] ? "🙈 ascunde" : "👁 arată"}
                            </button>
                          </div>
                        </div>
                        <div className="test-io-row">
                          <span className="test-io-label">Got:</span>
                          <pre className={"test-io-val"+(r.passed?"":" wrong")}>{r.actual}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: editor ── */}
        <div className="debug-right">
          <div className="editor-header">
            <div className="editor-header-left">
              <span className="editor-lang">C++</span>
              <span className="editor-filename">main.cpp</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setCode(problem.buggyCode||"")}>↺ Reset</button>
          </div>

          <div className="editor-wrapper">
            <div className="hl-layer" ref={highlightRef} aria-hidden="true" />
            <textarea
              ref={textareaRef}
              className="code-editor"
              value={code}
              onChange={e=>setCode(e.target.value)}
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
              {results && <div className={"run-summary "+(allPassed?"pass":"fail")}>{allPassed?`✓ ${passed}/${total}`:`✗ ${passed}/${total}`} teste</div>}
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={running}>
              {running ? <><span className="spinner" style={{width:14,height:14,flexShrink:0}}/> Evaluare...</> : <><span>▶</span> Submit</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
