/** Zwraca dishId tylko jeśli wiersz istnieje w Dish (unika błędu FK). */
export async function dishIdIfExists(prisma, raw) {
  if (raw == null || raw === "") return null;
  const id = String(raw).trim();
  if (!id) return null;
  const row = await prisma.dish.findUnique({ where: { id }, select: { id: true } });
  return row?.id ?? null;
}
