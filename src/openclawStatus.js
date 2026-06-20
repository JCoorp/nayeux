import { spawnSync } from "child_process";

function runCheck(label, script) {
  console.log("");
  console.log(`=== ${label} ===`);
  console.log("");

  const result = spawnSync("npm", ["run", script], {
    shell: true,
    stdio: "inherit"
  });

  return {
    label,
    script,
    ok: result.status === 0,
    status: result.status
  };
}

console.log("");
console.log("Naye OpenClaw Status");
console.log("--------------------");

const checks = [
  runCheck("OpenClaw Fresh Status", "openclaw-fresh-status"),
  runCheck("OpenClaw Agents Status", "openclaw-agents-status")
];

const failed = checks.filter(check => !check.ok);

console.log("");
console.log("Naye OpenClaw Status — Resumen");
console.log("------------------------------");

for (const check of checks) {
  console.log(`${check.ok ? "[OK]" : "[REVISAR]"} ${check.label} (${check.script})`);
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
