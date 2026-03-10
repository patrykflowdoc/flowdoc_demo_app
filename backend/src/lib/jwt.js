import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = "auth";
const CSRF_COOKIE_NAME = "csrf";

/**
 * @param {{ id: string, login: string, username: string }} payload
 * @returns {string} JWT
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * @param {string} token
 * @returns {{ id: string, login: string, username: string } | null}
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const CSRF_COOKIE_NAME_EXPORT = CSRF_COOKIE_NAME;
