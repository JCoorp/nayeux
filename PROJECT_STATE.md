# Naye Core — Project State

Fecha de checkpoint: 2026-06-19

## Estado general

Naye Core tiene una arquitectura local-first funcional y estable para esta etapa.

## Componentes consolidados

- Naye Core
- Model Router
- Runtime Audit Logger
- Tool Factory
- Tool Approver
- Tool Activator
- Active Tool Runner
- Ollama como proveedor local
- Modelo local configurable
- Naye Doctor
- Knowledge Indexer
- Knowledge Retriever
- Knowledge Approver
- Knowledge Status

## Modelo local

Proveedor local:

- Ollama

Modelo actual:

- llama3.2:3b

Configuración:

- config/local-model.config.json

## Herramientas activas

Herramienta activa actual:

- systemStatus

Estado:

- active
- solo lectura
- sin red
- sin proveedor externo

## Memoria documental

Rutas principales:

- Inbox: F:\NayeVault\knowledge\inbox
- Approved: F:\NayeVault\knowledge\approved
- Archive: F:\NayeVault\knowledge\archive
- Index: F:\NayeVault\knowledge\index\knowledge-index.json
- Approval log: F:\NayeVault\knowledge\index\knowledge-approvals.json

Flujo correcto:

inbox -> approve-knowledge -> approved -> index-knowledge -> respuesta con memoria

## Comandos principales

npm run doctor
npm run knowledge-status
npm run index-knowledge
npm run ask -- "estatus de la pc"
npm run ask -- "según la memoria local, cuál es el estado actual de Naye Core"

## Estado esperado

- Sistema base: OK
- Modelo local listo: OK
- Herramientas activas: OK
- Memoria documental: OK
- Aprobaciones documentales: OK

## OpenClaw

OpenClaw sí se usará, pero después de consolidar Naye Core, herramientas locales, memoria documental, auditoría y permisos.

No se deben restaurar credenciales antiguas de OpenClaw sin revisión explícita del Usuario Administrador designado.

## Siguiente paso recomendado

Crear un comando formal:

npm run archive-knowledge -- "archivo.md"

para archivar documentos aprobados sin romper el registro de aprobaciones.

---

## Actualización: Knowledge Archiver

Se agregó el comando formal para archivar documentos de conocimiento aprobados.

Comando:

npm run archive-knowledge -- "archivo.md"

Función:

- Mueve documentos desde F:\NayeVault\knowledge\approved hacia F:\NayeVault\knowledge\archive.
- Cambia el estado del documento en knowledge-approvals.json a archived.
- Evita que documentos archivados sigan apareciendo como conocimiento activo.
- Permite conservar historial sin contaminar la memoria documental activa.

Flujo actualizado de memoria:

inbox -> approve-knowledge -> approved -> index-knowledge -> respuesta con memoria
approved -> archive-knowledge -> archive -> index-knowledge

Comandos de mantenimiento actuales:

npm run approve-knowledge -- "archivo.md"
npm run archive-knowledge -- "archivo.md"
npm run index-knowledge
npm run knowledge-status
npm run doctor

Último commit relevante:

645ee81 Add knowledge archive command

---

## Actualización: Doctor archive awareness

Se actualizó Naye Doctor para distinguir correctamente entre:

- Documentos indexados activos.
- Aprobaciones formales activas.
- Documentos archivados formalmente.
- Archivos presentes en archive.

Ahora Doctor muestra:

- Aprobaciones formales activas.
- Aprobados activos.
- Archivados formalmente.
- Documentos archivados.
- Archivos en archive.
- Archivado documental: OK.

Esto alinea Doctor con knowledge-status y evita que documentos archivados se cuenten como conocimiento activo.

Último commit relevante:

d21d441 Update Doctor archive awareness

---

## Decisión: OpenClaw desde cero

Se decidió no restaurar el backup antiguo de OpenClaw.

Motivo:

- Evitar credenciales antiguas.
- Evitar sesiones, cookies o tokens.
- Evitar configuraciones heredadas inseguras.
- Mantener Naye Core limpio y controlado.

Nueva estrategia:

- Crear OpenClaw desde cero.
- Usar F:\NayeVault\openclaw\fresh como espacio limpio.
- Conectar OpenClaw después mediante un puente controlado desde Naye Core.

Ruta base:

F:\NayeVault\openclaw\fresh

Regla:

Naye Core sigue siendo el núcleo. OpenClaw será una capa operativa/agente, no un reemplazo.

---

## Actualización: OpenClaw Fresh Agent Registry

Se creó el primer agente preparado de OpenClaw Fresh:

- Agent ID: naye-ops
- Nombre: Naye Ops
- Estado: prepared_not_active
- Runtime: deshabilitado
- Ejecución: no permitida
- Red: deshabilitada
- Proveedores externos: deshabilitados
- Modificación de archivos: deshabilitada
- Acceso a credenciales: deshabilitado
- Datos heredados: deshabilitados
- Requiere aprobación del bridge: true

Archivos creados fuera del repo:

- F:\NayeVault\openclaw\fresh\agents\naye-ops.agent.json
- F:\NayeVault\openclaw\fresh\prompts\naye-ops.system.md

Comando de validación:

npm run openclaw-agents-status

Resultado esperado:

- Agentes totales: 1
- Agentes seguros: 1
- Agentes por revisar: 0
- Estado: OK

---

## Actualización: OpenClaw Fresh Agent Registry

Se creó el primer agente preparado de OpenClaw Fresh:

- Agent ID: naye-ops
- Nombre: Naye Ops
- Estado: prepared_not_active
- Runtime: deshabilitado
- Ejecución: no permitida
- Red: deshabilitada
- Proveedores externos: deshabilitados
- Modificación de archivos: deshabilitada
- Acceso a credenciales: deshabilitado
- Datos heredados: deshabilitados
- Requiere aprobación del bridge: true

Archivos creados fuera del repo:

- F:\NayeVault\openclaw\fresh\agents\naye-ops.agent.json
- F:\NayeVault\openclaw\fresh\prompts\naye-ops.system.md

Comando de validación:

npm run openclaw-agents-status

Resultado esperado:

- Agentes totales: 1
- Agentes seguros: 1
- Agentes por revisar: 0
- Estado: OK

---

## Actualización: OpenClaw Fresh Agent Registry

Se creó el primer agente preparado de OpenClaw Fresh:

- Agent ID: naye-ops
- Nombre: Naye Ops
- Estado: prepared_not_active
- Runtime: deshabilitado
- Ejecución: no permitida
- Red: deshabilitada
- Proveedores externos: deshabilitados
- Modificación de archivos: deshabilitada
- Acceso a credenciales: deshabilitado
- Datos heredados: deshabilitados
- Requiere aprobación del bridge: true

Archivos creados fuera del repo:

- F:\NayeVault\openclaw\fresh\agents\naye-ops.agent.json
- F:\NayeVault\openclaw\fresh\prompts\naye-ops.system.md

Comando de validación:

npm run openclaw-agents-status

Resultado esperado:

- Agentes totales: 1
- Agentes seguros: 1
- Agentes por revisar: 0
- Estado: OK

---

## Actualización: OpenClaw integrado en Naye Doctor

Se integró la validación general de OpenClaw Fresh dentro de Naye Doctor.

Ahora el comando:

npm run doctor

también valida:

- OpenClaw Fresh Status
- OpenClaw Agents Status
- Configuración fresh segura
- Bridge preparado pero no conectado operativamente
- Agente naye-ops preparado pero no activo

Resultado esperado en Doctor:

- OpenClaw Fresh: OK

Esto significa que Naye Core ya supervisa el estado de OpenClaw Fresh desde su diagnóstico principal, sin habilitar ejecución operativa todavía.

---

## Actualización: OpenClaw Proposal Review Flow

Se implementó y validó el flujo seguro de propuestas de OpenClaw Fresh.

Comandos disponibles:

- npm run openclaw-propose
- npm run openclaw-proposals-status
- npm run openclaw-approve
- npm run openclaw-reject
- npm run openclaw-status

Estado validado:

- Propuestas pendientes: 1
- Acciones aprobadas: 1
- Acciones rechazadas: 1
- Propuestas por revisar: 0
- OpenClaw Status: OK

Reglas de seguridad confirmadas:

- Las propuestas no ejecutan acciones.
- Las acciones aprobadas quedan en estado approved_not_executed.
- Incluso aprobadas, execution.allowed permanece en false.
- Toda aprobación queda registrada con Usuario Administrador designado.
- Las propuestas rechazadas se mueven a rejected-actions y no pueden ejecutarse.
- OpenClaw sigue sin conexión operativa directa.

Conclusión:

OpenClaw Fresh ya puede proponer, aprobar, rechazar y auditar acciones, pero todavía no puede ejecutar cambios en el sistema.

---

## Actualización: OpenClaw Execution Plan Layer

Se implementó la capa de planes de ejecución para OpenClaw Fresh.

Comandos disponibles:

- npm run openclaw-execution-plan
- npm run openclaw-execution-plans-status
- npm run openclaw-status

Estado validado:

- Planes totales: 1
- Planes seguros: 1
- Planes por revisar: 0
- OpenClaw Status: OK
- Checks totales en OpenClaw Status: 4
- Checks OK: 4

Reglas de seguridad confirmadas:

- Los planes quedan en estado planned_not_executable.
- execution.allowed permanece en false.
- execution.executed permanece en false.
- executorEnabled permanece en false.
- executionApprovalRequired permanece en true.
- executionApproved permanece en false.
- No se permite red.
- No se permiten proveedores externos.
- No se permite modificación de archivos.
- No se permite acceso a credenciales.
- Se requiere revisión manual.

Conclusión:

OpenClaw Fresh ya puede generar planes de ejecución revisables desde acciones aprobadas, pero todavía no puede ejecutar comandos ni modificar archivos.

---

## Actualización: OpenClaw Dry-Run Execution Chain

Se completó la cadena segura de OpenClaw Fresh hasta ejecución simulada en modo dry-run.

Cadena validada:

- OpenClaw Fresh Status
- OpenClaw Agents Status
- OpenClaw Proposals Status
- OpenClaw Execution Plans Status
- OpenClaw Execution Approvals Status
- OpenClaw Execution Runs Status

Comandos disponibles:

- npm run openclaw-propose
- npm run openclaw-approve
- npm run openclaw-reject
- npm run openclaw-proposals-status
- npm run openclaw-execution-plan
- npm run openclaw-execution-plans-status
- npm run openclaw-approve-execution
- npm run openclaw-execution-approvals-status
- npm run openclaw-execute-dry-run
- npm run openclaw-execution-runs-status
- npm run openclaw-status

Estado validado:

- Propuestas pendientes: 1
- Acciones aprobadas: 1
- Acciones rechazadas: 1
- Planes de ejecución seguros: 1
- Aprobaciones de ejecución seguras: 1
- Runs dry-run seguros: 1
- OpenClaw Status: OK
- Checks totales en OpenClaw Status: 6
- Checks OK: 6

Reglas de seguridad confirmadas:

- El dry-run no ejecuta comandos.
- El dry-run no modifica archivos.
- execution.allowed permanece en false.
- execution.executed permanece en false.
- executorEnabled permanece en false.
- commandsExecuted permanece vacío.
- filesModified permanece vacío.
- finalExecutorGatePassed permanece en false.
- No se permite red.
- No se permiten proveedores externos.
- No se permite acceso a credenciales.
- No se permite acceso a datos heredados.

Conclusión:

OpenClaw Fresh ya tiene una cadena completa de propuesta, revisión, planificación, aprobación específica y dry-run auditado, pero todavía no tiene ejecución real habilitada.

---

## Actualización: OpenClaw Final Executor Gate

Se integró la compuerta final del ejecutor en OpenClaw Status.

Cadena actual validada:

- OpenClaw Fresh Status
- OpenClaw Agents Status
- OpenClaw Proposals Status
- OpenClaw Execution Plans Status
- OpenClaw Execution Approvals Status
- OpenClaw Execution Runs Status
- OpenClaw Execution Policy Status
- OpenClaw Final Executor Gates Status

Estado validado:

- OpenClaw Status: OK
- Checks totales: 8
- Checks OK: 8
- Compuertas finales seguras: 2
- Estado de compuertas: final_gate_valid_executor_not_enabled

Conclusión:

La cadena previa al ejecutor real ya está completa. La acción evaluada por la compuerta final es compatible con la política de ejecución controlada, pero el ejecutor real aún no está implementado ni habilitado.
