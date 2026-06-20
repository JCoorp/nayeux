import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const PROPOSALS_DIR = path.join(RUNTIME_ROOT, "proposals");
const APPROVED_DIR = path.join(RUNTIME_ROOT, "approved-actions");
const REJECTED_DIR = path.join(RUNTIME_ROOT, "rejected-actions");

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

function inspectProposal(filePath, bucket) {
  const parsed = readJsonSafe(filePath);

  if (!parsed.ok) {
    return {
      ok: false,
      bucket,
      filePath,
      proposalId: path.basename(filePath),
      status: "invalid_json",
      executionAllowed: null,
      requiresApproval: null,
      sensitiveIndicators: [],
      error: parsed.error
    };
  }

  const proposal = parsed.data;
  const executionAllowed = proposal.execution?.allowed;
  const executed = proposal.execution?.executed;
  const requiresApproval = proposal.safety?.requiresApproval;
  const canExecuteWithoutApproval = proposal.safety?.canExecuteWithoutApproval;
  const sensitiveIndicators = proposal.safety?.sensitiveIndicators ?? [];

  let safe = true;

  if (bucket === "pending") {
    safe = safe &&
      proposal.status === "proposed_not_approved" &&
      executionAllowed === false &&
      executed === false &&
      requiresApproval === true &&
      canExecuteWithoutApproval === false &&
      proposal.review?.approved === false &&
      proposal.review?.rejected === false;
  }

  if (bucket === "approved") {
    safe = safe &&
      requiresApproval === true &&
      canExecuteWithoutApproval === false;
  }

  if (bucket === "rejected") {
    safe = safe &&
      proposal.review?.rejected === true;
  }

  return {
    ok: safe,
    bucket,
    filePath,
    proposalId: proposal.proposalId ?? path.basename(filePath),
    status: proposal.status ?? "missing_status",
    executionAllowed,
    executed,
    requiresApproval,
    canExecuteWithoutApproval,
    sensitiveIndicators,
    error: null
  };
}

function printGroup(title, results) {
  console.log("");
  console.log(title);
  console.log("-".repeat(title.length));

  if (!results.length) {
    console.log("(vacío)");
    return;
  }

  for (const item of results) {
    console.log("");
    console.log(`[${item.ok ? "OK" : "REVISAR"}] ${item.proposalId}`);
    console.log("Archivo:", item.filePath);
    console.log("Estado:", item.status);
    console.log("Ejecución permitida:", item.executionAllowed);
    console.log("Ejecutada:", item.executed);
    console.log("Requiere aprobación:", item.requiresApproval);
    console.log("Puede ejecutar sin aprobación:", item.canExecuteWithoutApproval);
    console.log(
      "Indicadores sensibles:",
      item.sensitiveIndicators.length ? item.sensitiveIndicators.join(", ") : "ninguno"
    );

    if (item.error) {
      console.log("Error:", item.error);
    }
  }
}

function main() {
  ensureDir(PROPOSALS_DIR);
  ensureDir(APPROVED_DIR);
  ensureDir(REJECTED_DIR);

  const pending = listJsonFiles(PROPOSALS_DIR).map(file => inspectProposal(file, "pending"));
  const approved = listJsonFiles(APPROVED_DIR).map(file => inspectProposal(file, "approved"));
  const rejected = listJsonFiles(REJECTED_DIR).map(file => inspectProposal(file, "rejected"));

  const all = [...pending, ...approved, ...rejected];
  const unsafe = all.filter(item => !item.ok);

  console.log("");
  console.log("Naye OpenClaw Proposals Status");
  console.log("------------------------------");
  console.log("Runtime:", RUNTIME_ROOT);
  console.log("Pendientes:", PROPOSALS_DIR);
  console.log("Aprobadas:", APPROVED_DIR);
  console.log("Rechazadas:", REJECTED_DIR);

  printGroup("Propuestas pendientes", pending);
  printGroup("Acciones aprobadas", approved);
  printGroup("Acciones rechazadas", rejected);

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Pendientes:", pending.length);
  console.log("Aprobadas:", approved.length);
  console.log("Rechazadas:", rejected.length);
  console.log("Total:", all.length);
  console.log("Por revisar:", unsafe.length);
  console.log("Estado:", unsafe.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafe.length > 0) {
    process.exit(1);
  }
}

main();
