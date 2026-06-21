import { spawnSync } from "child_process";

const CHECKS = [
  {
    name: "OpenClaw Fresh Status",
    script: "src/openclawFreshStatus.js"
  },
  {
    name: "OpenClaw Agents Status",
    script: "src/openclawAgentsStatus.js"
  },
  {
    name: "OpenClaw Proposals Status",
    script: "src/openclawProposalsStatus.js"
  },
  {
    name: "OpenClaw Execution Plans Status",
    script: "src/openclawExecutionPlansStatus.js"
  },
  {
    name: "OpenClaw Execution Approvals Status",
    script: "src/openclawExecutionApprovalsStatus.js"
  },
  {
    name: "OpenClaw Execution Runs Status",
    script: "src/openclawExecutionRunsStatus.js"
  },
  {
    name: "OpenClaw Execution Policy Status",
    script: "src/openclawExecutionPolicyStatus.js"
  },
  {
    name: "OpenClaw Final Executor Gates Status",
    script: "src/openclawFinalExecutorGatesStatus.js"
  },
  {
    name: "OpenClaw Controlled Executions Status",
    script: "src/openclawControlledExecutionsStatus.js"
  },
  {
    name: "OpenClaw Installed Runtime Status",
    script: "src/openclawInstalledStatus.js"
  }
];

function runCheck(check) {
  const result = spawnSync(process.execPath, [check.script], {
    cwd: "F:/NayeVault/naye-core",
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 30
  });

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  if (result.error) {
    console.error("Process error:", result.error.message);
  }

  return {
    ...check,
    ok: result.status === 0,
    exitCode: result.status,
    error: result.error?.message ?? null
  };
}

function main() {
  console.log("");
  console.log("Naye OpenClaw Status");
  console.log("--------------------");

  const results = [];

  for (const check of CHECKS) {
    console.log("");
    console.log(`=== ${check.name} ===`);
    console.log("");

    const result = runCheck(check);
    results.push(result);
  }

  const failed = results.filter(result => !result.ok);

  console.log("");
  console.log("Naye OpenClaw Status — Resumen");
  console.log("------------------------------");

  for (const result of results) {
    console.log(`[${result.ok ? "OK" : "REVISAR"}] ${result.name} (${result.script})`);
  }

  console.log("");
  console.log("Checks totales:", results.length);
  console.log("Checks OK:", results.filter(result => result.ok).length);
  console.log("Checks por revisar:", failed.length);
  console.log("Estado:", failed.length === 0 ? "OK" : "REVISAR");
  console.log("");

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
