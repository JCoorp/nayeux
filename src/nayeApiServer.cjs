const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HOST = "127.0.0.1";
const PORT = 17890;

const VAULT_ROOT = "F:/NayeVault";
const NODE_PROFILES_DIR = path.join(VAULT_ROOT, "devices", "nodes", "profiles");
const ACTIVE_SESSIONS_DIR = path.join(VAULT_ROOT, "devices", "nodes", "sessions", "active");
const BRIDGE_SCRIPT = path.join(process.cwd(), "src", "nayeOpenClawBridge.cjs");

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      return {
        file,
        fullPath,
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function getLatestNodeProfile() {
  const files = listJsonFiles(NODE_PROFILES_DIR);
  if (files.length === 0) return null;

  const latest = files[0];
  const data = safeReadJson(latest.fullPath);

  return {
    file: latest.file,
    modifiedAt: latest.modifiedAt,
    profile: data
  };
}

function getActiveSessions() {
  const files = listJsonFiles(ACTIVE_SESSIONS_DIR);

  return files.map((item) => ({
    file: item.file,
    modifiedAt: item.modifiedAt,
    session: safeReadJson(item.fullPath)
  }));
}

function runBridgeStatus(timeoutMs = 12000) {
  return new Promise((resolve) => {
    const child = spawn("node", [BRIDGE_SCRIPT], {
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
      try {
        child.kill("SIGTERM");
      } catch {}
      resolve({
        ok: false,
        timedOut: true,
        stdout,
        stderr,
        error: "bridge timeout"
      });
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      resolve({
        ok: code === 0,
        exitCode: code,
        timedOut: false,
        stdout,
        stderr,
        statusDetected: stdout.includes("Estado: ok") ? "ok" : "review"
      });
    });
  });
}

function getOpenClawConfigSummary() {
  const configPath = path.join(process.env.USERPROFILE || "", ".openclaw", "openclaw.json");
  const config = safeReadJson(configPath);

  if (!config) {
    return {
      found: false,
      configPath
    };
  }

  return {
    found: true,
    configPath,
    sanitized: {
      gateway: config.gateway ? {
        bind: config.gateway.bind,
        port: config.gateway.port,
        authMode: config.gateway.auth && config.gateway.auth.mode ? config.gateway.auth.mode : undefined
      } : undefined,
      model: config.model || config.models || undefined,
      pluginsPresent: Boolean(config.plugins),
      channelsPresent: Boolean(config.channels),
      webPresent: Boolean(config.web),
      secretsRedacted: true
    }
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, {
      error: "method_not_allowed"
    });
    return;
  }

  if (url.pathname === "/api/status") {
    sendJson(res, 200, {
      system: "Naye Core API",
      status: "running",
      host: HOST,
      port: PORT,
      timestamp: new Date().toISOString(),
      openClawGateway: "ws://127.0.0.1:18789",
      purpose: "Local API bridge for Naye UX."
    });
    return;
  }

  if (url.pathname === "/api/openclaw/status") {
    const bridge = await runBridgeStatus();
    sendJson(res, bridge.ok ? 200 : 503, {
      component: "OpenClaw Bridge",
      bridge
    });
    return;
  }

  if (url.pathname === "/api/openclaw/config-summary") {
    sendJson(res, 200, {
      component: "OpenClaw Config Summary",
      config: getOpenClawConfigSummary()
    });
    return;
  }

  if (url.pathname === "/api/node/profile") {
    sendJson(res, 200, {
      component: "Naye Node Profile",
      latest: getLatestNodeProfile()
    });
    return;
  }

  if (url.pathname === "/api/sessions/active") {
    sendJson(res, 200, {
      component: "Naye Active Sessions",
      sessions: getActiveSessions()
    });
    return;
  }

  sendJson(res, 404, {
    error: "not_found",
    availableEndpoints: [
      "/api/status",
      "/api/openclaw/status",
      "/api/openclaw/config-summary",
      "/api/node/profile",
      "/api/sessions/active"
    ]
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 500, {
      error: "internal_error",
      message: error.message
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("Naye Core API");
  console.log("-------------");
  console.log(`Local API: http://${HOST}:${PORT}`);
  console.log("Endpoints:");
  console.log(`- http://${HOST}:${PORT}/api/status`);
  console.log(`- http://${HOST}:${PORT}/api/openclaw/status`);
  console.log(`- http://${HOST}:${PORT}/api/openclaw/config-summary`);
  console.log(`- http://${HOST}:${PORT}/api/node/profile`);
  console.log(`- http://${HOST}:${PORT}/api/sessions/active`);
});
