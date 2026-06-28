# Naye Desktop UX

Aplicación local de escritorio para Naye, construida con Electron + Vite + React + TypeScript.

Esta versión reemplaza la consola web simple por una interfaz tipo asistente, parecida a GPT/Gemini, pero mantiene la regla de seguridad principal:

```text
Naye Desktop UX
  ↓
Naye Core API
  ↓
Naye Core / Bridge
  ↓
OpenClaw Gateway
```

La UX no se conecta directo a OpenClaw ni a `ws://127.0.0.1:18789`.

## Qué incluye

- Aplicación local de escritorio con Electron.
- Interfaz principal tipo chat moderno.
- Composer visual preparado, pero bloqueado hasta que exista `POST /api/chat`.
- Panel de sistema.
- Panel de OpenClaw.
- Panel de nodo local.
- Panel de sesiones.
- Lectura segura mediante IPC de Electron.
- Sin `localStorage`.
- Sin tokens visibles.
- Sin botones destructivos.
- Sin conexión directa al WebSocket de OpenClaw.

## Endpoints usados

La app consulta únicamente Naye Core API:

```text
GET http://127.0.0.1:17890/api/status
GET http://127.0.0.1:17890/api/openclaw/status
GET http://127.0.0.1:17890/api/openclaw/config-summary
GET http://127.0.0.1:17890/api/node/profile
GET http://127.0.0.1:17890/api/sessions/active
```

## Antes de abrir la app

Levanta OpenClaw y Naye Core API.

Terminal 1:

```powershell
cd F:\NayeVault\naye-core
openclaw gateway start
Start-Sleep -Seconds 8
npm run openclaw-bridge-status
```

Terminal 2:

```powershell
cd F:\NayeVault\naye-core
npm run naye-api
```

Si aparece `EADDRINUSE`, significa que la API ya está corriendo en `127.0.0.1:17890`.

## Instalar y ejecutar Naye Desktop UX

```powershell
cd F:\NayeVault\naye-core\naye-desktop-ux
npm install
npm run dev
```

Esto abre una ventana local de escritorio con Electron.

## Si Windows bloquea dependencias

Ejecuta:

```powershell
cd F:\NayeVault\naye-core\naye-desktop-ux
Get-ChildItem -Path . -Recurse | Unblock-File
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```

## Notas de diseño

Aunque Electron usa internamente un renderer basado en tecnologías web, el usuario no abre un HTML suelto: abre una aplicación local de escritorio. En desarrollo se usa Vite en `127.0.0.1:5173` solamente para servir el renderer de la app.

## Fase futura

Cuando Naye Core tenga estos endpoints, se puede activar el chat real y acciones controladas:

```text
POST /api/chat
POST /api/session/authorize
POST /api/session/close
GET /api/openclaw/capabilities
GET /api/openclaw/plugins
POST /api/openclaw/tool-request
```


## v0.3.0

Esta versión activa el composer de chat. El botón Enviar llama a `POST /api/chat` en Naye Core API.

Importante: esta UX no se conecta directamente a OpenClaw. La respuesta conversacional depende exclusivamente del endpoint local de Naye Core. Para esta fase, el endpoint puede responder en modo `local-safe` mientras se implementa la conexión profunda con OpenClaw.
