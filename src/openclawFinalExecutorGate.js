import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");

const POLICY_PATH = path.join(ROOT, "config", "openclaw-execution-policy.config.json");
const RUNS_DIR = path.join(RUNTIME_ROOT, "execution-runs");
const GATES_DIR = path.join(RUNTIME_ROOT, "final-executor-gates");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFile(date = new Date()) {
  return date.toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function listJsonFiles(dirPath) {
  ensureDir(dirPath);

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".json"))
    .map(entry => path.join(dirPath, entry.name))
    .sort();
}

function resolveRunFile(target) {
  const files = listJsonFiles(RUNS_DIR);

  if (!files.length) {
    throw new Error("No hay dry-runs disponibles.");
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
    throw new Error(`No se encontró el run: ${target}`);
  }

  return found;
}

function validateRun(run) {
  const errors = [];

  if (run.mode !== "dry_run") {
    errors.push(`run.mode inválido: ${run.mode}`);
  }

  if (run.status !== "blocked_dry_run_not_executed") {
    errors.push(`run.status inválido: ${run.status}`);
  }

  if (run.execution?.allowed !== false) {
    errors.push("run.execution.allowed debe ser false");
  }

  if (run.execution?.executed !== false) {
    errors.push("run.execution.executed debe ser false");
  }

  if (run.execution?.executorEnabled !== false) {
    errors.push("run.execution.executorEnabled debe ser false");
  }

  if (!Array.isArray(run.execution?.commandsExecuted) || run.execution.commandsExecuted.length !== 0) {
    errors.push("run.execution.commandsExecuted debe estar vacío");
  }

  if (!Array.isArray(run.execution?.filesModified) || run.execution.filesModified.length !== 0) {
    errors.push("run.execution.filesModified debe estar vacío");
  }

  if (run.safety?.finalExecutorGatePassed !== false) {
    errors.push("run.safety.finalExecutorGatePassed debe ser false antes de esta compuerta");
  }

  return errors;
}

function validatePolicy(policy) {
  const errors = [];

  if (policy.enabled !== true) {
    errors.push("policy.enabled debe ser true");
  }

  if (policy.mode !== "controlled_real_execution") {
    errors.push(`policy.mode inválido: ${policy.mode}`);
  }

  if (policy.policySupportsRealExecution !== true) {
    errors.push("policy.policySupportsRealExecution debe ser true");
  }

  if (policy.defaultAction !== "require_approval") {
    errors.push("policy.defaultAction debe ser require_approval");
  }

  if (policy.requirements?.requireFinalExecutorGate !== true) {
    errors.push("requirements.requireFinalExecutorGate debe ser true");
  }

  if (policy.blockedSensitiveAccess?.allowCredentialAccess !== false) {
    errors.push("El acceso a credenciales debe estar bloqueado");
  }

  if (policy.blockedSensitiveAccess?.allowCookies !== false) {
    errors.push("El acceso a cookies debe estar bloqueado");
  }

  if (policy.blockedSensitiveAccess?.allowTokens !== false) {
    errors.push("El acceso a tokens debe estar bloqueado");
  }

  if (policy.blockedSensitiveAccess?.allowBrowserProfiles !== false) {
    errors.push("El acceso a perfiles de navegador debe estar bloqueado");
  }

  if (policy.blockedSensitiveAccess?.allowWhatsAppData !== false) {
    errors.push("El acceso a WhatsApp debe estar bloqueado");
  }

  return errors;
}

function findAllowedCommand(policy, commandId) {
  const commands = Array.isArray(policy.allowedCommands) ? policy.allowedCommands : [];
  return commands.find(command => command.commandId === commandId) ?? null;
}

function validateCommandAgainstPolicy(commandPolicy, commandParts) {
  const errors = [];

  if (!commandPolicy) {
    errors.push("No existe política para ese commandId");
    return errors;
  }

  if (!Array.isArray(commandParts) || commandParts.length === 0) {
    errors.push("No se recibió comando real a evaluar");
    return errors;
  }

  const [executable, ...args] = commandParts;

  if (executable !== commandPolicy.executable) {
    errors.push(`Ejecutable no permitido. Recibido=${executable}, permitido=${commandPolicy.executable}`);
  }

  if (commandPolicy.cwd !== "F:/NayeVault/naye-core") {
    errors.push("El comando debe ejecutarse desde F:/NayeVault/naye-core");
  }

  if (commandPolicy.requiresAuditLog !== true) {
    errors.push("El comando debe requerir audit log");
  }

  if (Array.isArray(commandPolicy.allowedExactArgs)) {
    const expected = commandPolicy.allowedExactArgs.join(" ");
    const received = args.join(" ");

    if (expected !== received) {
      errors.push(`Argumentos exactos no permitidos. Recibido="${received}", permitido="${expected}"`);
    }
  }

  if (Array.isArray(commandPolicy.allowedArgsPrefix)) {
    const prefix = commandPolicy.allowedArgsPrefix;

    for (let index = 0; index < prefix.length; index += 1) {
      if (args[index] !== prefix[index]) {
        errors.push(`Prefijo de argumentos no permitido. Recibido="${args.join(" ")}", prefijo permitido="${prefix.join(" ")}"`);
        break;
      }
    }
  }

  if (commandPolicy.allowedPathPrefix) {
    const hasAllowedPath = commandParts.some(part => {
      const normalized = part.replace(/\\/g, "/");
      return normalized.startsWith(commandPolicy.allowedPathPrefix);
    });

    if (!hasAllowedPath) {
      errors.push(`El comando no apunta a una ruta permitida: ${commandPolicy.allowedPathPrefix}`);
    }
  }

  return errors;
}

function main() {
  ensureDir(RUNS_DIR);
  ensureDir(GATES_DIR);

  const [targetRun, commandId, ...commandParts] = process.argv.slice(2);

  if (!targetRun || !commandId || commandParts.length === 0) {
    console.log("");
    console.log("Uso:");
    console.log("npm run openclaw-final-executor-gate -- --latest npm_run npm run openclaw-status");
    console.log("");
    process.exit(1);
  }

  const runPath = resolveRunFile(targetRun);
  const run = readJson(runPath);
  const policy = readJson(POLICY_PATH);
  const commandPolicy = findAllowedCommand(policy, commandId);

  const runErrors = validateRun(run);
  const policyErrors = validatePolicy(policy);
  const commandErrors = validateCommandAgainstPolicy(commandPolicy, commandParts);

  const errors = [
    ...runErrors.map(error => `Run: ${error}`),
    ...policyErrors.map(error => `Policy: ${error}`),
    ...commandErrors.map(error => `Command: ${error}`)
  ];

  const executorImplemented = policy.executorImplemented === true;
  const realExecutionEnabled = policy.realExecutionEnabled === true;
  const canProceedToRealExecutor = errors.length === 0 && executorImplemented && realExecutionEnabled;

  const now = new Date();

  const gate = {
    gateId: `openclaw-final-executor-gate-${timestampForFile(now)}`,
    createdAt: now.toISOString(),
    createdBy: "Naye Core CLI",
    mode: "controlled_real_execution_gate",
    status: canProceedToRealExecutor
      ? "final_gate_passed_ready_for_controlled_executor"
      : "final_gate_valid_executor_not_enabled",
    source: {
      runId: run.runId ?? null,
      runFile: runPath,
      executionApprovalId: run.source?.executionApprovalId ?? null,
      planId: run.source?.planId ?? null,
      proposalId: run.source?.proposalId ?? null
    },
    requestedCommand: {
      commandId,
      command: commandParts,
      cwd: commandPolicy?.cwd ?? null
    },
    validation: {
      runValid: runErrors.length === 0,
      policyValid: policyErrors.length === 0,
      commandAllowedByPolicy: commandErrors.length === 0,
      errors
    },
    executor: {
      executorImplemented,
      realExecutionEnabled,
      canProceedToRealExecutor,
      reason: canProceedToRealExecutor
        ? "La compuerta permite pasar al ejecutor controlado."
        : "La compuerta validó la acción, pero el ejecutor real todavía no está implementado o no está habilitado."
    },
    safety: {
      canExecuteWithoutApproval: false,
      allowCredentialAccess: false,
      allowCookies: false,
      allowTokens: false,
      allowBrowserProfiles: false,
      allowWhatsAppData: false,
      requiresAuditLog: true
    },
    result: {
      success: errors.length === 0,
      message: errors.length === 0
        ? "La acción es compatible con la política de ejecución controlada."
        : "La acción no puede pasar la compuerta por errores de validación."
    }
  };

  const gatePath = path.join(GATES_DIR, `${gate.gateId}.json`);
  fs.writeFileSync(gatePath, JSON.stringify(gate, null, 2), "utf8");

  console.log("");
  console.log("OpenClaw Final Executor Gate");
  console.log("----------------------------");
  console.log("Gate ID:", gate.gateId);
  console.log("Estado:", gate.status);
  console.log("Run ID:", gate.source.runId);
  console.log("Approval ID:", gate.source.executionApprovalId);
  console.log("Plan ID:", gate.source.planId);
  console.log("Proposal ID:", gate.source.proposalId);
  console.log("Command ID:", gate.requestedCommand.commandId);
  console.log("Command:", gate.requestedCommand.command.join(" "));
  console.log("Run válido:", gate.validation.runValid);
  console.log("Política válida:", gate.validation.policyValid);
  console.log("Comando permitido por política:", gate.validation.commandAllowedByPolicy);
  console.log("Executor implementado:", gate.executor.executorImplemented);
  console.log("Ejecución real habilitada:", gate.executor.realExecutionEnabled);
  console.log("Puede pasar al ejecutor real:", gate.executor.canProceedToRealExecutor);
  console.log("Archivo:", gatePath);

  if (errors.length > 0) {
    console.log("");
    console.log("Errores");
    console.log("-------");
    for (const error of errors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  console.log("");
}

main();
