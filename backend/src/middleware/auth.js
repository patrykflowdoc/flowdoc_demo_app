import { isSkipAuth, MOCK_USER } from "../config/skipAuth.js";
import { verifyToken, AUTH_COOKIE_NAME } from "../lib/jwt.js";

/**
 * Verify JWT from cookie and attach user to req.
 * Use on routes that require authentication.
 * When SKIP_AUTH is set, always passes with mock user (no cookie required).
 */
export function requireAuth(req, res, next) {
  if (isSkipAuth()) {
    req.user = { ...MOCK_USER };
    return next();
  }
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = decoded;
  next();
}
