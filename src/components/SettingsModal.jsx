import { useState } from "react";
import "./SettingsModal.css";

// Modele reale disponibile pe free tier (cu quota > 0)
const MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    badge: "RECOMANDAT",
    badgeColor: "green",
    quota: "5 RPM · 250K TPM · 20 RPD",
    desc: "Cel mai bun echilibru calitate/quota pe free tier. Default recomandat.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    badge: "CEL MAI PERMISIV",
    badgeColor: "green",
    quota: "15 RPM · 250K TPM · 500 RPD",
    desc: "Cel mai generos la requests pe zi (500 RPD). Ideal dacă dai des de rate limit.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    badge: "FREE TIER",
    badgeColor: "green",
    quota: "10 RPM · 250K TPM · 20 RPD",
    desc: "Versiune lite a lui 2.5 Flash. Rapid și gratuit.",
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    badge: "FREE TIER",
    badgeColor: "green",
    quota: "5 RPM · 250K TPM · 20 RPD",
    desc: "Model nou de la Google, gratuit cu 5 requesturi pe minut.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    badge: "PAID",
    badgeColor: "yellow",
    quota: "0 RPD pe free",
    desc: "Cel mai capabil, dar necesită plan plătit. Nu funcționează pe free tier.",
  },
];

export default function SettingsModal({ geminiKey, onSave, onClose }) {
  const [key, setKey] = useState(geminiKey);
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(
    () => localStorage.getItem("gemini_model") || "gemini-2.5-flash"
  );

  const handleSave = () => {
    localStorage.setItem("gemini_model", model);
    onSave(key);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚙ Settings</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* API Key */}
          <div className="settings-section">
            <div className="settings-label">Gemini API Key</div>
            <div className="settings-desc">
              Token gratuit de pe{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="settings-link">
                Google AI Studio
              </a>.
            </div>
            <div className="settings-input-row">
              <input
                type={showKey ? "text" : "password"}
                className="settings-input"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Model selector */}
          <div className="settings-section">
            <div className="settings-label">Model Gemini</div>
            <div className="settings-desc">
              Dacă primești <code className="settings-code">429</code> sau{" "}
              <code className="settings-code">quota exceeded</code> încearcă{" "}
              <strong>Gemini 3.1 Flash Lite</strong> (500 req/zi).
              Aplicația face <strong>2 requesturi mici</strong> per problemă generată.
            </div>
            <div className="model-list">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className={"model-option" + (model === m.id ? " active" : "")}
                  onClick={() => setModel(m.id)}
                >
                  <div className="model-option-top">
                    <span className="model-option-name">{m.label}</span>
                    <span className={"model-badge model-badge--" + m.badgeColor}>{m.badge}</span>
                  </div>
                  <div className="model-option-id">{m.id}</div>
                  <div className="model-option-quota">{m.quota}</div>
                  <div className="model-option-desc">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom model input */}
          <div className="settings-section">
            <div className="settings-label">Model Custom (opțional)</div>
            <div className="settings-desc">Dacă ai un model nou care nu apare în lista de sus, poți să-l scrii manual.</div>
            <input
              type="text"
              className="settings-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ex: gemini-2.5-flash"
              spellCheck={false}
            />
          </div>

          {/* How it works */}
          <div className="settings-section">
            <div className="settings-label">Cum funcționează</div>
            <div className="settings-steps">
              {[
                "Selectezi categoria și dificultatea",
                "Request 1 mic → Gemini generează cerința + sursa C++ corectă + 5 teste",
                "Request 2 mic → Gemini injectează bug-uri subtile în sursă",
                "Repari codul în editor, dai Submit",
                "Request 3 → Gemini simulează execuția C++ și verifică testele",
              ].map((s, i) => (
                <div key={i} className="settings-step">
                  <span className="step-num">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <div className="modal-footer-model">
            Model activ: <code className="settings-code" style={{color: "var(--accent)"}}>{model}</code>
          </div>
          <div className="modal-footer-btns">
            <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button className="btn btn-primary" onClick={handleSave}>Salvează</button>
          </div>
        </div>
      </div>
    </div>
  );
}
