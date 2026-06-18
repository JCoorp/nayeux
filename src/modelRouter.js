import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve("F:/NayeVault/naye-core/config/model-router.config.json");

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function classifySensitivity(input) {
  const text = input.toLowerCase();

  const criticalTerms = [
    "contraseña",
    "password",
    "token",
    "clave privada",
    "cookie",
    "credencial",
    "banco",
    "tarjeta"
  ];

  const confidentialTerms = [
    "contrato",
    "cliente",
    "empresa",
    "financiero",
    "expediente",
    "factura",
    "nómina",
    "confidencial"
  ];

  const privateTerms = [
    "personal",
    "privado",
    "mi pc",
    "mis archivos",
    "documentos internos"
  ];

  if (criticalTerms.some(term => text.includes(term))) {
    return "critical";
  }

  if (confidentialTerms.some(term => text.includes(term))) {
    return "confidential";
  }

  if (privateTerms.some(term => text.includes(term))) {
    return "private";
  }

  if (text.includes("público") || text.includes("general")) {
    return "public";
  }

  return "internal";
}

function classifyTask(input) {
  const text = input.toLowerCase();

  if (text.includes("documento") || text.includes("reporte") || text.includes("word")) {
    return "document_generation_or_review";
  }

  if (text.includes("empresa") || text.includes("negocio")) {
    return "company_analysis";
  }

  if (text.includes("pc") || text.includes("equipo") || text.includes("nodo")) {
    return "multi_device";
  }

  if (text.includes("código") || text.includes("programa") || text.includes("script")) {
    return "code_or_automation";
  }

  return "general";
}

function routeTask({ input, jcPermissionForCloud = false }) {
  const config = loadConfig();
  const sensitivity = classifySensitivity(input);
  const taskType = classifyTask(input);

  let recommendedProvider = "local";
  let requiresPermission = false;
  let blockedExternal = false;
  let reason = "";

  if (sensitivity === "critical") {
    recommendedProvider = "local";
    requiresPermission = true;
    blockedExternal = true;
    reason = "La información parece crítica. No debe enviarse a un proveedor externo.";
  } else if (sensitivity === "confidential") {
    recommendedProvider = jcPermissionForCloud ? "openai_or_local" : "local";
    requiresPermission = !jcPermissionForCloud;
    reason = "La información parece confidencial. OpenAI solo puede usarse con autorización de JC.";
  } else if (sensitivity === "private") {
    recommendedProvider = "local";
    requiresPermission = false;
    reason = "La información parece privada. Se prefiere modelo local.";
  } else if (sensitivity === "public") {
    recommendedProvider = "openai_or_local";
    requiresPermission = false;
    reason = "La información parece pública. Puede usarse OpenAI o modelo local según calidad/costo.";
  } else {
    recommendedProvider = "local";
    requiresPermission = false;
    reason = "La información parece interna. Por defecto se prefiere local.";
  }

  return {
    mode: config.default_mode,
    taskType,
    sensitivity,
    recommendedProvider,
    requiresPermission,
    blockedExternal,
    reason
  };
}

export { routeTask };
