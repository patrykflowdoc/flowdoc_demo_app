import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { isSkipAuth, MOCK_USER } from "../config/skipAuth.js";
import { signToken, verifyToken, AUTH_COOKIE_NAME, CSRF_COOKIE_NAME_EXPORT } from "../lib/jwt.js";
import { generateCsrfToken } from "../lib/csrf.js";

const router = Router();

// Na http://localhost Secure cookies bywają odrzucane — w dev wyłączamy (produkcja: NODE_ENV=production).
const cookieSecure = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

/** POST /api/auth/login - body: { login, password } */
router.post("/login", async (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) {
    return res.status(400).json({ error: "Login and password required" });
  }
  if (isSkipAuth()) {
    return res.json({ user: { ...MOCK_USER }, csrfToken: "skip-auth" });
  }
  const user = await prisma.user.findUnique({ where: { login: String(login).trim() } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid login or password" });
  }
  const token = signToken({
    id: user.id,
    login: user.login,
    username: user.username,
  });
  const csrfToken = generateCsrfToken();
  res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
  res.cookie(CSRF_COOKIE_NAME_EXPORT, csrfToken, {
    ...COOKIE_OPTIONS,
    httpOnly: false, // so frontend can read and send in X-CSRF-Token
  });
  res.json({
    user: { id: user.id, login: user.login, username: user.username },
    csrfToken, // optional: client can also read from cookie
  });
});

/** POST /api/auth/logout */
router.post("/logout", (_req, res) => {
  const clearOpts = { path: "/", sameSite: "lax", secure: cookieSecure, httpOnly: true };
  res.clearCookie(AUTH_COOKIE_NAME, clearOpts);
  res.clearCookie(CSRF_COOKIE_NAME_EXPORT, { ...clearOpts, httpOnly: false });
  res.json({ ok: true });
});

/** GET /api/auth/me - current user (requires auth cookie) */
router.get("/me", (req, res) => {
  if (isSkipAuth()) {
    return res.json({ user: { ...MOCK_USER } });
  }
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: decoded });
});

export default router;
