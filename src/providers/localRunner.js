import fs from "fs";
import path from "path";
import { retrieveKnowledgeContext } from "../knowledgeRetriever.js";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const LOCAL_MODEL_CONFIG_PATH = path.join(ROOT, "config", "local-model.config.json");

const DEFAULT_CONFIG = {
  provider: "ollama",
  enabled: true,
  url: "http://127.0.0.1:11434/api/generate",
  model: "llama3.2:3b",
  temperature: 0.2,
  rules: {
    localFirst: true,
    allowInternet: false,
    allowFileAccessByDefault: false,
    language: "es"
  }
};

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function loadLocalModelConfig() {
  if (!fs.existsSync(LOCAL_MODEL_CONFIG_PATH)) {
    return {
      ...DEFAULT_CONFIG,
      configLoaded: false,
      configPath: LOCAL_MODEL_CONFIG_PATH
    };
  }

  const config = readJson(LOCAL_MODEL_CONFIG_PATH);

  return {
    ...DEFAULT_CONFIG,
    ...config,
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...(config.rules ?? {})
    },
    configLoaded: true,
    configPath: LOCAL_MODEL_CONFIG_PATH
  };
}

function buildLocalPrompt({ input, taskType, sensitivity, config, knowledge }) {
  const knowledgeBlock = knowledge.used
    ? [
        "",
        "MEMORIA DOCUMENTAL APROBADA:",
        knowledge.contextText,
        "",
        "REGLAS PARA USAR LA MEMORIA:",
        "- Usa la memoria documental aprobada como fuente principal cuando el usuario diga 'según la memoria local', 'según los documentos' o pregunte por el estado de Naye.",
        "- No te quedes con un solo dato si el documento contiene varias secciones relevantes.",
        "- Si el documento tiene secciones o listas, sintetiza las secciones principales.",
        "- Si el usuario pregunta por el estado actual de Naye Core, incluye: estado general, componentes consolidados, modelo local, herramientas activas, memoria documental, OpenClaw y regla principal, siempre que aparezcan en el contexto.",
        "- No inventes fuentes, rutas ni documentos que no estén en el contexto.",
        "- Si el contexto no alcanza para responder, dilo claramente.",
        "- Responde de forma estructurada y útil."
      ].join("\n")
    : [
        "",
        "MEMORIA DOCUMENTAL APROBADA:",
        "No se recuperó contexto documental relevante para esta solicitud."
      ].join("\n");

  return [
    "Eres Naye, un asistente local privado para apoyar tareas técnicas, documentación, diagnóstico y automatización segura.",
    "",
    "REGLAS GENERALES:",
    "- Responde en español.",
    "- Sé claro, directo y práctico.",
    "- No inventes acceso a archivos, equipos o internet.",
    "- Si una acción requiere permisos, dilo explícitamente.",
    "- No reveles secretos, tokens, contraseñas ni datos sensibles.",
    "- Respeta la política local-first: usa recursos locales por defecto.",
    "- Cuando uses memoria documental, apóyate solo en documentos aprobados.",
    "",
    `Proveedor local configurado: ${config.provider}`,
    `Modelo configurado: ${config.model}`,
    `Tipo de tarea: ${taskType}`,
    `Sensibilidad: ${sensitivity}`,
    knowledgeBlock,
    "",
    "SOLICITUD DEL USUARIO:",
    input
  ].join("\n");
}

async function runLocalModel({ input, taskType, sensitivity }) {
  const config = loadLocalModelConfig();
  const knowledge = retrieveKnowledgeContext({ input });

  const ollamaUrl = process.env.OLLAMA_URL ?? config.url;
  const ollamaModel = process.env.OLLAMA_MODEL ?? config.model;
  const temperature = Number(process.env.OLLAMA_TEMPERATURE ?? config.temperature ?? 0.2);

  if (!config.enabled) {
    return {
      provider: config.provider,
      model: ollamaModel,
      executed: false,
      message: "El modelo local está deshabilitado en config/local-model.config.json.",
      metadata: {
        configLoaded: config.configLoaded,
        configPath: config.configPath,
        knowledgeUsed: knowledge.used,
        knowledgeMessage: knowledge.message
      }
    };
  }

  const prompt = buildLocalPrompt({
    input,
    taskType,
    sensitivity,
    config: {
      ...config,
      model: ollamaModel
    },
    knowledge
  });

  try {
    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      return {
        provider: config.provider,
        model: ollamaModel,
        executed: false,
        message: "Ollama respondió con error.",
        error: errorText,
        metadata: {
          configLoaded: config.configLoaded,
          configPath: config.configPath,
          url: ollamaUrl,
          knowledgeUsed: knowledge.used,
          knowledgeMessage: knowledge.message,
          knowledgeSources: knowledge.sources
        }
      };
    }

    const data = await response.json();

    return {
      provider: config.provider,
      model: ollamaModel,
      executed: true,
      message: data.response?.trim() ?? "",
      metadata: {
        configLoaded: config.configLoaded,
        configPath: config.configPath,
        url: ollamaUrl,
        temperature,
        knowledgeUsed: knowledge.used,
        knowledgeMessage: knowledge.message,
        knowledgeSources: knowledge.sources,
        totalDuration: data.total_duration ?? null,
        loadDuration: data.load_duration ?? null,
        promptEvalCount: data.prompt_eval_count ?? null,
        evalCount: data.eval_count ?? null
      }
    };
  } catch (error) {
    return {
      provider: config.provider,
      model: ollamaModel,
      executed: false,
      message: "No se pudo conectar con Ollama. Verifica que Ollama esté instalado y ejecutándose.",
      error: error.message,
      metadata: {
        configLoaded: config.configLoaded,
        configPath: config.configPath,
        url: ollamaUrl,
        knowledgeUsed: knowledge.used,
        knowledgeMessage: knowledge.message,
        knowledgeSources: knowledge.sources
      }
    };
  }
}

export { runLocalModel };
