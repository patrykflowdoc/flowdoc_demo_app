import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const router = Router();

// All user routes require auth; mutations require CSRF
router.use(requireAuth);

/** GET /api/users - list users (no passwordHash) */
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, login: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

/** POST /api/users - create admin user. Body: { login, password, username }. Requires CSRF. */
router.post("/", requireCsrf, async (req, res) => {
  const { login, password, username } = req.body ?? {};
  if (!login || !password) {
    return res.status(400).json({ error: "Login and password required" });
  }
  const loginStr = String(login).trim();
  const usernameStr = username != null ? String(username).trim() : loginStr;
  const existing = await prisma.user.findUnique({ where: { login: loginStr } });
  if (existing) {
    return res.status(409).json({ error: "User with this login already exists" });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = await prisma.user.create({
    data: { login: loginStr, username: usernameStr, passwordHash },
    select: { id: true, username: true, login: true, createdAt: true },
  });
  res.status(201).json(user);
});

/** PATCH /api/users/:id - update username or password. Requires CSRF. */
router.patch("/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const { username, password } = req.body ?? {};
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const data = {};
  if (username !== undefined) data.username = String(username).trim();
  if (password !== undefined && String(password).length > 0) {
    data.passwordHash = bcrypt.hashSync(password, 10);
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Provide username or password to update" });
  }
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, login: true, createdAt: true },
  });
  res.json(updated);
});

/** DELETE /api/users/:id - delete user. Requires CSRF. Prevent deleting self. */
router.delete("/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  if (req.user?.id === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
