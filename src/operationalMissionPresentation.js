const STOPPED_STATES = new Set([
  "stopped",
  "stopped_by_operator"
]);

const COMPLETED_STATES = new Set([
  "completed",
  "mission_completed"
]);

const FAILED_STATES = new Set([
  "failed",
  "planning_failed"
]);

export function deriveOperationalMissionPresentation({
  authorizationActive,
  desiredState,
  controlTerminal,
  orchestratorState,
  orchestratorTerminal
}) {
  const state = String(orchestratorState || desiredState || "").trim();
  const terminal = controlTerminal === true || orchestratorTerminal === true;

  if (!authorizationActive) {
    return Object.freeze({
      heading: "Esperando autorización",
      description:
        "Autoriza una misión para habilitar sus controles operacionales dentro del scope mostrado.",
      terminal: false,
      state: state || "not_started"
    });
  }

  if (terminal && STOPPED_STATES.has(state)) {
    return Object.freeze({
      heading: "Misión detenida",
      description:
        "La ejecución terminó por solicitud del operador. La autorización permanece registrada, pero ya no hay una ejecución activa.",
      terminal: true,
      state
    });
  }

  if (terminal && COMPLETED_STATES.has(state)) {
    return Object.freeze({
      heading: "Misión completada",
      description:
        "La orquestación llegó a un estado terminal completado. Consulta la actividad y la evidencia antes de aceptar el resultado.",
      terminal: true,
      state
    });
  }

  if (terminal && FAILED_STATES.has(state)) {
    return Object.freeze({
      heading: "Misión fallida",
      description:
        "La misión terminó sin completar el objetivo. Consulta el motivo y la evidencia; Continuar no reiniciará el presupuesto agotado.",
      terminal: true,
      state
    });
  }

  if (terminal) {
    return Object.freeze({
      heading: "Misión finalizada",
      description:
        "La orquestación está en un estado terminal. Consulta el motivo y la evidencia publicados en la actividad.",
      terminal: true,
      state: state || "terminal"
    });
  }

  return Object.freeze({
    heading: "Misión en curso",
    description:
      "Puedes observar el proceso sin intervenir. Pause, Stop, Rollback y Revocación permanecen disponibles durante una ejecución activa.",
    terminal: false,
    state: state || "running"
  });
}
