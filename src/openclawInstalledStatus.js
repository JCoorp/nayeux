import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const CONFIG_PATH = path.join(ROOT, "config", "openclaw-installed.config.json");

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

function runOpenClawVersion() {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";

    return spawnSync(comspec, ["/d", "/s", "/c", "openclaw --version"], {
      cwd: ROOT,
      encoding: "utf8",
      shell: false,
      maxBuffer: 1024 * 1024 * 5
    });
  }

  return spawnSync("openclaw", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 5
  });
}

function main() {
  const parsed = readJsonSafe(CONFIG_PATH);

  console.log("");
  console.log("Naye OpenClaw Installed Runtime Status");
  console.log("--------------------------------------");
  console.log("Config:", CONFIG_PATH);

  if (!parsed.ok) {
    console.log("[REVISAR] No se pudo leer config:", parsed.error);
    console.log("");
    process.exit(1);
  }

  const config = parsed.data;
  const versionResult = runOpenClawVersion();
  const actualVersion = (versionResult.stdout ?? "").trim();
  const actualError = versionResult.error?.message ?? (versionResult.stderr ?? "").trim();

  const checks = [
    {
      name: "system_naye_core",
      ok: config.system === "Naye Core",
      value: config.system
    },
    {
      name: "component_openclaw_installed_runtime",
      ok: config.component === "OpenClaw Installed Runtime",
      value: config.component
    },
    {
      name: "installed_true",
      ok: config.installed === true,
      value: config.installed
    },
    {
      name: "cli_command_openclaw",
      ok: config.cli?.command === "openclaw",
      value: config.cli?.command
    },
    {
      name: "cli_installed_globally",
      ok: config.cli?.installedGlobally === true,
      value: config.cli?.installedGlobally
    },
    {
      name: "cli_validated",
      ok: config.cli?.validated === true,
      value: config.cli?.validated
    },
    {
      name: "actual_openclaw_cli_detected",
      ok: versionResult.status === 0 && actualVersion.startsWith("OpenClaw "),
      value: actualVersion || actualError || null
    },
    {
      name: "actual_version_matches_record",
      ok: actualVersion === config.cli?.version,
      value: actualVersion
    },
    {
      name: "node_recorded",
      ok: typeof config.runtime?.node === "string" && config.runtime.node.length > 0,
      value: config.runtime?.node
    },
    {
      name: "npm_recorded",
      ok: typeof config.runtime?.npm === "string" && config.runtime.npm.length > 0,
      value: config.runtime?.npm
    },
    {
      name: "project_root_is_naye_core",
      ok: config.runtime?.projectRoot === "F:/NayeVault/naye-core",
      value: config.runtime?.projectRoot
    },
    {
      name: "naye_vault_is_f_drive",
      ok: config.runtime?.nayeVault === "F:/NayeVault",
      value: config.runtime?.nayeVault
    },
    {
      name: "status_installed_not_onboarded",
      ok: config.integration?.status === "installed_not_onboarded",
      value: config.integration?.status
    },
    {
      name: "gateway_not_configured_yet",
      ok: config.integration?.gatewayConfigured === false,
      value: config.integration?.gatewayConfigured
    },
    {
      name: "channels_not_configured_yet",
      ok: config.integration?.channelsConfigured === false,
      value: config.integration?.channelsConfigured
    },
    {
      name: "models_not_configured_yet",
      ok: config.integration?.modelsConfigured === false,
      value: config.integration?.modelsConfigured
    },
    {
      name: "naye_controlled_execution_true",
      ok: config.integration?.nayeControlledExecution === true,
      value: config.integration?.nayeControlledExecution
    },
    {
      name: "no_legacy_backup_restore",
      ok: config.safety?.doNotRestoreLegacyBackup === true,
      value: config.safety?.doNotRestoreLegacyBackup
    },
    {
      name: "no_cookie_import",
      ok: config.safety?.doNotImportCookies === true,
      value: config.safety?.doNotImportCookies
    },
    {
      name: "no_token_import",
      ok: config.safety?.doNotImportTokens === true,
      value: config.safety?.doNotImportTokens
    },
    {
      name: "no_browser_profile_import",
      ok: config.safety?.doNotImportBrowserProfiles === true,
      value: config.safety?.doNotImportBrowserProfiles
    },
    {
      name: "no_whatsapp_import",
      ok: config.safety?.doNotImportWhatsAppData === true,
      value: config.safety?.doNotImportWhatsAppData
    },
    {
      name: "approval_required_for_onboarding",
      ok: config.safety?.requireNayeApprovalForOnboarding === true,
      value: config.safety?.requireNayeApprovalForOnboarding
    },
    {
      name: "allowed_next_commands_exist",
      ok: Array.isArray(config.allowedNextCommands) && config.allowedNextCommands.length >= 5,
      value: Array.isArray(config.allowedNextCommands) ? config.allowedNextCommands.length : null
    }
  ];

  console.log("");
  console.log("OpenClaw instalado");
  console.log("------------------");

  for (const check of checks) {
    console.log(`[${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Checks:", checks.length);
  console.log("Checks OK:", checks.filter(check => check.ok).length);
  console.log("Checks por revisar:", checks.filter(check => !check.ok).length);
  console.log("Estado:", checks.every(check => check.ok) ? "OK" : "REVISAR");
  console.log("");

  if (!checks.every(check => check.ok)) {
    process.exit(1);
  }
}

main();
