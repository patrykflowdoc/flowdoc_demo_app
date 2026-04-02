import { z } from "zod";

/**
 * Prisma `Decimal` and some JSON paths serialize as strings; coerce safely to number.
 */
const DecimalJson = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v == null) return 0;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  });

/** Prisma Dish row joined on order lines (camelCase). Passthrough for extra fields. */
export const AdminOrderDishSchema = z.object({ id: z.string() }).passthrough().nullable().optional();

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
  pricePerUnit: DecimalJson.default(0),
  total: DecimalJson.default(0),
  itemType: z.string().default("simple"),
  foodCostPerUnit: DecimalJson.optional(),
  subItems: z.array(AdminOrderSubItemSchema).nullable().default([]),
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
    cateringType: CateringTypeSchema.nullable().optional(),
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
    orderItems: z.array(AdminOrderItemSchema).nullable().default([]),
    orderFoodCostExtras: z.array(AdminFoodCostExtraSchema).nullable().default([]),
  })
  .passthrough();

export const AdminOrdersSchema = z.array(AdminOrderSchema);

export type AdminOrder = z.infer<typeof AdminOrderSchema>;
export type AdminOrderItem = z.infer<typeof AdminOrderItemSchema>;
export type AdminOrderSubItem = z.infer<typeof AdminOrderSubItemSchema>;
