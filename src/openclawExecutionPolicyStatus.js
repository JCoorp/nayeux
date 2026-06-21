import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const POLICY_PATH = path.join(ROOT, "config", "openclaw-execution-policy.config.json");

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

function hasString(array, value) {
  return Array.isArray(array) && array.includes(value);
}

function checkCommand(command) {
  const checks = [
    {
      name: "command_has_id",
      ok: typeof command.commandId === "string" && command.commandId.length > 0,
      value: command.commandId ?? null
    },
    {
      name: "executable_defined",
      ok: typeof command.executable === "string" && command.executable.length > 0,
      value: command.executable ?? null
    },
    {
      name: "cwd_is_naye_core",
      ok: command.cwd === "F:/NayeVault/naye-core",
      value: command.cwd ?? null
    },
    {
      name: "requires_audit_log",
      ok: command.requiresAuditLog === true,
      value: command.requiresAuditLog
    },
    {
      name: "command_is_controlled",
      ok: Boolean(command.allowedExactArgs || command.allowedArgsPrefix || command.allowedPathPrefix),
      value: Boolean(command.allowedExactArgs || command.allowedArgsPrefix || command.allowedPathPrefix)
    }
  ];

  return {
    commandId: command.commandId ?? "missing_command_id",
    ok: checks.every(check => check.ok),
    checks
  };
}

function main() {
  console.log("");
  console.log("Naye OpenClaw Execution Policy Status");
  console.log("-------------------------------------");
  console.log("Policy:", POLICY_PATH);

  if (!fs.existsSync(POLICY_PATH)) {
    console.log("[FALTA] config/openclaw-execution-policy.config.json");
    console.log("");
    console.log("Estado: REVISAR");
    process.exit(1);
  }

  const parsed = readJsonSafe(POLICY_PATH);

  if (!parsed.ok) {
    console.log("[REVISAR] JSON inválido:", parsed.error);
    console.log("");
    console.log("Estado: REVISAR");
    process.exit(1);
  }

  const policy = parsed.data;
  const requirements = policy.requirements ?? {};
  const workspaceScope = policy.workspaceScope ?? {};
  const capabilities = policy.capabilities ?? {};
  const blockedSensitiveAccess = policy.blockedSensitiveAccess ?? {};
  const commands = Array.isArray(policy.allowedCommands) ? policy.allowedCommands : [];
  const blockedPaths = Array.isArray(policy.blockedPaths) ? policy.blockedPaths : [];
  const blockedFilePatterns = Array.isArray(policy.blockedFilePatterns) ? policy.blockedFilePatterns : [];

  const checks = [
    {
      name: "system_naye_core",
      ok: policy.system === "Naye Core",
      value: policy.system
    },
    {
      name: "component_execution_policy",
      ok: policy.component === "OpenClaw Execution Policy",
      value: policy.component
    },
    {
      name: "version_0_2_0",
      ok: policy.version === "0.2.0",
      value: policy.version
    },
    {
      name: "policy_enabled",
      ok: policy.enabled === true,
      value: policy.enabled
    },
    {
      name: "controlled_real_execution_mode",
      ok: policy.mode === "controlled_real_execution",
      value: policy.mode
    },
    {
      name: "default_action_requires_approval",
      ok: policy.defaultAction === "require_approval",
      value: policy.defaultAction
    },
    {
      name: "policy_supports_real_execution",
      ok: policy.policySupportsRealExecution === true,
      value: policy.policySupportsRealExecution
    },
    {
      name: "executor_implemented", ok: policy.executorImplemented === true, value: policy.executorImplemented
    },
    {
      name: "real_execution_enabled", ok: policy.realExecutionEnabled === true, value: policy.realExecutionEnabled
    },
    {
      name: "dry_run_only_false",
      ok: policy.dryRunOnly === false,
      value: policy.dryRunOnly
    },
    {
      name: "proposal_approval_required",
      ok: requirements.requireProposalApproval === true,
      value: requirements.requireProposalApproval
    },
    {
      name: "execution_plan_required",
      ok: requirements.requireExecutionPlan === true,
      value: requirements.requireExecutionPlan
    },
    {
      name: "execution_approval_required",
      ok: requirements.requireExecutionApproval === true,
      value: requirements.requireExecutionApproval
    },
    {
      name: "dry_run_before_real_execution_required",
      ok: requirements.requireDryRunBeforeRealExecution === true,
      value: requirements.requireDryRunBeforeRealExecution
    },
    {
      name: "final_executor_gate_required",
      ok: requirements.requireFinalExecutorGate === true,
      value: requirements.requireFinalExecutorGate
    },
    {
      name: "audit_log_required",
      ok: requirements.requireAuditLog === true,
      value: requirements.requireAuditLog
    },
    {
      name: "primary_workspace_is_naye_vault",
      ok: workspaceScope.primaryWorkspace === "F:/NayeVault",
      value: workspaceScope.primaryWorkspace
    },
    {
      name: "project_root_is_naye_core",
      ok: workspaceScope.projectRoot === "F:/NayeVault/naye-core",
      value: workspaceScope.projectRoot
    },
    {
      name: "runtime_root_is_openclaw_runtime",
      ok: workspaceScope.runtimeRoot === "F:/NayeVault/openclaw/fresh/runtime",
      value: workspaceScope.runtimeRoot
    },
    {
      name: "can_read_workspace",
      ok: hasString(workspaceScope.allowedReadPaths, "F:/NayeVault"),
      value: workspaceScope.allowedReadPaths?.join(", ") ?? null
    },
    {
      name: "can_write_workspace",
      ok: hasString(workspaceScope.allowedWritePaths, "F:/NayeVault"),
      value: workspaceScope.allowedWritePaths?.join(", ") ?? null
    },
    {
      name: "read_files_allowed",
      ok: capabilities.allowReadFilesInWorkspace === true,
      value: capabilities.allowReadFilesInWorkspace
    },
    {
      name: "create_files_allowed",
      ok: capabilities.allowCreateFilesInWorkspace === true,
      value: capabilities.allowCreateFilesInWorkspace
    },
    {
      name: "edit_files_allowed",
      ok: capabilities.allowEditFilesInWorkspace === true,
      value: capabilities.allowEditFilesInWorkspace
    },
    {
      name: "append_files_allowed",
      ok: capabilities.allowAppendFilesInWorkspace === true,
      value: capabilities.allowAppendFilesInWorkspace
    },
    {
      name: "create_directories_allowed",
      ok: capabilities.allowCreateDirectoriesInWorkspace === true,
      value: capabilities.allowCreateDirectoriesInWorkspace
    },
    {
      name: "shell_whitelist_allowed",
      ok: capabilities.allowShellForWhitelistedCommands === true,
      value: capabilities.allowShellForWhitelistedCommands
    },
    {
      name: "npm_scripts_allowed",
      ok: capabilities.allowNpmScripts === true,
      value: capabilities.allowNpmScripts
    },
    {
      name: "node_scripts_allowed",
      ok: capabilities.allowNodeScripts === true,
      value: capabilities.allowNodeScripts
    },
    {
      name: "git_status_allowed",
      ok: capabilities.allowGitStatus === true,
      value: capabilities.allowGitStatus
    },
    {
      name: "git_diff_allowed",
      ok: capabilities.allowGitDiff === true,
      value: capabilities.allowGitDiff
    },
    {
      name: "git_add_allowed_with_approval",
      ok: capabilities.allowGitAdd === true,
      value: capabilities.allowGitAdd
    },
    {
      name: "git_commit_allowed_with_approval",
      ok: capabilities.allowGitCommitWithApproval === true,
      value: capabilities.allowGitCommitWithApproval
    },
    {
      name: "network_allowed_with_approval",
      ok: capabilities.allowNetworkWithApproval === true,
      value: capabilities.allowNetworkWithApproval
    },
    {
      name: "external_providers_allowed_with_approval",
      ok: capabilities.allowExternalProvidersWithApproval === true,
      value: capabilities.allowExternalProvidersWithApproval
    },
    {
      name: "credential_access_blocked",
      ok: blockedSensitiveAccess.allowCredentialAccess === false,
      value: blockedSensitiveAccess.allowCredentialAccess
    },
    {
      name: "cookies_blocked",
      ok: blockedSensitiveAccess.allowCookies === false,
      value: blockedSensitiveAccess.allowCookies
    },
    {
      name: "tokens_blocked",
      ok: blockedSensitiveAccess.allowTokens === false,
      value: blockedSensitiveAccess.allowTokens
    },
    {
      name: "browser_profiles_blocked",
      ok: blockedSensitiveAccess.allowBrowserProfiles === false,
      value: blockedSensitiveAccess.allowBrowserProfiles
    },
    {
      name: "whatsapp_data_blocked",
      ok: blockedSensitiveAccess.allowWhatsAppData === false,
      value: blockedSensitiveAccess.allowWhatsAppData
    },
    {
      name: "password_managers_blocked",
      ok: blockedSensitiveAccess.allowPasswordManagers === false,
      value: blockedSensitiveAccess.allowPasswordManagers
    },
    {
      name: "ssh_keys_blocked",
      ok: blockedSensitiveAccess.allowSshKeys === false,
      value: blockedSensitiveAccess.allowSshKeys
    },
    {
      name: "private_keys_blocked",
      ok: blockedSensitiveAccess.allowPrivateKeys === false,
      value: blockedSensitiveAccess.allowPrivateKeys
    },
    {
      name: "system_secrets_blocked",
      ok: blockedSensitiveAccess.allowSystemSecrets === false,
      value: blockedSensitiveAccess.allowSystemSecrets
    },
    {
      name: "blocked_paths_exist",
      ok: blockedPaths.length > 0,
      value: blockedPaths.length
    },
    {
      name: "blocked_file_patterns_exist",
      ok: blockedFilePatterns.length > 0,
      value: blockedFilePatterns.length
    },
    {
      name: "allowed_commands_exist",
      ok: commands.length >= 6,
      value: commands.length
    }
  ];

  const commandResults = commands.map(checkCommand);
  const unsafeChecks = checks.filter(check => !check.ok);
  const unsafeCommands = commandResults.filter(command => !command.ok);

  console.log("");
  console.log("Política general");
  console.log("----------------");

  for (const check of checks) {
    console.log(`[${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
  }

  console.log("");
  console.log("Comandos controlados");
  console.log("--------------------");

  for (const command of commandResults) {
    console.log("");
    console.log(`[${command.ok ? "OK" : "REVISAR"}] ${command.commandId}`);

    for (const check of command.checks) {
      console.log(`  [${check.ok ? "OK" : "REVISAR"}] ${check.name}: ${check.value}`);
    }
  }

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Checks de política:", checks.length);
  console.log("Checks de política OK:", checks.filter(check => check.ok).length);
  console.log("Checks de política por revisar:", unsafeChecks.length);
  console.log("Comandos registrados:", commands.length);
  console.log("Comandos seguros:", commandResults.filter(command => command.ok).length);
  console.log("Comandos por revisar:", unsafeCommands.length);
  console.log("Estado:", unsafeChecks.length === 0 && unsafeCommands.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (unsafeChecks.length > 0 || unsafeCommands.length > 0) {
    process.exit(1);
  }
}

main();

