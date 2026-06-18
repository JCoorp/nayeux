import { routeTask } from "./modelRouter.js";

const tests = [
  "Hazme un reporte general sobre inteligencia artificial.",
  "Revisa este contrato de una empresa y dime riesgos.",
  "Analiza mis archivos privados de la PC.",
  "Guarda esta contraseña y este token.",
  "Genera un documento público sobre metodología ágil."
];

console.log("Naye Model Router — Prueba inicial");
console.log("----------------------------------");

for (const input of tests) {
  const result = routeTask({ input, jcPermissionForCloud: false });

  console.log("");
  console.log("Entrada:", input);
  console.log("Tipo de tarea:", result.taskType);
  console.log("Sensibilidad:", result.sensitivity);
  console.log("Proveedor recomendado:", result.recommendedProvider);
  console.log("Requiere permiso:", result.requiresPermission);
  console.log("Bloquea externo:", result.blockedExternal);
  console.log("Motivo:", result.reason);
}
