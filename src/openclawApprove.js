import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const PROPOSALS_DIR = path.join(RUNTIME_ROOT, "proposals");
const APPROVED_DIR = path.join(RUNTIME_ROOT, "approved-actions");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listProposalFiles() {
  ensureDir(PROPOSALS_DIR);

  return fs.readdirSync(PROPOSALS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(PROPOSALS_DIR, entry.name))
    .sort();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function resolveProposalFile(target) {
  const files = listProposalFiles();

  if (!files.length) {
    throw new Error("No hay propuestas pendientes.");
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
    throw new Error(`No se encontró la propuesta pendiente: ${target}`);
  }

  return found;
}

function validatePendingProposal(proposal) {
  const errors = [];

  if (proposal.status !== "proposed_not_approved") {
    errors.push(`status inválido: ${proposal.status}`);
  }

  if (proposal.execution?.allowed !== false) {
    errors.push("execution.allowed debe ser false");
  }

  if (proposal.execution?.executed !== false) {
    errors.push("execution.executed debe ser false");
  }

  if (proposal.safety?.requiresApproval !== true) {
    errors.push("safety.requiresApproval debe ser true");
  }

  if (proposal.safety?.canExecuteWithoutApproval !== false) {
    errors.push("safety.canExecuteWithoutApproval debe ser false");
  }

  if (proposal.review?.approved !== false) {
    errors.push("review.approved debe ser false");
  }

  if (proposal.review?.rejected !== false) {
    errors.push("review.rejected debe ser false");
  }

  return errors;
}

function main() {
  ensureDir(PROPOSALS_DIR);
  ensureDir(APPROVED_DIR);

  const [target, ...noteParts] = process.argv.slice(2);
  const note = noteParts.join(" ").trim() || "Aprobada por Usuario Administrador designado.";

  if (!target) {
    console.log("");
    console.log("Uso:");
    console.log('npm run openclaw-approve -- --latest "nota de aprobación"');
    console.log("o:");
    console.log('npm run openclaw-approve -- openclaw-proposal-YYYY "nota de aprobación"');
    console.log("");
    process.exit(1);
  }

  const sourcePath = resolveProposalFile(target);
  const proposal = readJson(sourcePath);

  const validationErrors = validatePendingProposal(proposal);

  if (validationErrors.length) {
    console.log("");
    console.log("No se puede aprobar la propuesta.");
    console.log("--------------------------------");
    for (const error of validationErrors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  const now = new Date();

  const approvedProposal = {
    ...proposal,
    status: "approved_not_executed",
    approvedAt: now.toISOString(),
    execution: {
      ...proposal.execution,
      allowed: false,
      executed: false,
      reason: "La propuesta fue aprobada para revisión de ejecución futura, pero este comando no ejecuta acciones."
    },
    review: {
      ...proposal.review,
      approved: true,
      rejected: false,
      reviewedBy: "Usuario Administrador designado",
      reviewedAt: now.toISOString(),
      reviewNotes: note
    }
  };

  const targetPath = path.join(APPROVED_DIR, path.basename(sourcePath));
  fs.writeFileSync(targetPath, JSON.stringify(approvedProposal, null, 2), "utf8");
  fs.unlinkSync(sourcePath);

  console.log("");
  console.log("OpenClaw Proposal Approved");
  console.log("--------------------------");
  console.log("Proposal ID:", approvedProposal.proposalId);
  console.log("Origen:", sourcePath);
  console.log("Destino:", targetPath);
  console.log("Estado:", approvedProposal.status);
  console.log("Ejecución permitida:", approvedProposal.execution.allowed);
  console.log("Ejecutada:", approvedProposal.execution.executed);
  console.log("Revisado por:", approvedProposal.review.reviewedBy);
  console.log("Nota:", approvedProposal.review.reviewNotes);
  console.log("");
}

main();
