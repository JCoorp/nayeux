const DEV_RENDERER_URL = "http://127.0.0.1:5173/index.html";
const MAX_RENDERER_RECOVERY_ATTEMPTS = 2;

const RECOVERABLE_RENDERER_REASONS = new Set([
  "abnormal-exit",
  "killed",
  "crashed",
  "oom",
  "launch-failed",
  "integrity-failure"
]);

function shouldRecoverRenderer(input = {}) {
  const reason = String(input.reason || "").trim().toLowerCase();
  const attempts = Number.isInteger(input.attempts) ? input.attempts : 0;
  const maxAttempts = Number.isInteger(input.maxAttempts)
    ? input.maxAttempts
    : MAX_RENDERER_RECOVERY_ATTEMPTS;

  if (!RECOVERABLE_RENDERER_REASONS.has(reason)) return false;
  if (attempts < 0 || maxAttempts < 1) return false;
  return attempts < maxAttempts;
}

module.exports = {
  DEV_RENDERER_URL,
  MAX_RENDERER_RECOVERY_ATTEMPTS,
  RECOVERABLE_RENDERER_REASONS,
  shouldRecoverRenderer
};
