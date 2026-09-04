# Naye Desktop UX

Aplicación local de escritorio para Naye, construida con Electron + Vite + React + TypeScript.

La frontera de producto es:

```text
Naye Desktop UX
  ↓
Naye Unified Core API · 127.0.0.1:17890
  ↓
Live Mission Service / Action Engine
  ↓
Legacy runtime + modelo local
```

La UX no obtiene autoridad operacional por sí misma. La autorización pertenece al Mission Envelope del Core.

## Modos

- **Naye**: experiencia de asistente y estado local existente.
- **Misiones**: flujo operacional de alto nivel para proponer, autorizar, ejecutar y observar una misión.

La vista de Misiones usa únicamente:

```text
GET  /api/operational/action-engine/status
POST /api/operational/missions
GET  /api/operational/missions/:id
GET  /api/operational/missions/:id/activity
GET  /api/operational/missions/:id/orchestration
POST /api/operational/missions/:id/authorize
POST /api/operational/missions/:id/run
POST /api/operational/missions/:id/control
POST /api/operational/missions/:id/revoke
```

El bridge IPC de Electron rechaza rutas operacionales inferiores como `actions/admit`, `actions/dispatch`, grants y runtime interno.

## Antes de abrir Desktop

Usa el Core de la rama compatible con el Live Mission Service y asegúrate de que el modelo local configurado por Naye esté disponible.

Desde el repositorio `naye-core`:

```powershell
npm ci
npm run naye-api-unified
```

`naye-api-unified` expone la API pública en `127.0.0.1:17890` y levanta automáticamente el Core legacy upstream en el puerto siguiente disponible/configurado para esta ruta (`17891` por defecto).

En Windows, el gateway usa `F:/NayeVault` como vault por defecto. Si ese volumen no existe, define uno explícitamente antes de iniciar Core, por ejemplo:

```powershell
$env:NAYE_VAULT_ROOT = "$env:USERPROFILE\NayeVault"
npm run naye-api-unified
```

## Desarrollo Desktop

Desde el repositorio separado `nayeux`:

```powershell
npm ci
npm run dev
```

`npm run dev` inicia Vite en `127.0.0.1:5173` y Electron con el flag interno `--naye-dev`.

## Probar el bundle construido

```powershell
npm ci
npm run build
npm start
```

`npm start` carga `dist/index.html` directamente. No necesita un Vite dev server.

Las llamadas operacionales de Electron pasan por el preload/IPC bounded y desde el proceso principal llegan a la API local del Core. El fallback `fetch` directo existe únicamente cuando la UI se ejecuta como navegador de desarrollo sin el bridge Electron.

## Control humano

Durante una misión autorizada, Desktop mantiene visibles y utilizables los controles de:

- Pause
- Resume
- Stop
- Rollback
- Revocar autorización

El Activity Stream y el estado de orchestration se consultan periódicamente para que el usuario pueda observar plan, capability gaps, desarrollo, activación, ejecución, verificación y fallos.

## Truth boundary actual

La UI muestra explícitamente estados que todavía no deben maquillarse como garantías:

- `automaticExecution`
- restart recovery
- power-loss durability
- model authority
- source-author authority

Una build verde de Desktop no sustituye la prueba física Desktop → Core → modelo local → misión adaptativa. Esa prueba es un gate separado.

## Integridad de aceptación

La rama de Misiones usa un objetivo inicial neutral. No incorpora soluciones específicas ni prepara de antemano una futura misión de aceptación del usuario.
