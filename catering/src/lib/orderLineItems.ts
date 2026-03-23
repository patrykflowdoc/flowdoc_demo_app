/**
 * Line-item classification for admin orders / PDF / UI.
 * ADDON_ITEM_TYPES: non-dish lines (kitchen/summary dish list, food-cost primary rows).
 * Includes `extra_bundle` — same token as `submitOrder` checkout payloads.
 */

export const ADDON_ITEM_TYPES: ReadonlySet<string> = new Set([
  "extra",
  "extra_bundle",
  "packaging",
  "service",
  "waiter",
]);

const EXPANDABLE_ITEM_TYPES: ReadonlySet<string> = new Set(["bundle", "configurable", "expandable"]);

export function normalizeItemType(itemType: string | undefined): string {
  const t = String(itemType ?? "").trim().toLowerCase();
  return t.length > 0 ? t : "simple";
}

export function isAddonLineItem(itemType: string | undefined): boolean {
  return ADDON_ITEM_TYPES.has(normalizeItemType(itemType));
}

export function isExpandableLineItem(itemType: string | undefined): boolean {
  return EXPANDABLE_ITEM_TYPES.has(normalizeItemType(itemType));
}

/** Prefer API `itemType`, fall back to view-model `type`. */
export function effectiveLineItemType(item: { itemType?: string; type?: string }): string {
  return normalizeItemType(item.itemType ?? item.type);
}

export function splitPrimaryAndAddonItems<T extends { itemType?: string; type?: string }>(
  items: T[]
): { primary: T[]; addons: T[] } {
  const primary: T[] = [];
  const addons: T[] = [];
  for (const item of items) {
    if (isAddonLineItem(effectiveLineItemType(item))) addons.push(item);
    else primary.push(item);
  }
  return { primary, addons };
}

/** Food-cost rows: exclude add-ons; require positive FC when present. */
export function isFoodCostEligibleLineItem(item: {
  itemType?: string;
  type?: string;
  foodCostPerUnit?: number;
}): boolean {
  if (isAddonLineItem(effectiveLineItemType(item))) return false;
  const fc = item.foodCostPerUnit;
  return fc != null && Number.isFinite(fc) && fc > 0;
}
