import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const PLANS_DIR = path.join(RUNTIME_ROOT, "execution-plans");

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

function inspectPlan(filePath) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      planId: path.basename(filePath),
      status: "invalid_json",
      riskLevel: null,
      error: parsed.error,
      checks: []
    };
  }

  const plan = parsed.data;

  const checks = [
    {
      name: "status_planned_not_executable",
      ok: plan.status === "planned_not_executable",
      value: plan.status
    },
    {
      name: "execution_allowed_false",
      ok: plan.execution?.allowed === false,
      value: plan.execution?.allowed
    },
    {
      name: "execution_executed_false",
      ok: plan.execution?.executed === false,
      value: plan.execution?.executed
    },
    {
      name: "executor_enabled_false",
      ok: plan.execution?.executorEnabled === false,
      value: plan.execution?.executorEnabled
    },
    {
      name: "execution_approval_required",
      ok: plan.approvalGate?.executionApprovalRequired === true,
      value: plan.approvalGate?.executionApprovalRequired
    },
    {
      name: "execution_not_approved",
      ok: plan.approvalGate?.executionApproved === false,
      value: plan.approvalGate?.executionApproved
    },
    {
      name: "cannot_execute_without_approval",
      ok: plan.safety?.canExecuteWithoutApproval === false,
      value: plan.safety?.canExecuteWithoutApproval
    },
    {
      name: "network_disabled",
      ok: plan.safety?.allowNetwork === false,
      value: plan.safety?.allowNetwork
    },
    {
      name: "external_providers_disabled",
      ok: plan.safety?.allowExternalProviders === false,
      value: plan.safety?.allowExternalProviders
    },
    {
      name: "file_modification_disabled",
      ok: plan.safety?.allowFileModification === false,
      value: plan.safety?.allowFileModification
    },
    {
      name: "credential_access_disabled",
      ok: plan.safety?.allowCredentialAccess === false,
      value: plan.safety?.allowCredentialAccess
    },
    {
      name: "legacy_data_disabled",
      ok: plan.safety?.allowLegacyData === false,
      value: plan.safety?.allowLegacyData
    },
    {
      name: "manual_review_required",
      ok: plan.safety?.requiresManualReview === true,
      value: plan.safety?.requiresManualReview
    }
  ];

  return {
    ok: checks.every(check => check.ok),
    filePath,
    planId: plan.planId ?? path.basename(filePath),
    proposalId: plan.source?.proposalId ?? null,
    status: plan.status ?? "missing_status",
    riskLevel: plan.risk?.level ?? "unknown",
    sensitiveIndicators: plan.risk?.sensitiveIndicators ?? [],
    executionAllowed: plan.execution?.allowed,
    executed: plan.execution?.executed,
    executionApproved: plan.approvalGate?.executionApproved,
    error: null,
    checks
  };
}

function main() {
  ensureDir(PLANS_DIR);

  const files = listJsonFiles(PLANS_DIR);
  const plans = files.map(inspectPlan);
  const unsafe = plans.filter(plan => !plan.ok);

  console.log("");
  console.log("Naye OpenClaw Execution Plans Status");
  console.log("------------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Execution plans:", PLANS_DIR);

  console.log("");
  console.log("Planes encontrados");
  console.log("-------------------");

  if (!plans.length) {
    console.log("(vacío)");
  }

  for (const plan of plans) {
    console.log("");
    console.log(`[${plan.ok ? "OK" : "REVISAR"}] ${plan.planId}`);
    console.log("Archivo:", plan.filePath);
    console.log("Proposal ID:", plan.proposalId);
    console.log("Estado:", plan.status);
    console.log("Riesgo:", plan.riskLevel);
    console.log("Indicadores sensibles:", plan.sensitiveIndicators.length ? plan.sensitiveIndicators.join(", ") : "ninguno");
    console.log("Ejecución permitida:", plan.executionAllowed);
    console.log("Ejecutado:", plan.executed);
    console.log("Ejecución aprobada:", plan.executionApproved);

    if (plan.error) {
      console.log("Error:", plan.error);
    }

    for (const check of plan.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Planes totales:", plans.length);
  console.log("Planes seguros:", plans.filter(plan => plan.ok).length);
  console.log("Planes por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
