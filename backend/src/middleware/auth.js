import { verifyToken, AUTH_COOKIE_NAME } from "../lib/jwt.js";

/**
 * Verify JWT from cookie and attach user to req.
 * Use on routes that require authentication.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = decoded;
  next();
}
