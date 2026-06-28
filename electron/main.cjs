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
    "/api/chat"
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

ipcMain.handle("naye:get-status", () => fetchJsonFromNaye("/api/status"));
ipcMain.handle("naye:get-openclaw-status", () => fetchJsonFromNaye("/api/openclaw/status"));
ipcMain.handle("naye:get-openclaw-config", () => fetchJsonFromNaye("/api/openclaw/config-summary"));
ipcMain.handle("naye:get-node-profile", () => fetchJsonFromNaye("/api/node/profile"));
ipcMain.handle("naye:get-active-sessions", () => fetchJsonFromNaye("/api/sessions/active"));
ipcMain.handle("naye:send-chat", (_event, payload) => fetchJsonFromNaye("/api/chat", { method: "POST", body: payload }));

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
