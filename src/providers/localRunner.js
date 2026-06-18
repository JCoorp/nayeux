async function runLocalModel({ input, taskType, sensitivity }) {
  return {
    provider: "local",
    mode: "dry_run",
    executed: false,
    message: "Simulación local ejecutada. Aún no hay modelo local conectado.",
    received: {
      input,
      taskType,
      sensitivity
    },
    simulatedResponse: "Naye usaría un modelo local para procesar esta tarea sin enviar datos a un proveedor externo."
  };
}

export { runLocalModel };
