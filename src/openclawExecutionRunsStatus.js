import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const RUNS_DIR = path.join(RUNTIME_ROOT, "execution-runs");

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

function inspectRun(filePath) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      runId: path.basename(filePath),
      status: "invalid_json",
      mode: null,
      error: parsed.error,
      checks: []
    };
  }

  const run = parsed.data;

  const checks = [
    {
      name: "mode_dry_run",
      ok: run.mode === "dry_run",
      value: run.mode
    },
    {
      name: "status_blocked_dry_run_not_executed",
      ok: run.status === "blocked_dry_run_not_executed",
      value: run.status
    },
    {
      name: "execution_allowed_false",
      ok: run.execution?.allowed === false,
      value: run.execution?.allowed
    },
    {
      name: "execution_executed_false",
      ok: run.execution?.executed === false,
      value: run.execution?.executed
    },
    {
      name: "executor_enabled_false",
      ok: run.execution?.executorEnabled === false,
      value: run.execution?.executorEnabled
    },
    {
      name: "commands_executed_empty",
      ok: Array.isArray(run.execution?.commandsExecuted) && run.execution.commandsExecuted.length === 0,
      value: Array.isArray(run.execution?.commandsExecuted) ? run.execution.commandsExecuted.length : null
    },
    {
      name: "files_modified_empty",
      ok: Array.isArray(run.execution?.filesModified) && run.execution.filesModified.length === 0,
      value: Array.isArray(run.execution?.filesModified) ? run.execution.filesModified.length : null
    },
    {
      name: "final_executor_gate_not_passed",
      ok: run.safety?.finalExecutorGatePassed === false,
      value: run.safety?.finalExecutorGatePassed
    },
    {
      name: "cannot_execute_without_approval",
      ok: run.safety?.canExecuteWithoutApproval === false,
      value: run.safety?.canExecuteWithoutApproval
    },
    {
      name: "network_disabled",
      ok: run.safety?.allowNetwork === false,
      value: run.safety?.allowNetwork
    },
    {
      name: "external_providers_disabled",
      ok: run.safety?.allowExternalProviders === false,
      value: run.safety?.allowExternalProviders
    },
    {
      name: "file_modification_disabled",
      ok: run.safety?.allowFileModification === false,
      value: run.safety?.allowFileModification
    },
    {
      name: "credential_access_disabled",
      ok: run.safety?.allowCredentialAccess === false,
      value: run.safety?.allowCredentialAccess
    },
    {
      name: "legacy_data_disabled",
      ok: run.safety?.allowLegacyData === false,
      value: run.safety?.allowLegacyData
    },
    {
      name: "has_execution_approval_id",
      ok: typeof run.source?.executionApprovalId === "string" && run.source.executionApprovalId.length > 0,
      value: run.source?.executionApprovalId ?? null
    },
    {
      name: "has_plan_id",
      ok: typeof run.source?.planId === "string" && run.source.planId.length > 0,
      value: run.source?.planId ?? null
    },
    {
      name: "has_proposal_id",
      ok: typeof run.source?.proposalId === "string" && run.source.proposalId.length > 0,
      value: run.source?.proposalId ?? null
    }
  ];

  return {
    ok: checks.every(check => check.ok),
    filePath,
    runId: run.runId ?? path.basename(filePath),
    mode: run.mode ?? "missing_mode",
    status: run.status ?? "missing_status",
    approvalId: run.source?.executionApprovalId ?? null,
    planId: run.source?.planId ?? null,
    proposalId: run.source?.proposalId ?? null,
    executionAllowed: run.execution?.allowed,
    executed: run.execution?.executed,
    executorEnabled: run.execution?.executorEnabled,
    commandsExecuted: Array.isArray(run.execution?.commandsExecuted) ? run.execution.commandsExecuted.length : null,
    filesModified: Array.isArray(run.execution?.filesModified) ? run.execution.filesModified.length : null,
    error: null,
    checks
  };
}

function main() {
  ensureDir(RUNS_DIR);

  const files = listJsonFiles(RUNS_DIR);
  const runs = files.map(inspectRun);
  const unsafe = runs.filter(run => !run.ok);

  console.log("");
  console.log("Naye OpenClaw Execution Runs Status");
  console.log("-----------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Execution runs:", RUNS_DIR);

  console.log("");
  console.log("Runs encontrados");
  console.log("----------------");

  if (!runs.length) {
    console.log("(vacío)");
  }

  for (const run of runs) {
    console.log("");
    console.log(`[${run.ok ? "OK" : "REVISAR"}] ${run.runId}`);
    console.log("Archivo:", run.filePath);
    console.log("Modo:", run.mode);
    console.log("Estado:", run.status);
    console.log("Approval ID:", run.approvalId);
    console.log("Plan ID:", run.planId);
    console.log("Proposal ID:", run.proposalId);
    console.log("Ejecución permitida:", run.executionAllowed);
    console.log("Ejecutado:", run.executed);
    console.log("Ejecutor habilitado:", run.executorEnabled);
    console.log("Comandos ejecutados:", run.commandsExecuted);
    console.log("Archivos modificados:", run.filesModified);

    if (run.error) {
      console.log("Error:", run.error);
    }

    for (const check of run.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Runs totales:", runs.length);
  console.log("Runs seguros:", runs.filter(run => run.ok).length);
  console.log("Runs por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
