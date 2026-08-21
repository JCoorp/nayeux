import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authorizeOperationalMission,
  controlOperationalMission,
  getOperationalActionEngineStatus,
  getOperationalMissionActivity,
  getOperationalMissionStatus,
  proposeOperationalMission
} from "./operationalClient";
import type {
  OperationalActionEngineStatus,
  OperationalActivityEvent,
  OperationalMissionStatus
} from "./operationalTypes";

const OPERATOR = {
  userId: "local-desktop-operator",
  role: "operator"
};

const INITIAL_CAPABILITIES = [
  "file.create_text",
  "file.read",
  "file.update_text",
  "directory.create",
  "directory.list",
  "process.run_bounded",
  "build.run",
  "test.run",
  "network.inspect"
];

function eventTime(event: OperationalActivityEvent): string {
  const source = event as OperationalActivityEvent & {
    occurredAt?: string;
    createdAt?: string;
  };
  return source.timestamp || source.occurredAt || source.createdAt || "";
}

function eventLabel(event: OperationalActivityEvent): string {
  return event.summary || event.type || "actividad operacional";
}

function engineStateLabel(engine: OperationalActionEngineStatus | null): string {
  if (!engine) return "Sin conexión";
  if (engine.available) return "Runtime activo";
  return "Esperando misión autorizada";
}

export default function OperationalMissionPanel() {
  const [engine, setEngine] = useState<OperationalActionEngineStatus | null>(null);
  const [mission, setMission] = useState<OperationalMissionStatus | null>(null);
  const [activity, setActivity] = useState<OperationalActivityEvent[]>([]);
  const [objective, setObjective] = useState(
    "Desarrolla una aplicación que conecte mi celular con esta computadora, construye las capacidades que te falten, pruébala y verifica que la conexión funcione."
  );
  const [workspaceRoot, setWorkspaceRoot] = useState(
    "F:\\NayeVault\\missions\\phone-pc-app"
  );
  const [missionId, setMissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const engineResult = await getOperationalActionEngineStatus();
    setEngine(engineResult.actionEngine || null);

    if (missionId) {
      const [missionResult, activityResult] = await Promise.all([
        getOperationalMissionStatus(missionId),
        getOperationalMissionActivity(missionId)
      ]);
      setMission(missionResult);
      setActivity(activityResult.activity || []);
    }

    setLastRefresh(new Date().toISOString());
  }, [missionId]);

  useEffect(() => {
    void refresh().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    });
  }, [refresh]);

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      void refresh().catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [missionId, refresh]);

  const registeredCapabilities = useMemo(
    () => engine?.capabilities?.map((item) => item.capability).filter(Boolean) as string[] || [],
    [engine]
  );

  const authorizationActive = Boolean(
    mission?.authorization &&
    (mission.authorization as { active?: boolean }).active === true
  );
  const desiredState = mission?.control?.desiredState || "not_started";
  const terminal = mission?.control?.terminal === true;

  const createMission = useCallback(async () => {
    if (!objective.trim() || !workspaceRoot.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const proposal = await proposeOperationalMission({
        objective: objective.trim(),
        requestedBy: { userId: "local-desktop-user" },
        risk: "low",
        allowedCapabilities: INITIAL_CAPABILITIES,
        resourceIds: ["project:phone-pc-app"],
        workspaceRoots: [workspaceRoot.trim()],
        maxActions: 16,
        durationMs: 60 * 60 * 1000,
        rollbackRequired: true,
        verificationRequired: true,
        metadata: {
          source: "naye_desktop_ux",
          mode: "operational_mission",
          adaptiveCapabilityDevelopmentRequested: true
        }
      });
      const nextMissionId = proposal.mission?.missionId || null;
      if (!nextMissionId) throw new Error("Naye Core no devolvió missionId.");
      setMissionId(nextMissionId);
      setMission(await getOperationalMissionStatus(nextMissionId));
      const nextActivity = await getOperationalMissionActivity(nextMissionId);
      setActivity(nextActivity.activity || []);
      setEngine((await getOperationalActionEngineStatus()).actionEngine || null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }, [objective, workspaceRoot]);

  const authorizeMission = useCallback(async () => {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    try {
      await authorizeOperationalMission(missionId, OPERATOR);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }, [missionId, refresh]);

  const controlMission = useCallback(async (
    type: "pause" | "resume" | "stop" | "rollback"
  ) => {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    try {
      await controlOperationalMission(
        missionId,
        type,
        OPERATOR,
        `Solicitud ${type} desde Naye Desktop UX`
      );
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }, [missionId, refresh]);

  return (
    <div className="operational-page">
      <header className="operational-hero">
        <div>
          <span className="operational-eyebrow">NAYE ESTÁ TRABAJANDO</span>
          <h1>Misiones operacionales</h1>
          <p>
            Autoriza el objetivo una vez. Naye trabaja dentro del alcance de la misión,
            publica cada cambio en Activity Stream y conserva Pause, Stop y Rollback.
          </p>
        </div>
        <div className={`operational-engine-state ${engine?.available ? "is-live" : ""}`}>
          <strong>{engineStateLabel(engine)}</strong>
          <span>
            {engine?.activeRuntimeCount || 0} runtime · {engine?.capabilityCount || 0} capability activa
          </span>
        </div>
      </header>

      {error ? (
        <div className="operational-error">
          <strong>Estado operacional</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="operational-grid">
        <section className="operational-card operational-mission-card">
          <div className="operational-card-heading">
            <div>
              <span>Paso 1</span>
              <h2>Objetivo</h2>
            </div>
            {missionId ? <code>{missionId}</code> : null}
          </div>

          <label className="operational-field">
            <span>Misión</span>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              disabled={Boolean(missionId) || busy}
            />
          </label>

          <label className="operational-field">
            <span>Workspace autorizado</span>
            <input
              value={workspaceRoot}
              onChange={(event) => setWorkspaceRoot(event.target.value)}
              disabled={Boolean(missionId) || busy}
            />
          </label>

          {!missionId ? (
            <button className="operational-primary" disabled={busy} onClick={() => void createMission()}>
              {busy ? "Creando misión..." : "Crear misión"}
            </button>
          ) : null}

          {missionId && !authorizationActive ? (
            <div className="operational-authorization">
              <div>
                <strong>La misión está propuesta</strong>
                <p>
                  Una autorización cubre el objetivo y su alcance. No se solicitará aprobación por cada archivo o paso.
                </p>
              </div>
              <button className="operational-primary" disabled={busy} onClick={() => void authorizeMission()}>
                {busy ? "Autorizando..." : "Autorizar misión y comenzar"}
              </button>
            </div>
          ) : null}

          {authorizationActive ? (
            <div className="operational-authorized">
              <strong>Misión autorizada</strong>
              <span>Estado deseado: {desiredState}</span>
              <span>Recovery tras reinicio: {mission?.processRestartMissionRecovery ? "activo" : "pendiente"}</span>
            </div>
          ) : null}
        </section>

        <section className="operational-card">
          <div className="operational-card-heading">
            <div>
              <span>Runtime</span>
              <h2>Capacidades</h2>
            </div>
          </div>
          <div className="operational-capability-list">
            {registeredCapabilities.length ? registeredCapabilities.map((capability) => (
              <div key={capability} className="operational-capability is-ready">
                <strong>{capability}</strong>
                <span>ACTIVA</span>
              </div>
            )) : (
              <p className="operational-muted">
                El runtime mostrará aquí únicamente capabilities realmente activadas y verificadas.
              </p>
            )}
          </div>
          <div className="operational-truth-grid">
            <span>Automatic execution: {engine?.automaticExecution ? "true" : "false"}</span>
            <span>Restart recovery: {engine?.processRestartMissionRecovery ? "true" : "false"}</span>
            <span>Power-loss durability: {engine?.powerLossDurabilityClaimed ? "true" : "false"}</span>
          </div>
        </section>
      </div>

      <section className="operational-card operational-control-card">
        <div>
          <span className="operational-eyebrow">CONTROL HUMANO PERMANENTE</span>
          <h2>{authorizationActive ? "Misión en curso" : "Esperando autorización"}</h2>
          <p>
            Puedes observar el proceso sin intervenir. Usa los controles solamente cuando quieras cambiar el estado de la misión.
          </p>
        </div>
        <div className="operational-controls">
          <button
            disabled={!authorizationActive || terminal || busy || desiredState === "paused"}
            onClick={() => void controlMission("pause")}
          >
            Pausar
          </button>
          <button
            disabled={!authorizationActive || terminal || busy || desiredState !== "paused"}
            onClick={() => void controlMission("resume")}
          >
            Reanudar
          </button>
          <button
            className="is-danger"
            disabled={!authorizationActive || terminal || busy}
            onClick={() => void controlMission("stop")}
          >
            Stop
          </button>
          <button
            className="is-warning"
            disabled={!authorizationActive || terminal || busy}
            onClick={() => void controlMission("rollback")}
          >
            Rollback
          </button>
        </div>
      </section>

      <section className="operational-card operational-activity-card">
        <div className="operational-card-heading">
          <div>
            <span>Actividad en vivo</span>
            <h2>Qué está haciendo Naye</h2>
          </div>
          <small>{lastRefresh ? `Actualizado ${new Date(lastRefresh).toLocaleTimeString()}` : "Sin actividad"}</small>
        </div>

        <div className="operational-timeline">
          {activity.length ? [...activity].reverse().map((event, index) => (
            <article key={event.eventId || event.hash || `${eventLabel(event)}-${index}`}>
              <div className={`operational-event-dot type-${event.type || "unknown"}`} />
              <div>
                <div className="operational-event-title">
                  <strong>{eventLabel(event)}</strong>
                  <span>{event.type || "event"}</span>
                </div>
                {event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}
                <small>{eventTime(event) ? new Date(eventTime(event)).toLocaleString() : ""}</small>
              </div>
            </article>
          )) : (
            <div className="operational-empty">
              <strong>Todavía no hay eventos.</strong>
              <p>Crea y autoriza una misión para empezar a ver el trabajo de Naye.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
