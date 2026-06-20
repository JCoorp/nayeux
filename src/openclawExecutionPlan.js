import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const APPROVED_DIR = path.join(RUNTIME_ROOT, "approved-actions");
const PLANS_DIR = path.join(RUNTIME_ROOT, "execution-plans");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFile(date = new Date()) {
  return date.toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function listApprovedFiles() {
  ensureDir(APPROVED_DIR);

  return fs.readdirSync(APPROVED_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(APPROVED_DIR, entry.name))
    .sort();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function resolveApprovedFile(target) {
  const files = listApprovedFiles();

  if (!files.length) {
    throw new Error("No hay acciones aprobadas para crear plan de ejecución.");
  }

  if (target === "--latest") {
    return files[files.length - 1];
  }

  const normalizedTarget = target.endsWith(".json") ? target : `${target}.json`;

  const found = files.find(file =>
    path.basename(file) === normalizedTarget ||
    path.basename(file, ".json") === target
  );

  if (!found) {
    throw new Error(`No se encontró la acción aprobada: ${target}`);
  }

  return found;
}

function validateApprovedAction(action) {
  const errors = [];

  if (action.status !== "approved_not_executed") {
    errors.push(`status inválido: ${action.status}`);
  }

  if (action.review?.approved !== true) {
    errors.push("review.approved debe ser true");
  }

  if (action.review?.rejected !== false) {
    errors.push("review.rejected debe ser false");
  }

  if (action.execution?.allowed !== false) {
    errors.push("execution.allowed debe permanecer false");
  }

  if (action.execution?.executed !== false) {
    errors.push("execution.executed debe ser false");
  }

  if (action.safety?.requiresApproval !== true) {
    errors.push("safety.requiresApproval debe ser true");
  }

  if (action.safety?.canExecuteWithoutApproval !== false) {
    errors.push("safety.canExecuteWithoutApproval debe ser false");
  }

  return errors;
}

function inferRiskLevel(sensitiveIndicators = []) {
  const highRisk = [
    "credentials",
    "network",
    "install_package",
    "file_delete",
    "git_operation"
  ];

  const mediumRisk = [
    "file_modify",
    "shell_command"
  ];

  if (sensitiveIndicators.some(indicator => highRisk.includes(indicator))) {
    return "high";
  }

  if (sensitiveIndicators.some(indicator => mediumRisk.includes(indicator))) {
    return "medium";
  }

  return "low";
}

function createExecutionPlan(action, sourcePath) {
  const now = new Date();
  const sensitiveIndicators = action.safety?.sensitiveIndicators ?? [];
  const riskLevel = inferRiskLevel(sensitiveIndicators);

  return {
    planId: `openclaw-execution-plan-${timestampForFile(now)}`,
    createdAt: now.toISOString(),
    createdBy: "Naye Core CLI",
    agentId: action.agentId ?? "naye-ops",
    source: {
      proposalId: action.proposalId,
      approvedActionFile: sourcePath,
      originalStatus: action.status,
      approvedAt: action.approvedAt ?? null,
      reviewedBy: action.review?.reviewedBy ?? null,
      reviewNotes: action.review?.reviewNotes ?? null
    },
    status: "planned_not_executable",
    originalRequest: action.request?.raw ?? null,
    risk: {
      level: riskLevel,
      sensitiveIndicators,
      requiresExtraReview: riskLevel !== "low"
    },
    plannedScope: {
      summary: "Plan generado desde una acción aprobada. No ejecuta cambios.",
      intendedOutcome: action.request?.raw ?? "Sin descripción original.",
      filesToRead: [],
      filesToModify: [],
      commandsToRun: [],
      externalServices: [],
      networkAccessRequired: false,
      credentialAccessRequired: false
    },
    execution: {
      allowed: false,
      executed: false,
      executorEnabled: false,
      reason: "Este plan solo describe la posible ejecución. No tiene permiso para ejecutar comandos ni modificar archivos."
    },
    approvalGate: {
      proposalApproved: true,
      executionPlanCreated: true,
      executionApprovalRequired: true,
      executionApproved: false,
      approvedBy: null,
      approvedAt: null
    },
    safety: {
      canExecuteWithoutApproval: false,
      allowNetwork: false,
      allowExternalProviders: false,
      allowFileModification: false,
      allowCredentialAccess: false,
      allowLegacyData: false,
      requiresManualReview: true
    },
    recommendedManualReview: [
      "Confirmar que el objetivo de la acción aprobada sigue siendo válido.",
      "Definir explícitamente qué archivos se leerían.",
      "Definir explícitamente qué archivos se modificarían, si aplica.",
      "Definir comandos exactos antes de cualquier ejecución.",
      "Confirmar autorización del Usuario Administrador designado antes de ejecutar."
    ],
    nextStep: "Revisar este plan. Si es correcto, crear una aprobación específica de ejecución en una fase posterior."
  };
}

function main() {
  ensureDir(APPROVED_DIR);
  ensureDir(PLANS_DIR);

  const [target] = process.argv.slice(2);

  if (!target) {
    console.log("");
    console.log("Uso:");
    console.log('npm run openclaw-execution-plan -- --latest');
    console.log("o:");
    console.log('npm run openclaw-execution-plan -- openclaw-proposal-YYYY');
    console.log("");
    process.exit(1);
  }

  const sourcePath = resolveApprovedFile(target);
  const approvedAction = readJson(sourcePath);

  const validationErrors = validateApprovedAction(approvedAction);

  if (validationErrors.length) {
    console.log("");
    console.log("No se puede crear plan de ejecución.");
    console.log("-----------------------------------");
    for (const error of validationErrors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  const plan = createExecutionPlan(approvedAction, sourcePath);
  const planPath = path.join(PLANS_DIR, `${plan.planId}.json`);

  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");

  console.log("");
  console.log("OpenClaw Execution Plan Created");
  console.log("-------------------------------");
  console.log("Plan ID:", plan.planId);
  console.log("Proposal ID:", plan.source.proposalId);
  console.log("Archivo:", planPath);
  console.log("Estado:", plan.status);
  console.log("Riesgo:", plan.risk.level);
  console.log("Indicadores sensibles:", plan.risk.sensitiveIndicators.length ? plan.risk.sensitiveIndicators.join(", ") : "ninguno");
  console.log("Ejecución permitida:", plan.execution.allowed);
  console.log("Ejecutado:", plan.execution.executed);
  console.log("Requiere aprobación de ejecución:", plan.approvalGate.executionApprovalRequired);
  console.log("");
}

main();
