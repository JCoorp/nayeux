import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const GATES_DIR = path.join(RUNTIME_ROOT, "final-executor-gates");

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

function inspectGate(filePath) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      gateId: path.basename(filePath),
      status: "invalid_json",
      error: parsed.error,
      checks: []
    };
  }

  const gate = parsed.data;

  const checks = [
    {
      name: "mode_controlled_real_execution_gate",
      ok: gate.mode === "controlled_real_execution_gate",
      value: gate.mode
    },
    {
      name: "status_valid_executor_not_enabled",
      ok: gate.status === "final_gate_valid_executor_not_enabled",
      value: gate.status
    },
    {
      name: "run_valid",
      ok: gate.validation?.runValid === true,
      value: gate.validation?.runValid
    },
    {
      name: "policy_valid",
      ok: gate.validation?.policyValid === true,
      value: gate.validation?.policyValid
    },
    {
      name: "command_allowed_by_policy",
      ok: gate.validation?.commandAllowedByPolicy === true,
      value: gate.validation?.commandAllowedByPolicy
    },
    {
      name: "validation_errors_empty",
      ok: Array.isArray(gate.validation?.errors) && gate.validation.errors.length === 0,
      value: Array.isArray(gate.validation?.errors) ? gate.validation.errors.length : null
    },
    {
      name: "executor_not_implemented",
      ok: gate.executor?.executorImplemented === false,
      value: gate.executor?.executorImplemented
    },
    {
      name: "real_execution_not_enabled",
      ok: gate.executor?.realExecutionEnabled === false,
      value: gate.executor?.realExecutionEnabled
    },
    {
      name: "cannot_proceed_to_real_executor_yet",
      ok: gate.executor?.canProceedToRealExecutor === false,
      value: gate.executor?.canProceedToRealExecutor
    },
    {
      name: "cannot_execute_without_approval",
      ok: gate.safety?.canExecuteWithoutApproval === false,
      value: gate.safety?.canExecuteWithoutApproval
    },
    {
      name: "credential_access_blocked",
      ok: gate.safety?.allowCredentialAccess === false,
      value: gate.safety?.allowCredentialAccess
    },
    {
      name: "cookies_blocked",
      ok: gate.safety?.allowCookies === false,
      value: gate.safety?.allowCookies
    },
    {
      name: "tokens_blocked",
      ok: gate.safety?.allowTokens === false,
      value: gate.safety?.allowTokens
    },
    {
      name: "browser_profiles_blocked",
      ok: gate.safety?.allowBrowserProfiles === false,
      value: gate.safety?.allowBrowserProfiles
    },
    {
      name: "whatsapp_data_blocked",
      ok: gate.safety?.allowWhatsAppData === false,
      value: gate.safety?.allowWhatsAppData
    },
    {
      name: "audit_log_required",
      ok: gate.safety?.requiresAuditLog === true,
      value: gate.safety?.requiresAuditLog
    },
    {
      name: "result_success",
      ok: gate.result?.success === true,
      value: gate.result?.success
    },
    {
      name: "has_run_id",
      ok: typeof gate.source?.runId === "string" && gate.source.runId.length > 0,
      value: gate.source?.runId ?? null
    },
    {
      name: "has_execution_approval_id",
      ok: typeof gate.source?.executionApprovalId === "string" && gate.source.executionApprovalId.length > 0,
      value: gate.source?.executionApprovalId ?? null
    },
    {
      name: "has_plan_id",
      ok: typeof gate.source?.planId === "string" && gate.source.planId.length > 0,
      value: gate.source?.planId ?? null
    },
    {
      name: "has_proposal_id",
      ok: typeof gate.source?.proposalId === "string" && gate.source.proposalId.length > 0,
      value: gate.source?.proposalId ?? null
    },
    {
      name: "has_requested_command",
      ok: Array.isArray(gate.requestedCommand?.command) && gate.requestedCommand.command.length > 0,
      value: Array.isArray(gate.requestedCommand?.command) ? gate.requestedCommand.command.join(" ") : null
    }
  ];

  return {
    ok: checks.every(check => check.ok),
    filePath,
    gateId: gate.gateId ?? path.basename(filePath),
    status: gate.status ?? "missing_status",
    runId: gate.source?.runId ?? null,
    approvalId: gate.source?.executionApprovalId ?? null,
    planId: gate.source?.planId ?? null,
    proposalId: gate.source?.proposalId ?? null,
    commandId: gate.requestedCommand?.commandId ?? null,
    command: Array.isArray(gate.requestedCommand?.command) ? gate.requestedCommand.command.join(" ") : null,
    canProceedToRealExecutor: gate.executor?.canProceedToRealExecutor,
    error: null,
    checks
  };
}

function main() {
  ensureDir(GATES_DIR);

  const files = listJsonFiles(GATES_DIR);
  const gates = files.map(inspectGate);
  const unsafe = gates.filter(gate => !gate.ok);

  console.log("");
  console.log("Naye OpenClaw Final Executor Gates Status");
  console.log("-----------------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Final executor gates:", GATES_DIR);

  console.log("");
  console.log("Compuertas encontradas");
  console.log("----------------------");

  if (!gates.length) {
    console.log("(vacío)");
  }

  for (const gate of gates) {
    console.log("");
    console.log(`[${gate.ok ? "OK" : "REVISAR"}] ${gate.gateId}`);
    console.log("Archivo:", gate.filePath);
    console.log("Estado:", gate.status);
    console.log("Run ID:", gate.runId);
    console.log("Approval ID:", gate.approvalId);
    console.log("Plan ID:", gate.planId);
    console.log("Proposal ID:", gate.proposalId);
    console.log("Command ID:", gate.commandId);
    console.log("Command:", gate.command);
    console.log("Puede pasar al ejecutor real:", gate.canProceedToRealExecutor);

    if (gate.error) {
      console.log("Error:", gate.error);
    }

    for (const check of gate.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Compuertas totales:", gates.length);
  console.log("Compuertas seguras:", gates.filter(gate => gate.ok).length);
  console.log("Compuertas por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
