import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const APPROVALS_DIR = path.join(RUNTIME_ROOT, "execution-approvals");
const RUNS_DIR = path.join(RUNTIME_ROOT, "execution-runs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFile(date = new Date()) {
  return date.toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function listApprovalFiles() {
  ensureDir(APPROVALS_DIR);

  return fs.readdirSync(APPROVALS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(APPROVALS_DIR, entry.name))
    .sort();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function resolveApprovalFile(target) {
  const files = listApprovalFiles();

  if (!files.length) {
    throw new Error("No hay aprobaciones de ejecución disponibles.");
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
    throw new Error(`No se encontró la aprobación de ejecución: ${target}`);
  }

  return found;
}

function validateApproval(approval) {
  const errors = [];

  if (approval.status !== "execution_approved_executor_disabled") {
    errors.push(`status inválido: ${approval.status}`);
  }

  if (approval.decision?.executionApproved !== true) {
    errors.push("decision.executionApproved debe ser true");
  }

  if (approval.execution?.allowed !== false) {
    errors.push("execution.allowed debe seguir en false");
  }

  if (approval.execution?.executed !== false) {
    errors.push("execution.executed debe ser false");
  }

  if (approval.execution?.executorEnabled !== false) {
    errors.push("execution.executorEnabled debe seguir en false");
  }

  if (approval.safety?.requiresFinalExecutorGate !== true) {
    errors.push("safety.requiresFinalExecutorGate debe ser true");
  }

  return errors;
}

function main() {
  ensureDir(APPROVALS_DIR);
  ensureDir(RUNS_DIR);

  const [target] = process.argv.slice(2);

  if (!target) {
    console.log("");
    console.log("Uso:");
    console.log("npm run openclaw-execute-dry-run -- --latest");
    console.log("");
    process.exit(1);
  }

  const approvalPath = resolveApprovalFile(target);
  const approval = readJson(approvalPath);
  const validationErrors = validateApproval(approval);

  if (validationErrors.length) {
    console.log("");
    console.log("No se puede preparar dry-run.");
    console.log("-----------------------------");
    for (const error of validationErrors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  const now = new Date();

  const run = {
    runId: `openclaw-execution-run-${timestampForFile(now)}`,
    createdAt: now.toISOString(),
    createdBy: "Naye Core CLI",
    mode: "dry_run",
    status: "blocked_dry_run_not_executed",
    source: {
      executionApprovalId: approval.executionApprovalId,
      approvalFile: approvalPath,
      planId: approval.source?.planId ?? null,
      planFile: approval.source?.planFile ?? null,
      proposalId: approval.source?.proposalId ?? null,
      approvedActionFile: approval.source?.approvedActionFile ?? null
    },
    execution: {
      allowed: false,
      executed: false,
      executorEnabled: false,
      commandsExecuted: [],
      filesModified: [],
      reason: "Dry-run creado correctamente. No se ejecutaron comandos ni se modificaron archivos."
    },
    safety: {
      finalExecutorGatePassed: false,
      canExecuteWithoutApproval: false,
      allowNetwork: false,
      allowExternalProviders: false,
      allowFileModification: false,
      allowCredentialAccess: false,
      allowLegacyData: false
    },
    result: {
      success: true,
      message: "Cadena validada hasta dry-run. Ejecución real sigue bloqueada."
    },
    nextStep: "Crear validador de execution-runs y, después, un ejecutor controlado con lista blanca de acciones."
  };

  const runPath = path.join(RUNS_DIR, `${run.runId}.json`);
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2), "utf8");

  console.log("");
  console.log("OpenClaw Dry-Run Execution Created");
  console.log("----------------------------------");
  console.log("Run ID:", run.runId);
  console.log("Approval ID:", run.source.executionApprovalId);
  console.log("Plan ID:", run.source.planId);
  console.log("Proposal ID:", run.source.proposalId);
  console.log("Archivo:", runPath);
  console.log("Modo:", run.mode);
  console.log("Estado:", run.status);
  console.log("Ejecución permitida:", run.execution.allowed);
  console.log("Ejecutado:", run.execution.executed);
  console.log("Ejecutor habilitado:", run.execution.executorEnabled);
  console.log("Comandos ejecutados:", run.execution.commandsExecuted.length);
  console.log("Archivos modificados:", run.execution.filesModified.length);
  console.log("");
}

main();
