"use strict";

const OPERATIONAL_REQUEST_ROUTES = Object.freeze([
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/action-engine\/status$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+\/activity$/ }),
  Object.freeze({ method: "GET", pattern: /^\/api\/operational\/missions\/[^/]+\/orchestration$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/authorize$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/run$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/control$/ }),
  Object.freeze({ method: "POST", pattern: /^\/api\/operational\/missions\/[^/]+\/revoke$/ })
]);

function normalizeOperationalRequest(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Naye Desktop operational request must be an object.");
  }

  const endpoint = String(input.endpoint || "").trim();
  const method = String(input.method || "GET").trim().toUpperCase();
  if (!endpoint.startsWith("/") || endpoint.includes("?") || endpoint.includes("#")) {
    throw new TypeError("Naye Desktop operational endpoint is invalid.");
  }
  if (!OPERATIONAL_REQUEST_ROUTES.some((route) => route.method === method && route.pattern.test(endpoint))) {
    throw new Error(`Operational endpoint not allowed from Naye Desktop UX: ${method} ${endpoint}`);
  }

  return Object.freeze({
    endpoint,
    method,
    body: input.body
  });
}

module.exports = {
  OPERATIONAL_REQUEST_ROUTES,
  normalizeOperationalRequest
};
