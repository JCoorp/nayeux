"use strict";

const path = require("path");

const OPERATIONAL_WORKSPACE_POLICY_VERSION = "1.0.0";

function cleanAbsolutePath(value, pathModule) {
  const candidate = String(value || "").trim();
  if (
    !candidate ||
    candidate.includes("\0") ||
    !pathModule.isAbsolute(candidate)
  ) {
    return null;
  }

  return pathModule.resolve(candidate);
}

function vaultRootFromOperationalPath(
  value,
  expectedLeaf,
  pathModule
) {
  const resolved = cleanAbsolutePath(
    value,
    pathModule
  );
  if (!resolved) return null;

  if (
    pathModule.basename(resolved).toLowerCase() !==
    expectedLeaf
  ) {
    return null;
  }

  const operationalRoot =
    pathModule.dirname(resolved);
  if (
    pathModule
      .basename(operationalRoot)
      .toLowerCase() !== "operational"
  ) {
    return null;
  }

  return pathModule.dirname(operationalRoot);
}

function vaultRootFromAppPath(value, pathModule) {
  const resolved = cleanAbsolutePath(
    value,
    pathModule
  );
  if (!resolved) return null;

  if (
    pathModule.basename(resolved).toLowerCase() !==
    "nayeux"
  ) {
    return null;
  }

  return pathModule.dirname(resolved);
}

function resolveDefaultOperationalWorkspace({
  env = process.env,
  appPath = null,
  pathModule =
    process.platform === "win32"
      ? path.win32
      : path
} = {}) {
  const vaultCandidates = [
    cleanAbsolutePath(
      env?.NAYE_VAULT_ROOT,
      pathModule
    ),
    vaultRootFromOperationalPath(
      env?.NAYE_EXECUTION_CLAIM_ROOT,
      "execution-claims",
      pathModule
    ),
    vaultRootFromOperationalPath(
      env?.NAYE_CAPABILITY_DEVELOPMENT_ROOT,
      "capability-development",
      pathModule
    ),
    vaultRootFromAppPath(
      appPath,
      pathModule
    )
  ].filter(Boolean);

  if (vaultCandidates.length === 0) {
    return null;
  }

  return pathModule.join(
    vaultCandidates[0],
    "missions",
    "operational-workspace"
  );
}

module.exports = {
  OPERATIONAL_WORKSPACE_POLICY_VERSION,
  resolveDefaultOperationalWorkspace
};
