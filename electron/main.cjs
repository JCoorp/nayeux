const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

const NAYE_API_BASE_URL = "http://127.0.0.1:17890";
const isDev = !app.isPackaged;

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
  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

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

const OPERATIONAL_REQUEST_ROUTES = Object.freeze([
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/action-engine\/status$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+\/activity$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+\/orchestration$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/authorize$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/run$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/control$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/revoke$/ })
]);

function normalizeOperationalRequest(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Naye Desktop operational request must be an object.");
  }

  const endpoint = String(input.endpoint || "").trim();
  const method = String(input.method || "GET").trim().toUpperCase();
  if (!endpoint.startsWith("/") || endpoint.includes("?") || endpoint.includes("#")) {
    throw new TypeError("Naye Desktop operational endpoint is invalid.");
  }
  if (!OPERATIONAL_REQUEST_ROUTES.some((route) => route.method === method && route.pattern.test(endpoint))) {
    throw new Error(`Operational endpoint not allowed from Naye Desktop UX: ${method} ${endpoint}`);
  }

  return {
    endpoint,
    method,
    body: input.body
  };
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
  mode: isDev ? "development" : "production",
  apiBaseUrl: NAYE_API_BASE_URL,
  renderer: isDev ? "vite-dev-server" : "local-desktop-bundle"
}));

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
