const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nayeDesktop", {
  getDesktopContext: () => ipcRenderer.invoke("naye:get-desktop-context"),
  getStatus: () => ipcRenderer.invoke("naye:get-status"),
  getOpenClawStatus: () => ipcRenderer.invoke("naye:get-openclaw-status"),
  getOpenClawConfig: () => ipcRenderer.invoke("naye:get-openclaw-config"),
  getNodeProfile: () => ipcRenderer.invoke("naye:get-node-profile"),
  getActiveSessions: () => ipcRenderer.invoke("naye:get-active-sessions"),
  sendChat: (payload) => ipcRenderer.invoke("naye:send-chat", payload)
});
