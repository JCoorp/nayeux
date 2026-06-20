import { processWithNaye } from "./nayeCore.js";

function parseArgs(argv) {
  const flags = {
    cloudEnabled: false,
    jcPermissionForCloud: false
  };

  const inputParts = [];

  for (const arg of argv) {
    if (arg === "--cloud") {
      flags.cloudEnabled = true;
      continue;
    }

    if (
      arg === "--allow-sensitive-cloud" ||
      arg === "--allow-cloud-sensitive" ||
      arg === "--permit-cloud"
    ) {
      flags.jcPermissionForCloud = true;
      continue;
    }

    inputParts.push(arg);
  }

  return {
    input: inputParts.join(" ").trim(),
    ...flags
  };
}

function printJsonBlock(title, data) {
  if (data === undefined || data === null) {
    return;
  }

  console.log("");
  console.log(`${title}:`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { input, cloudEnabled, jcPermissionForCloud } = parseArgs(process.argv.slice(2));

  if (!input) {
    console.log("");
    console.log("Naye Core — CLI");
    console.log("---------------");
    console.log('Uso: npm run ask -- "tu instrucción"');
    console.log("");
    console.log("Opciones:");
    console.log("  --cloud                  Habilita proveedor cloud si el router lo permite.");
    console.log("  --allow-sensitive-cloud  Permite cloud en tareas sensibles cuando aplique.");
    console.log("");
    process.exit(0);
  }

  const response = await processWithNaye({
    input,
    cloudEnabled,
    jcPermissionForCloud
  });

  const decision = response.decision;
  const result = response.result;

  console.log("");
  console.log("Naye Core — CLI");
  console.log("---------------");
  console.log("Entrada:", input);
  console.log("Nube habilitada:", cloudEnabled);
  console.log("Permiso nube sensible:", jcPermissionForCloud);
  console.log("Estado:", response.status);
  console.log("Tipo de tarea:", decision.taskType);
  console.log("Sensibilidad:", decision.sensitivity);
  console.log("Proveedor recomendado:", decision.recommendedProvider);
  console.log("Requiere permiso:", decision.requiresPermission);
  console.log("Bloquea externo:", decision.blockedExternal);
  console.log("Motivo:", decision.reason);

  if (result?.provider) {
    console.log("Proveedor real:", result.provider);
  }

  if (result?.model) {
    console.log("Modelo:", result.model);
  }

  if (result?.tool) {
    console.log("Herramienta:", result.tool);
  }

  if (typeof result?.executed === "boolean") {
    console.log("Ejecutado:", result.executed);
  }

  console.log("Resultado:", result?.message ?? "Sin mensaje de resultado.");

  if (result?.data) {
    printJsonBlock("Datos adicionales", result.data);
  }

  if (result?.metadata) {
    printJsonBlock("Metadata", result.metadata);
  }

  if (result?.error) {
    console.log("Error:", result.error);
  }

  if (response.audit?.path) {
    console.log("Log:", response.audit.path);
  }

  console.log("");
}

main().catch(error => {
  console.error("");
  console.error("Naye Core — Error");
  console.error("-----------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
});
