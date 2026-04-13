/**
 * Tworzy użytkownika panelu admina (tabela `users`).
 *
 * Użycie (w katalogu backend/):
 *   NEW_ADMIN_LOGIN=mojlogin NEW_ADMIN_PASSWORD='SilneHaslo123!' npx tsx prisma/createAdminUser.ts
 *
 * Opcjonalnie: NEW_ADMIN_USERNAME="Jan Kowalski"
 *
 * DATABASE_URL musi wskazywać na docelową bazę (np. z .env — nie commituj URL z hasłem).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db.js";

async function main() {
  const login = process.env.NEW_ADMIN_LOGIN?.trim();
  const password = process.env.NEW_ADMIN_PASSWORD;
  const username = process.env.NEW_ADMIN_USERNAME?.trim() || login || "Administrator";

  if (!login || !password) {
    console.error(
      "Brak danych. Ustaw zmienne środowiskowe:\n" +
        "  NEW_ADMIN_LOGIN   — login do panelu\n" +
        "  NEW_ADMIN_PASSWORD — hasło\n" +
        "  NEW_ADMIN_USERNAME — opcjonalnie wyświetlana nazwa\n" +
        "\nPrzykład:\n" +
        "  NEW_ADMIN_LOGIN=jan NEW_ADMIN_PASSWORD='TwojeHaslo' npx tsx prisma/createAdminUser.ts"
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Hasło powinno mieć co najmniej 6 znaków.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.error(`Użytkownik o loginie "${login}" już istnieje — nie tworzę duplikatu.`);
    process.exit(1);
  }

  await prisma.user.create({
    data: {
      login,
      username,
      passwordHash: bcrypt.hashSync(password, 10),
    },
  });

  console.log(`OK — utworzono użytkownika panelu: login="${login}", username="${username}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
