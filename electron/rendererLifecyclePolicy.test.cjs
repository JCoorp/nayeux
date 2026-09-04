const assert = require("node:assert/strict");
const {
  DEV_RENDERER_URL,
  MAX_RENDERER_RECOVERY_ATTEMPTS,
  shouldRecoverRenderer
} = require("./rendererLifecyclePolicy.cjs");

assert.equal(DEV_RENDERER_URL, "http://127.0.0.1:5173/index.html");
assert.equal(MAX_RENDERER_RECOVERY_ATTEMPTS, 2);

assert.equal(shouldRecoverRenderer({ reason: "crashed", attempts: 0 }), true);
assert.equal(shouldRecoverRenderer({ reason: "oom", attempts: 1 }), true);
assert.equal(shouldRecoverRenderer({ reason: "crashed", attempts: 2 }), false);
assert.equal(shouldRecoverRenderer({ reason: "clean-exit", attempts: 0 }), false);
assert.equal(shouldRecoverRenderer({ reason: "", attempts: 0 }), false);
assert.equal(shouldRecoverRenderer({ reason: "killed", attempts: 0, maxAttempts: 0 }), false);

console.log(JSON.stringify({
  schema: "naye-renderer-lifecycle-policy-selftest-v1",
  passed: true,
  assertions: 8
}, null, 2));
