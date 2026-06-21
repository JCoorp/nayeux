import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const RUNTIME_ROOT = path.resolve("F:/NayeVault/openclaw/fresh/runtime");

const POLICY_PATH = path.join(ROOT, "config", "openclaw-execution-policy.config.json");
const GATES_DIR = path.join(RUNTIME_ROOT, "final-executor-gates");
const EXECUTIONS_DIR = path.join(RUNTIME_ROOT, "controlled-executions");

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

function resolveGateFile(target) {
  const files = listJsonFiles(GATES_DIR);

  if (!files.length) {
    throw new Error("No hay compuertas finales disponibles.");
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
    throw new Error(`No se encontró la compuerta final: ${target}`);
  }

  return found;
}

function findAllowedCommand(policy, commandId) {
  const commands = Array.isArray(policy.allowedCommands) ? policy.allowedCommands : [];
  return commands.find(command => command.commandId === commandId) ?? null;
}

function validateGate(gate) {
  const errors = [];

  if (gate.mode !== "controlled_real_execution_gate") {
    errors.push(`gate.mode inválido: ${gate.mode}`);
  }

  if (gate.status !== "final_gate_passed_ready_for_controlled_executor") {
    errors.push(`gate.status inválido para ejecución real: ${gate.status}`);
  }

  if (gate.validation?.runValid !== true) {
    errors.push("gate.validation.runValid debe ser true");
  }

  if (gate.validation?.policyValid !== true) {
    errors.push("gate.validation.policyValid debe ser true");
  }

  if (gate.validation?.commandAllowedByPolicy !== true) {
    errors.push("gate.validation.commandAllowedByPolicy debe ser true");
  }

  if (!Array.isArray(gate.validation?.errors) || gate.validation.errors.length !== 0) {
    errors.push("gate.validation.errors debe estar vacío");
  }

  if (gate.executor?.executorImplemented !== true) {
    errors.push("gate.executor.executorImplemented debe ser true");
  }

  if (gate.executor?.realExecutionEnabled !== true) {
    errors.push("gate.executor.realExecutionEnabled debe ser true");
  }

  if (gate.executor?.canProceedToRealExecutor !== true) {
    errors.push("gate.executor.canProceedToRealExecutor debe ser true");
  }

  if (gate.safety?.canExecuteWithoutApproval !== false) {
    errors.push("gate.safety.canExecuteWithoutApproval debe ser false");
  }

  if (gate.safety?.allowCredentialAccess !== false) {
    errors.push("Acceso a credenciales debe estar bloqueado");
  }

  if (gate.safety?.allowCookies !== false) {
    errors.push("Acceso a cookies debe estar bloqueado");
  }

  if (gate.safety?.allowTokens !== false) {
    errors.push("Acceso a tokens debe estar bloqueado");
  }

  if (gate.safety?.allowBrowserProfiles !== false) {
    errors.push("Acceso a perfiles de navegador debe estar bloqueado");
  }

  if (gate.safety?.allowWhatsAppData !== false) {
    errors.push("Acceso a WhatsApp debe estar bloqueado");
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

  if (policy.executorImplemented !== true) {
    errors.push("policy.executorImplemented debe ser true");
  }

  if (policy.realExecutionEnabled !== true) {
    errors.push("policy.realExecutionEnabled debe ser true");
  }

  if (policy.requirements?.requireFinalExecutorGate !== true) {
    errors.push("policy.requirements.requireFinalExecutorGate debe ser true");
  }

  if (policy.requirements?.requireAuditLog !== true) {
    errors.push("policy.requirements.requireAuditLog debe ser true");
  }

  return errors;
}

function validateCommand(policy, gate) {
  const errors = [];

  const commandId = gate.requestedCommand?.commandId;
  const commandParts = gate.requestedCommand?.command;

  if (typeof commandId !== "string" || commandId.length === 0) {
    errors.push("La compuerta no tiene commandId");
    return errors;
  }

  if (!Array.isArray(commandParts) || commandParts.length === 0) {
    errors.push("La compuerta no tiene comando ejecutable");
    return errors;
  }

  const commandPolicy = findAllowedCommand(policy, commandId);

  if (!commandPolicy) {
    errors.push(`No existe política para commandId=${commandId}`);
    return errors;
  }

  const [executable, ...args] = commandParts;

  if (executable !== commandPolicy.executable) {
    errors.push(`Ejecutable no permitido. Recibido=${executable}, permitido=${commandPolicy.executable}`);
  }

  if (commandPolicy.cwd !== "F:/NayeVault/naye-core") {
    errors.push("El cwd del comando debe ser F:/NayeVault/naye-core");
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

  return errors;
}

function quoteForCmd(arg) {
  if (/^[a-zA-Z0-9_\-.:/\\]+$/.test(arg)) {
    return arg;
  }

  return `"${String(arg).replace(/"/g, `\"`)}"`;
}

function resolveExecutable(commandParts) {
  const [executable, ...args] = commandParts;

  if (executable === "npm") {
    const npmCli = process.env.npm_execpath;

    if (!npmCli) {
      throw new Error("No se encontró process.env.npm_execpath para ejecutar npm sin shell.");
    }

    return {
      executableToRun: process.execPath,
      argsToRun: [npmCli, ...args]
    };
  }

  if (executable === "openclaw" && process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    const commandLine = [executable, ...args].map(quoteForCmd).join(" ");

    return {
      executableToRun: comspec,
      argsToRun: ["/d", "/s", "/c", commandLine]
    };
  }

  return {
    executableToRun: executable,
    argsToRun: args
  };
}

function main() {
  ensureDir(GATES_DIR);
  ensureDir(EXECUTIONS_DIR);

  const [targetGate] = process.argv.slice(2);

  if (!targetGate) {
    console.log("");
    console.log("Uso:");
    console.log("npm run openclaw-controlled-executor -- --latest");
    console.log("");
    process.exit(1);
  }

  const gatePath = resolveGateFile(targetGate);
  const gate = readJson(gatePath);
  const policy = readJson(POLICY_PATH);

  const gateErrors = validateGate(gate);
  const policyErrors = validatePolicy(policy);
  const commandErrors = validateCommand(policy, gate);

  const validationErrors = [
    ...gateErrors.map(error => `Gate: ${error}`),
    ...policyErrors.map(error => `Policy: ${error}`),
    ...commandErrors.map(error => `Command: ${error}`)
  ];

  if (validationErrors.length > 0) {
    console.log("");
    console.log("OpenClaw Controlled Executor — BLOQUEADO");
    console.log("----------------------------------------");
    for (const error of validationErrors) {
      console.log("[REVISAR]", error);
    }
    console.log("");
    process.exit(1);
  }

  const commandParts = gate.requestedCommand.command;
  const cwd = gate.requestedCommand.cwd ?? "F:/NayeVault/naye-core";

  const { executableToRun, argsToRun } = resolveExecutable(commandParts);

  const now = new Date();
  const executionId = `openclaw-controlled-execution-${timestampForFile(now)}`;

  console.log("");
  console.log("OpenClaw Controlled Executor");
  console.log("----------------------------");
  console.log("Execution ID:", executionId);
  console.log("Gate ID:", gate.gateId);
  console.log("Command:", commandParts.join(" "));
  console.log("CWD:", cwd);
  console.log("Ejecutando comando real controlado...");
  console.log("");

  const result = spawnSync(executableToRun, argsToRun, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 20
  });

  const execution = {
    executionId,
    createdAt: now.toISOString(),
    createdBy: "Naye Core CLI",
    mode: "controlled_real_execution",
    status: result.status === 0 ? "real_execution_completed" : "real_execution_failed",
    source: {
      gateId: gate.gateId,
      gateFile: gatePath,
      runId: gate.source?.runId ?? null,
      executionApprovalId: gate.source?.executionApprovalId ?? null,
      planId: gate.source?.planId ?? null,
      proposalId: gate.source?.proposalId ?? null
    },
    command: {
      commandId: gate.requestedCommand.commandId,
      executable: commandParts[0],
      args: commandParts.slice(1),
      commandLine: commandParts.join(" "),
      cwd
    },
    safety: {
      controlledExecutor: true,
      canExecuteWithoutApproval: false,
      finalExecutorGateRequired: true,
      finalExecutorGatePassed: true,
      allowCredentialAccess: false,
      allowCookies: false,
      allowTokens: false,
      allowBrowserProfiles: false,
      allowWhatsAppData: false
    },
    result: {
      exitCode: result.status,
      signal: result.signal,
      error: result.error?.message ?? null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    }
  };

  const executionPath = path.join(EXECUTIONS_DIR, `${execution.executionId}.json`);
  fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), "utf8");

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  if (result.error) {
    console.error("Process error:", result.error.message);
  }

  console.log("");
  console.log("OpenClaw Controlled Executor — Resultado");
  console.log("----------------------------------------");
  console.log("Estado:", execution.status);
  console.log("Exit code:", execution.result.exitCode);
  console.log("Archivo:", executionPath);
  console.log("");

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main();

