import { processWithNaye } from "./nayeCore.js";

const tests = [
  {
    input: "Hazme un reporte general sobre inteligencia artificial.",
    jcPermissionForCloud: false,
    cloudEnabled: false
  },
  {
    input: "Hazme un reporte general sobre inteligencia artificial.",
    jcPermissionForCloud: false,
    cloudEnabled: true
  },
  {
    input: "Revisa este contrato de una empresa y dime riesgos.",
    jcPermissionForCloud: false,
    cloudEnabled: true
  },
  {
    input: "Revisa este contrato de una empresa y dime riesgos.",
    jcPermissionForCloud: true,
    cloudEnabled: true
  },
  {
    input: "Analiza mis archivos privados de la PC.",
    jcPermissionForCloud: false,
    cloudEnabled: true
  },
  {
    input: "Guarda esta contraseña y este token.",
    jcPermissionForCloud: false,
    cloudEnabled: true
  }
];

console.log("Naye Core — Prueba con auditoría automática");
console.log("-------------------------------------------");

for (const test of tests) {
  const response = await processWithNaye(test);

  console.log("");
  console.log("Entrada:", test.input);
  console.log("Permiso nube sensible:", test.jcPermissionForCloud);
  console.log("Nube habilitada:", test.cloudEnabled);
  console.log("Estado:", response.status);
  console.log("Sensibilidad:", response.decision.sensitivity);
  console.log("Proveedor recomendado:", response.decision.recommendedProvider);
  console.log("Resultado:", response.result.message);
  console.log("Log:", response.audit.filePath);
}
