import fs from "fs";
import path from "path";

const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");
const PROPOSALS_DIR = path.join(RUNTIME_ROOT, "proposals");
const REJECTED_DIR = path.join(RUNTIME_ROOT, "rejected-actions");

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

function main() {
  ensureDir(PROPOSALS_DIR);
  ensureDir(REJECTED_DIR);

  const [target, ...noteParts] = process.argv.slice(2);
  const note = noteParts.join(" ").trim() || "Rechazada por Usuario Administrador designado.";

  if (!target) {
    console.log("");
    console.log("Uso:");
    console.log('npm run openclaw-reject -- --latest "nota de rechazo"');
    console.log("o:");
    console.log('npm run openclaw-reject -- openclaw-proposal-YYYY "nota de rechazo"');
    console.log("");
    process.exit(1);
  }

  const sourcePath = resolveProposalFile(target);
  const proposal = readJson(sourcePath);
  const now = new Date();

  const rejectedProposal = {
    ...proposal,
    status: "rejected",
    rejectedAt: now.toISOString(),
    execution: {
      ...proposal.execution,
      allowed: false,
      executed: false,
      reason: "La propuesta fue rechazada. No se permite ejecución."
    },
    review: {
      ...proposal.review,
      approved: false,
      rejected: true,
      reviewedBy: "Usuario Administrador designado",
      reviewedAt: now.toISOString(),
      reviewNotes: note
    }
  };

  const targetPath = path.join(REJECTED_DIR, path.basename(sourcePath));
  fs.writeFileSync(targetPath, JSON.stringify(rejectedProposal, null, 2), "utf8");
  fs.unlinkSync(sourcePath);

  console.log("");
  console.log("OpenClaw Proposal Rejected");
  console.log("--------------------------");
  console.log("Proposal ID:", rejectedProposal.proposalId);
  console.log("Origen:", sourcePath);
  console.log("Destino:", targetPath);
  console.log("Estado:", rejectedProposal.status);
  console.log("Ejecución permitida:", rejectedProposal.execution.allowed);
  console.log("Ejecutada:", rejectedProposal.execution.executed);
  console.log("Revisado por:", rejectedProposal.review.reviewedBy);
  console.log("Nota:", rejectedProposal.review.reviewNotes);
  console.log("");
}

main();
