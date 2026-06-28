import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getActiveSessions,
  getDesktopContext,
  getNayeStatus,
  getNodeProfile,
  getOpenClawConfigSummary,
  getOpenClawStatus,
  sendChatMessage
} from "./nayeDesktopClient";
import type { ConnectionState, SystemSnapshot } from "./types";
import {
  extractPlugins,
  formatDate,
  getApiState,
  getConfigState,
  getGatewayUrl,
  getOpenClawState,
  getProfileValue,
  getSessionCount,
  getStateLabel,
  toSafePathLabel
} from "./utils";

const INITIAL_SNAPSHOT: SystemSnapshot = {
  desktopContext: null,
  status: null,
  openClawStatus: null,
  openClawConfig: null,
  nodeProfile: null,
  activeSessions: null,
  lastUpdated: null,
  loading: false,
  error: null,
  warnings: []
};

type ViewMode = "assistant" | "system" | "openclaw" | "node" | "sessions";

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  title?: string;
  content: string;
  timestamp: string;
};

function StatusDot({ state }: { state: ConnectionState }) {
  return <span className={`status-dot status-${state}`} aria-hidden="true" />;
}

function StatusPill({ state, label }: { state: ConnectionState; label?: string }) {
  return (
    <span className={`status-pill status-${state}`}>
      <StatusDot state={state} />
      {label || getStateLabel(state)}
    </span>
  );
}

function MetricCard({ label, value, state, helper }: { label: string; value: string; state?: ConnectionState; helper?: string }) {
  return (
    <section className="metric-card">
      <div className="metric-header">
        <span>{label}</span>
        {state ? <StatusPill state={state} /> : null}
      </div>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Sidebar({ activeView, setActiveView, apiState, openClawState, sessionCount }: {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  apiState: ConnectionState;
  openClawState: ConnectionState;
  sessionCount: number;
}) {
  const items: Array<{ id: ViewMode; label: string; caption: string; state?: ConnectionState; badge?: string }> = [
    { id: "assistant", label: "Naye Assistant", caption: "Interfaz principal", state: openClawState },
    { id: "system", label: "Sistema", caption: "API, gateway y warnings", state: apiState },
    { id: "openclaw", label: "OpenClaw", caption: "Bridge y capacidades", state: openClawState },
    { id: "node", label: "Nodo local", caption: "Perfil del equipo" },
    { id: "sessions", label: "Sesiones", caption: "Autorizaciones activas", badge: String(sessionCount) }
  ];

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">N</div>
        <div>
          <h1>Naye</h1>
          <p>Local Desktop UX</p>
        </div>
      </div>

      <nav className="nav-list" aria-label="Navegación principal">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? "nav-item-active" : ""}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="nav-text">
              <strong>{item.label}</strong>
              <small>{item.caption}</small>
            </span>
            {item.state ? <StatusDot state={item.state} /> : null}
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>Arquitectura protegida</p>
        <code>Naye UX → Naye Core API</code>
        <span>No hay conexión directa a OpenClaw.</span>
      </div>
    </aside>
  );
}

function AssistantWorkspace({ snapshot, refresh }: { snapshot: SystemSnapshot; refresh: () => void }) {
  const apiState = getApiState(snapshot);
  const openClawState = getOpenClawState(snapshot.openClawStatus);
  const gateway = getGatewayUrl(snapshot);
  const sessionCount = getSessionCount(snapshot.activeSessions);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const systemMessages: ChatMessage[] = useMemo(() => [
    {
      id: "welcome",
      role: "assistant",
      title: "Naye listo para operar localmente",
      content: "Esta es la interfaz principal tipo asistente. El envío de mensajes ya pasa por POST /api/chat en Naye Core API. La UX no se conecta directamente a OpenClaw.",
      timestamp: snapshot.lastUpdated || new Date().toISOString()
    },
    {
      id: "system-status",
      role: "system",
      title: "Estado operativo",
      content: `API: ${getStateLabel(apiState)} · OpenClaw: ${getStateLabel(openClawState)} · Sesiones activas: ${sessionCount}`,
      timestamp: snapshot.lastUpdated || new Date().toISOString()
    }
  ], [apiState, openClawState, sessionCount, snapshot.lastUpdated]);

  const messages = useMemo(() => [...systemMessages, ...conversation], [systemMessages, conversation]);
  const canSend = apiState === "online" && !sending && draft.trim().length > 0;

  const handleSend = useCallback(async () => {
    const cleanMessage = draft.trim();
    if (!cleanMessage || sending) return;

    const timestamp = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleanMessage,
      timestamp
    };

    setConversation((current) => [...current, userMessage]);
    setDraft("");
    setSending(true);
    setSendError(null);

    try {
      const response = await sendChatMessage(cleanMessage);
      const assistantMessage: ChatMessage = {
        id: response.id || `assistant-${Date.now()}`,
        role: "assistant",
        title: response.mode === "local-safe" ? "Respuesta local de Naye Core" : "Respuesta de Naye",
        content: response.reply || "Naye Core respondió sin contenido textual.",
        timestamp: response.timestamp || new Date().toISOString()
      };
      setConversation((current) => [...current, assistantMessage]);
      void refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "No se pudo enviar el mensaje");
      setSendError(message);
      setConversation((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "system",
          title: "No se pudo enviar el mensaje",
          content: message,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, refresh, sending]);

  return (
    <main className="assistant-layout">
      <section className="chat-panel">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">Consola conversacional</span>
            <h2>Naye Assistant</h2>
            <p>Interfaz local con chat vía Naye Core API, preparada para herramientas y autorizaciones futuras.</p>
          </div>
          <div className="header-actions">
            <StatusPill state={apiState} label={`Core ${getStateLabel(apiState)}`} />
            <StatusPill state={openClawState} label={`OpenClaw ${getStateLabel(openClawState)}`} />
            <button className="primary-button" onClick={refresh} disabled={snapshot.loading}>
              {snapshot.loading ? "Actualizando..." : "Actualizar estado"}
            </button>
          </div>
        </header>

        <div className="chat-stream">
          {messages.map((message) => (
            <article key={message.id} className={`message message-${message.role}`}>
              <div className="avatar">{message.role === "assistant" ? "N" : message.role === "system" ? "S" : "Tú"}</div>
              <div className="message-body">
                {message.title ? <strong>{message.title}</strong> : null}
                <p>{message.content}</p>
                <small>{formatDate(message.timestamp)}</small>
              </div>
            </article>
          ))}
          {sending ? (
            <article className="message message-assistant">
              <div className="avatar">N</div>
              <div className="message-body">
                <strong>Naye está procesando</strong>
                <p>Enviando mensaje a Naye Core API...</p>
                <small>{formatDate(new Date().toISOString())}</small>
              </div>
            </article>
          ) : null}
        </div>

        <footer className="composer-area">
          <div className="composer-enabled-note">
            Chat habilitado mediante <code>POST /api/chat</code> en Naye Core. No hay conexión directa a OpenClaw.
          </div>
          {sendError ? <div className="composer-error">{sendError}</div> : null}
          <form className={`composer-shell ${apiState === "online" ? "active" : "disabled"}`} onSubmit={(event) => { event.preventDefault(); void handleSend(); }}>
            <textarea
              placeholder={apiState === "online" ? "Escribe a Naye..." : "Naye Core API no está disponible."}
              value={draft}
              disabled={apiState !== "online" || sending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button type="submit" disabled={!canSend}>{sending ? "Enviando" : "Enviar"}</button>
          </form>
        </footer>
      </section>

      <aside className="right-panel">
        <MetricCard label="Naye Core API" value={snapshot.status?.system || "Naye Core API"} state={apiState} helper={snapshot.status?.purpose || "Bridge local para Naye UX"} />
        <MetricCard label="OpenClaw" value={snapshot.openClawStatus?.bridge?.statusDetected || "Sin verificar"} state={openClawState} helper="Validado solo por Naye Core API" />
        <MetricCard label="Gateway" value={gateway} helper="Visible solo como referencia operativa" />
        <MetricCard label="Sesiones" value={sessionCount === 0 ? "No hay sesiones activas" : `${sessionCount} sesión(es)`} state={sessionCount > 0 ? "review" : "online"} />
      </aside>
    </main>
  );
}

function SystemPanel({ snapshot, refresh }: { snapshot: SystemSnapshot; refresh: () => void }) {
  const apiState = getApiState(snapshot);
  const gatewayState = getOpenClawState(snapshot.openClawStatus);
  const configState = getConfigState(snapshot.openClawConfig);

  return (
    <main className="page-panel">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Panel de sistema</span>
          <h2>Estado general de Naye</h2>
          <p>Lectura local de salud operativa, configuración y warnings no críticos.</p>
        </div>
        <button className="primary-button" onClick={refresh} disabled={snapshot.loading}>Actualizar estado</button>
      </header>

      <div className="metric-grid">
        <MetricCard label="API" value={snapshot.status?.status || "No disponible"} state={apiState} helper={snapshot.desktopContext?.apiBaseUrl || "http://127.0.0.1:17890"} />
        <MetricCard label="Gateway" value={getGatewayUrl(snapshot)} state={gatewayState} helper="La UX no se conecta directamente al WebSocket" />
        <MetricCard label="Configuración" value={snapshot.openClawConfig?.config?.found ? "Detectada" : "No detectada"} state={configState} helper="Secretos redactados antes de mostrarse" />
        <MetricCard label="Última actualización" value={formatDate(snapshot.lastUpdated)} helper={snapshot.desktopContext?.renderer || "Desktop renderer"} />
      </div>

      <section className="content-card">
        <h3>Warnings no críticos</h3>
        <div className="warning-list">
          <div className="warning-item">
            <span>Ollama desactivado</span>
            <p>El warning de Ollama no bloquea Naye si OpenClaw está usando el modelo configurado.</p>
          </div>
          <div className="warning-item">
            <span>Chat no disponible</span>
            <p>El chat usa <code>POST /api/chat</code>; la conexión conversacional profunda con OpenClaw queda controlada por Naye Core.</p>
          </div>
          <div className="warning-item">
            <span>Sin acciones destructivas</span>
            <p>No hay botones para borrar, cerrar sesiones o ejecutar herramientas directamente.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function OpenClawPanel({ snapshot, refresh }: { snapshot: SystemSnapshot; refresh: () => void }) {
  const bridge = snapshot.openClawStatus?.bridge;
  const plugins = extractPlugins(bridge?.stdout);
  const config = snapshot.openClawConfig?.config;

  return (
    <main className="page-panel">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Bridge controlado</span>
          <h2>OpenClaw por Naye Core</h2>
          <p>La UX no toca el gateway directamente; solo interpreta el resumen seguro del backend.</p>
        </div>
        <button className="primary-button" onClick={refresh} disabled={snapshot.loading}>Actualizar OpenClaw</button>
      </header>

      <div className="metric-grid">
        <MetricCard label="Bridge OK" value={String(bridge?.ok ?? "Sin dato")} state={getOpenClawState(snapshot.openClawStatus)} />
        <MetricCard label="statusDetected" value={bridge?.statusDetected || "Sin dato"} state={getOpenClawState(snapshot.openClawStatus)} />
        <MetricCard label="timedOut" value={String(bridge?.timedOut ?? "Sin dato")} state={bridge?.timedOut ? "timeout" : "online"} />
        <MetricCard label="Última verificación" value={formatDate(snapshot.lastUpdated)} />
      </div>

      <section className="content-card">
        <h3>Resumen seguro de configuración</h3>
        <div className="field-grid">
          <ReadonlyField label="Config detectada" value={String(config?.found ?? "Sin dato")} />
          <ReadonlyField label="Ruta segura" value={toSafePathLabel(config?.configPath)} />
          <ReadonlyField label="Auth mode" value={config?.sanitized?.gateway?.authMode || "No disponible"} />
          <ReadonlyField label="Secretos redactados" value={String(config?.sanitized?.secretsRedacted ?? "Sin dato")} />
          <ReadonlyField label="Plugins presentes" value={String(config?.sanitized?.pluginsPresent ?? "Sin dato")} />
          <ReadonlyField label="Canales presentes" value={String(config?.sanitized?.channelsPresent ?? "Sin dato")} />
        </div>
      </section>

      <section className="content-card">
        <h3>Plugins detectados</h3>
        {plugins.length > 0 ? (
          <div className="plugin-list">
            {plugins.map((plugin) => <span key={plugin}>{plugin}</span>)}
          </div>
        ) : (
          <p className="muted">No se recibió una lista parseable de plugins desde el bridge.</p>
        )}
      </section>
    </main>
  );
}

function NodePanel({ snapshot, refresh }: { snapshot: SystemSnapshot; refresh: () => void }) {
  const profile = snapshot.nodeProfile;
  const hasProfile = profile && Object.keys(profile).length > 0;

  return (
    <main className="page-panel">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Nodo local</span>
          <h2>Perfil del dispositivo</h2>
          <p>Datos del equipo registrado en Naye, mostrados sin secretos ni rutas sensibles.</p>
        </div>
        <button className="primary-button" onClick={refresh} disabled={snapshot.loading}>Actualizar nodo</button>
      </header>

      <div className="metric-grid two-columns">
        <MetricCard label="Estado del perfil" value={hasProfile ? "Profile found" : "Profile missing"} state={hasProfile ? "online" : "review"} />
        <MetricCard label="Clasificación" value={getProfileValue(profile, ["classification", "userClassification", "clasificacion", "classificationLabel"])} />
      </div>

      <section className="content-card">
        <h3>Identidad del nodo</h3>
        <div className="field-grid">
          <ReadonlyField label="Nombre del equipo" value={getProfileValue(profile, ["deviceName", "computerName", "hostName", "machineName", "equipo"])} />
          <ReadonlyField label="Alias" value={getProfileValue(profile, ["alias", "deviceAlias", "nodeAlias"])} />
          <ReadonlyField label="Tipo de equipo" value={getProfileValue(profile, ["deviceType", "type", "tipoEquipo"])} />
          <ReadonlyField label="Usuario" value={getProfileValue(profile, ["user", "username", "owner", "usuario"])} />
          <ReadonlyField label="Rol" value={getProfileValue(profile, ["role", "rol", "userRole"])} />
          <ReadonlyField label="Área" value={getProfileValue(profile, ["area", "department", "departamento"])} />
        </div>
      </section>
    </main>
  );
}

function SessionsPanel({ snapshot, refresh }: { snapshot: SystemSnapshot; refresh: () => void }) {
  const count = getSessionCount(snapshot.activeSessions);

  return (
    <main className="page-panel">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Sesiones y autorización</span>
          <h2>Sesiones activas</h2>
          <p>Consulta de sesiones mediante Naye Core API. No hay cierre ni autorización manual en esta versión.</p>
        </div>
        <button className="primary-button" onClick={refresh} disabled={snapshot.loading}>Actualizar sesiones</button>
      </header>

      <div className="metric-grid two-columns">
        <MetricCard label="Estado" value={count === 0 ? "No hay sesiones activas" : "Active session"} state={count === 0 ? "online" : "review"} />
        <MetricCard label="Total" value={String(count)} />
      </div>

      <section className="content-card">
        <h3>Detalle seguro</h3>
        {count === 0 ? (
          <div className="empty-state">
            <strong>No hay sesiones activas</strong>
            <p>Cuando Naye Core exponga sesiones activas o autorizaciones pendientes, aparecerán aquí.</p>
          </div>
        ) : (
          <pre className="json-view">{JSON.stringify(snapshot.activeSessions, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewMode>("assistant");
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(INITIAL_SNAPSHOT);

  const refresh = useCallback(async () => {
    setSnapshot((current) => ({ ...current, loading: true, error: null, warnings: [] }));

    const readError = (label: string, result: PromiseSettledResult<unknown>) => {
      if (result.status === "fulfilled") return null;
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason || "Error desconocido");
      return `${label}: ${message}`;
    };

    const [desktopContextResult, statusResult, openClawStatusResult, openClawConfigResult, nodeProfileResult, activeSessionsResult] = await Promise.allSettled([
      getDesktopContext(),
      getNayeStatus(),
      getOpenClawStatus(),
      getOpenClawConfigSummary(),
      getNodeProfile(),
      getActiveSessions()
    ]);

    const warnings = [
      readError("OpenClaw status", openClawStatusResult),
      readError("OpenClaw config", openClawConfigResult),
      readError("Perfil de nodo", nodeProfileResult),
      readError("Sesiones", activeSessionsResult)
    ].filter(Boolean) as string[];

    const criticalError = statusResult.status === "rejected"
      ? statusResult.reason instanceof Error
        ? statusResult.reason.message
        : "No se pudo consultar Naye Core API"
      : null;

    setSnapshot((current) => ({
      desktopContext: desktopContextResult.status === "fulfilled" ? desktopContextResult.value : current.desktopContext,
      status: statusResult.status === "fulfilled" ? statusResult.value : current.status,
      openClawStatus: openClawStatusResult.status === "fulfilled" ? openClawStatusResult.value : current.openClawStatus,
      openClawConfig: openClawConfigResult.status === "fulfilled" ? openClawConfigResult.value : current.openClawConfig,
      nodeProfile: nodeProfileResult.status === "fulfilled" ? nodeProfileResult.value : current.nodeProfile,
      activeSessions: activeSessionsResult.status === "fulfilled" ? activeSessionsResult.value : current.activeSessions,
      lastUpdated: new Date().toISOString(),
      loading: false,
      error: criticalError,
      warnings
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const apiState = getApiState(snapshot);
  const openClawState = getOpenClawState(snapshot.openClawStatus);
  const sessionCount = getSessionCount(snapshot.activeSessions);

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        apiState={apiState}
        openClawState={openClawState}
        sessionCount={sessionCount}
      />

      <div className="main-shell">
        {snapshot.error ? (
          <div className="error-banner">
            <strong>No se pudo consultar Naye Core API.</strong>
            <span>{snapshot.error}</span>
          </div>
        ) : null}

        {!snapshot.error && snapshot.warnings?.length ? (
          <div className="warning-banner">
            <strong>Lectura parcial del sistema.</strong>
            <span>{snapshot.warnings[0]}</span>
          </div>
        ) : null}

        {activeView === "assistant" ? <AssistantWorkspace snapshot={snapshot} refresh={refresh} /> : null}
        {activeView === "system" ? <SystemPanel snapshot={snapshot} refresh={refresh} /> : null}
        {activeView === "openclaw" ? <OpenClawPanel snapshot={snapshot} refresh={refresh} /> : null}
        {activeView === "node" ? <NodePanel snapshot={snapshot} refresh={refresh} /> : null}
        {activeView === "sessions" ? <SessionsPanel snapshot={snapshot} refresh={refresh} /> : null}
      </div>
    </div>
  );
}
