/**
 * Legacy: JSON { [groupId]: { notes?: string } } — zastąpione przez `offerLineNotes` na OrderItem.
 * Zachowane dla ewentualnego odczytu starych rekordów; zapis z panelu już nie używa tego pola.
 */
export function sanitizeOfferGroupMeta(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [gid, v] of Object.entries(raw)) {
    const gidStr = String(gid).trim();
    if (!gidStr || gidStr.length > 128) continue;
    if (v == null || typeof v !== "object" || Array.isArray(v)) continue;
    const entry = {};
    if (typeof v.notes === "string") {
      const n = v.notes.slice(0, 4000);
      if (n.trim()) entry.notes = n.trim();
    }
    if (Object.keys(entry).length > 0) out[gidStr] = entry;
  }
  return Object.keys(out).length > 0 ? out : null;
}
