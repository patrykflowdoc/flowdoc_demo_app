import type { Dish } from "@/data/products";
import type { AdminOrder } from "@/lib/schemas/orders";
import { toHtmlDateValue } from "@/lib/orderDates";
import type { Order, OrderEventDay, OrderItem, OrderStatus } from "@/types/orders";
import type { CateringType } from "@/lib/pricing";

const CATERING_TYPE_VALUES = new Set<CateringType>(["wyjazdowy", "na_sali", "odbior_osobisty"]);

function parseCateringType(raw: unknown): CateringType | null {
  if (typeof raw !== "string" || !CATERING_TYPE_VALUES.has(raw as CateringType)) return null;
  return raw as CateringType;
}

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
  formatOrderTime: (timeStr: string | null) => string,
  fmtNum: (n: number) => string
): Order {
  const orderItems = o.orderItems ?? [];
  const items: OrderItem[] = orderItems.map((item) => {
    const {
      dish: apiDish,
      subItems: apiSubs,
      offerGroupMeta: metaRaw,
      offerLineNotes: notesRaw,
      id: itemIdRaw,
      ...itemRest
    } = item;
    const offerLineNotes = (() => {
      const fromCol =
        notesRaw != null && String(notesRaw).trim() !== "" ? String(notesRaw).trim() : null;
      if (fromCol) return fromCol;
      if (metaRaw == null || typeof metaRaw !== "object" || Array.isArray(metaRaw)) return null;
      const parts: string[] = [];
      for (const v of Object.values(metaRaw)) {
        if (v == null || typeof v !== "object" || Array.isArray(v)) continue;
        const n = (v as { notes?: unknown }).notes;
        if (typeof n === "string" && n.trim()) parts.push(n.trim());
      }
      return parts.length > 0 ? parts.join(" · ") : null;
    })();
    const offerLineServingTime =
      item.offerLineServingTime != null && String(item.offerLineServingTime).trim() !== ""
        ? String(item.offerLineServingTime).trim()
        : null;
    return {
      ...itemRest,
      ...(itemIdRaw != null && String(itemIdRaw).trim() !== ""
        ? { id: String(itemIdRaw).trim() }
        : {}),
      type: item.itemType,
      dishId: item.dishId ?? undefined,
      offerLineServingTime,
      offerLineNotes,
      sourceProductId:
        item.sourceProductId != null && String(item.sourceProductId).trim() !== ""
          ? String(item.sourceProductId)
          : undefined,
      offerClientToggle: item.offerClientToggle === true,
      offerClientAccepted:
        item.offerClientToggle === true ? Boolean(item.offerClientAccepted) : true,
      orderEventDayId: item.orderEventDayId ?? null,
      dish: mapApiDishToOrderDish(apiDish),
      subItems: (apiSubs ?? []).map((sub) => {
        const { dish: apiSubDish, id: subIdRaw, ...subRest } = sub;
        return {
          ...subRest,
          ...(subIdRaw != null && String(subIdRaw).trim() !== ""
            ? { id: String(subIdRaw).trim() }
            : {}),
          dishId: sub.dishId ?? undefined,
          dish: mapApiDishToOrderDish(apiSubDish),
        };
      }),
    };
  });

  const eventDays: OrderEventDay[] = (o.orderEventDays ?? []).map((d) => ({
    id: String(d.id ?? ""),
    label: String(d.label ?? ""),
    date: d.date != null ? String(d.date).slice(0, 10) : null,
    startTime: d.startTime != null ? String(d.startTime) : null,
    endTime: d.endTime != null ? String(d.endTime) : null,
    sortOrder: Number(d.sortOrder ?? 0),
    eventType:
      d.eventType != null && String(d.eventType).trim() !== "" ? String(d.eventType) : null,
    guestCount:
      d.guestCount != null && Number.isFinite(Number(d.guestCount))
        ? Math.max(0, Number(d.guestCount))
        : 0,
    deliveryAddress:
      d.deliveryAddress != null && String(d.deliveryAddress).trim() !== ""
        ? String(d.deliveryAddress)
        : null,
  }));

  return {
    id: String(o.orderNumber ?? ""),
    dbId: String(o.id ?? ""),
    publicOfferToken: o.publicOfferToken != null && String(o.publicOfferToken).trim() !== "" ? String(o.publicOfferToken) : null,
    cateringType: parseCateringType(o.cateringType),
    clientId: o.clientId ? String(o.clientId) : null,
    client: o.clientName ?? "",
    email: o.clientEmail ?? "",
    phone: o.clientPhone ?? "",
    companyName: o.companyName != null && o.companyName !== "" ? String(o.companyName) : null,
    companyNip: o.companyNip != null && o.companyNip !== "" ? String(o.companyNip) : null,
    contactCity: o.contactCity != null && String(o.contactCity).trim() !== "" ? String(o.contactCity) : null,
    contactStreet: o.contactStreet != null && String(o.contactStreet).trim() !== "" ? String(o.contactStreet) : null,
    contactBuilding: o.contactBuilding != null && String(o.contactBuilding).trim() !== "" ? String(o.contactBuilding) : null,
    contactApartment: o.contactApartment != null && String(o.contactApartment).trim() !== "" ? String(o.contactApartment) : null,
    event: o.eventType ?? "",
    date: formatOrderDate(o.eventDate != null ? String(o.eventDate) : null),
    time: formatOrderTime(o.eventTime != null ? String(o.eventTime) : null),
    eventDateIso:
      o.eventDate != null && String(o.eventDate).trim() !== ""
        ? toHtmlDateValue(o.eventDate) || null
        : null,
    eventTimeHHMM:
      o.eventTime != null && String(o.eventTime).trim() !== ""
        ? (() => {
            const d = new Date(String(o.eventTime));
            return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
          })()
        : null,
    deliveryAddress: o.deliveryAddress ?? "",
    amount: fmtNum(Number(o.amount ?? 0)) + " zł",
    amountNum: Number(o.amount ?? 0),
    status: (o.status as OrderStatus) || "Nowe zamówienie",
    notes: o.notes ?? "",
    items,
    eventDays,
    createdAt: formatOrderDate(o.createdAt != null ? String(o.createdAt) : null),
    deliveryCost: Number(o.deliveryCost ?? 0) || 0,
    guestCount: Number(o.guestCount ?? 0) || 0,
    discount: Number(o.discount ?? 0) || 0,
    deposit: Number(o.deposit ?? 0) || 0,
  };
}
