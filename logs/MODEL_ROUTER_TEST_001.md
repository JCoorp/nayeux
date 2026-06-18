# Naye — Log de prueba del Model Router

## Fecha

2026-06-18

## Componente probado

Naye Model Router

## Ruta del componente

F:\NayeVault\naye-core

## Comando ejecutado

npm run test-router

## Resultado general

La prueba fue exitosa.

El router pudo clasificar correctamente diferentes tipos de entrada según:

- Tipo de tarea.
- Sensibilidad de datos.
- Proveedor recomendado.
- Necesidad de permiso.
- Bloqueo de proveedor externo.
- Motivo de la decisión.

## Casos probados

### Caso 1

Entrada:

Hazme un reporte general sobre inteligencia artificial.

Resultado:

- Tipo de tarea: document_generation_or_review
- Sensibilidad: public
- Proveedor recomendado: openai_or_local
- Requiere permiso: false
- Bloquea externo: false

### Caso 2

Entrada:

Revisa este contrato de una empresa y dime riesgos.

Resultado:

- Tipo de tarea: company_analysis
- Sensibilidad: confidential
- Proveedor recomendado: local
- Requiere permiso: true
- Bloquea externo: false

### Caso 3

Entrada:

Analiza mis archivos privados de la PC.

Resultado:

- Tipo de tarea: multi_device
- Sensibilidad: private
- Proveedor recomendado: local
- Requiere permiso: false
- Bloquea externo: false

### Caso 4

Entrada:

Guarda esta contraseña y este token.

Resultado:

- Tipo de tarea: general
- Sensibilidad: critical
- Proveedor recomendado: local
- Requiere permiso: true
- Bloquea externo: true

### Caso 5

Entrada:

Genera un documento público sobre metodología ágil.

Resultado:

- Tipo de tarea: document_generation_or_review
- Sensibilidad: public
- Proveedor recomendado: openai_or_local
- Requiere permiso: false
- Bloquea externo: false

## Conclusión

El primer Model Router de Naye funciona correctamente en modo dry_run.

Naye ya puede tomar una primera decisión antes de usar un modelo de IA.

## Próximo paso

Inicializar Git en F:\NayeVault\naye-core para versionar el código base.

Menos caos, más control.
