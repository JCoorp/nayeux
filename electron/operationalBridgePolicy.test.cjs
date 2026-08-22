"use strict";

const assert = require("node:assert/strict");
const {
  normalizeOperationalRequest
} = require("./operationalBridgePolicy.cjs");

function allowed(method, endpoint) {
  const result = normalizeOperationalRequest({ method, endpoint, body: { proof: true } });
  assert.equal(result.method, method);
  assert.equal(result.endpoint, endpoint);
}

function denied(method, endpoint) {
  assert.throws(
    () => normalizeOperationalRequest({ method, endpoint }),
    /not allowed|invalid/i,
    `${method} ${endpoint} must be denied to the Desktop renderer`
  );
}

allowed("GET", "/api/operational/action-engine/status");
allowed("POST", "/api/operational/missions");
allowed("GET", "/api/operational/missions/mission-123");
allowed("GET", "/api/operational/missions/mission-123/activity");
allowed("GET", "/api/operational/missions/mission-123/orchestration");
allowed("POST", "/api/operational/missions/mission-123/authorize");
allowed("POST", "/api/operational/missions/mission-123/run");
allowed("POST", "/api/operational/missions/mission-123/control");
allowed("POST", "/api/operational/missions/mission-123/revoke");

denied("POST", "/api/operational/missions/mission-123/actions/admit");
denied("POST", "/api/operational/missions/mission-123/actions/dispatch");
denied("POST", "/api/operational/missions/mission-123/grants");
denied("GET", "/api/operational-execution/status");
denied("GET", "/api/runtime/status");
denied("POST", "/api/chat");
denied("GET", "/api/operational/missions");
denied("POST", "/api/operational/action-engine/status");
denied("GET", "/api/operational/missions/mission-123/run");
denied("GET", "/api/operational/missions/mission-123?debug=true");

console.log(JSON.stringify({
  schema: "naye-desktop-operational-bridge-policy-selftest-v1",
  passed: true,
  highLevelMissionContractOnly: true,
  lowLevelAdmissionDispatchExposed: false,
  arbitraryCoreEndpointExposed: false
}, null, 2));
