import { useState, useEffect, useRef } from "react";
import { getProblems, generateNewProblem, deleteProblem, DIFFICULTIES } from "../utils/storage";
import { PROBLEM_TYPES } from "../utils/categories";
import { PBINFO_CATEGORIES } from "../utils/categories";
import "./ProblemsPage.css";

const DIFF_ORDER = ["easy", "medium", "hard"];

export default function ProblemsPage({ onDebug, onBack, onSettings, geminiKey }) {
  const [problems, setProblems] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(PBINFO_CATEGORIES[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [selectedType, setSelectedType] = useState("debug");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    setProblems(getProblems());
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCategoryPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const refresh = () => setProblems(getProblems());

  const handleGenerate = async () => {
    if (!geminiKey || !geminiKey.trim()) {
      setGenError("⚠ Adaugă un token Gemini în Settings (butonul ⚙ din dreapta sus).");
      return;
    }
    setGenerating(true);
    setGenError("");
    setShowCategoryPicker(false);
    setGenStatus("Se pregătește...");
    try {
      const cat = PBINFO_CATEGORIES.find(c => c.id === selectedCategory);
      const existing = getProblems().map(p => p.title);
      await generateNewProblem(geminiKey, cat, selectedDifficulty, selectedType, existing, setGenStatus);
      setProblems(getProblems());
      setGenStatus("");
    } catch (e) {
      setGenError(e.message);
      setGenStatus("");
    }
    setGenerating(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Ștergi această problemă?")) {
      deleteProblem(id);
      refresh();
    }
  };

  const cat = PBINFO_CATEGORIES.find(c => c.id === selectedCategory);
  const diff = DIFFICULTIES[selectedDifficulty];

  return (
    <div className="problems-page">
      <div className="problems-grid-bg" />

      <header className="problems-header">
        <div className="header-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <div className="header-title">
            <span className="header-logo">[DBG]</span>
            <span className="header-sep">/</span>
            <span className="header-section">Probleme</span>
          </div>
        </div>
        <div className="header-right">
          <span className="problems-count">{problems.length} probleme</span>
          <button className="btn btn-ghost btn-sm" onClick={onSettings}>⚙ Settings</button>
        </div>
      </header>

      <div className="problems-content">
        {/* Generate Panel */}
        <div className="gen-panel">
          <div className="gen-panel-inner">
            <div className="gen-panel-title">
              <span className="gen-icon">⚡</span>
              Generează Problemă Nouă
            </div>
            <p className="gen-desc">
              Alege categoria și dificultatea. Se face <strong>un singur request</strong> care generează
              cerința, sursa corectă și bug-urile — totul dintr-o dată.
            </p>

            {/* Row 1: Category */}
            <div className="gen-row">
              <div className="gen-row-label">Categorie</div>
              <div className="cat-dropdown-wrapper" ref={dropdownRef}>
                <div
                  className="category-select"
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <span className="cat-icon">{cat?.icon}</span>
                  <span className="cat-name">{cat?.name}</span>
                  <span className="cat-arrow">{showCategoryPicker ? "▲" : "▼"}</span>
                </div>

                {showCategoryPicker && (
                  <div className="category-dropdown">
                    {PBINFO_CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        className={"cat-option" + (c.id === selectedCategory ? " active" : "")}
                        onClick={() => { setSelectedCategory(c.id); setShowCategoryPicker(false); }}
                      >
                        <span className="cat-opt-icon">{c.icon}</span>
                        <div>
                          <div className="cat-opt-name">{c.name}</div>
                          <div className="cat-opt-desc">{c.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Difficulty pills */}
            <div className="gen-row">
              <div className="gen-row-label">Dificultate</div>
              <div className="diff-pills">
                {DIFF_ORDER.map(id => {
                  const d = DIFFICULTIES[id];
                  return (
                    <button
                      key={id}
                      className={"diff-pill diff-pill--" + id + (selectedDifficulty === id ? " active" : "")}
                      onClick={() => setSelectedDifficulty(id)}
                      disabled={generating}
                    >
                      <span className="diff-pill-icon">{d.icon}</span>
                      <div className="diff-pill-body">
                        <span className="diff-pill-label">{d.label}</span>
                        <span className="diff-pill-desc">{d.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 3: Problem type */}
            <div className="gen-row">
              <div className="gen-row-label">Tip Problemă</div>
              <div className="type-pills">
                {PROBLEM_TYPES.map(pt => (
                  <button
                    key={pt.id}
                    className={"type-pill" + (selectedType === pt.id ? " active" : "")}
                    onClick={() => setSelectedType(pt.id)}
                    disabled={generating}
                  >
                    <span className="type-pill-icon">{pt.icon}</span>
                    <div className="type-pill-body">
                      <span className="type-pill-label">{pt.label}</span>
                      <span className="type-pill-desc">{pt.description}</span>
                    </div>
                    <span className={"type-pill-tag tag-" + pt.tagColor}>{pt.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected summary + Generate button */}
            <div className="gen-footer-row">
              <div className="gen-summary">
                <span className="gen-summary-item">
                  {cat?.icon} {cat?.name}
                </span>
                <span className="gen-summary-sep">·</span>
                <span className={"gen-summary-diff diff-" + selectedDifficulty}>
                  {diff?.icon} {diff?.label}
                </span>
                <span className="gen-summary-sep">·</span>
                <span className="gen-summary-note">{diff?.bugCount} bug-uri · {diff?.codeLines} linii</span>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <><span className="spinner" style={{width:14,height:14,flexShrink:0}} /> {genStatus || "Se generează..."}</>
                ) : (
                  <><span>⚡</span> Generează</>
                )}
              </button>
            </div>

            {genError && (
              <div className="gen-error">{genError}</div>
            )}
          </div>
        </div>

        {/* Problems List */}
        {problems.length === 0 ? (
          <div className="problems-empty">
            <div className="empty-icon">{"{ }"}</div>
            <div className="empty-title">Nicio problemă încă</div>
            <div className="empty-desc">Generează prima problemă folosind panoul de sus.</div>
          </div>
        ) : (
          <div className="problems-list">
            {problems.map((p, i) => (
              <div key={p.id} className="problem-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="problem-card-left">
                  <div className="problem-card-num">#{i + 1}</div>
                  <div>
                    <div className="problem-card-title">{p.title}</div>
                    <div className="problem-card-meta">
                      <span className="meta-cat">{p.category}</span>
                      {p.difficulty && (
                        <>
                          <span className="meta-sep">·</span>
                          <span className={"meta-diff diff-" + p.difficulty}>
                            {DIFFICULTIES[p.difficulty]?.icon} {DIFFICULTIES[p.difficulty]?.label}
                          </span>
                        </>
                      )}
                      {p.problemType && (
                        <>
                          <span className="meta-sep">·</span>
                          <span className="meta-type">
                            {{"debug":"🐛","complete":"✏️","rewrite_lib":"📦"}[p.problemType]} {{"debug":"Debug","complete":"Completează","rewrite_lib":"Lib"}[p.problemType]}
                          </span>
                        </>
                      )}
                      <span className="meta-sep">·</span>
                      <span className="meta-date">{new Date(p.createdAt).toLocaleDateString("ro-RO")}</span>
                      <span className="meta-sep">·</span>
                      <span className={"meta-status " + (p.solved ? "solved" : "unsolved")}>
                        {p.solved ? "✓ Rezolvată" : "○ Nerezolvată"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="problem-card-right">
                  <button className="btn btn-ghost btn-sm" onClick={() => onDebug(p)}>
                    Debug →
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
