import assert from "node:assert/strict";

import {
  deriveOperationalMissionPresentation
} from "./operationalMissionPresentation.js";

const running = deriveOperationalMissionPresentation({
  authorizationActive: true,
  desiredState: "running",
  controlTerminal: false,
  orchestratorState: "planning",
  orchestratorTerminal: false
});

assert.equal(running.heading, "Misión en curso");
assert.equal(running.terminal, false);

const stopped = deriveOperationalMissionPresentation({
  authorizationActive: true,
  desiredState: "stopped",
  controlTerminal: true,
  orchestratorState: "stopped_by_operator",
  orchestratorTerminal: true
});

assert.equal(stopped.heading, "Misión detenida");
assert.equal(stopped.terminal, true);
assert.match(stopped.description, /ya no hay una ejecución activa/);

const completed = deriveOperationalMissionPresentation({
  authorizationActive: true,
  desiredState: "running",
  controlTerminal: false,
  orchestratorState: "completed",
  orchestratorTerminal: true
});

assert.equal(completed.heading, "Misión completada");
assert.equal(completed.terminal, true);

const failed = deriveOperationalMissionPresentation({
  authorizationActive: true,
  desiredState: "running",
  controlTerminal: true,
  orchestratorState: "planning_failed",
  orchestratorTerminal: true
});

assert.equal(failed.heading, "Misión fallida");
assert.equal(failed.terminal, true);
assert.match(failed.description, /no reiniciará el presupuesto agotado/);

const waiting = deriveOperationalMissionPresentation({
  authorizationActive: false,
  desiredState: "not_started",
  controlTerminal: false,
  orchestratorState: null,
  orchestratorTerminal: false
});

assert.equal(waiting.heading, "Esperando autorización");
assert.equal(waiting.terminal, false);

console.log(JSON.stringify({
  schema: "naye-operational-mission-presentation-selftest-v1",
  passed: true,
  assertions: 12
}, null, 2));
