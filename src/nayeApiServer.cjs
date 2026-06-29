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

const OPENCLAW_MODEL = process.env.NAYE_OPENCLAW_MODEL || "openai/gpt-5.5";
const OPENCLAW_CHAT_TIMEOUT_MS = Number(process.env.NAYE_OPENCLAW_CHAT_TIMEOUT_MS || 240000);
const OPENCLAW_BRIDGE_TIMEOUT_MS = Number(process.env.NAYE_OPENCLAW_BRIDGE_TIMEOUT_MS || 20000);
const MAX_CHAT_MESSAGE_LENGTH = Number(process.env.NAYE_MAX_CHAT_MESSAGE_LENGTH || 8000);

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function readRequestJson(req, maxBytes = 128 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request_body_too_large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

function runBridgeStatus(timeoutMs = OPENCLAW_BRIDGE_TIMEOUT_MS) {
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

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        timedOut: false,
        stdout,
        stderr,
        error: error.message
      });
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      resolve({
        ok: code === 0 && stdout.includes("Estado: ok"),
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

function createOpenClawProcess(args) {
  const options = {
    cwd: process.cwd(),
    windowsHide: true,
    shell: false,
    env: process.env
  };

  // Windows cannot reliably spawn .cmd launchers directly with shell:false.
  // Route through cmd.exe while keeping arguments separated to avoid the
  // spawn EINVAL failure seen when calling openclaw.cmd directly.
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "openclaw.cmd", ...args], options);
  }

  return spawn("openclaw", args, options);
}

function extractJsonObject(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  const jsonSlice = text.slice(first, last + 1);

  try {
    return JSON.parse(jsonSlice);
  } catch {
    return null;
  }
}

function sanitizeProcessText(text, maxLength = 4000) {
  if (!text) return "";
  return text
    .replace(/token\s*[:=]\s*[^\s]+/gi, "token=[REDACTED]")
    .replace(/api[_-]?key\s*[:=]\s*[^\s]+/gi, "api_key=[REDACTED]")
    .slice(0, maxLength);
}

function runOpenClawModel(message, timeoutMs = OPENCLAW_CHAT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const args = [
      "--no-color",
      "infer",
      "model",
      "run",
      "--gateway",
      "--model",
      OPENCLAW_MODEL,
      "--thinking",
      "minimal",
      "--json",
      "--prompt",
      message
    ];

    let child;

    try {
      child = createOpenClawProcess(args);
    } catch (error) {
      resolve({
        ok: false,
        timedOut: false,
        stdout: "",
        stderr: "",
        error: error.message || "openclaw spawn failed"
      });
      return;
    }

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
        stdout: sanitizeProcessText(stdout),
        stderr: sanitizeProcessText(stderr),
        error: "openclaw model timeout"
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
        ok: false,
        timedOut: false,
        stdout: sanitizeProcessText(stdout),
        stderr: sanitizeProcessText(stderr),
        error: error.message
      });
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      const parsed = extractJsonObject(stdout);
      const outputText = parsed && Array.isArray(parsed.outputs)
        ? parsed.outputs.map((item) => item && item.text ? item.text : "").filter(Boolean).join("\n\n").trim()
        : "";

      resolve({
        ok: code === 0 && Boolean(parsed && parsed.ok && outputText),
        exitCode: code,
        timedOut: false,
        stdout: sanitizeProcessText(stdout),
        stderr: sanitizeProcessText(stderr),
        parsed,
        reply: outputText,
        provider: parsed && parsed.provider ? parsed.provider : undefined,
        model: parsed && parsed.model ? parsed.model : undefined,
        capability: parsed && parsed.capability ? parsed.capability : undefined,
        transport: parsed && parsed.transport ? parsed.transport : undefined,
        error: code === 0 ? undefined : "openclaw model command failed"
      });
    });
  });
}

async function handleChat(req, res) {
  let payload;

  try {
    payload = await readRequestJson(req);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      id: `chat-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: "naye-core-api",
      mode: "error",
      reply: "No pude leer el mensaje porque el JSON recibido no es válido.",
      error: {
        layer: "core-api",
        code: error.message,
        recoverable: true
      }
    });
    return;
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const id = `chat-${Date.now()}`;
  const timestamp = new Date().toISOString();

  if (!message) {
    sendJson(res, 400, {
      ok: false,
      id,
      timestamp,
      source: "naye-core-api",
      mode: "error",
      reply: "Escribe un mensaje para Naye.",
      error: {
        layer: "core-api",
        code: "empty_message",
        recoverable: true
      }
    });
    return;
  }

  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    sendJson(res, 413, {
      ok: false,
      id,
      timestamp,
      source: "naye-core-api",
      mode: "blocked",
      reply: `El mensaje excede el límite permitido de ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`,
      policy: {
        blocked: true,
        reason: "message-too-long",
        riskLevel: "low"
      }
    });
    return;
  }

  const bridge = await runBridgeStatus();
  const activeSessions = getActiveSessions();

  // v0.4.3: do not hard-block chat only because the bridge status probe reports
  // "review". The authoritative test for chat is the model call through
  // `openclaw infer model run --gateway`. This keeps the UX functional when
  // OpenClaw can answer but the diagnostic bridge probe is stricter than needed.
  const openclaw = await runOpenClawModel(message);

  if (!openclaw.ok) {
    const bridgeIsHealthy = Boolean(bridge.ok && bridge.statusDetected === "ok");
    sendJson(res, bridgeIsHealthy ? 502 : 503, {
      ok: false,
      id,
      timestamp,
      source: "naye-core-api",
      mode: "error",
      reply: bridgeIsHealthy
        ? "Naye Core sí recibió tu mensaje, pero OpenClaw no pudo generar una respuesta del modelo."
        : "OpenClaw no está disponible desde Naye Core para chat en este momento. El diagnóstico del bridge no está en estado ok y el modelo tampoco respondió.",
      bridge: {
        ok: bridge.ok,
        statusDetected: bridge.statusDetected || "review",
        timedOut: bridge.timedOut
      },
      openclaw: {
        ok: false,
        timedOut: openclaw.timedOut,
        exitCode: openclaw.exitCode,
        stderr: openclaw.stderr,
        stdout: openclaw.stdout
      },
      error: {
        layer: bridgeIsHealthy ? "openclaw" : "bridge",
        code: openclaw.timedOut ? "openclaw_timeout" : "openclaw_model_failed",
        recoverable: true,
        suggestion: "Verifica que `openclaw infer model run --gateway --model openai/gpt-5.5 --json --prompt \"hola\"` responda correctamente y reinicia Naye Core API."
      }
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    id,
    timestamp,
    source: "naye-core-api",
    mode: "openclaw-assisted",
    reply: openclaw.reply,
    bridge: {
      ok: bridge.ok,
      statusDetected: bridge.statusDetected,
      timedOut: bridge.timedOut
    },
    openclaw: {
      ok: true,
      transport: openclaw.transport,
      capability: openclaw.capability,
      provider: openclaw.provider,
      model: openclaw.model
    },
    sessions: {
      activeCount: activeSessions.length
    }
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/chat") {
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: "method_not_allowed",
        allowedMethods: ["POST"]
      });
      return;
    }

    await handleChat(req, res);
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
      "GET /api/status",
      "GET /api/openclaw/status",
      "GET /api/openclaw/config-summary",
      "GET /api/node/profile",
      "GET /api/sessions/active",
      "POST /api/chat"
    ]
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 500, {
      ok: false,
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
  console.log(`Chat mode: OpenClaw assisted via ${OPENCLAW_MODEL} (v0.4.3 tolerant bridge check + Windows spawn fix)`);
  console.log("Endpoints:");
  console.log(`- GET  http://${HOST}:${PORT}/api/status`);
  console.log(`- GET  http://${HOST}:${PORT}/api/openclaw/status`);
  console.log(`- GET  http://${HOST}:${PORT}/api/openclaw/config-summary`);
  console.log(`- GET  http://${HOST}:${PORT}/api/node/profile`);
  console.log(`- GET  http://${HOST}:${PORT}/api/sessions/active`);
  console.log(`- POST http://${HOST}:${PORT}/api/chat`);
});
