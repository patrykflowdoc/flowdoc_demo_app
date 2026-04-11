import { z } from "zod";

/**
 * Prisma `Decimal` i podobne — w JSON bywa string, number, czasem obiekt z toString().
 */
const DecimalJson = z
  .union([z.number(), z.string(), z.null(), z.undefined(), z.record(z.unknown())])
  .transform((v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof v === "object" && v !== null && typeof (v as { toString?: () => string }).toString === "function") {
      const n = Number(String((v as { toString: () => string }).toString()));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  });

const CateringTypeLoose = z
  .union([z.enum(["wyjazdowy", "na_sali", "odbior_osobisty"]), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    const allowed = new Set(["wyjazdowy", "na_sali", "odbior_osobisty"]);
    return allowed.has(v) ? v : null;
  });

function boolLoose(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false") return false;
  return Boolean(v);
}

/** Prisma Dish — czasem brak id; nie blokuj parsowania całej listy. */
export const AdminOrderDishSchema = z
  .object({ id: z.string().optional() })
  .passthrough()
  .nullable()
  .optional();

export const AdminOrderSubItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().default(""),
  quantity: DecimalJson.default(0),
  unit: z.string().default("szt."),
  converter: DecimalJson.optional(),
  optionConverter: DecimalJson.optional(),
  groupConverter: DecimalJson.optional(),
  foodCostPerUnit: DecimalJson.optional(),
  dishId: z.string().nullable().optional(),
  pricePerUnit: DecimalJson.optional(),
  dish: AdminOrderDishSchema,
});

export const AdminOrderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().default(""),
  quantity: DecimalJson.default(1),
  unit: z.string().default("szt."),
  dishId: z.string().nullable().optional(),
  sourceProductId: z.string().nullable().optional(),
  orderEventDayId: z.string().nullable().optional(),
  offerClientToggle: z
    .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => boolLoose(v ?? false)),
  offerClientAccepted: z
    .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v == null ? true : boolLoose(v))),
  pricePerUnit: DecimalJson.default(0),
  total: DecimalJson.default(0),
  itemType: z.string().default("simple"),
  foodCostPerUnit: DecimalJson.optional(),
  subItems: z
    .array(AdminOrderSubItemSchema)
    .nullable()
    .optional()
    .transform((v) => v ?? []),
  dish: AdminOrderDishSchema,
});

export const AdminFoodCostExtraSchema = z.object({
  id: z.string().optional(),
  name: z.string().default(""),
  amount: DecimalJson.default(0),
});

export const CateringTypeSchema = z.enum(["wyjazdowy", "na_sali", "odbior_osobisty"]);

export const AdminOrderSchema = z
  .object({
    id: z.string(),
    orderNumber: z.string().default(""),
    publicOfferToken: z.string().nullable().optional(),
    clientId: z.string().nullable().optional(),
    clientName: z.string().default(""),
    clientEmail: z.string().default(""),
    clientPhone: z.string().default(""),
    companyName: z.string().nullable().optional(),
    companyNip: z.string().nullable().optional(),
    contactCity: z.string().nullable().optional(),
    contactStreet: z.string().nullable().optional(),
    contactBuilding: z.string().nullable().optional(),
    contactApartment: z.string().nullable().optional(),
    cateringType: CateringTypeLoose.optional(),
    eventDate: z.string().nullable().optional(),
    eventTime: z.string().nullable().optional(),
    eventType: z.string().default(""),
    deliveryAddress: z.string().nullable().optional().transform((v) => v ?? ""),
    amount: DecimalJson.default(0),
    bail: DecimalJson.default(0),
    status: z.string().default("Nowe zamówienie"),
    notes: z.string().default(""),
    createdAt: z.string().nullable().optional(),
    deliveryCost: DecimalJson.default(0),
    guestCount: DecimalJson.default(0),
    discount: DecimalJson.default(0),
    deposit: DecimalJson.default(0),
    orderItems: z
      .array(AdminOrderItemSchema)
      .nullable()
      .optional()
      .transform((v) => v ?? []),
    orderFoodCostExtras: z
      .array(AdminFoodCostExtraSchema)
      .nullable()
      .optional()
      .transform((v) => v ?? []),
    orderEventDays: z
      .array(
        z.object({
          id: z.string(),
          label: z.string().default(""),
          date: z.string().nullable().optional(),
          startTime: z.string().nullable().optional(),
          endTime: z.string().nullable().optional(),
          sortOrder: z.number().default(0),
          eventType: z.string().nullable().optional(),
          guestCount: z.number().nullable().optional(),
          deliveryAddress: z.string().nullable().optional(),
        })
      )
      .nullable()
      .optional()
      .transform((v) => v ?? []),
  })
  .passthrough();

export const AdminOrdersSchema = z.array(AdminOrderSchema);

export type AdminOrder = z.infer<typeof AdminOrderSchema>;
export type AdminOrderItem = z.infer<typeof AdminOrderItemSchema>;
export type AdminOrderSubItem = z.infer<typeof AdminOrderSubItemSchema>;
