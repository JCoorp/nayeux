# Naye Core — OpenClaw Bridge Plan

## Objetivo

Preparar una integración segura entre Naye Core y OpenClaw.

Naye Core seguirá siendo el núcleo principal local-first. OpenClaw se integrará después como una capa operativa/agente, no como reemplazo del núcleo.

## Regla principal

No se debe restaurar OpenClaw directamente sobre el sistema activo.

Toda migración debe pasar por:

staging -> inventory -> quarantine/approved -> integración controlada

## Carpetas

- F:\NayeVault\openclaw\staging
- F:\NayeVault\openclaw\inventory
- F:\NayeVault\openclaw\quarantine
- F:\NayeVault\openclaw\approved
- F:\NayeVault\openclaw\logs

## Política de seguridad

No migrar automáticamente:

- credenciales
- tokens
- sesiones
- cookies
- claves privadas
- perfiles de navegador
- datos de WhatsApp
- archivos personales no revisados
- configuraciones que den acceso externo sin permiso

## Qué sí puede migrarse después de revisión

- configuraciones limpias
- prompts
- documentación
- scripts no sensibles
- estructura de agentes
- manifiestos
- reglas de operación
- plantillas
- archivos de configuración sin secretos

## Fase 1

Crear inventario del backup de OpenClaw sin extraerlo completamente.

## Fase 2

Clasificar archivos en:

- seguro
- requiere revisión
- sensible
- excluir

## Fase 3

Mover solo archivos aprobados a:

F:\NayeVault\openclaw\approved

## Fase 4

Crear comandos de Naye Core para consultar el inventario de OpenClaw.

## Fase 5

Integrar OpenClaw como herramienta/capa operativa autorizada.
