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


function getDeviceCapabilities() {
  return {
    ok: true,
    component: "Naye Device Capabilities",
    version: "0.1.0",
    policy: {
      directPcControlEnabled: false,
      screenCaptureRequiresExplicitConfirmation: true,
      mouseControlEnabled: false,
      keyboardControlEnabled: false,
      commandExecutionEnabled: false
    },
    capabilities: {
      chat: true,
      openclawBridge: true,
      webSearch: true,
      webFetch: true,
      screenCapture: true,
      screenCaptureOnce: true,
      mouseControl: false,
      keyboardControl: false,
      fileRead: false,
      fileWrite: false,
      commandExecute: false
    }
  };
}


function readDeviceJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function ensureNayeRuntimeDir(...parts) {
  const fs = require("fs");
  const path = require("path");
  const dir = path.join("F:\\NayeVault", "runtime", ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeDeviceAuditEvent(event) {
  const fs = require("fs");
  const path = require("path");
  const auditDir = ensureNayeRuntimeDir("audit");
  const auditFile = path.join(auditDir, "naye-device-actions.jsonl");

  const record = {
    ...event,
    writtenAt: new Date().toISOString()
  };

  fs.appendFileSync(auditFile, JSON.stringify(record) + "\n", "utf8");
  return auditFile;
}

function captureScreenOnce() {
  return new Promise((resolve, reject) => {
    const fs = require("fs");
    const path = require("path");
    const execFile = require("child_process").execFile;
    const capturesDir = ensureNayeRuntimeDir("screen-captures");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(capturesDir, "screen-" + timestamp + ".png");

    const psScript = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$outputPath = $env:NAYE_SCREEN_CAPTURE_PATH",
      "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "if ($null -eq $bounds) { throw 'No primary screen detected' }",
      "$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
      "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
      "try {",
      "  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)",
      "  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)",
      "} finally {",
      "  $graphics.Dispose()",
      "  $bitmap.Dispose()",
      "}"
    ].join("\n");

    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      {
        windowsHide: true,
        timeout: 15000,
        env: {
          ...process.env,
          NAYE_SCREEN_CAPTURE_PATH: outputPath
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error("Screen capture failed: " + error.message + (stderr ? " | " + stderr : "")));
          return;
        }

        if (!fs.existsSync(outputPath)) {
          reject(new Error("Screen capture did not create output file."));
          return;
        }

        resolve({
          outputPath,
          stdout,
          stderr
        });
      }
    );
  });
}

async function handleScreenCaptureOnce(req, res) {
  let body;

  try {
    body = await readDeviceJsonBody(req);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: "invalid_request_body",
      message: error.message
    });
    return;
  }

  if (body.confirm !== "CAPTURE_ONCE_APPROVED") {
    writeDeviceAuditEvent({
      type: "screen_capture_denied",
      ok: false,
      reason: body.reason || "Missing explicit confirmation",
      requiredConfirm: "CAPTURE_ONCE_APPROVED",
      timestamp: new Date().toISOString()
    });

    sendJson(res, 403, {
      ok: false,
      error: "explicit_confirmation_required",
      message: "Screen capture requires confirm: CAPTURE_ONCE_APPROVED",
      requiredConfirm: "CAPTURE_ONCE_APPROVED"
    });
    return;
  }

  try {
    const result = await captureScreenOnce();

    const auditFile = writeDeviceAuditEvent({
      type: "screen_capture_once",
      ok: true,
      scope: "screen-capture-once",
      reason: body.reason || "Manual user-approved screen capture",
      savedTo: result.outputPath,
      timestamp: new Date().toISOString()
    });

    sendJson(res, 200, {
      ok: true,
      component: "Naye Screen Capture",
      mode: "capture-once",
      savedTo: result.outputPath,
      auditFile,
      timestamp: new Date().toISOString(),
      warning: "Capture created after explicit local confirmation. Continuous screen capture is not enabled."
    });
  } catch (error) {
    const auditFile = writeDeviceAuditEvent({
      type: "screen_capture_failed",
      ok: false,
      reason: body.reason || "Manual user-approved screen capture",
      error: error.message,
      timestamp: new Date().toISOString()
    });

    sendJson(res, 500, {
      ok: false,
      error: "screen_capture_failed",
      message: error.message,
      auditFile
    });
  }
}


function getNayePrivacyPolicy() {
  return {
    ok: true,
    component: "Naye Privacy Policy",
    version: "0.1.0",
    mode: "local_first_cloud_optional",
    defaultRoute: "local_only",
    sensitiveDataCloudBlocked: true,
    cloudRequiresExplicitApproval: true,
    rules: {
      screenToCloudBlocked: true,
      mouseKeyboardToCloudBlocked: true,
      filesToCloudBlocked: true,
      databaseToCloudBlocked: true,
      internalChatToCloudBlocked: true,
      credentialsToCloudBlocked: true,
      browserProfilesToCloudBlocked: true,
      cookiesToCloudBlocked: true,
      tokensToCloudBlocked: true
    },
    localOnlyRequestTypes: [
      "screen_analysis",
      "screen_live",
      "mouse_control",
      "keyboard_control",
      "computer_control",
      "file_read",
      "file_write",
      "database_query",
      "internal_chat",
      "private_data",
      "credential_access",
      "browser_profile_access"
    ],
    cloudOptionalRequestTypes: [
      "image_generation",
      "presentation_generation",
      "document_generation",
      "heavy_creative_task",
      "non_sensitive_research"
    ],
    cloudUseConditions: [
      "The request must not contain private/internal data.",
      "The request must not include screen, mouse, keyboard, files, database content, credentials, cookies, tokens, or local paths.",
      "The user must explicitly approve cloud use for that single task."
    ]
  };
}

function getNayeModelRouterStatus() {
  return {
    ok: true,
    component: "Naye Model Router",
    version: "0.1.0",
    policyMode: "local_first_cloud_optional",
    enforcement: {
      routeCheckAvailable: true,
      chatEnforcementEnabled: false,
      note: "Route policy exists, but /api/chat is not yet fully gated. Do not send private data to cloud chat until enforcement is enabled."
    },
    localModel: {
      configured: false,
      provider: null,
      textModel: null,
      visionModel: null,
      status: "pending_configuration"
    },
    cloudModel: {
      available: true,
      provider: "openclaw/openai",
      status: "available_but_policy_gated",
      requiresExplicitApproval: true
    },
    targetArchitecture: {
      privateChat: "local_only",
      databaseQueries: "local_only",
      screenMouseKeyboard: "local_only",
      files: "local_only",
      cloud: "optional_for_non_sensitive_heavy_tasks_only"
    }
  };
}

function readRouterJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function classifyNayeRoute(body) {
  const requestType = String(body.requestType || "").toLowerCase().trim();
  const message = String(body.message || body.prompt || body.text || "").toLowerCase();
  const combined = (requestType + " " + message).trim();

  const localOnlyTypes = new Set([
    "screen_analysis",
    "screen_live",
    "mouse_control",
    "keyboard_control",
    "computer_control",
    "file_read",
    "file_write",
    "database_query",
    "internal_chat",
    "private_data",
    "credential_access",
    "browser_profile_access"
  ]);

  const localOnlyKeywords = [
    "pantalla",
    "screen",
    "captura",
    "mouse",
    "raton",
    "teclado",
    "keyboard",
    "archivo",
    "file",
    "base de datos",
    "database",
    "bd",
    "sql",
    "interno",
    "privado",
    "confidencial",
    "cliente",
    "clientes",
    "empleado",
    "empleados",
    "inventario",
    "pedido",
    "pedidos",
    "orden",
    "ordenes",
    "contraseña",
    "password",
    "token",
    "cookie",
    "credencial",
    "credenciales",
    "ruta local",
    "c:\\",
    "f:\\"
  ];

  const cloudOptionalKeywords = [
    "imagen",
    "image",
    "presentacion",
    "presentación",
    "powerpoint",
    "pptx",
    "diapositiva",
    "diapositivas",
    "diseño",
    "design",
    "render",
    "crear desde cero",
    "documento completo",
    "trabajo pesado"
  ];

  const hasLocalOnlyType = localOnlyTypes.has(requestType);
  const hasLocalOnlyKeyword = localOnlyKeywords.some((keyword) => combined.includes(keyword));
  const hasCloudOptionalKeyword = cloudOptionalKeywords.some((keyword) => combined.includes(keyword));

  if (hasLocalOnlyType || hasLocalOnlyKeyword) {
    return {
      requestType: requestType || "detected_sensitive_or_internal_request",
      allowedRoute: "local_only",
      cloudAllowed: false,
      requiresExplicitApproval: false,
      reason: "The request may involve internal/private data, screen, mouse, keyboard, files, database, credentials, or local machine context. Cloud use is blocked."
    };
  }

  if (hasCloudOptionalKeyword) {
    return {
      requestType: requestType || "detected_heavy_non_sensitive_task",
      allowedRoute: "local_preferred_cloud_optional",
      cloudAllowed: true,
      requiresExplicitApproval: true,
      reason: "The request looks like a heavy creative/generation task. Cloud may be allowed only if the user explicitly approves and the content is non-sensitive."
    };
  }

  return {
    requestType: requestType || "general_chat",
    allowedRoute: "local_only",
    cloudAllowed: false,
    requiresExplicitApproval: false,
    reason: "Default route is local_only until a local model and explicit cloud approval policy are fully configured."
  };
}

async function handleModelRouterRouteCheck(req, res) {
  let body;

  try {
    body = await readRouterJsonBody(req);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: "invalid_request_body",
      message: error.message
    });
    return;
  }

  const route = classifyNayeRoute(body);

  sendJson(res, 200, {
    ok: true,
    component: "Naye Model Router Route Check",
    input: {
      requestType: body.requestType || null,
      hasMessage: Boolean(body.message || body.prompt || body.text)
    },
    route,
    policy: {
      defaultRoute: "local_only",
      sensitiveDataCloudBlocked: true,
      cloudRequiresExplicitApproval: true
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

  if (url.pathname === "/api/screen/capture-once") {
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: "method_not_allowed",
        allowedMethods: ["POST"]
      });
      return;
    }

    await handleScreenCaptureOnce(req, res);
    return;
  }

  if (url.pathname === "/api/model-router/route-check") {
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: "method_not_allowed",
        allowedMethods: ["POST"]
      });
      return;
    }

    await handleModelRouterRouteCheck(req, res);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, {
      error: "method_not_allowed"
    });
    return;
  }

  if (url.pathname === "/api/capabilities") {
    sendJson(res, 200, getDeviceCapabilities());
    return;
  }

  if (url.pathname === "/api/privacy/policy") {
    sendJson(res, 200, getNayePrivacyPolicy());
    return;
  }

  if (url.pathname === "/api/model-router/status") {
    sendJson(res, 200, getNayeModelRouterStatus());
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
      "GET /api/capabilities",
      "GET /api/privacy/policy",
      "GET /api/model-router/status",
      "GET /api/openclaw/status",
      "GET /api/openclaw/config-summary",
      "GET /api/node/profile",
      "GET /api/sessions/active",
      "POST /api/chat",
      "POST /api/model-router/route-check",
      "POST /api/screen/capture-once"
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
  console.log(`- GET  http://${HOST}:${PORT}/api/capabilities`);
  console.log(`- GET  http://${HOST}:${PORT}/api/privacy/policy`);
  console.log(`- GET  http://${HOST}:${PORT}/api/model-router/status`);
  console.log(`- POST http://${HOST}:${PORT}/api/model-router/route-check`);
  console.log(`- GET  http://${HOST}:${PORT}/api/openclaw/status`);
  console.log(`- GET  http://${HOST}:${PORT}/api/openclaw/config-summary`);
  console.log(`- GET  http://${HOST}:${PORT}/api/node/profile`);
  console.log(`- GET  http://${HOST}:${PORT}/api/sessions/active`);
  console.log(`- POST http://${HOST}:${PORT}/api/chat`);
  console.log(`- POST http://${HOST}:${PORT}/api/screen/capture-once`);
});
