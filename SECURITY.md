# Seguridad de Naye Desktop UX

Reglas aplicadas:

- La UX solo llama a Naye Core API.
- La UX no se conecta al WebSocket de OpenClaw.
- La UX no pide tokens.
- La UX no muestra tokens.
- La UX no guarda secretos en localStorage.
- La UX no ejecuta acciones destructivas.
- El proceso principal de Electron permite únicamente endpoints GET explícitamente autorizados.
- Las rutas locales sensibles se acortan visualmente antes de mostrarse.
- El chat visual está bloqueado hasta que exista `POST /api/chat` en Naye Core.
