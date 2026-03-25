import { useState, useEffect, useRef } from "react";
import { updateProblem } from "../utils/storage";
import { runTests } from "../utils/runner";
import "./DebugPage.css";

export default function DebugPage({ problem, onBack, onSettings, geminiKey }) {
  const [code, setCode] = useState(problem.buggyCode || "");
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [activeTab, setActiveTab] = useState("problem"); // problem | tests
  const [showHint, setShowHint] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hint, setHint] = useState("");
  const textareaRef = useRef(null);

  const handleTabKey = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      requestAnimationFrame(() => {
        textareaRef.current.selectionStart = start + 2;
        textareaRef.current.selectionEnd = start + 2;
      });
    }
  };

  const handleSubmit = async () => {
    setRunning(true);
    setRunError("");
    setResults(null);
    try {
      const res = await runTests(code, problem.tests, geminiKey, setRunError);
      setResults(res);
      const allPassed = res.every(r => r.passed);
      if (allPassed) {
        updateProblem(problem.id, { solved: true, solvedCode: code });
      }
    } catch (e) {
      setRunError("Eroare la rulare: " + e.message);
    }
    setRunning(false);
  };

  const handleHint = async () => {
    if (!geminiKey) { setHint("Adaugă token Gemini în Settings."); setShowHint(true); return; }
    setHintLoading(true);
    setShowHint(true);
    setHint("");
    try {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Ești un asistent pentru debugging C++. Analizează codul de mai jos și oferă un HINT scurt (max 2 propoziții) despre o greșeală, fără a da răspunsul complet. Nu dezvălui bug-ul direct, doar orientează.

Cerința problemei: ${problem.statement}

Codul submis:
\`\`\`cpp
${code}
\`\`\`

Codul original cu bug-uri (pentru referință internă):
\`\`\`cpp
${problem.buggyCode}
\`\`\`

Dă un hint scurt și util, în română:`
            }]
          }]
        })
      });
      const data = await resp.json();
      setHint(data.candidates?.[0]?.content?.parts?.[0]?.text || "Nu s-a putut genera un hint.");
    } catch (e) {
      setHint("Eroare la generarea hintului: " + e.message);
    }
    setHintLoading(false);
  };

  const passed = results ? results.filter(r => r.passed).length : 0;
  const total = results ? results.length : 0;
  const allPassed = results && total > 0 && passed === total;

  return (
    <div className="debug-page">
      {/* Header */}
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
        {/* Left panel: problem + tests */}
        <div className="debug-left">
          <div className="panel-tabs">
            <button
              className={`panel-tab ${activeTab === "problem" ? "active" : ""}`}
              onClick={() => setActiveTab("problem")}
            >
              Cerință
            </button>
            <button
              className={`panel-tab ${activeTab === "tests" ? "active" : ""}`}
              onClick={() => setActiveTab("tests")}
            >
              Teste {results && <span className="tab-badge">{passed}/{total}</span>}
            </button>
          </div>

          {activeTab === "problem" && (
            <div className="problem-statement">
              <div className="statement-section">
                <div className="statement-label">Cerința problemei</div>
                <div className="statement-text">{problem.statement}</div>
              </div>

              {problem.inputSpec && (
                <div className="statement-section">
                  <div className="statement-label">Date de intrare</div>
                  <div className="statement-text">{problem.inputSpec}</div>
                </div>
              )}

              {problem.outputSpec && (
                <div className="statement-section">
                  <div className="statement-label">Date de ieșire</div>
                  <div className="statement-text">{problem.outputSpec}</div>
                </div>
              )}

              {problem.constraints && (
                <div className="statement-section">
                  <div className="statement-label">Restricții</div>
                  <div className="statement-text">{problem.constraints}</div>
                </div>
              )}

              <div className="statement-section">
                <div className="statement-label">Exemple</div>
                {(problem.examples || []).map((ex, i) => (
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

              <div className="hint-section">
                <button
                  className="btn btn-ghost btn-sm hint-btn"
                  onClick={handleHint}
                  disabled={hintLoading}
                >
                  {hintLoading ? <><span className="spinner" style={{width:12,height:12}} /> Se generează...</> : "💡 Hint AI"}
                </button>
                {showHint && hint && (
                  <div className="hint-box">
                    <span className="hint-label">Hint:</span> {hint}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "tests" && (
            <div className="tests-panel">
              {!results ? (
                <div className="tests-empty">
                  <div className="tests-empty-icon">▶</div>
                  <div>Apasă Submit pentru a rula testele</div>
                </div>
              ) : (
                <div className="tests-list">
                  <div className={`tests-summary ${allPassed ? "all-pass" : "some-fail"}`}>
                    {allPassed ? `✓ Toate ${total} teste trecute! Felicitări!` : `${passed}/${total} teste trecute`}
                  </div>
                  {results.map((r, i) => (
                    <div key={i} className={`test-result ${r.passed ? "pass" : "fail"}`}>
                      <div className="test-result-header">
                        <span className={`test-status ${r.passed ? "pass" : "fail"}`}>
                          {r.passed ? "✓" : "✗"} Test #{i + 1}
                        </span>
                        <span className="test-time">{r.time || ""}</span>
                      </div>
                      <div className="test-io">
                        <div className="test-io-row">
                          <span className="test-io-label">Input:</span>
                          <pre className="test-io-val">{r.input}</pre>
                        </div>
                        <div className="test-io-row">
                          <span className="test-io-label">Expected:</span>
                          <pre className="test-io-val">{r.expected}</pre>
                        </div>
                        <div className="test-io-row">
                          <span className="test-io-label">Got:</span>
                          <pre className={`test-io-val ${!r.passed ? "wrong" : ""}`}>{r.actual}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: code editor */}
        <div className="debug-right">
          <div className="editor-header">
            <div className="editor-header-left">
              <span className="editor-lang">C++</span>
              <span className="editor-filename">main.cpp</span>
            </div>
            <div className="editor-header-right">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCode(problem.buggyCode)}
                title="Reset la codul original"
              >
                ↺ Reset
              </button>
            </div>
          </div>

          <div className="editor-wrapper">
            <div className="line-numbers">
              {code.split("\n").map((_, i) => (
                <div key={i} className="line-num">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="code-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleTabKey}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="editor-footer">
            {runError && (
              <div className="run-error">{runError}</div>
            )}
            {results && (
              <div className={`run-summary ${allPassed ? "pass" : "fail"}`}>
                {allPassed ? `✓ ${passed}/${total} teste trecute` : `✗ ${passed}/${total} teste trecute`}
              </div>
            )}
            <div className="editor-footer-actions">
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={running}
              >
                {running ? (
                  <><span className="spinner" style={{width:14,height:14}} /> Rulează testele...</>
                ) : (
                  <><span>▶</span> Submit</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
