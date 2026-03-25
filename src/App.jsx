import { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import ProblemsPage from "./pages/ProblemsPage";
import DebugPage from "./pages/DebugPage";
import SettingsModal from "./components/SettingsModal";
import "./App.css";

export default function App() {
  const [page, setPage] = useState("landing");
  const [currentProblem, setCurrentProblem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const navigate = (p, data = null) => {
    setPage(p);
    if (data) setCurrentProblem(data);
  };

  return (
    <div className="app">
      {page === "landing" && (
        <LandingPage onEnter={() => navigate("problems")} onSettings={() => setShowSettings(true)} />
      )}
      {page === "problems" && (
        <ProblemsPage
          onDebug={(problem) => navigate("debug", problem)}
          onBack={() => navigate("landing")}
          onSettings={() => setShowSettings(true)}
          geminiKey={geminiKey}
        />
      )}
      {page === "debug" && currentProblem && (
        <DebugPage
          problem={currentProblem}
          onBack={() => navigate("problems")}
          onSettings={() => setShowSettings(true)}
          geminiKey={geminiKey}
        />
      )}
      {showSettings && (
        <SettingsModal
          geminiKey={geminiKey}
          onSave={(key) => {
            setGeminiKey(key);
            localStorage.setItem("gemini_key", key);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
