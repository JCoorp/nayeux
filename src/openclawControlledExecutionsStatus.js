import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const EXECUTIONS_DIR = path.join(RUNTIME_ROOT, "controlled-executions");

const VALID_STATUSES = [
  "real_execution_completed",
  "real_execution_failed"
];

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

function inspectExecution(filePath) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      executionId: path.basename(filePath),
      status: "invalid_json",
      error: parsed.error,
      checks: []
    };
  }

  const execution = parsed.data;

  const checks = [
    {
      name: "mode_controlled_real_execution",
      ok: execution.mode === "controlled_real_execution",
      value: execution.mode
    },
    {
      name: "status_is_valid",
      ok: VALID_STATUSES.includes(execution.status),
      value: execution.status
    },
    {
      name: "has_gate_id",
      ok: typeof execution.source?.gateId === "string" && execution.source.gateId.length > 0,
      value: execution.source?.gateId ?? null
    },
    {
      name: "has_run_id",
      ok: typeof execution.source?.runId === "string" && execution.source.runId.length > 0,
      value: execution.source?.runId ?? null
    },
    {
      name: "has_execution_approval_id",
      ok: typeof execution.source?.executionApprovalId === "string" && execution.source.executionApprovalId.length > 0,
      value: execution.source?.executionApprovalId ?? null
    },
    {
      name: "has_plan_id",
      ok: typeof execution.source?.planId === "string" && execution.source.planId.length > 0,
      value: execution.source?.planId ?? null
    },
    {
      name: "has_proposal_id",
      ok: typeof execution.source?.proposalId === "string" && execution.source.proposalId.length > 0,
      value: execution.source?.proposalId ?? null
    },
    {
      name: "has_command_id",
      ok: typeof execution.command?.commandId === "string" && execution.command.commandId.length > 0,
      value: execution.command?.commandId ?? null
    },
    {
      name: "has_command_line",
      ok: typeof execution.command?.commandLine === "string" && execution.command.commandLine.length > 0,
      value: execution.command?.commandLine ?? null
    },
    {
      name: "cwd_is_naye_core",
      ok: execution.command?.cwd === "F:/NayeVault/naye-core",
      value: execution.command?.cwd ?? null
    },
    {
      name: "controlled_executor_true",
      ok: execution.safety?.controlledExecutor === true,
      value: execution.safety?.controlledExecutor
    },
    {
      name: "cannot_execute_without_approval",
      ok: execution.safety?.canExecuteWithoutApproval === false,
      value: execution.safety?.canExecuteWithoutApproval
    },
    {
      name: "final_executor_gate_required",
      ok: execution.safety?.finalExecutorGateRequired === true,
      value: execution.safety?.finalExecutorGateRequired
    },
    {
      name: "final_executor_gate_passed",
      ok: execution.safety?.finalExecutorGatePassed === true,
      value: execution.safety?.finalExecutorGatePassed
    },
    {
      name: "credential_access_blocked",
      ok: execution.safety?.allowCredentialAccess === false,
      value: execution.safety?.allowCredentialAccess
    },
    {
      name: "cookies_blocked",
      ok: execution.safety?.allowCookies === false,
      value: execution.safety?.allowCookies
    },
    {
      name: "tokens_blocked",
      ok: execution.safety?.allowTokens === false,
      value: execution.safety?.allowTokens
    },
    {
      name: "browser_profiles_blocked",
      ok: execution.safety?.allowBrowserProfiles === false,
      value: execution.safety?.allowBrowserProfiles
    },
    {
      name: "whatsapp_data_blocked",
      ok: execution.safety?.allowWhatsAppData === false,
      value: execution.safety?.allowWhatsAppData
    },
    {
      name: "has_exit_code_or_error",
      ok: typeof execution.result?.exitCode === "number" || typeof execution.result?.error === "string",
      value: execution.result?.exitCode ?? execution.result?.error ?? null
    }
  ];

  return {
    ok: checks.every(check => check.ok),
    filePath,
    executionId: execution.executionId ?? path.basename(filePath),
    status: execution.status ?? "missing_status",
    gateId: execution.source?.gateId ?? null,
    runId: execution.source?.runId ?? null,
    approvalId: execution.source?.executionApprovalId ?? null,
    planId: execution.source?.planId ?? null,
    proposalId: execution.source?.proposalId ?? null,
    commandId: execution.command?.commandId ?? null,
    commandLine: execution.command?.commandLine ?? null,
    exitCode: execution.result?.exitCode ?? null,
    error: execution.result?.error ?? null,
    checks
  };
}

function main() {
  ensureDir(EXECUTIONS_DIR);

  const files = listJsonFiles(EXECUTIONS_DIR);
  const executions = files.map(inspectExecution);
  const unsafe = executions.filter(execution => !execution.ok);
  const completed = executions.filter(execution => execution.status === "real_execution_completed");
  const failed = executions.filter(execution => execution.status === "real_execution_failed");

  console.log("");
  console.log("Naye OpenClaw Controlled Executions Status");
  console.log("------------------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Controlled executions:", EXECUTIONS_DIR);

  console.log("");
  console.log("Ejecuciones encontradas");
  console.log("-----------------------");

  if (!executions.length) {
    console.log("(vacío)");
  }

  for (const execution of executions) {
    console.log("");
    console.log(`[${execution.ok ? "OK" : "REVISAR"}] ${execution.executionId}`);
    console.log("Archivo:", execution.filePath);
    console.log("Estado:", execution.status);
    console.log("Gate ID:", execution.gateId);
    console.log("Run ID:", execution.runId);
    console.log("Approval ID:", execution.approvalId);
    console.log("Plan ID:", execution.planId);
    console.log("Proposal ID:", execution.proposalId);
    console.log("Command ID:", execution.commandId);
    console.log("Command:", execution.commandLine);
    console.log("Exit code:", execution.exitCode);
    console.log("Error:", execution.error);

    for (const check of execution.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Ejecuciones totales:", executions.length);
  console.log("Ejecuciones completadas:", completed.length);
  console.log("Ejecuciones fallidas auditadas:", failed.length);
  console.log("Ejecuciones seguras:", executions.filter(execution => execution.ok).length);
  console.log("Ejecuciones por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
