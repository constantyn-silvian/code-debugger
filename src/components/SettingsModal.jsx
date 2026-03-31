import { useState } from "react";
import { testJudge0 } from "../utils/runner";
import "./SettingsModal.css";

const GEMINI_MODELS = [
  { id:"gemini-2.5-flash",      label:"Gemini 2.5 Flash",      badge:"RECOMANDAT", color:"green",  quota:"5 RPM · 250K TPM · 20 RPD" },
  { id:"gemini-3.1-flash-lite", label:"Gemini 3.1 Flash Lite", badge:"500 RPD",    color:"green",  quota:"15 RPM · 250K TPM · 500 RPD" },
  { id:"gemini-2.5-flash-lite", label:"Gemini 2.5 Flash Lite", badge:"FREE",       color:"green",  quota:"10 RPM · 250K TPM · 20 RPD" },
  { id:"gemini-3-flash",        label:"Gemini 3 Flash",        badge:"FREE",       color:"green",  quota:"5 RPM · 250K TPM · 20 RPD" },
  { id:"gemini-2.5-pro",        label:"Gemini 2.5 Pro",        badge:"PAID",       color:"yellow", quota:"0 RPD pe free tier" },
];

export default function SettingsModal({ geminiKey, onSave, onClose }) {
  const [key,      setKey]      = useState(geminiKey);
  const [showKey,  setShowKey]  = useState(false);
  const [model,    setModel]    = useState(() => localStorage.getItem("gemini_model") || "gemini-2.5-flash");
  const [j0host,   setJ0host]   = useState(() => localStorage.getItem("judge0_host")  || "https://ce.judge0.com");
  const [j0key,    setJ0key]    = useState(() => localStorage.getItem("judge0_key")   || "");
  const [showJ0,   setShowJ0]   = useState(false);
  const [j0status, setJ0status] = useState(null);
  const [tab,      setTab]      = useState("gemini");

  const save = () => {
    localStorage.setItem("gemini_model", model);
    localStorage.setItem("judge0_host",  j0host);
    localStorage.setItem("judge0_key",   j0key);
    onSave(key);
  };

  const testJ0 = async () => {
    setJ0status("testing");
    const r = await testJudge0();
    setJ0status(r);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚙ Settings</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={"modal-tab"+(tab==="gemini"?" active":"")} onClick={()=>setTab("gemini")}>🤖 Gemini AI</button>
          <button className={"modal-tab"+(tab==="judge0"?" active":"")} onClick={()=>setTab("judge0")}>⚡ Judge0 C++</button>
        </div>

        <div className="modal-body">

          {tab === "gemini" && <>
            <div className="settings-section">
              <div className="settings-label">API Key</div>
              <div className="settings-desc">Token gratuit de pe <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="settings-link">Google AI Studio</a>. Folosit pentru generarea problemelor.</div>
              <div className="settings-input-row">
                <input type={showKey?"text":"password"} className="settings-input" value={key}
                  onChange={e=>setKey(e.target.value)} placeholder="AIzaSy..." autoComplete="off" spellCheck={false}/>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowKey(!showKey)}>{showKey?"🙈":"👁"}</button>
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-label">Model</div>
              <div className="settings-desc">Dacă primești <code className="settings-code">429</code> încearcă <strong>Gemini 3.1 Flash Lite</strong> (500 req/zi).</div>
              <div className="model-list">
                {GEMINI_MODELS.map(m=>(
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
              <input type="text" className="settings-input" style={{marginTop:6}} value={model}
                onChange={e=>setModel(e.target.value)} placeholder="model custom..." spellCheck={false}/>
            </div>
          </>}

          {tab === "judge0" && <>
            <div className="settings-section">
              <div className="settings-label">Ce este Judge0?</div>
              <div className="settings-desc">
                Judge0 compilează și rulează codul C++ real (GCC 9.2) pe servere dedicate.
                Înlocuiește simularea AI — outputul e garantat corect.<br/><br/>
                <strong>Instanța publică</strong> (<code className="settings-code">ce.judge0.com</code>) e gratuită, fără cheie.
                Dacă primești erori de rate limit, adaugă o cheie RapidAPI gratuită.
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-label">Host Judge0</div>
              <input type="text" className="settings-input" value={j0host}
                onChange={e=>setJ0host(e.target.value)} placeholder="https://ce.judge0.com" spellCheck={false}/>
              <div className="settings-desc" style={{marginTop:4}}>
                Opțiuni: <code className="settings-code">https://ce.judge0.com</code> (public gratuit) sau <code className="settings-code">https://judge0-ce.p.rapidapi.com</code> (RapidAPI cu cheie)
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-label">RapidAPI Key (opțional)</div>
              <div className="settings-desc">Obții gratuit de pe <a href="https://rapidapi.com/judge0-official/api/judge0-ce" target="_blank" rel="noreferrer" className="settings-link">RapidAPI</a> (50 req/zi free, mai stabil).</div>
              <div className="settings-input-row">
                <input type={showJ0?"text":"password"} className="settings-input" value={j0key}
                  onChange={e=>setJ0key(e.target.value)} placeholder="Cheie RapidAPI..." autoComplete="off"/>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowJ0(!showJ0)}>{showJ0?"🙈":"👁"}</button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-label">Test conexiune</div>
              <button className="btn btn-ghost btn-sm" onClick={testJ0} disabled={j0status==="testing"}>
                {j0status==="testing"?<><span className="spinner" style={{width:12,height:12}}/> Testare...</>:"▶ Testează Judge0"}
              </button>
              {j0status && j0status!=="testing" && (
                <div className={"j0-status "+(j0status==="ok"?"j0-ok":"j0-err")}>
                  {j0status==="ok"?"✓ Judge0 funcționează! GCC real activ.":"✗ "+j0status}
                </div>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-label">Self-hosted (nelimitat)</div>
              <pre className="settings-pre">{`git clone https://github.com/judge0/judge0
cd judge0 && cp judge0.conf.example judge0.conf
docker-compose up -d
# Host: http://localhost:2358`}</pre>
            </div>
          </>}

        </div>

        <div className="modal-footer">
          <div className="modal-footer-model">
            <code className="settings-code" style={{color:"var(--accent)"}}>{model}</code>
          </div>
          <div className="modal-footer-btns">
            <button className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button className="btn btn-primary" onClick={save}>Salvează</button>
          </div>
        </div>
      </div>
    </div>
  );
}
