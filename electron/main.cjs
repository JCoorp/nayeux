const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const {
  normalizeOperationalRequest
} = require("./operationalBridgePolicy.cjs");
const {
  DEV_RENDERER_URL,
  MAX_RENDERER_RECOVERY_ATTEMPTS,
  shouldRecoverRenderer
} = require("./rendererLifecyclePolicy.cjs");
const {
  resolveDefaultOperationalWorkspace
} = require("./operationalWorkspacePolicy.cjs");

const NAYE_API_BASE_URL = "http://127.0.0.1:17890";
const useDevServer = process.argv.includes("--naye-dev");

function rendererLog(type, details = {}) {
  const record = {
    schema: "naye-desktop-renderer-event-v1",
    timestamp: new Date().toISOString(),
    type,
    ...details
  };
  process.stdout.write(`[naye-renderer] ${JSON.stringify(record)}\n`);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "unknown_renderer_error");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function showRendererFailurePage(win, error) {
  if (win.isDestroyed()) return;
  const message = escapeHtml(errorMessage(error));
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Naye Desktop UX — renderer no disponible</title>
<style>
html,body{height:100%;margin:0;background:#090b12;color:#f5f7fb;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
body{display:grid;place-items:center}.card{max-width:760px;margin:32px;padding:28px;border:1px solid #303749;border-radius:16px;background:#111622}
h1{margin-top:0;font-size:24px}p{line-height:1.55;color:#c7cedd}code{display:block;white-space:pre-wrap;word-break:break-word;padding:14px;border-radius:10px;background:#080b11;color:#ffcf8b}
</style>
</head>
<body><main class="card"><h1>Naye Desktop UX no pudo cargar el renderer</h1><p>Core no se ha reiniciado. El proceso principal de Desktop conservó el error para diagnóstico y evitó dejar una ventana negra silenciosa.</p><code>${message}</code></main></body>
</html>`;

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } catch (fallbackError) {
    rendererLog("renderer_failure_page_failed", {
      error: errorMessage(fallbackError)
    });
  }
}

async function navigateRenderer(win, trigger) {
  if (win.isDestroyed()) return;

  rendererLog("renderer_navigation_started", {
    trigger,
    mode: useDevServer ? "development" : "production",
    target: useDevServer ? DEV_RENDERER_URL : "dist/index.html"
  });

  if (useDevServer) {
    await win.loadURL(DEV_RENDERER_URL, {
      extraHeaders: "Accept: text/html\n"
    });
  } else {
    await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  rendererLog("renderer_navigation_completed", {
    trigger,
    url: win.webContents.getURL()
  });
}

function installRendererLifecycle(win) {
  let recoveryAttempts = 0;
  let recoveryInFlight = false;

  win.webContents.on("did-navigate", (_event, url, httpResponseCode, httpStatusText) => {
    rendererLog("renderer_did_navigate", {
      url,
      httpResponseCode,
      httpStatusText
    });
  });

  win.webContents.on("did-finish-load", () => {
    rendererLog("renderer_did_finish_load", {
      url: win.webContents.getURL(),
      recoveryAttempts
    });
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      rendererLog("renderer_did_fail_load", {
        errorCode,
        errorDescription,
        validatedURL,
        recoveryAttempts
      });
    }
  );

  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    rendererLog("renderer_preload_error", {
      preloadPath,
      error: errorMessage(error)
    });
  });

  win.webContents.on("unresponsive", () => {
    rendererLog("renderer_unresponsive", {
      url: win.webContents.getURL(),
      recoveryAttempts
    });
  });

  win.webContents.on("responsive", () => {
    rendererLog("renderer_responsive", {
      url: win.webContents.getURL(),
      recoveryAttempts
    });
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    rendererLog("renderer_process_gone", {
      reason: details.reason,
      exitCode: details.exitCode,
      recoveryAttempts
    });

    if (recoveryInFlight) return;
    if (!shouldRecoverRenderer({
      reason: details.reason,
      attempts: recoveryAttempts,
      maxAttempts: MAX_RENDERER_RECOVERY_ATTEMPTS
    })) {
      rendererLog("renderer_recovery_not_attempted", {
        reason: details.reason,
        recoveryAttempts,
        maxAttempts: MAX_RENDERER_RECOVERY_ATTEMPTS
      });
      return;
    }

    recoveryAttempts += 1;
    recoveryInFlight = true;

    setTimeout(() => {
      void navigateRenderer(win, `render-process-gone:${details.reason}`)
        .catch(async (error) => {
          rendererLog("renderer_recovery_failed", {
            reason: details.reason,
            recoveryAttempts,
            error: errorMessage(error)
          });
          await showRendererFailurePage(win, error);
        })
        .finally(() => {
          recoveryInFlight = false;
        });
    }, 500);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: "Naye Desktop UX",
    backgroundColor: "#090b12",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.removeMenu();
  installRendererLifecycle(win);
  win.once("ready-to-show", () => win.show());

  void navigateRenderer(win, "initial")
    .catch(async (error) => {
      rendererLog("renderer_initial_navigation_failed", {
        error: errorMessage(error)
      });
      await showRendererFailurePage(win, error);
      if (!win.isDestroyed()) win.show();
    });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function getTimeoutForEndpoint(endpoint) {
  if (endpoint === "/api/openclaw/status") return 45000;
  if (endpoint === "/api/openclaw/config-summary") return 20000;
  if (endpoint === "/api/chat") return 60000;
  return 12000;
}

async function fetchJsonFromNaye(endpoint, options = {}) {
  const allowedEndpoints = new Set([
    "/api/status",
    "/api/openclaw/status",
    "/api/openclaw/config-summary",
    "/api/node/profile",
    "/api/sessions/active",
    "/api/chat",
    "/api/screen/live/status",
    "/api/screen/live/latest",
    "/api/screen/live/start",
    "/api/screen/live/stop"
  ]);

  if (!allowedEndpoints.has(endpoint)) {
    throw new Error(`Endpoint not allowed from Naye Desktop UX: ${endpoint}`);
  }

  const controller = new AbortController();
  const timeoutMs = getTimeoutForEndpoint(endpoint);
  const timeout = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms for ${endpoint}`)), timeoutMs);

  try {
    const res = await fetch(`${NAYE_API_BASE_URL}${endpoint}`, {
      method: options.method || "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });

    if (!res.ok) {
      throw new Error(`Naye API returned HTTP ${res.status} for ${endpoint}`);
    }

    return await res.json();
  } catch (error) {
    if (error?.name === "AbortError" || String(error?.message || "").includes("Timeout")) {
      throw new Error(`Timeout consultando ${endpoint}. Naye Core API respondió lento o el bridge está verificando OpenClaw.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOperationalJsonFromNaye(input = {}) {
  const request = normalizeOperationalRequest(input);
  const res = await fetch(`${NAYE_API_BASE_URL}${request.endpoint}`, {
    method: request.method,
    headers: {
      "Accept": "application/json",
      ...(request.method === "POST" ? { "Content-Type": "application/json" } : {})
    },
    ...(request.method === "POST" ? { body: JSON.stringify(request.body ?? {}) } : {})
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? { error: "naye_core_non_json_response", raw } : null;
  }

  return {
    ok: res.ok,
    status: res.status,
    data
  };
}

ipcMain.handle("naye:get-status", () => fetchJsonFromNaye("/api/status"));
ipcMain.handle("naye:get-openclaw-status", () => fetchJsonFromNaye("/api/openclaw/status"));
ipcMain.handle("naye:get-openclaw-config", () => fetchJsonFromNaye("/api/openclaw/config-summary"));
ipcMain.handle("naye:get-node-profile", () => fetchJsonFromNaye("/api/node/profile"));
ipcMain.handle("naye:get-active-sessions", () => fetchJsonFromNaye("/api/sessions/active"));
ipcMain.handle("naye:send-chat", (_event, payload) => fetchJsonFromNaye("/api/chat", { method: "POST", body: payload }));
ipcMain.handle("naye:operational-request", (_event, payload) => fetchOperationalJsonFromNaye(payload));

ipcMain.handle("naye:get-screen-live-status", () =>
  fetchJsonFromNaye("/api/screen/live/status")
);

ipcMain.handle("naye:get-screen-live-latest", () =>
  fetchJsonFromNaye("/api/screen/live/latest")
);

ipcMain.handle("naye:start-screen-live", (_event, payload) =>
  fetchJsonFromNaye("/api/screen/live/start", {
    method: "POST",
    body: payload
  })
);

ipcMain.handle("naye:stop-screen-live", () =>
  fetchJsonFromNaye("/api/screen/live/stop", {
    method: "POST",
    body: {}
  })
);
ipcMain.handle("naye:get-desktop-context", () => ({
  appName: "Naye Desktop UX",
  appVersion: app.getVersion(),
  mode: useDevServer ? "development" : "production",
  apiBaseUrl: NAYE_API_BASE_URL,
  renderer: useDevServer ? "vite-dev-server" : "local-desktop-bundle",
  defaultOperationalWorkspace:
    resolveDefaultOperationalWorkspace({
      env: process.env,
      appPath: app.getAppPath()
    })
}));

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("child-process-gone", (_event, details) => {
  rendererLog("electron_child_process_gone", details);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
