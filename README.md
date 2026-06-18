# Naye Core

Naye Core es el núcleo técnico inicial del sistema Naye.

## Estado actual

Versión: 0.1.0

Estado: Model Router inicial funcionando en modo dry_run.

## Propósito

Naye Core permitirá construir una arquitectura híbrida para usar distintos motores de inteligencia artificial sin depender de un solo proveedor.

La regla principal del sistema es:

Local first, cloud when useful, permission when sensitive.

## Componentes actuales

- Model Router
- Configuración de proveedores
- Clasificación básica de sensibilidad
- Clasificación básica de tipo de tarea
- Prueba inicial del router

## Motores considerados

- Modelo local
- OpenAI
- Otros motores futuros

## Seguridad

Naye no debe enviar información sensible a proveedores externos sin autorización de JC.

Los datos críticos nunca deben enviarse a servicios externos.

## Estado del primer test

El primer test del Model Router fue exitoso.

## Regla del proyecto

Naye es el sistema.

El modelo es reemplazable.

Menos caos, más control.
