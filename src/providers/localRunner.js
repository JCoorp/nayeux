import fs from "fs";
import path from "path";

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

function buildLocalPrompt({ input, taskType, sensitivity, config }) {
  return [
    "Eres Naye, un asistente local privado para apoyar tareas técnicas, documentación, diagnóstico y automatización segura.",
    "",
    "Reglas:",
    "- Responde en español.",
    "- Sé claro, directo y práctico.",
    "- No inventes acceso a archivos, equipos o internet.",
    "- Si una acción requiere permisos, dilo explícitamente.",
    "- No reveles secretos, tokens, contraseñas ni datos sensibles.",
    "- Respeta la política local first: usa recursos locales por defecto.",
    "",
    `Proveedor local configurado: ${config.provider}`,
    `Modelo configurado: ${config.model}`,
    `Tipo de tarea: ${taskType}`,
    `Sensibilidad: ${sensitivity}`,
    "",
    "Solicitud del usuario:",
    input
  ].join("\n");
}

async function runLocalModel({ input, taskType, sensitivity }) {
  const config = loadLocalModelConfig();

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
        configPath: config.configPath
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
    }
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
          url: ollamaUrl
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
        url: ollamaUrl
      }
    };
  }
}

export { runLocalModel };
