import { useState } from "react";
import App from "./App";
import OperationalMissionPanel from "./OperationalMissionPanel";
import "./operational.css";

type RootMode = "assistant" | "missions";

export default function DesktopRoot() {
  const [mode, setMode] = useState<RootMode>("assistant");

  return (
    <div className="desktop-root-shell">
      <div className="desktop-mode-switch" role="navigation" aria-label="Modo principal de Naye">
        <button
          className={mode === "assistant" ? "is-active" : ""}
          onClick={() => setMode("assistant")}
        >
          Naye
        </button>
        <button
          className={mode === "missions" ? "is-active" : ""}
          onClick={() => setMode("missions")}
        >
          Misiones
          <span className="desktop-mode-live-dot" aria-hidden="true" />
        </button>
      </div>

      {mode === "assistant" ? <App /> : <OperationalMissionPanel />}
    </div>
  );
}
