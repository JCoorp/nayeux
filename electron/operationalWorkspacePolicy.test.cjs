"use strict";

const assert = require("assert/strict");
const path = require("path");

const {
  OPERATIONAL_WORKSPACE_POLICY_VERSION,
  resolveDefaultOperationalWorkspace
} = require("./operationalWorkspacePolicy.cjs");

let assertions = 0;
function verify(condition, message) {
  assertions += 1;
  assert.equal(condition, true, message);
}

const win32 = path.win32;

verify(
  OPERATIONAL_WORKSPACE_POLICY_VERSION === "1.0.0",
  "The operational workspace policy version must be explicit."
);

verify(
  resolveDefaultOperationalWorkspace({
    env: {
      NAYE_EXECUTION_CLAIM_ROOT:
        "C:\\NayeVault\\operational\\execution-claims"
    },
    appPath: "F:\\NayeVault\\nayeux",
    pathModule: win32
  }) ===
    "C:\\NayeVault\\missions\\operational-workspace",
  "The durable execution-claim root must move the default workspace with the active vault instead of retaining a stale app-drive path."
);

verify(
  resolveDefaultOperationalWorkspace({
    env: {
      NAYE_CAPABILITY_DEVELOPMENT_ROOT:
        "D:\\PortableVault\\operational\\capability-development"
    },
    pathModule: win32
  }) ===
    "D:\\PortableVault\\missions\\operational-workspace",
  "The capability-development root must provide a second authoritative vault signal."
);

verify(
  resolveDefaultOperationalWorkspace({
    env: {},
    appPath: "C:\\NayeVault\\nayeux",
    pathModule: win32
  }) ===
    "C:\\NayeVault\\missions\\operational-workspace",
  "A source checkout directly under the vault must provide a safe local fallback."
);

verify(
  resolveDefaultOperationalWorkspace({
    env: {
      NAYE_EXECUTION_CLAIM_ROOT:
        "relative\\execution-claims"
    },
    appPath:
      "C:\\Program Files\\Naye Desktop UX\\resources\\app.asar",
    pathModule: win32
  }) === null,
  "Unknown or relative layouts must fail closed instead of inventing a drive-specific workspace."
);

console.log(JSON.stringify({
  schema:
    "naye-operational-workspace-policy-selftest-v1",
  passed: true,
  assertions
}, null, 2));
