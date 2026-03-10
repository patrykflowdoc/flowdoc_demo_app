import { validateCsrfToken } from "../lib/csrf.js";
import { CSRF_COOKIE_NAME_EXPORT } from "../lib/jwt.js";

const CSRF_HEADER = "x-csrf-token";

/**
 * Require valid CSRF token for state-changing methods.
 * Call after requireAuth. Expects cookie named by CSRF_COOKIE_NAME_EXPORT.
 */
export function requireCsrf(req, res, next) {
  const method = (req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }
  const headerToken = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME_EXPORT];
  if (!validateCsrfToken(headerToken, cookieToken)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  next();
}
