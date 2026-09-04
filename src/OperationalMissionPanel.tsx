import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authorizeOperationalMission,
  controlOperationalMission,
  getOperationalActionEngineStatus,
  getOperationalMissionActivity,
  getOperationalMissionOrchestration,
  getOperationalMissionStatus,
  proposeOperationalMission,
  revokeOperationalMission,
  runOperationalMission
} from "./operationalClient";
import type {
  OperationalActionEngineStatus,
  OperationalActivityEvent,
  OperationalMissionOrchestrationStatus,
  OperationalMissionRunResponse,
  OperationalMissionStatus
} from "./operationalTypes";
import {
  deriveOperationalMissionPresentation
} from "./operationalMissionPresentation.js";
import {
  getDesktopContext
} from "./nayeDesktopClient";

const OPERATOR = {
  userId: "local-desktop-operator",
  role: "operator"
};

const INITIAL_CAPABILITIES = ["file.create_text"];
const INITIAL_RESOURCE_IDS = ["project:operational-mission"];
const LOCAL_DEVELOPMENT_PROFILE = "naye_local_process_structured_v1";

const ADAPTIVE_POLICY = {
  maxActions: 64,
  durationMs: 4 * 60 * 60 * 1000,
  maxPlanSteps: "unbounded" as const,
  maxPlanningAttempts: 20,
  maxCapabilityDevelopmentAttempts: 20,
  maxArtifactBytes: 32 * 1024 * 1024,
  maxWorkspaceBytes: 512 * 1024 * 1024,
  maxFiles: 20000,
  toolTimeoutMs: 120000,
  maxToolInputBytes: 32 * 1024 * 1024,
  maxToolOutputBytes: 32 * 1024 * 1024,
  maxToolArgs: 512
};

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

function orchestrationStateLabel(orchestration: OperationalMissionOrchestrationStatus | null): string {
  const state = orchestration?.runtime?.orchestrator?.state;
  if (state) return state;
  if (orchestration?.authorizationActive) return "lista para ejecutar";
  return "esperando autorización";
}

export default function OperationalMissionPanel() {
  const [engine, setEngine] = useState<OperationalActionEngineStatus | null>(null);
  const [mission, setMission] = useState<OperationalMissionStatus | null>(null);
  const [orchestration, setOrchestration] = useState<OperationalMissionOrchestrationStatus | null>(null);
  const [lastRun, setLastRun] = useState<OperationalMissionRunResponse | null>(null);
  const [activity, setActivity] = useState<OperationalActivityEvent[]>([]);
  const [objective, setObjective] = useState(
    "Crea un resultado verificable dentro del workspace autorizado. Si falta una capacidad para cumplir el objetivo, desarróllala, pruébala, actívala y continúa la misma misión."
  );
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [missionId, setMissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getDesktopContext()
      .then((context) => {
        if (
          cancelled ||
          !context.defaultOperationalWorkspace
        ) {
          return;
        }

        setWorkspaceRoot(
          (current) =>
            current ||
            context.defaultOperationalWorkspace ||
            ""
        );
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : String(nextError)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const engineResult = await getOperationalActionEngineStatus();
    setEngine(engineResult.actionEngine || null);

    if (missionId) {
      const [missionResult, activityResult, orchestrationResult] = await Promise.all([
        getOperationalMissionStatus(missionId),
        getOperationalMissionActivity(missionId),
        getOperationalMissionOrchestration(missionId)
      ]);
      setMission(missionResult);
      setActivity(activityResult.activity || []);
      setOrchestration(orchestrationResult);
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
    mission?.runtime?.authorization?.active === true ||
    (mission?.authorization && (mission.authorization as { active?: boolean }).active === true)
  );
  const desiredState = mission?.control?.desiredState || "not_started";
  const controlTerminal = mission?.control?.terminal === true;
  const orchestrator = orchestration?.runtime?.orchestrator || null;
  const orchestrationRunning = orchestration?.running === true;
  const missionPresentation = deriveOperationalMissionPresentation({
    authorizationActive,
    desiredState,
    controlTerminal,
    orchestratorState: orchestrator?.state,
    orchestratorTerminal: orchestrator?.terminal === true
  });

  const createMission = useCallback(async () => {
    if (!objective.trim() || !workspaceRoot.trim()) return;
    setBusy(true);
    setError(null);
    setLastRun(null);
    try {
      const proposal = await proposeOperationalMission({
        objective: objective.trim(),
        requestedBy: { userId: "local-desktop-user" },
        risk: "medium",
        allowedCapabilities: INITIAL_CAPABILITIES,
        resourceIds: INITIAL_RESOURCE_IDS,
        workspaceRoots: [workspaceRoot.trim()],
        maxActions: ADAPTIVE_POLICY.maxActions,
        durationMs: ADAPTIVE_POLICY.durationMs,
        rollbackRequired: true,
        verificationRequired: true,
        metadata: {
          source: "naye_desktop_ux",
          mode: "operational_mission",
          adaptiveCapabilityDevelopmentRequested: true,
          adaptiveCapabilityPolicy: {
            enabled: true,
            maxDerivedCapabilities: "unbounded",
            maxRisk: "medium",
            allowedCategories: ["development"],
            requireTests: true,
            requireVerification: true,
            requireRollbackForMutations: true,
            allowIrreversibleMutations: false,
            allowCapabilityReplacement: true
          },
          liveOrchestrationPolicy: {
            maxPlanSteps: ADAPTIVE_POLICY.maxPlanSteps,
            maxPlanningAttempts: ADAPTIVE_POLICY.maxPlanningAttempts,
            maxCapabilityDevelopmentAttempts: ADAPTIVE_POLICY.maxCapabilityDevelopmentAttempts
          },
          capabilityDevelopmentPolicyRequest: {
            workspaceBudgets: {
              maxArtifactBytes: ADAPTIVE_POLICY.maxArtifactBytes,
              maxWorkspaceBytes: ADAPTIVE_POLICY.maxWorkspaceBytes,
              maxFiles: ADAPTIVE_POLICY.maxFiles
            },
            developmentExecution: {
              profile: LOCAL_DEVELOPMENT_PROFILE,
              limits: {
                timeoutMs: ADAPTIVE_POLICY.toolTimeoutMs,
                maxInputBytes: ADAPTIVE_POLICY.maxToolInputBytes,
                maxOutputBytes: ADAPTIVE_POLICY.maxToolOutputBytes,
                maxArgs: ADAPTIVE_POLICY.maxToolArgs
              }
            },
            runtimeExecution: {
              profile: LOCAL_DEVELOPMENT_PROFILE,
              limits: {
                timeoutMs: ADAPTIVE_POLICY.toolTimeoutMs,
                maxInputBytes: ADAPTIVE_POLICY.maxToolInputBytes,
                maxOutputBytes: ADAPTIVE_POLICY.maxToolOutputBytes,
                maxArgs: ADAPTIVE_POLICY.maxToolArgs
              }
            }
          },
          taskSpecificFutureChallengePrepared: false
        }
      });
      const nextMissionId = proposal.mission?.missionId || null;
      if (!nextMissionId) throw new Error("Naye Core no devolvió missionId.");
      setMissionId(nextMissionId);
      const [nextMission, nextActivity, nextOrchestration] = await Promise.all([
        getOperationalMissionStatus(nextMissionId),
        getOperationalMissionActivity(nextMissionId),
        getOperationalMissionOrchestration(nextMissionId)
      ]);
      setMission(nextMission);
      setActivity(nextActivity.activity || []);
      setOrchestration(nextOrchestration);
      setEngine((await getOperationalActionEngineStatus()).actionEngine || null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }, [objective, workspaceRoot]);

  const authorizeAndRunMission = useCallback(async () => {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    try {
      await authorizeOperationalMission(missionId, OPERATOR);
      await refresh();
      const runResult = await runOperationalMission(missionId);
      setLastRun(runResult);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [missionId, refresh]);

  const continueMission = useCallback(async () => {
    if (!missionId) return;
    setBusy(true);
    setError(null);
    try {
      const runResult = await runOperationalMission(missionId);
      setLastRun(runResult);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [missionId, refresh]);

  const controlMission = useCallback(async (
    type: "pause" | "resume" | "stop" | "rollback"
  ) => {
    if (!missionId) return;
    setControlBusy(true);
    setError(null);
    try {
      await controlOperationalMission(
        missionId,
        type,
        OPERATOR,
        `Solicitud ${type} desde Naye Desktop UX`
      );
      await refresh();
      setControlBusy(false);
      if (type === "resume") {
        setBusy(true);
        try {
          const runResult = await runOperationalMission(missionId);
          setLastRun(runResult);
          await refresh();
        } finally {
          setBusy(false);
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      await refresh().catch(() => undefined);
    } finally {
      setControlBusy(false);
    }
  }, [missionId, refresh]);

  const revokeMission = useCallback(async () => {
    if (!missionId) return;
    setControlBusy(true);
    setError(null);
    try {
      await revokeOperationalMission(
        missionId,
        OPERATOR,
        "Revocación explícita desde Naye Desktop UX"
      );
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      await refresh().catch(() => undefined);
    } finally {
      setControlBusy(false);
    }
  }, [missionId, refresh]);

  return (
    <div className="operational-page">
      <header className="operational-hero">
        <div>
          <span className="operational-eyebrow">NAYE ESTÁ TRABAJANDO</span>
          <h1>Misiones operacionales</h1>
          <p>
            Autoriza el objetivo y su alcance una vez. Naye puede detectar capacidades faltantes,
            desarrollarlas dentro de esa autoridad y continuar la misma misión, mientras publica
            cada cambio y conserva Pause, Stop, Rollback y Revocación incluso mientras trabaja.
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
              placeholder="Selecciona un workspace absoluto dentro de NayeVault"
              disabled={Boolean(missionId) || busy}
            />
          </label>

          <div className="operational-card-heading">
            <div>
              <span>Scope que autorizarás</span>
              <h2>Política explícita de esta misión</h2>
            </div>
          </div>
          <div className="operational-truth-grid">
            <span>Capability inicial: {INITIAL_CAPABILITIES.join(", ")}</span>
            <span>Resource scope: {INITIAL_RESOURCE_IDS.join(", ")}</span>
            <span>Riesgo de misión: medium</span>
            <span>Máximo de acciones: {ADAPTIVE_POLICY.maxActions}</span>
            <span>Duración máxima: {ADAPTIVE_POLICY.durationMs / 60 / 60 / 1000} h</span>
            <span>Verification: requerida</span>
            <span>Rollback: requerido para mutaciones</span>
            <span>Expansión adaptativa: permitida</span>
            <span>Riesgo máximo derivado: medium</span>
            <span>Categoría derivada: development</span>
            <span>Capabilities derivadas: sin máximo semántico</span>
            <span>Reemplazo/upgrade de capability: permitido</span>
            <span>Mutaciones irreversibles: no permitidas en esta misión</span>
            <span>Tests de capability: requeridos</span>
            <span>Plan: sin máximo de pasos</span>
            <span>Intentos planner: {ADAPTIVE_POLICY.maxPlanningAttempts}</span>
            <span>Intentos desarrollo: {ADAPTIVE_POLICY.maxCapabilityDevelopmentAttempts}</span>
            <span>Artefacto máximo: {Math.round(ADAPTIVE_POLICY.maxArtifactBytes / 1024 / 1024)} MB</span>
            <span>Workspace desarrollo: {Math.round(ADAPTIVE_POLICY.maxWorkspaceBytes / 1024 / 1024)} MB</span>
            <span>Máximo de archivos: {ADAPTIVE_POLICY.maxFiles}</span>
            <span>Timeout por tool: {ADAPTIVE_POLICY.toolTimeoutMs / 1000} s</span>
            <span>Input por tool: {Math.round(ADAPTIVE_POLICY.maxToolInputBytes / 1024 / 1024)} MB</span>
            <span>Output por tool: {Math.round(ADAPTIVE_POLICY.maxToolOutputBytes / 1024 / 1024)} MB</span>
            <span>Argumentos por tool: {ADAPTIVE_POLICY.maxToolArgs}</span>
            <span>Perfil ejecución: {LOCAL_DEVELOPMENT_PROFILE}</span>
          </div>

          {!missionId ? (
            <button className="operational-primary" disabled={busy || !workspaceRoot.trim()} onClick={() => void createMission()}>
              {busy ? "Creando misión..." : "Crear misión"}
            </button>
          ) : null}

          {missionId && !authorizationActive ? (
            <div className="operational-authorization">
              <div>
                <strong>La misión está propuesta</strong>
                <p>
                  Core ya resolvió la identidad local de ejecución dentro del Mission Envelope.
                  Al autorizar confirmas el objetivo, workspace y toda la política explícita mostrada arriba;
                  no se pedirá aprobación por cada archivo o paso dentro de ese scope.
                </p>
              </div>
              <button className="operational-primary" disabled={busy} onClick={() => void authorizeAndRunMission()}>
                {busy ? "Autorizando y ejecutando..." : "Autorizar misión y comenzar"}
              </button>
            </div>
          ) : null}

          {authorizationActive ? (
            <div className="operational-authorized">
              <strong>Misión autorizada</strong>
              <span>Control: {desiredState}</span>
              <span>Orquestación: {orchestrationStateLabel(orchestration)}</span>
              <span>Recovery tras reinicio: {mission?.processRestartMissionRecovery ? "activo" : "pendiente"}</span>
            </div>
          ) : null}

          {authorizationActive && orchestrator?.terminal !== true && orchestrator?.retryable === true && !orchestrationRunning ? (
            <button className="operational-primary" disabled={busy} onClick={() => void continueMission()}>
              {busy ? "Continuando..." : "Continuar misión"}
            </button>
          ) : null}

          {lastRun ? (
            <div className="operational-authorized">
              <strong>Último ciclo de ejecución</strong>
              <span>{lastRun.completed ? "Completado" : "Yield operacional"}</span>
              <span>{lastRun.reason || lastRun.result?.reason || "sin reason"}</span>
            </div>
          ) : null}
        </section>

        <section className="operational-card">
          <div className="operational-card-heading">
            <div>
              <span>Runtime</span>
              <h2>Capacidades realmente activas</h2>
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
                El runtime mostrará aquí únicamente capabilities realmente registradas y verificadas.
              </p>
            )}
          </div>
          <div className="operational-truth-grid">
            <span>Automatic execution: {engine?.automaticExecution ? "true" : "false"}</span>
            <span>Restart recovery: {engine?.processRestartMissionRecovery ? "true" : "false"}</span>
            <span>Power-loss durability: {engine?.powerLossDurabilityClaimed ? "true" : "false"}</span>
            <span>Modelo es autoridad: {orchestration?.modelIsAuthority ? "true" : "false"}</span>
            <span>Author es autoridad: {orchestration?.sourceAuthorIsAuthority ? "true" : "false"}</span>
          </div>
        </section>
      </div>

      <section className="operational-card operational-control-card">
        <div>
          <span className="operational-eyebrow">CONTROL HUMANO PERMANENTE</span>
          <h2>{missionPresentation.heading}</h2>
          <p>{missionPresentation.description}</p>
        </div>
        <div className="operational-controls">
          <button
            disabled={!authorizationActive || missionPresentation.terminal || controlBusy || desiredState === "paused"}
            onClick={() => void controlMission("pause")}
          >
            Pausar
          </button>
          <button
            disabled={!authorizationActive || missionPresentation.terminal || controlBusy || desiredState !== "paused" || orchestrationRunning}
            onClick={() => void controlMission("resume")}
          >
            Reanudar
          </button>
          <button
            className="is-danger"
            disabled={!authorizationActive || missionPresentation.terminal || controlBusy}
            onClick={() => void controlMission("stop")}
          >
            Stop
          </button>
          <button
            className="is-warning"
            disabled={!authorizationActive || missionPresentation.terminal || controlBusy}
            onClick={() => void controlMission("rollback")}
          >
            Rollback
          </button>
          <button
            className="is-danger"
            disabled={!authorizationActive || controlBusy}
            onClick={() => void revokeMission()}
          >
            Revocar autorización
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
