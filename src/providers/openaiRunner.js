async function runOpenAIModel({ input, taskType, sensitivity, cloudEnabled = false }) {
  if (!cloudEnabled) {
    return {
      provider: "openai",
      mode: "cloud_disabled_dry_run",
      executed: false,
      message: "OpenAI no fue ejecutado porque la nube está desactivada por defecto en esta fase.",
      received: {
        input,
        taskType,
        sensitivity
      }
    };
  }

  return {
    provider: "openai",
    mode: "dry_run",
    executed: false,
    message: "Simulación OpenAI ejecutada. Aún no hay API configurada.",
    received: {
      input,
      taskType,
      sensitivity
    },
    simulatedResponse: "Naye usaría OpenAI solo si la tarea lo justifica y la nube está habilitada."
  };
}

export { runOpenAIModel };
