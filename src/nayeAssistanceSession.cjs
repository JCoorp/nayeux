const fs = require("fs");
const path = require("path");
const readline = require("readline");

const VAULT_ROOT = "F:/NayeVault";
const PROFILE_DIR = path.join(VAULT_ROOT, "devices", "nodes", "profiles");
const SESSION_ROOT = path.join(VAULT_ROOT, "devices", "nodes", "sessions");
const ACTIVE_DIR = path.join(SESSION_ROOT, "active");
const CLOSED_DIR = path.join(SESSION_ROOT, "closed");
const LOG_DIR = path.join(SESSION_ROOT, "logs");

function ensureDirs() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(ACTIVE_DIR, { recursive: true });
  fs.mkdirSync(CLOSED_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || "").trim()));
  });
}

function yesNo(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["si", "sí", "s", "yes", "y", "acepto", "autorizar", "autorizo"].includes(normalized);
}

function safeId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function latestProfilePath() {
  const files = fs.readdirSync(PROFILE_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(PROFILE_DIR, file);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (files.length === 0) {
    throw new Error("No hay perfiles de nodo. Ejecuta primero: npm run node-onboarding");
  }

  return files[0].fullPath;
}

function permissionCatalog() {
  return {
    screenView: {
      label: "ver pantalla",
      critical: false,
      reason: "para entender visualmente el error o la situación que estás viendo"
    },
    fileSearch: {
      label: "buscar archivos",
      critical: false,
      reason: "para localizar el archivo si no sabes exactamente dónde está"
    },
    fileRead: {
      label: "leer archivos autorizados",
      critical: false,
      reason: "para analizar el contenido del archivo y detectar el problema"
    },
    fileModify: {
      label: "modificar archivos autorizados",
      critical: false,
      requiresBackup: true,
      reason: "solo si después apruebas que aplique la corrección"
    },
    remoteControl: {
      label: "control remoto temporal",
      critical: false,
      reason: "solo si quieres que yo realice los pasos directamente por ti"
    },
    commandExecution: {
      label: "ejecutar comandos técnicos",
      critical: true,
      reason: "solo si el problema requiere diagnóstico técnico del sistema"
    },
    softwareInstall: {
      label: "instalar software o dependencias",
      critical: true,
      reason: "solo si hace falta instalar algo para resolver el problema"
    }
  };
}

function inferPermissionsFromProblem(problemText) {
  const text = String(problemText || "").toLowerCase();
  const permissions = new Set();

  const mentionsScreen =
    text.includes("pantalla") ||
    text.includes("error") ||
    text.includes("ventana") ||
    text.includes("mensaje") ||
    text.includes("no abre") ||
    text.includes("se ve") ||
    text.includes("sale");

  const mentionsFile =
    text.includes("archivo") ||
    text.includes("excel") ||
    text.includes("word") ||
    text.includes("pdf") ||
    text.includes("documento") ||
    text.includes("carpeta") ||
    text.includes("descargas") ||
    text.includes("escritorio");

  const mentionsSearch =
    text.includes("no se donde") ||
    text.includes("no sé dónde") ||
    text.includes("no encuentro") ||
    text.includes("buscar") ||
    text.includes("busca") ||
    text.includes("localizar");

  const mentionsModify =
    text.includes("corrige") ||
    text.includes("corregir") ||
    text.includes("arregla") ||
    text.includes("arreglar") ||
    text.includes("modifica") ||
    text.includes("modificar") ||
    text.includes("formula") ||
    text.includes("fórmula");

  const mentionsRemote =
    text.includes("hazlo") ||
    text.includes("resuelvelo") ||
    text.includes("resuélvelo") ||
    text.includes("control") ||
    text.includes("toma el control");

  const mentionsCommand =
    text.includes("npm") ||
    text.includes("terminal") ||
    text.includes("powershell") ||
    text.includes("comando") ||
    text.includes("servidor") ||
    text.includes("servicio") ||
    text.includes("puerto");

  const mentionsInstall =
    text.includes("instalar") ||
    text.includes("dependencia") ||
    text.includes("paquete") ||
    text.includes("driver");

  if (mentionsScreen) permissions.add("screenView");
  if (mentionsFile) permissions.add("fileRead");
  if (mentionsSearch || mentionsFile) permissions.add("fileSearch");
  if (mentionsModify) permissions.add("fileModify");
  if (mentionsRemote) permissions.add("remoteControl");
  if (mentionsCommand) permissions.add("commandExecution");
  if (mentionsInstall) permissions.add("softwareInstall");

  if (permissions.size === 0) {
    permissions.add("screenView");
  }

  return Array.from(permissions);
}

function canApprovePermission(profile, permissionKey) {
  const catalog = permissionCatalog();
  const permission = catalog[permissionKey];

  if (!permission) {
    return {
      allowed: false,
      reason: "Permiso desconocido."
    };
  }

  if (!permission.critical) {
    return {
      allowed: true,
      reason: "Permiso temporal no crítico permitido con autorización del usuario durante la sesión."
    };
  }

  if (profile.user?.canApproveCriticalActions === true) {
    return {
      allowed: true,
      reason: "El usuario puede aprobar acciones críticas."
    };
  }

  return {
    allowed: false,
    reason: "Este usuario no puede aprobar acciones críticas. Debe comunicarse con TI/Sistemas."
  };
}

function buildSession(profile, problemText, requestedPermissions, userApproved) {
  const catalog = permissionCatalog();
  const now = new Date().toISOString();
  const deviceAlias = profile.device?.alias || profile.device?.detectedHostname || "node";
  const sessionId = `naye-session-${safeId(deviceAlias)}-${now.replace(/[:.]/g, "-")}`;

  const approvedTemporaryPermissions = [];
  const blockedRequestedPermissions = [];

  for (const key of requestedPermissions) {
    const decision = canApprovePermission(profile, key);
    const item = {
      id: key,
      label: catalog[key].label,
      reason: catalog[key].reason,
      critical: catalog[key].critical === true,
      requiresBackup: catalog[key].requiresBackup === true,
      decisionReason: decision.reason
    };

    if (userApproved && decision.allowed) {
      approvedTemporaryPermissions.push(item);
    } else {
      blockedRequestedPermissions.push(item);
    }
  }

  return {
    system: "Naye Core",
    component: "Naye Assistance Session",
    version: "0.2.0",
    sessionId,
    status: userApproved ? "active" : "rejected",
    createdAt: now,
    expiresAt: userApproved ? new Date(Date.now() + 45 * 60 * 1000).toISOString() : null,
    durationPolicy: {
      userWasNotAskedForMinutes: true,
      defaultMaxMinutes: 45,
      closesOnUserCancelOrFinish: true,
      inactivityClosePending: true
    },
    user: {
      fullName: profile.user?.fullName || null,
      department: profile.user?.department || null,
      companyRole: profile.user?.companyRole || null,
      classificationId: profile.user?.classificationId || null,
      classificationLabel: profile.user?.classificationLabel || null,
      canApproveCriticalActions: profile.user?.canApproveCriticalActions === true
    },
    node: {
      deviceId: profile.device?.id || null,
      alias: deviceAlias,
      detectedHostname: profile.device?.detectedHostname || null
    },
    conversation: {
      userInitialRequest: "Oye Naye, tengo un problema.",
      userProblemDescription: problemText,
      nayeInferredPermissions: requestedPermissions
    },
    authorization: {
      userApprovedSession: userApproved,
      permissionsAreTemporary: true,
      permissionsEndWithSession: true,
      requiresNewAuthorizationForNewSession: true
    },
    approvedTemporaryPermissions,
    blockedRequestedPermissions,
    permanentBlocks: {
      cameraAlwaysBlocked: true,
      keyloggerAlwaysBlocked: true,
      hiddenAccessBlocked: true,
      credentialAccessAlwaysBlocked: true,
      passwordsAlwaysBlocked: true,
      tokensAlwaysBlocked: true,
      cookiesAlwaysBlocked: true,
      browserProfilesAlwaysBlocked: true,
      privateKeysAlwaysBlocked: true
    },
    audit: {
      createdBy: "naye-assistance-chat",
      noRealScreenAccessYet: true,
      noRealFileAccessYet: true,
      noRealRemoteControlYet: true,
      noRealCommandExecutionYet: true,
      note: "Esta versión simula el flujo conversacional y registra permisos temporales. La ejecución real se conectará después."
    }
  };
}

async function conversationalStart() {
  ensureDirs();

  const profilePath = latestProfilePath();
  const profile = readJson(profilePath);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("");
  console.log("Naye Assistance Chat");
  console.log("--------------------");
  console.log(`Naye: Hola ${profile.user?.fullName || ""}, dime qué necesitas.`);
  console.log("");

  const firstMessage = await ask(rl, "Tú: ");

  console.log("");
  console.log("Naye: Claro, ¿qué pasó?");
  const problemText = await ask(rl, "Tú: ");

  const requestedPermissions = inferPermissionsFromProblem(`${firstMessage} ${problemText}`);
  const catalog = permissionCatalog();

  console.log("");
  console.log("Naye: Para ayudarte necesito autorización temporal para:");
  for (const key of requestedPermissions) {
    const permission = catalog[key];
    console.log(`- ${permission.label}: ${permission.reason}`);
  }

  console.log("");
  console.log("Naye: Estos permisos solo estarán activos durante esta sesión. Al finalizar o cancelar, perderé el acceso.");
  console.log("Naye: Cámara, contraseñas, tokens, cookies, perfiles de navegador y acceso oculto siguen bloqueados siempre.");
  console.log("");

  const approval = await ask(rl, "Naye: ¿Autorizas esta sesión temporal? (si/no): ");
  const userApproved = yesNo(approval);

  rl.close();

  const session = buildSession(profile, problemText, requestedPermissions, userApproved);
  const targetDir = userApproved ? ACTIVE_DIR : LOG_DIR;
  const sessionPath = path.join(targetDir, `${session.sessionId}.json`);
  const logPath = path.join(LOG_DIR, `${session.sessionId}.log.json`);

  writeJson(sessionPath, session);
  writeJson(logPath, {
    event: userApproved ? "naye_assistance_chat_session_created" : "naye_assistance_chat_session_rejected",
    at: new Date().toISOString(),
    sessionId: session.sessionId,
    sessionPath,
    approvedTemporaryPermissions: session.approvedTemporaryPermissions.map((p) => p.id),
    blockedRequestedPermissions: session.blockedRequestedPermissions.map((p) => p.id)
  });

  console.log("");
  console.log("Naye Assistance Chat — Resultado");
  console.log("--------------------------------");
  console.log(`Session ID: ${session.sessionId}`);
  console.log(`Estado: ${session.status}`);
  console.log(`Archivo de sesión: ${sessionPath}`);
  console.log(`Permisos aprobados: ${session.approvedTemporaryPermissions.map((p) => p.label).join(", ") || "ninguno"}`);
  console.log(`Permisos bloqueados: ${session.blockedRequestedPermissions.map((p) => p.label).join(", ") || "ninguno"}`);
  console.log("");

  if (userApproved) {
    console.log("Naye: Perfecto, empecemos. Dime el nombre del archivo, la carpeta donde está o describe el error con más detalle.");
    console.log(`Para cerrar esta sesión después: npm run assistance-close -- ${session.sessionId}`);
  } else {
    console.log("Naye: Entendido. No iniciaré la asistencia sin autorización.");
  }
}

function listActiveSessions() {
  ensureDirs();

  const files = fs.readdirSync(ACTIVE_DIR).filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    console.log("No hay sesiones activas.");
    return;
  }

  for (const file of files) {
    const fullPath = path.join(ACTIVE_DIR, file);
    const session = readJson(fullPath);
    console.log(`${session.sessionId} | ${session.user?.fullName || "usuario"} | ${session.conversation?.userProblemDescription || "sin descripción"}`);
  }
}

async function closeSession(sessionIdArg) {
  ensureDirs();

  let sessionId = sessionIdArg;

  if (!sessionId) {
    listActiveSessions();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    sessionId = await ask(rl, "Session ID a cerrar: ");
    rl.close();
  }

  const activePath = path.join(ACTIVE_DIR, `${sessionId}.json`);

  if (!fs.existsSync(activePath)) {
    throw new Error(`No existe sesión activa con ID: ${sessionId}`);
  }

  const session = readJson(activePath);
  const now = new Date().toISOString();

  session.status = "closed";
  session.closedAt = now;
  session.authorization.revokedAt = now;
  session.authorization.temporaryPermissionsRevoked = true;

  const closedPath = path.join(CLOSED_DIR, `${sessionId}.json`);
  writeJson(closedPath, session);
  fs.unlinkSync(activePath);

  writeJson(path.join(LOG_DIR, `${sessionId}.closed.log.json`), {
    event: "naye_assistance_chat_session_closed",
    at: now,
    sessionId,
    closedPath,
    temporaryPermissionsRevoked: true
  });

  console.log("Sesión cerrada correctamente.");
  console.log(`Archivo cerrado: ${closedPath}`);
  console.log("Permisos temporales revocados.");
}

async function main() {
  const command = process.argv[2] || "start";

  if (command === "start") {
    await conversationalStart();
    return;
  }

  if (command === "list") {
    listActiveSessions();
    return;
  }

  if (command === "close") {
    await closeSession(process.argv[3]);
    return;
  }

  throw new Error(`Comando no reconocido: ${command}`);
}

main().catch((error) => {
  console.error("Error en Naye Assistance Chat:", error.message);
  process.exit(1);
});
