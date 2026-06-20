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
