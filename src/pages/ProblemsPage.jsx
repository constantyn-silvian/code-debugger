import { useState, useEffect, useRef } from "react";
import { getProblems, generateNewProblem, deleteProblem } from "../utils/storage";
import { PBINFO_CATEGORIES } from "../utils/categories";
import "./ProblemsPage.css";

export default function ProblemsPage({ onDebug, onBack, onSettings, geminiKey }) {
  const [problems, setProblems] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(PBINFO_CATEGORIES[0].id);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    setProblems(getProblems());
  }, []);

  // Close dropdown on click outside
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
    setGenStatus("Se genereaza problema...");
    try {
      const cat = PBINFO_CATEGORIES.find(c => c.id === selectedCategory);
      const existing = getProblems().map(p => p.title);
      await generateNewProblem(geminiKey, cat, existing, setGenStatus);
      setProblems(getProblems());
      setGenStatus("");
    } catch (e) {
      setGenError(e.message);
      setGenStatus("");
    }
    setGenerating(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Stergi aceasta problema?")) {
      deleteProblem(id);
      refresh();
    }
  };

  const cat = PBINFO_CATEGORIES.find(c => c.id === selectedCategory);

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
              Genereaza Problema Noua
            </div>
            <p className="gen-desc">
              Selecteaza o categorie PBInfo, AI-ul genereaza o problema originala cu sursa C++ corecta de 100p,
              apoi injecteaza bug-uri subtile pe care trebuie sa le gasesti.
            </p>

            <div className="gen-controls">
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

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <><span className="spinner" style={{width:14,height:14,flexShrink:0}} /> {genStatus || "Se genereaza..."}</>
                ) : (
                  <><span>⚡</span> Genereaza</>
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
            <div className="empty-title">Nicio problema inca</div>
            <div className="empty-desc">Genereaza prima problema folosind panoul de sus.</div>
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
                      <span className="tag tag-easy" style={{fontSize:'10px'}}>{p.category}</span>
                      <span className="meta-sep">·</span>
                      <span className="meta-date">{new Date(p.createdAt).toLocaleDateString("ro-RO")}</span>
                      <span className="meta-sep">·</span>
                      <span className={"meta-status " + (p.solved ? "solved" : "unsolved")}>
                        {p.solved ? "✓ Rezolvata" : "○ Nerezolvata"}
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
