import { useState } from "react";
import "./SettingsModal.css";

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      badge: "RECOMANDAT", color: "green",  quota: "5 RPM · 250K TPM · 20 RPD" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", badge: "500 RPD",    color: "green",  quota: "15 RPM · 250K TPM · 500 RPD" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", badge: "FREE",       color: "green",  quota: "10 RPM · 250K TPM · 20 RPD" },
  { id: "gemini-3-flash",        label: "Gemini 3 Flash",        badge: "FREE",       color: "green",  quota: "5 RPM · 250K TPM · 20 RPD"  },
  { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro",        badge: "PAID",       color: "yellow", quota: "0 RPD pe free tier"           },
];

export default function SettingsModal({ geminiKey, onSave, onClose }) {
  const [key,     setKey]     = useState(geminiKey);
  const [showKey, setShowKey] = useState(false);
  const [model,   setModel]   = useState(() => localStorage.getItem("gemini_model") || "gemini-2.5-flash");

  const handleSave = () => {
    localStorage.setItem("gemini_model", model);
    onSave(key);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚙ Settings</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-label">Gemini API Key</div>
            <div className="settings-desc">
              Token gratuit de pe{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="settings-link">
                Google AI Studio
              </a>. Folosit pentru generarea problemelor și evaluarea codului.
            </div>
            <div className="settings-input-row">
              <input type={showKey?"text":"password"} className="settings-input" value={key}
                onChange={e=>setKey(e.target.value)} placeholder="AIzaSy..." autoComplete="off" spellCheck={false}/>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowKey(!showKey)}>{showKey?"🙈":"👁"}</button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-label">Model Gemini</div>
            <div className="settings-desc">
              Dacă primești <code className="settings-code">429</code> încearcă <strong>Gemini 3.1 Flash Lite</strong> (500 req/zi).
            </div>
            <div className="model-list">
              {GEMINI_MODELS.map(m => (
                <button key={m.id} className={"model-option"+(model===m.id?" active":"")} onClick={()=>setModel(m.id)}>
                  <div className="model-option-top">
                    <span className="model-option-name">{m.label}</span>
                    <span className={"model-badge model-badge--"+m.color}>{m.badge}</span>
                  </div>
                  <div className="model-option-id">{m.id}</div>
                  <div className="model-option-quota">{m.quota}</div>
                </button>
              ))}
            </div>
            <div className="settings-desc" style={{marginTop:6}}>Model custom:</div>
            <input type="text" className="settings-input" value={model}
              onChange={e=>setModel(e.target.value)} placeholder="ex: gemini-2.5-flash" spellCheck={false}/>
          </div>

          <div className="settings-section">
            <div className="settings-label">Cum funcționează evaluarea</div>
            <div className="settings-steps">
              {[
                "La generare: Gemini produce sursa C++ corectă + sursa cu buguri",
                "Testele se generează o singură dată rulând mental sursa corectă — expected-ul e consistent",
                "La Submit: Gemini primește sursa corectă + codul tău + testele și compară outputurile",
                "Dublu check: dacă outputul text e identic, testul trece indiferent de ce zice Gemini",
              ].map((s,i) => (
                <div key={i} className="settings-step">
                  <span className="step-num">{i+1}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-model">
            Model: <code className="settings-code" style={{color:"var(--accent)"}}>{model}</code>
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
