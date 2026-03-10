import crypto from "node:crypto";

const CSRF_TOKEN_BYTES = 32;

/**
 * Generate a new CSRF token (for cookie + client to send back in header).
 * @returns {string}
 */
export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

/**
 * Compare token from header with token from cookie (double-submit cookie).
 * @param {string} headerToken - X-CSRF-Token header value
 * @param {string} cookieToken - CSRF cookie value
 * @returns {boolean}
 */
export function validateCsrfToken(headerToken, cookieToken) {
  if (!headerToken || !cookieToken) return false;
  const a = Buffer.from(headerToken, "utf8");
  const b = Buffer.from(cookieToken, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
