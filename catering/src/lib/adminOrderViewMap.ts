import type { Dish } from "@/data/products";
import type { AdminOrder } from "@/lib/schemas/orders";
import type { Order, OrderItem, OrderStatus } from "@/types/orders";

export function mapApiDishToOrderDish(raw: unknown): Dish | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string") return undefined;
  return {
    type: typeof d.productType === "string" ? d.productType : "dish",
    id: d.id,
    name: String(d.name ?? ""),
    description: String(d.description ?? ""),
    longDescription: d.longDescription != null ? String(d.longDescription) : undefined,
    image: d.imageUrl != null ? String(d.imageUrl) : undefined,
    contents: Array.isArray(d.contents) ? d.contents.map((c) => String(c)) : [],
    allergens: Array.isArray(d.allergens) ? d.allergens.map((c) => String(c)) : [],
    dietaryTags: Array.isArray(d.dietaryTags) ? d.dietaryTags.map((c) => String(c)) : [],
    pricePerUnit: Number(d.pricePerUnit ?? 0),
    pricePerUnitOnSite: d.pricePerUnitOnSite != null ? Number(d.pricePerUnitOnSite) : null,
    unitLabel: String(d.unitLabel ?? "szt."),
    minQuantity: Number(d.minQuantity ?? 1) || 1,
    category: String(d.categorySlug ?? ""),
    bail: Number(d.bail ?? 0),
  };
}

export function mapAdminApiOrderToOrder(
  o: AdminOrder,
  formatOrderDate: (dateStr: string | null) => string,
  fmtNum: (n: number) => string
): Order {
  const orderItems = o.orderItems ?? [];
  const items: OrderItem[] = orderItems.map((item) => {
    const { dish: apiDish, subItems: apiSubs, ...itemRest } = item;
    return {
      ...itemRest,
      type: item.itemType,
      dishId: item.dishId ?? undefined,
      dish: mapApiDishToOrderDish(apiDish),
      subItems: (apiSubs ?? []).map((sub) => {
        const { dish: apiSubDish, ...subRest } = sub;
        return {
          ...subRest,
          dishId: sub.dishId ?? undefined,
          dish: mapApiDishToOrderDish(apiSubDish),
        };
      }),
    };
  });

  return {
    id: String(o.orderNumber ?? ""),
    dbId: String(o.id ?? ""),
    clientId: o.clientId ? String(o.clientId) : null,
    client: o.clientName ?? "",
    email: o.clientEmail ?? "",
    phone: o.clientPhone ?? "",
    event: o.eventType ?? "",
    date: formatOrderDate(o.eventDate != null ? String(o.eventDate) : null),
    deliveryAddress: o.deliveryAddress ?? "",
    amount: fmtNum(Number(o.amount ?? 0)) + " zł",
    amountNum: Number(o.amount ?? 0),
    status: (o.status as OrderStatus) || "Nowe zamówienie",
    notes: o.notes ?? "",
    items,
    createdAt: formatOrderDate(o.createdAt != null ? String(o.createdAt) : null),
    deliveryCost: Number(o.deliveryCost ?? 0) || 0,
    guestCount: Number(o.guestCount ?? 0) || 0,
    discount: Number(o.discount ?? 0) || 0,
    deposit: Number(o.deposit ?? 0) || 0,
  };
}
