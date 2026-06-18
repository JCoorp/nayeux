import { processWithNaye } from "./nayeCore.js";

function printHelp() {
  console.log("");
  console.log("Uso:");
  console.log('  npm run ask -- "tu instrucción aquí"');
  console.log("");
  console.log("Opciones:");
  console.log("  --cloud                  Habilita nube en modo dry_run");
  console.log("  --allow-sensitive-cloud  Autoriza nube para datos sensibles en modo dry_run");
  console.log("");
  console.log("Ejemplos:");
  console.log('  npm run ask -- "Hazme un reporte general sobre IA"');
  console.log('  npm run ask -- "estatus de la pc"');
  console.log('  npm run ask -- --cloud "Hazme un reporte público sobre IA"');
  console.log('  npm run ask -- --cloud --allow-sensitive-cloud "Revisa este contrato de empresa"');
  console.log("");
}

function getArgs() {
  const args = process.argv.slice(2);

  const cloudEnabled = args.includes("--cloud");
  const jcPermissionForCloud = args.includes("--allow-sensitive-cloud");

  const inputParts = args.filter(arg => {
    return arg !== "--cloud" && arg !== "--allow-sensitive-cloud";
  });

  const input = inputParts.join(" ").trim();

  return {
    input,
    cloudEnabled,
    jcPermissionForCloud
  };
}

function safePreview(input, sensitivity) {
  if (sensitivity === "critical") {
    return "[REDACTED_CRITICAL_INPUT]";
  }

  if (sensitivity === "confidential") {
    return input.length > 120 ? input.slice(0, 120) + "..." : input;
  }

  if (sensitivity === "private") {
    return input.length > 100 ? input.slice(0, 100) + "..." : input;
  }

  return input;
}

function printData(data) {
  if (!data) {
    return;
  }

  console.log("");
  console.log("Datos adicionales:");
  console.log(JSON.stringify(data, null, 2));
}

const { input, cloudEnabled, jcPermissionForCloud } = getArgs();

if (!input) {
  printHelp();
  process.exit(0);
}

const response = await processWithNaye({
  input,
  cloudEnabled,
  jcPermissionForCloud
});

console.log("");
console.log("Naye Core — CLI");
console.log("---------------");
console.log("Entrada:", safePreview(input, response.decision.sensitivity));
console.log("Nube habilitada:", cloudEnabled);
console.log("Permiso nube sensible:", jcPermissionForCloud);
console.log("Estado:", response.status);
console.log("Tipo de tarea:", response.decision.taskType);
console.log("Sensibilidad:", response.decision.sensitivity);
console.log("Proveedor recomendado:", response.decision.recommendedProvider);
console.log("Requiere permiso:", response.decision.requiresPermission);
console.log("Bloquea externo:", response.decision.blockedExternal);
console.log("Motivo:", response.decision.reason);
console.log("Resultado:", response.result.message);

printData(response.result.data);

console.log("Log:", response.audit.filePath);
console.log("");
