import { effectiveLineItemType, isAddonLineItem, isExpandableLineItem } from "@/lib/orderLineItems";
import type { OrderItem } from "@/types/orders";

export type KitchenDishRow = { name: string; totalQty: number; unit: string; };

function normalizeMultiplier(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function calculateKitchenRows(items: OrderItem[]): KitchenDishRow[] {
  const dishMap: Record<string, KitchenDishRow> = {};

  items.forEach((item) => {
    const itemType = effectiveLineItemType(item);
    if (isAddonLineItem(itemType)) return;

    if (isExpandableLineItem(itemType) && item.subItems) {
      item.subItems.map((sub) => {
        const key = sub.dishId ?? sub.name;
        if (!dishMap[key]) {
          dishMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit};
        }

        const optionConv = normalizeMultiplier(sub.optionConverter);
        const groupConv = normalizeMultiplier(sub.groupConverter);
        const baseConv = normalizeMultiplier(sub.converter);
        const multiplier = itemType === "configurable" ? (optionConv !== 1 ? optionConv : groupConv) : baseConv;
        dishMap[key].totalQty += Number(sub.quantity) * multiplier;
      });
      return;
    }

    const key = item.dishId ?? item.name;
    if (!dishMap[key]) {
      dishMap[key] = { name: item.name, totalQty: 0, unit: item.unit, };
    }
    dishMap[key].totalQty += item.quantity;
  });

  return Object.values(dishMap).sort((a, b) => a.name.localeCompare(b.name, "pl")).map(dish => ({
    ...dish,
    totalQty: Math.round(dish.totalQty),
  }));
}
