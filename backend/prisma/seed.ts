/**
 * Seed: creates first admin user if no users exist.
 * Run with: npm run db:seed  (or npx prisma db seed)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db.js";

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Users already exist, skipping seed.");
    return;
  }
  const defaultLogin = process.env.SEED_ADMIN_LOGIN ?? "admin";
  const defaultPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const defaultUsername = process.env.SEED_ADMIN_USERNAME ?? "Administrator";

  await prisma.user.create({
    data: {
      login: defaultLogin,
      username: defaultUsername,
      passwordHash: bcrypt.hashSync(defaultPassword, 10),
    },
  });
  console.log(`Created first admin user: ${defaultLogin}. Change password after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
