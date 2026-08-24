# NAYE DESKTOP — NEXT CHAT START HERE

Checkpoint: 2026-08-24

Repository:
JCoorp/nayeux

Branch:
feat/live-operational-mission-ux-v2

DO NOT MERGE main without explicit human authorization.

Main Core handoff is in:

JCoorp/naye-core
branch:
feat/live-operational-mission-service-v2
file:
NEXT_CHAT_START_HERE.md

Read the Core handoff first.

---

# Desktop state

Prior feature HEAD before this checkpoint:

915625b
fix: surface full mission policy before authorization

Intentional working-tree change:

vite.config.ts

contains:

base: "./",

This is deliberate and required for Electron production loadFile behavior.

Do NOT reset or clean this change.

---

# UX mission behavior

Operational mission UX exposes:

- objective
- authorized workspace
- explicit mission policy before authorization
- one mission authorization
- live mission status
- active capabilities
- Activity Stream
- Pause
- Resume
- Stop
- Rollback
- Revoke

Desired final UX:

Natural user request
→ mission proposal
→ complete visible scope/policy
→ "¿Debo continuar?"
→ one authorization
→ autonomous mission

No per-command approval loops.

---

# Current physical mission at checkpoint

Mission:

mission-1-dd40f3be-233b-4030-874b-dbe0f320b536

State observed:

Control:
running

Orchestration:
waiting_for_capability_development

Active capabilities:

file.create_text
file.compress_gzip

Current missing capability:

file.decompress_gzip_and_compare

Latest observed development:

attempt 15 / 20

Do not click Continue/Resume merely because capability development takes time.

---

# Transient UX responsiveness issue

During the long capability-development loop, Windows displayed:

Naye Desktop UX (No responde)

The UI later recovered.

A later UI snapshot contained:

Error invoking remote method 'naye:operational-request':
TypeError: fetch failed

while Core's mission continued to advance.

Possible later investigation:

- renderer main-thread blocking
- huge Activity Stream rendering
- excessive JSON rendering
- polling overlap
- IPC/fetch timeout
- incremental rendering / virtualization

Do not assume Core is dead just because Electron temporarily says "No responde".

Check /api/status and backend activity first.

---

# Other non-blocking Desktop observations

Vite dev server:
127.0.0.1:5173

A stale previous renderer once occupied port 5173.

Electron emitted:

Unable to create cache
Gpu Cache Creation failed

These did not terminate Electron.

OpenClaw status endpoint has produced HTTP 503.

OpenClaw availability is separate from the operational mission engine.

---

# Product gap after physical acceptance

Normal chat currently does not naturally route real-effect requests into the
operational mission workflow.

Future desired integration:

chat request
→ operational intent detection
→ proposal
→ one human authorization
→ orchestrator
→ result returned naturally in chat

Do this AFTER core physical acceptance.

---

# Rules for next assistant

Do not reset vite.config.ts.

Do not merge main.

Do not confuse Desktop repo with naye-core.

Do not restart the live physical mission merely because the UI is slow.

Read the Core NEXT_CHAT_START_HERE.md before continuing development.