/**
 * Kwota zamówienia/oferty: pozycje z offerClientToggle wymagają offerClientAccepted,
 * żeby wliczały się w sumę (zestawy konfigurowalne zawsze wliczamy).
 */
export function lineContributesToOfferTotal(item) {
  const t = String(item.itemType ?? "simple");
  if (t === "configurable") return true;
  if (!item.offerClientToggle) return true;
  return Boolean(item.offerClientAccepted);
}

export function sumContributingOrderLineTotals(items) {
  return items.reduce((s, i) => {
    const n = Number(i.total);
    const add = Number.isFinite(n) ? n : 0;
    return s + (lineContributesToOfferTotal(i) ? add : 0);
  }, 0);
}
