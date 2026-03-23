import { normalizeItemType } from "@/lib/orderLineItems";
import type { PdfOrderLineItem } from "@/types/orders";
import type { AdminOrderItem } from "@/lib/schemas/orders";

/** Map validated API row → line item used in admin UI and PDF payloads. */
export function adminOrderItemToPdfLineItem(i: AdminOrderItem): PdfOrderLineItem {
  const t = normalizeItemType(i.itemType);
  return {
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    pricePerUnit: i.pricePerUnit,
    total: i.total,
    type: t,
    itemType: t,
    foodCostPerUnit: i.foodCostPerUnit,
    subItems: (i.subItems ?? []).map((s) => ({
      name: s.name,
      quantity: s.quantity,
      unit: s.unit,
      foodCostPerUnit: s.foodCostPerUnit,
    })),
  };
}
