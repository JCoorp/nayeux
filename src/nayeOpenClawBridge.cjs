const { spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const VAULT_ROOT = "F:/NayeVault";
const OUT_DIR = path.join(VAULT_ROOT, "openclaw", "fresh", "runtime", "bridge-status");
const GATEWAY_HOST = "127.0.0.1";
const GATEWAY_PORT = 18789;

function ensureDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  return {
    command: [command, ...args].join(" "),
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null
  };
}

function checkTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    function finish(result) {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish({
        reachable: true,
        host,
        port,
        error: null
      });
    });

    socket.once("timeout", () => {
      finish({
        reachable: false,
        host,
        port,
        error: "timeout"
      });
    });

    socket.once("error", (error) => {
      finish({
        reachable: false,
        host,
        port,
        error: error.message
      });
    });

    socket.connect(port, host);
  });
}

function summarize(statusOutput, probeOutput, tcpCheck) {
  const combined = `${statusOutput.stdout}\n${probeOutput.stdout}\n${statusOutput.stderr}\n${probeOutput.stderr}`;

  return {
    gatewayConfigured: combined.includes("Service: Scheduled Task") || combined.includes("Gateway:"),
    gatewayReachableByProbe: combined.includes("Connectivity probe: ok") || combined.includes("Reachable: yes"),
    gatewayListeningTextDetected: combined.includes("Listening: 127.0.0.1:18789"),
    capabilityAdminCapable: combined.includes("admin-capable"),
    tokenPresentInCurrentEnv: Boolean(process.env.OPENCLAW_GATEWAY_AUTH_TOKEN),
    tcpReachable: tcpCheck.reachable,
    status: (
      (combined.includes("Connectivity probe: ok") || combined.includes("Reachable: yes") || tcpCheck.reachable) &&
      combined.includes("admin-capable")
    ) ? "ok" : "review"
  };
}

async function main() {
  ensureDirs();

  const statusOutput = run("openclaw", ["gateway", "status"]);
  const probeOutput = run("openclaw", ["gateway", "probe"]);
  const tcpCheck = await checkTcp(GATEWAY_HOST, GATEWAY_PORT);

  const now = new Date().toISOString();
  const summary = summarize(statusOutput, probeOutput, tcpCheck);

  const report = {
    system: "Naye Core",
    component: "Naye OpenClaw Bridge Status",
    version: "0.1.0",
    checkedAt: now,
    gateway: {
      host: GATEWAY_HOST,
      port: GATEWAY_PORT,
      url: `ws://${GATEWAY_HOST}:${GATEWAY_PORT}`,
      dashboard: `http://${GATEWAY_HOST}:${GATEWAY_PORT}/`,
      bindPolicy: "loopback_only"
    },
    summary,
    checks: {
      openclawGatewayStatus: statusOutput,
      openclawGatewayProbe: probeOutput,
      tcpCheck
    },
    security: {
      doNotExposeGatewayExternally: true,
      tokenValuePrinted: false,
      tokenPresentInCurrentEnv: Boolean(process.env.OPENCLAW_GATEWAY_AUTH_TOKEN),
      credentialAccessBlocked: true,
      cookiesBlocked: true,
      tokensBlockedFromInspection: true,
      browserProfilesBlocked: true
    }
  };

  const fileName = `naye-openclaw-bridge-status-${now.replace(/[:.]/g, "-")}.json`;
  const reportPath = path.join(OUT_DIR, fileName);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("Naye OpenClaw Bridge Status");
  console.log("---------------------------");
  console.log(`Gateway URL: ${report.gateway.url}`);
  console.log(`Probe reachable: ${summary.gatewayReachableByProbe}`);
  console.log(`TCP reachable: ${summary.tcpReachable}`);
  console.log(`Capability admin-capable: ${summary.capabilityAdminCapable}`);
  console.log(`Token env present: ${summary.tokenPresentInCurrentEnv}`);
  console.log(`Estado: ${summary.status}`);
  console.log(`Reporte: ${reportPath}`);

  if (summary.status !== "ok") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Error en Naye OpenClaw Bridge Status:", error.message);
  process.exit(1);
});
