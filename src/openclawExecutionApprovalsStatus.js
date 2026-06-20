import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const APPROVALS_DIR = path.join(RUNTIME_ROOT, "execution-approvals");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listJsonFiles(dirPath) {
  ensureDir(dirPath);

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(dirPath, entry.name))
    .sort();
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return {
      ok: true,
      data: JSON.parse(raw),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error.message
    };
  }
}

function inspectApproval(filePath) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      approvalId: path.basename(filePath),
      status: "invalid_json",
      error: parsed.error,
      checks: []
    };
  }

  const approval = parsed.data;

  const checks = [
    {
      name: "status_execution_approved_executor_disabled",
      ok: approval.status === "execution_approved_executor_disabled",
      value: approval.status
    },
    {
      name: "decision_execution_approved_true",
      ok: approval.decision?.executionApproved === true,
      value: approval.decision?.executionApproved
    },
    {
      name: "execution_allowed_false",
      ok: approval.execution?.allowed === false,
      value: approval.execution?.allowed
    },
    {
      name: "execution_executed_false",
      ok: approval.execution?.executed === false,
      value: approval.execution?.executed
    },
    {
      name: "executor_enabled_false",
      ok: approval.execution?.executorEnabled === false,
      value: approval.execution?.executorEnabled
    },
    {
      name: "cannot_execute_without_approval",
      ok: approval.safety?.canExecuteWithoutApproval === false,
      value: approval.safety?.canExecuteWithoutApproval
    },
    {
      name: "network_disabled",
      ok: approval.safety?.allowNetwork === false,
      value: approval.safety?.allowNetwork
    },
    {
      name: "external_providers_disabled",
      ok: approval.safety?.allowExternalProviders === false,
      value: approval.safety?.allowExternalProviders
    },
    {
      name: "file_modification_disabled",
      ok: approval.safety?.allowFileModification === false,
      value: approval.safety?.allowFileModification
    },
    {
      name: "credential_access_disabled",
      ok: approval.safety?.allowCredentialAccess === false,
      value: approval.safety?.allowCredentialAccess
    },
    {
      name: "legacy_data_disabled",
      ok: approval.safety?.allowLegacyData === false,
      value: approval.safety?.allowLegacyData
    },
    {
      name: "requires_final_executor_gate",
      ok: approval.safety?.requiresFinalExecutorGate === true,
      value: approval.safety?.requiresFinalExecutorGate
    },
    {
      name: "has_plan_id",
      ok: typeof approval.source?.planId === "string" && approval.source.planId.length > 0,
      value: approval.source?.planId ?? null
    },
    {
      name: "has_proposal_id",
      ok: typeof approval.source?.proposalId === "string" && approval.source.proposalId.length > 0,
      value: approval.source?.proposalId ?? null
    }
  ];

  return {
    ok: checks.every(check => check.ok),
    filePath,
    approvalId: approval.executionApprovalId ?? path.basename(filePath),
    status: approval.status ?? "missing_status",
    planId: approval.source?.planId ?? null,
    proposalId: approval.source?.proposalId ?? null,
    executionApproved: approval.decision?.executionApproved,
    executionAllowed: approval.execution?.allowed,
    executed: approval.execution?.executed,
    executorEnabled: approval.execution?.executorEnabled,
    error: null,
    checks
  };
}

function main() {
  ensureDir(APPROVALS_DIR);

  const files = listJsonFiles(APPROVALS_DIR);
  const approvals = files.map(inspectApproval);
  const unsafe = approvals.filter(approval => !approval.ok);

  console.log("");
  console.log("Naye OpenClaw Execution Approvals Status");
  console.log("----------------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Execution approvals:", APPROVALS_DIR);

  console.log("");
  console.log("Aprobaciones encontradas");
  console.log("------------------------");

  if (!approvals.length) {
    console.log("(vacío)");
  }

  for (const approval of approvals) {
    console.log("");
    console.log(`[${approval.ok ? "OK" : "REVISAR"}] ${approval.approvalId}`);
    console.log("Archivo:", approval.filePath);
    console.log("Estado:", approval.status);
    console.log("Plan ID:", approval.planId);
    console.log("Proposal ID:", approval.proposalId);
    console.log("Ejecución aprobada:", approval.executionApproved);
    console.log("Ejecución permitida:", approval.executionAllowed);
    console.log("Ejecutor habilitado:", approval.executorEnabled);
    console.log("Ejecutado:", approval.executed);

    if (approval.error) {
      console.log("Error:", approval.error);
    }

    for (const check of approval.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Aprobaciones totales:", approvals.length);
  console.log("Aprobaciones seguras:", approvals.filter(approval => approval.ok).length);
  console.log("Aprobaciones por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
