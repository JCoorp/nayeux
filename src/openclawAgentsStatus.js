import fs from "fs";
import path from "path";

const FRESH_ROOT = path.resolve("F:/NayeVault/openclaw/fresh");
const AGENTS_DIR = path.join(FRESH_ROOT, "agents");
const PROMPTS_DIR = path.join(FRESH_ROOT, "prompts");
const BRIDGE_CONFIG_PATH = path.resolve("F:/NayeVault/naye-core/config/openclaw-bridge.config.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function listAgentFiles() {
  if (!fs.existsSync(AGENTS_DIR)) {
    return [];
  }

  return fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith(".agent.json"))
    .map(entry => path.join(AGENTS_DIR, entry.name))
    .sort();
}

function checkAgent(filePath) {
  const agent = readJson(filePath);
  const agentId = agent.agentId ?? path.basename(filePath, ".agent.json");

  const expectedPromptPath = path.join(PROMPTS_DIR, `${agentId}.system.md`);
  const promptExists = fs.existsSync(expectedPromptPath);

  const runtime = agent.runtime ?? {};
  const security = agent.security ?? {};
  const integration = agent.integration ?? {};

  const checks = [
    {
      name: "status_prepared_not_active",
      ok: agent.status === "prepared_not_active",
      value: agent.status
    },
    {
      name: "managed_by_naye_core",
      ok: agent.managedBy === "Naye Core",
      value: agent.managedBy
    },
    {
      name: "runtime_disabled",
      ok: runtime.enabled === false,
      value: runtime.enabled
    },
    {
      name: "execution_not_allowed",
      ok: runtime.executionAllowed === false,
      value: runtime.executionAllowed
    },
    {
      name: "requires_bridge_approval",
      ok: runtime.requiresBridgeApproval === true,
      value: runtime.requiresBridgeApproval
    },
    {
      name: "read_only_by_default",
      ok: security.readOnlyByDefault === true,
      value: security.readOnlyByDefault
    },
    {
      name: "network_disabled",
      ok: security.allowNetwork === false,
      value: security.allowNetwork
    },
    {
      name: "external_providers_disabled",
      ok: security.allowExternalProviders === false,
      value: security.allowExternalProviders
    },
    {
      name: "file_modification_disabled",
      ok: security.allowFileModification === false,
      value: security.allowFileModification
    },
    {
      name: "credential_access_disabled",
      ok: security.allowCredentialAccess === false,
      value: security.allowCredentialAccess
    },
    {
      name: "legacy_data_disabled",
      ok: security.allowLegacyData === false,
      value: security.allowLegacyData
    },
    {
      name: "browser_profiles_disabled",
      ok: security.allowBrowserProfiles === false,
      value: security.allowBrowserProfiles
    },
    {
      name: "whatsapp_data_disabled",
      ok: security.allowWhatsAppData === false,
      value: security.allowWhatsAppData
    },
    {
      name: "sensitive_actions_require_approval",
      ok: security.requireApprovalForSensitiveActions === true,
      value: security.requireApprovalForSensitiveActions
    },
    {
      name: "bridge_required",
      ok: integration.nayeCoreBridgeRequired === true,
      value: integration.nayeCoreBridgeRequired
    },
    {
      name: "operational_connection_disabled",
      ok: integration.operationalConnection === false,
      value: integration.operationalConnection
    },
    {
      name: "prompt_exists",
      ok: promptExists,
      value: expectedPromptPath
    }
  ];

  const ok = checks.every(check => check.ok);

  return {
    agentId,
    name: agent.name,
    version: agent.version,
    filePath,
    expectedPromptPath,
    ok,
    checks
  };
}

function main() {
  console.log("");
  console.log("Naye OpenClaw Agents Status");
  console.log("---------------------------");
  console.log("Fresh root:", FRESH_ROOT);
  console.log("Agents:", AGENTS_DIR);
  console.log("Prompts:", PROMPTS_DIR);
  console.log("Bridge config:", BRIDGE_CONFIG_PATH);
  console.log("");

  const bridgeExists = fs.existsSync(BRIDGE_CONFIG_PATH);
  console.log("Bridge");
  console.log("------");
  console.log(`[${bridgeExists ? "OK" : "FALTA"}] openclaw-bridge.config.json`);

  if (!bridgeExists) {
    console.log("");
    console.log("Estado: REVISAR");
    process.exit(1);
  }

  const agentFiles = listAgentFiles();

  console.log("");
  console.log("Agentes encontrados");
  console.log("-------------------");

  if (!agentFiles.length) {
    console.log("(vacío)");
    console.log("");
    console.log("Estado: REVISAR");
    process.exit(1);
  }

  const results = agentFiles.map(checkAgent);

  for (const result of results) {
    console.log("");
    console.log(`[${result.ok ? "OK" : "REVISAR"}] ${result.agentId} — ${result.name ?? "sin nombre"}`);
    console.log("Archivo:", result.filePath);
    console.log("Prompt:", result.expectedPromptPath);
    console.log("Versión:", result.version ?? "sin versión");

    for (const check of result.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  const safeAgents = results.filter(result => result.ok);
  const unsafeAgents = results.filter(result => !result.ok);

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Agentes totales:", results.length);
  console.log("Agentes seguros:", safeAgents.length);
  console.log("Agentes por revisar:", unsafeAgents.length);
  console.log("Estado:", unsafeAgents.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafeAgents.length > 0) {
    process.exit(1);
  }
}

main();
