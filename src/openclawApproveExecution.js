import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const PLANS_DIR = path.join(RUNTIME_ROOT, "execution-plans");
const APPROVALS_DIR = path.join(RUNTIME_ROOT, "execution-approvals");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFile(date = new Date()) {
  return date.toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function listPlanFiles() {
  ensureDir(PLANS_DIR);

  return fs.readdirSync(PLANS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(PLANS_DIR, entry.name))
    .sort();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function resolvePlanFile(target) {
  const files = listPlanFiles();

  if (!files.length) {
    throw new Error("No hay planes de ejecución disponibles.");
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
    throw new Error(`No se encontró el plan de ejecución: ${target}`);
  }

  return found;
}

function validatePlan(plan) {
  const errors = [];

  if (plan.status !== "planned_not_executable") {
    errors.push(`status inválido: ${plan.status}`);
  }

  if (plan.execution?.allowed !== false) {
    errors.push("execution.allowed debe ser false");
  }

  if (plan.execution?.executed !== false) {
    errors.push("execution.executed debe ser false");
  }

  if (plan.execution?.executorEnabled !== false) {
    errors.push("execution.executorEnabled debe ser false");
  }

  if (plan.approvalGate?.executionApprovalRequired !== true) {
    errors.push("approvalGate.executionApprovalRequired debe ser true");
  }

  if (plan.approvalGate?.executionApproved !== false) {
    errors.push("approvalGate.executionApproved debe ser false antes de crear esta aprobación");
  }

  if (plan.safety?.canExecuteWithoutApproval !== false) {
    errors.push("safety.canExecuteWithoutApproval debe ser false");
  }

  if (plan.safety?.requiresManualReview !== true) {
    errors.push("safety.requiresManualReview debe ser true");
  }

  return errors;
}

function main() {
  ensureDir(PLANS_DIR);
  ensureDir(APPROVALS_DIR);

  const [target, ...noteParts] = process.argv.slice(2);
  const note = noteParts.join(" ").trim() || "Aprobación específica de ejecución registrada por Usuario Administrador designado.";

  if (!target) {
    console.log("");
    console.log("Uso:");
    console.log('npm run openclaw-approve-execution -- --latest "nota de aprobación"');
    console.log("o:");
    console.log('npm run openclaw-approve-execution -- openclaw-execution-plan-YYYY "nota de aprobación"');
    console.log("");
    process.exit(1);
  }

  const planPath = resolvePlanFile(target);
  const plan = readJson(planPath);
  const validationErrors = validatePlan(plan);

  if (validationErrors.length) {
    console.log("");
    console.log("No se puede aprobar la ejecución.");
    console.log("---------------------------------");
    for (const error of validationErrors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  const now = new Date();

  const approval = {
    executionApprovalId: `openclaw-execution-approval-${timestampForFile(now)}`,
    createdAt: now.toISOString(),
    createdBy: "Usuario Administrador designado",
    status: "execution_approved_executor_disabled",
    source: {
      planId: plan.planId,
      planFile: planPath,
      proposalId: plan.source?.proposalId ?? null,
      approvedActionFile: plan.source?.approvedActionFile ?? null
    },
    decision: {
      executionApproved: true,
      approvalNote: note,
      approvedAt: now.toISOString()
    },
    execution: {
      allowed: false,
      executed: false,
      executorEnabled: false,
      reason: "La ejecución fue aprobada formalmente, pero el ejecutor todavía está deshabilitado."
    },
    safety: {
      canExecuteWithoutApproval: false,
      allowNetwork: false,
      allowExternalProviders: false,
      allowFileModification: false,
      allowCredentialAccess: false,
      allowLegacyData: false,
      requiresFinalExecutorGate: true
    },
    nextStep: "Crear un ejecutor controlado que solo pueda operar si existe esta aprobación y si sus permisos siguen bloqueados por defecto."
  };

  const approvalPath = path.join(APPROVALS_DIR, `${approval.executionApprovalId}.json`);
  fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2), "utf8");

  console.log("");
  console.log("OpenClaw Execution Approval Created");
  console.log("-----------------------------------");
  console.log("Approval ID:", approval.executionApprovalId);
  console.log("Plan ID:", approval.source.planId);
  console.log("Proposal ID:", approval.source.proposalId);
  console.log("Archivo:", approvalPath);
  console.log("Estado:", approval.status);
  console.log("Ejecución aprobada:", approval.decision.executionApproved);
  console.log("Ejecución permitida:", approval.execution.allowed);
  console.log("Ejecutor habilitado:", approval.execution.executorEnabled);
  console.log("Ejecutado:", approval.execution.executed);
  console.log("Nota:", approval.decision.approvalNote);
  console.log("");
}

main();
