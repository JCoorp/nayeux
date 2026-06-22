const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const VAULT_ROOT = "F:/NayeVault";
const PROFILE_DIR = path.join(VAULT_ROOT, "devices", "nodes", "profiles");
const LOG_DIR = path.join(VAULT_ROOT, "devices", "nodes", "logs");

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || "").trim()));
  });
}

function yesNo(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["si", "sí", "s", "yes", "y"].includes(normalized);
}

function safeId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeDeviceType(value) {
  const selected = String(value || "").trim().toLowerCase();

  if (selected === "1" || selected.includes("personal")) {
    return {
      id: "personal",
      label: "Personal",
      description: "Equipo asignado a una persona específica."
    };
  }

  if (selected === "3" || selected.includes("ti") || selected.includes("infra")) {
    return {
      id: "it_infrastructure",
      label: "TI / Infraestructura",
      description: "Equipo técnico, servidor, router, switch o dispositivo de infraestructura."
    };
  }

  return {
    id: "business",
    label: "Empresarial",
    description: "Equipo de uso empresarial, administrativo u operativo."
  };
}

function classifyUser(answers) {
  const role = String(answers.companyRole || "").toLowerCase();
  const department = String(answers.department || "").toLowerCase();

  const isNayeAdmin =
    role.includes("administrador naye") ||
    role.includes("admin naye") ||
    role.includes("responsable naye");

  const isBusinessAuthority =
    role.includes("director") ||
    role.includes("dueño") ||
    role.includes("dueno") ||
    role.includes("gerente") ||
    role.includes("manager") ||
    role.includes("owner") ||
    role.includes("responsable");

  const isIT =
    answers.belongsToIT ||
    department.includes("ti") ||
    department.includes("sistemas") ||
    department.includes("soporte") ||
    department.includes("infraestructura") ||
    department.includes("tecnologia") ||
    department.includes("tecnología") ||
    role.includes("ingeniero") ||
    role.includes("sistemas") ||
    role.includes("soporte") ||
    role.includes("it") ||
    role.includes("ti");

  if (isNayeAdmin) {
    return {
      id: "naye_admin",
      label: "Administrador de Naye",
      category: "privileged_user",
      canApproveCriticalActions: true,
      canManageNodes: true,
      canManageUsers: true,
      canManageKnowledgeVault: true
    };
  }

  if (isIT) {
    return {
      id: "it_user",
      label: "Usuario de TI / Sistemas",
      category: "technical_department",
      canApproveCriticalActions: answers.canApproveCriticalActions,
      canManageNodes: false,
      canManageUsers: false,
      canManageKnowledgeVault: false
    };
  }

  if (isBusinessAuthority && answers.canApproveCriticalActions) {
    return {
      id: "business_authority",
      label: "Autoridad empresarial",
      category: "business_authority",
      canApproveCriticalActions: true,
      canManageNodes: false,
      canManageUsers: false,
      canManageKnowledgeVault: false
    };
  }

  if (isBusinessAuthority && !answers.canApproveCriticalActions) {
    return {
      id: "business_user",
      label: "Usuario empresarial sin aprobación crítica",
      category: "standard_business_user",
      canApproveCriticalActions: false,
      canManageNodes: false,
      canManageUsers: false,
      canManageKnowledgeVault: false
    };
  }

  return {
    id: "standard_user",
    label: "Usuario empresarial estándar",
    category: "standard_employee",
    canApproveCriticalActions: false,
    canManageNodes: false,
    canManageUsers: false,
    canManageKnowledgeVault: false
  };
}
function buildSessionPolicy(classification) {
  return {
    permissionsAreNotPermanent: true,
    permissionsAreRequestedPerSession: true,
    revokeAllTemporaryPermissionsWhenSessionEnds: true,
    requireNewAuthorizationForNewSession: true,
    assistanceScope: {
      wholeDevicePotentiallyAssistable: true,
      fullDevicePreScanAllowed: false,
      searchOnlyWhenRequestedByUser: true,
      searchRequiresActiveSession: true,
      fileAccessRequiresUserContextOrApproval: true,
      description: "Naye puede asistir sobre el equipo completo, pero solo busca o lee archivos durante una sesión autorizada y cuando el usuario lo solicita o indica una ubicación/nombre de archivo."
    },
    possibleTemporaryPermissions: {
      screenView: {
        description: "Ver pantalla durante una sesión de ayuda.",
        requiresUserApproval: true,
        defaultDuration: "session_only"
      },
      fileSearch: {
        description: "Buscar un archivo por nombre o ubicación indicada por el usuario durante una sesión.",
        requiresUserApproval: true,
        defaultDuration: "session_only"
      },
      fileRead: {
        description: "Leer archivo autorizado durante una sesión.",
        requiresUserApproval: true,
        defaultDuration: "session_only"
      },
      fileModify: {
        description: "Modificar archivo autorizado después de propuesta y aprobación.",
        requiresUserApproval: true,
        requiresBackup: true,
        defaultDuration: "session_only"
      },
      remoteControl: {
        description: "Tomar control remoto temporal para resolver un problema.",
        requiresUserApproval: true,
        defaultDuration: "session_only"
      },
      commandExecution: {
        description: "Ejecutar comandos técnicos autorizados.",
        requiresUserApproval: true,
        requiresHigherTrustRole: true,
        defaultDuration: "session_only"
      },
      softwareInstall: {
        description: "Instalar software o dependencias.",
        requiresUserApproval: true,
        requiresCriticalApproval: true,
        defaultDuration: "session_only"
      }
    },
    roleLimits: {
      classificationId: classification.id,
      classificationLabel: classification.label,
      canApproveCriticalActions: classification.canApproveCriticalActions,
      canManageNodes: classification.canManageNodes,
      canManageUsers: classification.canManageUsers,
      canManageKnowledgeVault: classification.canManageKnowledgeVault
    }
  };
}

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const detected = {
    hostname: os.hostname(),
    platform: process.platform,
    osType: os.type(),
    osRelease: os.release(),
    windowsUser: process.env.USERNAME || process.env.USER || null
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("");
  console.log("Naye Node Onboarding");
  console.log("--------------------");
  console.log("Este cuestionario registra la PC y clasifica al usuario.");
  console.log("No concede permisos permanentes.");
  console.log("Pantalla, archivos, control remoto y comandos se autorizan después por sesión.");
  console.log("");
  console.log(`Equipo detectado: ${detected.hostname}`);
  console.log(`Usuario Windows detectado: ${detected.windowsUser || "no detectado"}`);
  console.log("");

  const answers = {};
  answers.userFullName = await ask(rl, "Nombre de la persona que usará principalmente esta PC: ");
  answers.department = await ask(rl, "Área o departamento en la empresa: ");
  answers.companyRole = await ask(rl, "Rol o puesto en la empresa: ");
  answers.deviceAlias = await ask(rl, `Alias para este equipo [Enter para usar '${detected.hostname}']: `);

  console.log("");
  console.log("Tipo de equipo:");
  console.log("1) Personal");
  console.log("2) Empresarial");
  console.log("3) TI / Infraestructura");
  answers.deviceTypeRaw = await ask(rl, "Selecciona una opción (1/2/3): ");

  answers.belongsToIT = yesNo(await ask(rl, "¿Este usuario pertenece al Departamento de TI/Sistemas? (si/no): "));
  answers.canApproveCriticalActions = yesNo(await ask(rl, "¿Este usuario puede aprobar acciones críticas de Naye? (si/no): "));

  rl.close();

  const deviceType = normalizeDeviceType(answers.deviceTypeRaw);
  const classification = classifyUser(answers);
  const now = new Date().toISOString();
  const deviceName = answers.deviceAlias || detected.hostname;
  const deviceId = `naye-node-${safeId(deviceName)}-${now.replace(/[:.]/g, "-")}`;

  const profile = {
    system: "Naye Core",
    component: "Naye Node Profile",
    version: "0.3.0",
    createdAt: now,
    installationPackagePath: {
      designedForInstaller: true,
      futureInstallerName: "Naye Node Installer",
      futureInstallerFlow: [
        "install_node_files",
        "detect_device",
        "run_onboarding",
        "create_local_profile",
        "register_with_company_naye_device",
        "start_node_service"
      ]
    },
    device: {
      id: deviceId,
      alias: deviceName,
      detectedHostname: detected.hostname,
      detectedWindowsUser: detected.windowsUser,
      type: deviceType,
      platform: detected.platform,
      osType: detected.osType,
      osRelease: detected.osRelease
    },
    user: {
      fullName: answers.userFullName,
      department: answers.department,
      companyRole: answers.companyRole,
      belongsToIT: answers.belongsToIT,
      classificationId: classification.id,
      classificationLabel: classification.label,
      classificationCategory: classification.category,
      canApproveCriticalActions: classification.canApproveCriticalActions
    },
    fileScope: {
      defaultWorkFoldersAsked: false,
      wholeDevicePotentiallyAssistable: true,
      fullDevicePreScanAllowed: false,
      accessMode: "session_based_user_requested_search",
      note: "No se preguntan carpetas habituales. Naye puede buscar o leer archivos durante una sesión autorizada cuando el usuario indique una ubicación, nombre de archivo o solicite búsqueda."
    },
    sessionPolicy: buildSessionPolicy(classification),
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
      profileCreatedBy: "naye-node-onboarding",
      storesSecrets: false,
      storesPasswords: false,
      storesTokens: false,
      storesCookies: false,
      notes: [
        "El onboarding no concede permisos permanentes.",
        "No se pregunta nivel técnico.",
        "No se preguntan carpetas habituales.",
        "La pantalla, archivos, control remoto, comandos e instalación se autorizan por sesión.",
        "Al finalizar o cancelar la sesión, Naye debe revocar accesos temporales."
      ]
    }
  };

  const profilePath = path.join(PROFILE_DIR, `${deviceId}.json`);
  const logPath = path.join(LOG_DIR, `${deviceId}.log.json`);

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf8");
  fs.writeFileSync(logPath, JSON.stringify({
    event: "naye_node_onboarding_completed",
    at: now,
    deviceId,
    profilePath,
    classificationId: classification.id,
    classificationLabel: classification.label,
    deviceType: deviceType.id
  }, null, 2), "utf8");

  console.log("");
  console.log("Naye Node Onboarding — Resultado");
  console.log("--------------------------------");
  console.log(`Device ID: ${deviceId}`);
  console.log(`Equipo detectado: ${detected.hostname}`);
  console.log(`Alias del equipo: ${deviceName}`);
  console.log(`Tipo de equipo: ${deviceType.label} (${deviceType.id})`);
  console.log(`Usuario clasificado como: ${classification.label} (${classification.id})`);
  console.log(`Perfil guardado en: ${profilePath}`);
  console.log("");
  console.log("Regla de permisos:");
  console.log("- No se concedieron permisos permanentes.");
  console.log("- Pantalla, archivos, control remoto y comandos se autorizarán por sesión.");
  console.log("- Naye puede buscar archivos solo durante una sesión autorizada.");
  console.log("- Al finalizar la sesión, Naye pierde el acceso temporal.");
  console.log("");
  console.log("Bloqueos permanentes:");
  console.log("- Cámara bloqueada");
  console.log("- Keylogger bloqueado");
  console.log("- Contraseñas/tokens/cookies bloqueados");
  console.log("- Acceso oculto bloqueado");
}

main().catch((error) => {
  console.error("Error en Naye Node Onboarding:", error.message);
  process.exit(1);
});

