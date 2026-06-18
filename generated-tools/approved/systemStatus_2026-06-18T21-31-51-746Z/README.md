# System Status Tool

## Estado

Proposed / Pending Review

## Propósito

Leer el estado básico de la PC local en modo solo lectura.

## Lenguaje elegido

Lenguaje principal: PowerShell

Lenguaje de integración: JavaScript

## Justificación técnica

PowerShell es la mejor opción para consultar información local de Windows; JavaScript sirve como puente con Naye Core.

## Riesgo

low

## Uso esperado

Esta herramienta deberá ejecutarse primero en modo dry_run.

## Regla

La herramienta no queda activa hasta que el Usuario Administrador designado la apruebe.