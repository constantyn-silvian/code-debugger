import { useState } from "react";
import "./SettingsModal.css";

export default function SettingsModal({ geminiKey, onSave, onClose }) {
  const [key, setKey] = useState(geminiKey);
  const [show, setShow] = useState(false);

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
              Necesar pentru generarea problemelor și verificarea testelor.
              Obține un token gratuit de pe{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="settings-link">
                Google AI Studio
              </a>.
            </div>
            <div className="settings-input-row">
              <input
                type={show ? "text" : "password"}
                className="settings-input"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
              />
              <button className="btn btn-ghost btn-sm" onClick={() => setShow(!show)}>
                {show ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-label">Cum funcționează</div>
            <div className="settings-steps">
              <div className="settings-step">
                <span className="step-num">1</span>
                <span>Selectezi o categorie de probleme PBInfo</span>
              </div>
              <div className="settings-step">
                <span className="step-num">2</span>
                <span>Gemini generează o problemă cu cerință, teste și sursă C++ corectă de 100p</span>
              </div>
              <div className="settings-step">
                <span className="step-num">3</span>
                <span>Gemini adaugă bug-uri subtile în sursă (off-by-one, condiție greșită, tip greșit etc.)</span>
              </div>
              <div className="settings-step">
                <span className="step-num">4</span>
                <span>Tu găsești și repari bug-urile, dai submit, Gemini verifică pe teste</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" onClick={() => onSave(key)}>
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}
