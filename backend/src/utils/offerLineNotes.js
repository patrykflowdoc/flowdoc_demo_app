/** Jedna notatka na linię zamówienia (panel admina). */
export function sanitizeOfferLineNotes(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.length > 4000 ? s.slice(0, 4000) : s;
}
