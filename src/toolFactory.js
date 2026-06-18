import fs from "fs";
import path from "path";

const PROPOSED_TOOLS_DIR = path.resolve("F:/NayeVault/naye-core/generated-tools/proposed");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeInputPreview(input, sensitivity) {
  if (sensitivity === "critical") {
    return "[REDACTED_CRITICAL_INPUT]";
  }

  if (sensitivity === "confidential") {
    return input.length > 120 ? input.slice(0, 120) + "..." : input;
  }

  if (sensitivity === "private") {
    return input.length > 100 ? input.slice(0, 100) + "..." : input;
  }

  return input;
}

function detectToolNeed({ input, route }) {
  const text = input.toLowerCase();

  if (route.sensitivity === "critical") {
    return null;
  }

  const asksForPcStatus =
    route.taskType === "multi_device" &&
    (
      text.includes("estatus") ||
      text.includes("status") ||
      text.includes("estado") ||
      text.includes("estus") ||
      text.includes("pc")
    );

  if (asksForPcStatus) {
    return {
      name: "systemStatus",
      displayName: "System Status Tool",
      purpose: "Leer el estado básico de la PC local en modo solo lectura.",
      riskLevel: "low",
      recommendedLanguage: "PowerShell",
      integrationLanguage: "JavaScript",
      languageReason: "PowerShell es la mejor opción para consultar información local de Windows; JavaScript sirve como puente con Naye Core.",
      alternativeLanguages: [
        {
          language: "JavaScript",
          useCase: "Integración directa con Naye Core, pero con menos acceso nativo a diagnósticos de Windows."
        },
        {
          language: "Python",
          useCase: "Útil para análisis posterior, pero no necesario para diagnóstico básico de Windows."
        }
      ],
      permissions: {
        readOnly: true,
        canModifyFiles: false,
        canDeleteFiles: false,
        canRunAdminCommands: false,
        usesNetwork: false,
        usesExternalProvider: false,
        allowedScope: "Metadatos básicos del sistema local."
      },
      prohibitedActions: [
        "Borrar archivos.",
        "Modificar archivos.",
        "Leer contraseñas.",
        "Leer tokens.",
        "Cambiar permisos.",
        "Ejecutar comandos administrativos.",
        "Enviar datos a internet.",
        "Acceder a rutas no autorizadas."
      ]
    };
  }

  return null;
}

function buildManifest({ tool, input, route }) {
  return {
    system: "Naye Core",
    component: "Naye Tool Factory",
    packageType: "tool_package",
    status: "proposed",
    createdAt: new Date().toISOString(),
    authorizationRole: "Usuario Administrador designado",
    sourceRequest: {
      inputPreview: safeInputPreview(input, route.sensitivity),
      taskType: route.taskType,
      sensitivity: route.sensitivity
    },
    tool: {
      name: tool.name,
      displayName: tool.displayName,
      purpose: tool.purpose,
      riskLevel: tool.riskLevel,
      recommendedLanguage: tool.recommendedLanguage,
      integrationLanguage: tool.integrationLanguage,
      languageReason: tool.languageReason,
      alternativeLanguages: tool.alternativeLanguages,
      permissions: tool.permissions,
      prohibitedActions: tool.prohibitedActions,
      dryRunRequired: true,
      adminReviewRequired: true,
      activationStatus: "pending_review"
    },
    files: {
      manifest: "manifest.json",
      readme: "README.md",
      security: "SECURITY.md",
      implementation: "src/systemStatus.ps1",
      test: "tests/test-systemStatus.ps1",
      bridge: "bridge/systemStatusBridge.js"
    },
    nextSteps: [
      "Revisar el paquete generado.",
      "Ejecutar prueba dry_run.",
      "Validar que no modifica archivos ni usa red.",
      "Registrar en Tool Registry si se aprueba.",
      "Activar solo después de aprobación del Usuario Administrador designado."
    ]
  };
}

function buildReadme(tool) {
  return [
    `# ${tool.displayName}`,
    "",
    "## Estado",
    "",
    "Proposed / Pending Review",
    "",
    "## Propósito",
    "",
    tool.purpose,
    "",
    "## Lenguaje elegido",
    "",
    `Lenguaje principal: ${tool.recommendedLanguage}`,
    "",
    `Lenguaje de integración: ${tool.integrationLanguage}`,
    "",
    "## Justificación técnica",
    "",
    tool.languageReason,
    "",
    "## Riesgo",
    "",
    tool.riskLevel,
    "",
    "## Uso esperado",
    "",
    "Esta herramienta deberá ejecutarse primero en modo dry_run.",
    "",
    "## Regla",
    "",
    "La herramienta no queda activa hasta que el Usuario Administrador designado la apruebe."
  ].join("\n");
}

function buildSecurity(tool) {
  return [
    `# Seguridad — ${tool.displayName}`,
    "",
    "## Nivel de riesgo",
    "",
    tool.riskLevel,
    "",
    "## Permisos",
    "",
    JSON.stringify(tool.permissions, null, 2),
    "",
    "## Acciones prohibidas",
    "",
    ...tool.prohibitedActions.map(action => `- ${action}`),
    "",
    "## Red",
    "",
    "Esta herramienta no debe usar red.",
    "",
    "## Proveedor externo",
    "",
    "Esta herramienta no debe usar proveedor externo.",
    "",
    "## Activación",
    "",
    "No activar sin revisión y aprobación del Usuario Administrador designado."
  ].join("\n");
}

function buildPowerShellImplementation() {
  return [
    'param(',
    '  [switch]$DryRun',
    ')',
    '',
    '$ErrorActionPreference = "Stop"',
    '',
    '$os = Get-CimInstance Win32_OperatingSystem',
    '$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1',
    '$drives = Get-PSDrive -PSProvider FileSystem | ForEach-Object {',
    '  [PSCustomObject]@{',
    '    Name = $_.Name',
    '    UsedGB = [math]::Round($_.Used / 1GB, 2)',
    '    FreeGB = [math]::Round($_.Free / 1GB, 2)',
    '    TotalGB = [math]::Round(($_.Used + $_.Free) / 1GB, 2)',
    '  }',
    '}',
    '',
    '$result = [PSCustomObject]@{',
    '  tool = "systemStatus"',
    '  mode = $(if ($DryRun) { "dry_run" } else { "read_only" })',
    '  executedAt = (Get-Date).ToString("o")',
    '  device = [PSCustomObject]@{',
    '    hostname = $env:COMPUTERNAME',
    '    username = $env:USERNAME',
    '    osCaption = $os.Caption',
    '    osVersion = $os.Version',
    '    architecture = $os.OSArchitecture',
    '    uptimeMinutes = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalMinutes, 0)',
    '  }',
    '  cpu = [PSCustomObject]@{',
    '    name = $cpu.Name',
    '    cores = $cpu.NumberOfCores',
    '    logicalProcessors = $cpu.NumberOfLogicalProcessors',
    '  }',
    '  memory = [PSCustomObject]@{',
    '    totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)',
    '    freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)',
    '    usedGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)',
    '  }',
    '  disks = $drives',
    '  security = [PSCustomObject]@{',
    '    readOnly = $true',
    '    usesNetwork = $false',
    '    usesExternalProvider = $false',
    '    modifiesFiles = $false',
    '  }',
    '}',
    '',
    '$result | ConvertTo-Json -Depth 8'
  ].join("\n");
}

function buildPowerShellTest() {
  return [
    '$ErrorActionPreference = "Stop"',
    '',
    '$toolPath = Join-Path $PSScriptRoot "..\\src\\systemStatus.ps1"',
    '',
    'Write-Host "Testing systemStatus tool in dry_run mode..."',
    '$output = & $toolPath -DryRun',
    '',
    'if (-not $output) {',
    '  throw "Tool returned empty output."',
    '}',
    '',
    '$json = $output | ConvertFrom-Json',
    '',
    'if ($json.tool -ne "systemStatus") {',
    '  throw "Unexpected tool name."',
    '}',
    '',
    'if ($json.security.readOnly -ne $true) {',
    '  throw "Tool is not marked as read-only."',
    '}',
    '',
    'if ($json.security.usesNetwork -ne $false) {',
    '  throw "Tool should not use network."',
    '}',
    '',
    'Write-Host "systemStatus dry_run test passed."',
    '$output'
  ].join("\n");
}

function buildBridgeJs() {
  return [
    'import { execFileSync } from "child_process";',
    'import path from "path";',
    'import { fileURLToPath } from "url";',
    '',
    'const __filename = fileURLToPath(import.meta.url);',
    'const __dirname = path.dirname(__filename);',
    '',
    'function runSystemStatusDryRun() {',
    '  const scriptPath = path.resolve(__dirname, "../src/systemStatus.ps1");',
    '',
    '  const output = execFileSync(',
    '    "powershell.exe",',
    '    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-DryRun"],',
    '    { encoding: "utf8" }',
    '  ).trim().replace(/^\\uFEFF/, "");',
    '',
    '  return JSON.parse(output);',
    '}',
    '',
    'export { runSystemStatusDryRun };'
  ].join("\n");
}

function createToolPackageIfNeeded({ input, route }) {
  const tool = detectToolNeed({ input, route });

  if (!tool) {
    return {
      packageCreated: false,
      message: "No se detectó necesidad clara de crear una herramienta nueva."
    };
  }

  ensureDir(PROPOSED_TOOLS_DIR);

  const packageName = `${tool.name}_${safeTimestamp()}`;
  const packageDir = path.join(PROPOSED_TOOLS_DIR, packageName);

  const srcDir = path.join(packageDir, "src");
  const testsDir = path.join(packageDir, "tests");
  const bridgeDir = path.join(packageDir, "bridge");

  ensureDir(packageDir);
  ensureDir(srcDir);
  ensureDir(testsDir);
  ensureDir(bridgeDir);

  const manifest = buildManifest({ tool, input, route });

  fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(path.join(packageDir, "README.md"), buildReadme(tool), "utf8");
  fs.writeFileSync(path.join(packageDir, "SECURITY.md"), buildSecurity(tool), "utf8");
  fs.writeFileSync(path.join(srcDir, "systemStatus.ps1"), buildPowerShellImplementation(), "utf8");
  fs.writeFileSync(path.join(testsDir, "test-systemStatus.ps1"), buildPowerShellTest(), "utf8");
  fs.writeFileSync(path.join(bridgeDir, "systemStatusBridge.js"), buildBridgeJs(), "utf8");

  return {
    packageCreated: true,
    toolName: tool.name,
    packageName,
    status: "pending_review",
    riskLevel: tool.riskLevel,
    recommendedLanguage: tool.recommendedLanguage,
    integrationLanguage: tool.integrationLanguage,
    languageReason: tool.languageReason,
    packageDir,
    files: manifest.files,
    message: "Naye generó un paquete completo de herramienta para revisión del Usuario Administrador designado."
  };
}

export { createToolPackageIfNeeded };
