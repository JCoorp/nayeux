import fs from "fs";
import path from "path";

const PROPOSALS_DIR = path.resolve("F:/NayeVault/openclaw/fresh/runtime/proposals");
const APPROVED_DIR = path.resolve("F:/NayeVault/openclaw/fresh/runtime/approved-actions");
const REJECTED_DIR = path.resolve("F:/NayeVault/openclaw/fresh/runtime/rejected-actions");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFile(date = new Date()) {
  return date.toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function detectSensitiveIndicators(text) {
  const patterns = [
    { key: "file_delete", pattern: /\b(delete|borrar|remove|rm|del)\b/i },
    { key: "file_modify", pattern: /\b(modify|modificar|editar|write|set-content|add-content)\b/i },
    { key: "install_package", pattern: /\b(npm install|pip install|winget install|choco install)\b/i },
    { key: "shell_command", pattern: /\b(powershell|cmd|bash|terminal|comando|script)\b/i },
    { key: "network", pattern: /\b(internet|http|https|curl|wget|api|request|red)\b/i },
    { key: "credentials", pattern: /\b(password|contraseña|token|cookie|secret|credential|credencial)\b/i },
    { key: "git_operation", pattern: /\b(git push|git reset|git clean|git checkout|commit|branch)\b/i }
  ];

  return patterns
    .filter(item => item.pattern.test(text))
    .map(item => item.key);
}

function main() {
  ensureDir(PROPOSALS_DIR);
  ensureDir(APPROVED_DIR);
  ensureDir(REJECTED_DIR);

  const request = process.argv.slice(2).join(" ").trim();

  if (!request) {
    console.log("");
    console.log("Uso:");
    console.log('npm run openclaw-propose -- "describe la acción que quieres que OpenClaw prepare"');
    console.log("");
    process.exit(1);
  }

  const now = new Date();
  const proposalId = `openclaw-proposal-${timestampForFile(now)}`;
  const sensitiveIndicators = detectSensitiveIndicators(request);

  const proposal = {
    proposalId,
    createdAt: now.toISOString(),
    createdBy: "Naye Core CLI",
    agentId: "naye-ops",
    status: "proposed_not_approved",
    request: {
      raw: request
    },
    execution: {
      allowed: false,
      executed: false,
      command: null,
      reason: "Las propuestas no ejecutan acciones. Requieren aprobación explícita."
    },
    safety: {
      requiresApproval: true,
      canExecuteWithoutApproval: false,
      operationalConnection: false,
      allowNetwork: false,
      allowExternalProviders: false,
      allowFileModification: false,
      allowCredentialAccess: false,
      allowLegacyData: false,
      sensitiveIndicators
    },
    review: {
      approved: false,
      rejected: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null
    },
    nextStep: "Revisar la propuesta. Si es correcta, moverla al flujo de aprobación controlada."
  };

  const filePath = path.join(PROPOSALS_DIR, `${proposalId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2), "utf8");

  console.log("");
  console.log("OpenClaw Proposal Created");
  console.log("-------------------------");
  console.log("Proposal ID:", proposalId);
  console.log("Archivo:", filePath);
  console.log("Estado:", proposal.status);
  console.log("Ejecución permitida:", proposal.execution.allowed);
  console.log("Requiere aprobación:", proposal.safety.requiresApproval);
  console.log("Indicadores sensibles:", sensitiveIndicators.length ? sensitiveIndicators.join(", ") : "ninguno");
  console.log("");
}

main();
