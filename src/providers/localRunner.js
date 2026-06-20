const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

function buildLocalPrompt({ input, taskType, sensitivity }) {
  return [
    "Eres Naye, un asistente local privado para apoyar tareas técnicas, documentación, diagnóstico y automatización segura.",
    "",
    "Reglas:",
    "- Responde en español.",
    "- Sé claro, directo y práctico.",
    "- No inventes acceso a archivos, equipos o internet.",
    "- Si una acción requiere permisos, dilo explícitamente.",
    "- No reveles secretos, tokens, contraseñas ni datos sensibles.",
    "",
    `Tipo de tarea: ${taskType}`,
    `Sensibilidad: ${sensitivity}`,
    "",
    "Solicitud del usuario:",
    input
  ].join("\n");
}

async function runLocalModel({ input, taskType, sensitivity }) {
  const prompt = buildLocalPrompt({ input, taskType, sensitivity });

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      return {
        provider: "ollama",
        model: OLLAMA_MODEL,
        executed: false,
        message: "Ollama respondió con error.",
        error: errorText
      };
    }

    const data = await response.json();

    return {
      provider: "ollama",
      model: OLLAMA_MODEL,
      executed: true,
      message: data.response?.trim() ?? "",
      metadata: {
        totalDuration: data.total_duration ?? null,
        loadDuration: data.load_duration ?? null,
        promptEvalCount: data.prompt_eval_count ?? null,
        evalCount: data.eval_count ?? null
      }
    };
  } catch (error) {
    return {
      provider: "ollama",
      model: OLLAMA_MODEL,
      executed: false,
      message: "No se pudo conectar con Ollama. Verifica que Ollama esté instalado y ejecutándose.",
      error: error.message
    };
  }
}

export { runLocalModel };
