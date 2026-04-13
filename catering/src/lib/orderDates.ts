/**
 * Data wydarzenia: Prisma / <input type="date"> wymagają YYYY-MM-DD.
 * W bazie lub po błędnym mapowaniu może pojawić się zapis zwarty YYYYMMDD — naprawiamy.
 */
export function toHtmlDateValue(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s0 = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s0)) return s0.slice(0, 10);
  if (/^\d{8}$/.test(s0)) {
    return `${s0.slice(0, 4)}-${s0.slice(4, 6)}-${s0.slice(6, 8)}`;
  }
  const d = new Date(s0);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

/** Dla PATCH zamówienia — null gdy brak poprawnej daty. */
export function toApiEventDateOrNull(raw: string | null | undefined): string | null {
  const v = toHtmlDateValue(raw ?? "");
  return v === "" ? null : v;
}
