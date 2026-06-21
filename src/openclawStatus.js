import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve("F:/NayeVault/naye-core");

function runCheck(label, relativeScriptPath) {
  console.log("");
  console.log(`=== ${label} ===`);
  console.log("");

  const fullScriptPath = path.join(ROOT, relativeScriptPath);

  const result = spawnSync(process.execPath, [fullScriptPath], {
    cwd: ROOT,
    stdio: "inherit"
  });

  return {
    label,
    script: relativeScriptPath,
    ok: result.status === 0,
    status: result.status,
    error: result.error?.message ?? null
  };
}

console.log("");
console.log("Naye OpenClaw Status");
console.log("--------------------");

const checks = [
  runCheck("OpenClaw Fresh Status", "src/openclawFreshStatus.js"),
  runCheck("OpenClaw Agents Status", "src/openclawAgentsStatus.js"),
  runCheck("OpenClaw Proposals Status", "src/openclawProposalsStatus.js"),
  runCheck("OpenClaw Execution Plans Status", "src/openclawExecutionPlansStatus.js"),
  runCheck("OpenClaw Execution Approvals Status", "src/openclawExecutionApprovalsStatus.js"),
  runCheck("OpenClaw Execution Runs Status", "src/openclawExecutionRunsStatus.js")
];

const failed = checks.filter(check => !check.ok);

console.log("");
console.log("Naye OpenClaw Status — Resumen");
console.log("------------------------------");

for (const check of checks) {
  console.log(`${check.ok ? "[OK]" : "[REVISAR]"} ${check.label} (${check.script})`);

  if (check.error) {
    console.log(`     Error: ${check.error}`);
  }
}

console.log("");
console.log("Checks totales:", checks.length);
console.log("Checks OK:", checks.filter(check => check.ok).length);
console.log("Checks por revisar:", failed.length);
console.log("Estado:", failed.length === 0 ? "OK" : "REVISAR");
console.log("");

if (failed.length > 0) {
  process.exit(1);
}
