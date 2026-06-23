const { spawn, spawnSync } = require("child_process");
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

function quoteArg(value) {
  const text = String(value);
  if (/^[a-zA-Z0-9_./:=-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function killTree(pid) {
  try {
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true
    });
  } catch {}
}

function runCli(command, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const commandLine = [command, ...args].map(quoteArg).join(" ");

    const child = spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: process.cwd(),
      windowsHide: true,
      shell: false,
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      killTree(child.pid);
      resolve({
        command: commandLine,
        exitCode: null,
        stdout,
        stderr,
        error: "timeout",
        timedOut: true
      });
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        command: commandLine,
        exitCode: null,
        stdout,
        stderr,
        error: error.message,
        timedOut: false
      });
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        command: commandLine,
        exitCode: code,
        stdout,
        stderr,
        error: null,
        timedOut: false
      });
    });
  });
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

  const gatewayReachableByProbe =
    combined.includes("Connectivity probe: ok") ||
    combined.includes("Reachable: yes") ||
    combined.includes("Connect: ok");

  const capabilityAdminCapable =
    combined.includes("admin-capable");

  const gatewayListeningTextDetected =
    combined.includes("Listening: 127.0.0.1:18789");

  return {
    gatewayConfigured: combined.includes("Service: Scheduled Task") || combined.includes("Gateway:"),
    gatewayReachableByProbe,
    gatewayListeningTextDetected,
    capabilityAdminCapable,
    tokenPresentInCurrentEnv: Boolean(process.env.OPENCLAW_GATEWAY_AUTH_TOKEN),
    tcpReachable: tcpCheck.reachable,
    cliStatusTimedOut: statusOutput.timedOut === true,
    cliProbeTimedOut: probeOutput.timedOut === true,
    status: (
      tcpCheck.reachable &&
      Boolean(process.env.OPENCLAW_GATEWAY_AUTH_TOKEN) &&
      (
        capabilityAdminCapable ||
        gatewayReachableByProbe ||
        gatewayListeningTextDetected
      )
    ) ? "ok" : "review"
  };
}

async function main() {
  ensureDirs();

  const tcpCheck = await checkTcp(GATEWAY_HOST, GATEWAY_PORT);
  const statusOutput = await runCli("openclaw", ["gateway", "status"], 8000);
  const probeOutput = await runCli("openclaw", ["gateway", "probe"], 8000);

  const now = new Date().toISOString();
  const summary = summarize(statusOutput, probeOutput, tcpCheck);

  const report = {
    system: "Naye Core",
    component: "Naye OpenClaw Bridge Status",
    version: "0.2.0",
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
      tcpCheck,
      openclawGatewayStatus: statusOutput,
      openclawGatewayProbe: probeOutput
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
  console.log(`CLI status timed out: ${summary.cliStatusTimedOut}`);
  console.log(`CLI probe timed out: ${summary.cliProbeTimedOut}`);
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
