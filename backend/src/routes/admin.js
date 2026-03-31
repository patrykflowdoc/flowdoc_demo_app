/**
 * Admin API: all routes require auth; mutations require CSRF.
 * Mount at /api/admin
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const router = Router();
router.use(requireAuth);

function numOrAdminOrder(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** PATCH body: only provided fields; numeric fields coerced from string. */
const bundlePatchSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    longDescription: z.string().optional(),
    imageUrl: z.union([z.string(), z.null()]).optional(),
    categorySlug: z.union([z.string(), z.null()]).optional(),
    priceNetto: z.coerce.number().optional(),
    vatRate: z.coerce.number().optional(),
    priceBrutto: z.coerce.number().optional(),
    basePrice: z.coerce.number().optional(),
    converter: z.coerce.number().optional(),
    minQuantity: z.coerce.number().optional(),
    icon: z.string().optional(),
    dietaryTags: z.array(z.string()).optional(),
  })
  .partial();

/** PATCH body: only provided fields; numeric fields coerced from string. */
const configurableSetPatchSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    longDescription: z.string().optional(),
    imageUrl: z.union([z.string(), z.null()]).optional(),
    categorySlug: z.union([z.string(), z.null()]).optional(),
    pricePerPerson: z.coerce.number().optional(),
    pricePerPersonOnSite: z.union([z.coerce.number(), z.null()]).optional(),
    minPersons: z.coerce.number().optional(),
    icon: z.string().optional(),
    dietaryTags: z.array(z.string()).optional(),
  })
  .partial();

const eventExtrasCategoryMappingSchema = z.object({
  eventTypeId: z.string().min(1),
  extrasCategoryId: z.string().min(1),
});

function pickWithSnakeFallback(obj, keys) {
  const out = {};
  for (const key of keys) {
    const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    const v = obj[key] ?? obj[snake];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const BUNDLE_PATCH_KEYS = [
  "name", "description", "longDescription", "imageUrl", "categorySlug",
  "priceNetto", "vatRate", "priceBrutto", "basePrice", "converter", "minQuantity", "icon", "dietaryTags",
];

const CONFIGURABLE_SET_PATCH_KEYS = [
  "name", "description", "longDescription", "imageUrl", "categorySlug",
  "pricePerPerson", "pricePerPersonOnSite", "minPersons", "icon", "dietaryTags",
];

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function decimalToNum(d) {
  if (d == null) return null;
  return toNum(d.toString());
}

// ─── Company settings ─────────────────────────────────────────────────
/** PATCH /api/admin/company-settings - upsert single row */
router.patch("/company-settings", requireCsrf, async (req, res) => {
  try {
    const body = req.body ?? {};
    const existing = await prisma.companySetting.findFirst();
    const payload = {
      companyName: body.companyName ?? existing?.companyName ?? "",
      nip: body.nip ?? existing?.nip ?? "",
      email: body.email ?? existing?.email ?? "",
      phone: body.phone ?? existing?.phone ?? "",
      address: body.address ?? existing?.address ?? "",
      bankAccount: body.bankAccount ?? existing?.bankAccount ?? "",
      logoUrl: body.logoUrl ?? existing?.logoUrl ?? null,
      faviconUrl: body.faviconUrl  ?? existing?.faviconUrl ?? null,
      privacyPolicyUrl: body.privacyPolicyUrl  ?? existing?.privacyPolicyUrl ?? null,
      minOrderValue: body.minOrderValue  ?? existing?.minOrderValue ?? 200,
      minLeadDays: body.minLeadDays  ?? existing?.minLeadDays ?? 3,
      companyAddressFull: body.companyAddressFull  ?? existing?.companyAddressFull ?? "",
      companyLat: body.companyLat ?? existing?.companyLat ?? null,
      companyLng: body.companyLng ?? existing?.companyLng ?? null,
      deliveryPricePerKm: body.deliveryPricePerKm ?? existing?.deliveryPricePerKm ?? 3,
      maxDeliveryKm: body.maxDeliveryKm ?? existing?.maxDeliveryKm ?? null,
      freeDeliveryAboveKm: body.freeDeliveryAboveKm ?? existing?.freeDeliveryAboveKm ?? null,
    };
    let row;
    if (existing) {
      row = await prisma.companySetting.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      row = await prisma.companySetting.create({ data: payload });
    }
    res.json(row);
  } catch (err) {
    console.error("PATCH admin/company-settings:", err);
    res.status(500).json({ error: String(err.message) });
  }
});

// ─── Clients ─────────────────────────────────────────────────────────
/** GET /api/admin/clients */
router.get("/clients", async (_req, res) => {
  const list = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });
  const orders = await prisma.order.findMany({
    select: { clientId: true, amount: true, createdAt: true },
    where: { clientId: { not: null } },
  });
  const statsMap = {};
  orders.forEach((o) => {
    if (!o.clientId) return;
    if (!statsMap[o.clientId]) statsMap[o.clientId] = { count: 0, total: 0, lastDate: "" };
    statsMap[o.clientId].count++;
    statsMap[o.clientId].total += Number(o.amount);
    const d = o.createdAt?.toISOString?.() ?? "";
    if (d && (!statsMap[o.clientId].lastDate || d > statsMap[o.clientId].lastDate)) {
      statsMap[o.clientId].lastDate = d;
    }
  });
  const out = list.map((c) => ({
    ...c,
    orders: statsMap[c.id]?.count ?? 0,
    totalSpent: statsMap[c.id]?.total ?? 0,
    lastOrder: statsMap[c.id]?.lastDate ?? null,
  }));
  res.json(out);
});

/** POST /api/admin/clients */
router.post("/clients", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const data = {
    firstName: b.firstName ?? b.first_name ?? "",
    lastName: b.lastName ?? b.last_name ?? "",
    email: b.email ?? "",
    phone: b.phone ?? "",
    phoneAlt: b.phoneAlt ?? b.phone_alt ?? null,
    address: b.address ?? null,
    city: b.city ?? null,
    postalCode: b.postalCode ?? b.postal_code ?? null,
    companyName: b.companyName ?? b.company_name ?? null,
    nip: b.nip ?? null,
    companyAddress: b.companyAddress ?? b.company_address ?? null,
    companyCity: b.companyCity ?? b.company_city ?? null,
    companyPostalCode: b.companyPostalCode ?? b.company_postal_code ?? null,
    notes: b.notes ?? null,
  };
  if (b.id) data.id = b.id;
  const created = await prisma.client.create({ data });
  res.status(201).json(created);
});

/** PATCH /api/admin/clients/:id */
router.patch("/clients/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const b = req.body ?? {};
  const data = {};
  if (b.firstName !== undefined) data.firstName = String(b.firstName);
  if (b.lastName !== undefined) data.lastName = String(b.lastName);
  if (b.email !== undefined) data.email = String(b.email);
  if (b.phone !== undefined) data.phone = String(b.phone);
  if (b.phoneAlt !== undefined) data.phoneAlt = b.phoneAlt;
  if (b.address !== undefined) data.address = b.address;
  if (b.city !== undefined) data.city = b.city;
  if (b.postalCode !== undefined) data.postalCode = b.postalCode;
  if (b.companyName !== undefined) data.companyName = b.companyName;
  if (b.nip !== undefined) data.nip = b.nip;
  if (b.notes !== undefined) data.notes = b.notes;
  const updated = await prisma.client.update({ where: { id }, data });
  res.json(updated);
});

/** DELETE /api/admin/clients/:id */
router.delete("/clients/:id", requireCsrf, async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Orders (list, one, update) ───────────────────────────────────────
/** GET /api/admin/orders */
router.get("/orders", async (_req, res) => {
  const list = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      deliveryZone: true,
      orderItems: { orderBy: { sortOrder: "asc" }, include: { subItems: true } },
      orderFoodCostExtras: true,
    },
  });
  res.json(list);
});

/** GET /api/admin/orders/:id */
router.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      deliveryZone: true,
      orderItems: { orderBy: { sortOrder: "asc" }, include: { subItems: true } },
      orderFoodCostExtras: true,
    },
  });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

/** PATCH /api/admin/orders/:id */
router.patch("/orders/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const {orderItems, orderFoodCostExtras, ...data} = req.body;
  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id }, data });
  }
  if (Array.isArray(orderItems)) {
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    for (let i = 0; i < orderItems.length; i++) {
      const it = orderItems[i];
      const created = await prisma.orderItem.create({
        data: {
          orderId: id,
          name: String(it.name),
          quantity: Number(it.quantity) || 1,
          unit: it.unit,
          pricePerUnit: Number(it.pricePerUnit),
          total: Number(it.total) ?? 0,
          itemType: it.itemType,
          foodCostPerUnit:
            it.foodCostPerUnit != null
              ? Number(it.foodCostPerUnit)
              : 0,
          sortOrder: i,
          dishId: it.dishId ? String(it.dishId) : null,
        },
      });
      if (Array.isArray(it.subItems) && it.subItems.length > 0) {
        await prisma.orderItemSubItem.createMany({
          data: it.subItems.map((s) => ({
            orderItemId: created.id,
            name: String(s.name),
            quantity: numOrAdminOrder(s.quantity, 0),
            unit: s.unit,
            foodCostPerUnit: numOrAdminOrder(s.foodCostPerUnit, 0),
            pricePerUnit: numOrAdminOrder(s.pricePerUnit, 0),
            converter: numOrAdminOrder(s.converter, 1),
            optionConverter: numOrAdminOrder(s.optionConverter, 1),
            groupConverter: numOrAdminOrder(s.groupConverter, 1),
            dishId: s.dishId ? String(s.dishId) : null,
          })),
        });
      }
    }
  }

  if (Array.isArray(orderFoodCostExtras)) {
    await prisma.orderFoodCostExtra.deleteMany({ where: { orderId: id } });
    if (orderFoodCostExtras.length > 0) {
      await prisma.orderFoodCostExtra.createMany({
        data: orderFoodCostExtras.map((e) => ({
          orderId: id,
          name: String(e.name),
          amount: Number(e.amount) ?? 0,
        })),
      });
    }
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      orderItems: { include: { subItems: true } },
      orderFoodCostExtras: true,
    },
  });
  res.json(updated);
});

/** DELETE /api/admin/orders/:id */
router.delete("/orders/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;

  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  await prisma.$transaction(async (tx) => {
    // Fallback for environments where FK cascade could be missing/misaligned.
    await tx.orderItemSubItem.deleteMany({
      where: { orderItem: { orderId: id } },
    });
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.orderFoodCostExtra.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });
  });

  return res.status(204).send();
});

// ─── Catalog (dishes, bundles, sets, extras for admin) ─────────────────
/** GET /api/admin/catalog */
router.get("/catalog", async (_req, res) => {
  const [dishes, bundles, sets, extras] = await Promise.all([
    prisma.dish.findMany({ orderBy: { name: "asc" } }),
    prisma.bundle.findMany({
      include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.configurableSet.findMany({
      include: {
        configGroups: {
          include: { options: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.extra.findMany({ orderBy: { name: "asc" } }),
  ]);
  res.json({
    dishes: dishes.map((d) => ({
      id: d.id,
      name: d.name,
      unit_label: d.unitLabel,
      price_per_unit: decimalToNum(d.pricePerUnit),
      price_brutto: decimalToNum(d.priceBrutto),
    })),
    bundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      base_price: decimalToNum(b.basePrice),
      converter: toNum(b.converter) ?? 1,
      bundle_variants: (b.bundleVariants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        price: decimalToNum(v.price),
        sort_order: v.sortOrder,
      })),
    })),
    configurable_sets: sets.map((s) => ({
      id: s.id,
      name: s.name,
      price_per_person: decimalToNum(s.pricePerPerson),
      config_groups: (s.configGroups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        min_selections: g.minSelections,
        max_selections: g.maxSelections,
        sort_order: g.sortOrder,
        converter: toNum(g.converter) ?? 1,
        config_group_options: (g.options ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          sort_order: o.sortOrder,
          converter: toNum(o.converter) ?? 1,
        })),
      })),
    })),
    extras: extras.map((e) => ({
      id: e.id,
      name: e.name,
      price: decimalToNum(e.price),
      unit_label: e.unitLabel,
      category: e.category,
    })),
  });
});

// ─── Product categories (admin CRUD) ─────────────────────────────────
/** GET /api/admin/product-categories - full rows */
router.get("/product-categories", async (_req, res) => {
  const rows = await prisma.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

/** POST /api/admin/product-categories */
router.post("/product-categories", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const slug = (b.slug ?? String(b.name ?? "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")).trim();
  const created = await prisma.productCategory.create({
    data: {
      name: b.name ?? "",
      description: b.description ?? "",
      icon: b.icon ?? "Salad",
      slug: slug || "category",
      sortOrder: b.sortOrder ?? b.sort_order ?? 0,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/product-categories/:id */
router.patch("/product-categories/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.slug !== undefined) data.slug = String(b.slug);
  if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
  const updated = await prisma.productCategory.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/product-categories/:id */
router.delete("/product-categories/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  await prisma.eventCategoryMapping.deleteMany({ where: { categoryId: id } });
  await prisma.productCategory.delete({ where: { id } });
  res.status(204).send();
});

// ─── Event types ───────────────────────────────────────────────────────
/** GET /api/admin/event-types - full rows */
router.get("/event-types", async (_req, res) => {
  const rows = await prisma.eventType.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

/** POST /api/admin/event-types */
router.post("/event-types", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.eventType.create({
    data: {
      name: b.name,
      icon: b.icon ?? "CalendarDays",
      sortOrder: b.sortOrder,
      isCatering: b.isCatering,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/event-types/:id */
router.patch("/event-types/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
  if (b.isCatering !== undefined) data.isCatering = Boolean(b.isCatering);
  const updated = await prisma.eventType.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/event-types/:id */
router.delete("/event-types/:id", requireCsrf, async (req, res) => {
  await prisma.eventType.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Event category mappings ──────────────────────────────────────────
/** GET /api/admin/event-category-mappings */
router.get("/event-category-mappings", async (_req, res) => {
  const rows = await prisma.eventCategoryMapping.findMany();
  res.json(rows.map((r) => ({ id: r.id, event_type_id: r.eventTypeId, category_id: r.categoryId })));
});

/** POST /api/admin/event-category-mappings */
router.post("/event-category-mappings", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.eventCategoryMapping.create({
    data: {
      eventTypeId: b.eventTypeId ?? b.event_type_id,
      categoryId: b.categoryId ?? b.category_id,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/event-category-mappings/:id */
router.patch("/event-category-mappings/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.eventTypeId !== undefined) data.eventTypeId = String(b.eventTypeId);
  if (b.categoryId !== undefined) data.categoryId = String(b.categoryId);
  const updated = await prisma.eventCategoryMapping.update({
    where: { id: req.params.id },
    data,
  });
  res.status(200).json(updated);
});

/** DELETE /api/admin/event-category-mappings - query: event_type_id, category_id */
router.delete("/event-category-mappings", requireCsrf, async (req, res) => {
  const eventTypeId = req.query.event_type_id;
  const categoryId = req.query.category_id;
  await prisma.eventCategoryMapping.deleteMany({
    where: { eventTypeId, categoryId },
  });
  res.status(204).send();
});

// ─── Event extras category mappings ───────────────────────────────────
/** GET /api/admin/event-extras-category-mappings */
router.get("/event-extras-category-mappings", async (_req, res) => {
  const rows = await prisma.eventExtrasCategoryMapping.findMany();
  res.json(
    rows.map((r) => ({
      id: r.id,
      eventTypeId: r.eventTypeId,
      extrasCategoryId: r.extrasCategoryId,
    }))
  );
});

/** POST /api/admin/event-extras-category-mappings */
router.post("/event-extras-category-mappings", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const parsed = eventExtrasCategoryMappingSchema.safeParse({
    eventTypeId: b.eventTypeId,
    extrasCategoryId: b.extrasCategoryId,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const created = await prisma.eventExtrasCategoryMapping.create({
    data: parsed.data,
  });
  res.status(201).json(created);
});

/** DELETE /api/admin/event-extras-category-mappings - query: eventTypeId, extrasCategoryId */
router.delete("/event-extras-category-mappings", requireCsrf, async (req, res) => {
  const parsed = eventExtrasCategoryMappingSchema.safeParse({
    eventTypeId: req.query.eventTypeId,
    extrasCategoryId: req.query.extrasCategoryId,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  await prisma.eventExtrasCategoryMapping.deleteMany({
    where: parsed.data,
  });
  res.status(204).send();
});

// ─── Extras categories ────────────────────────────────────────────────
/** GET /api/admin/extras-categories - full rows */
router.get("/extras-categories", async (_req, res) => {
  const rows = await prisma.extrasCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

/** POST /api/admin/extras-categories */
router.post("/extras-categories", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const slug = (b.slug ?? String(b.name ?? "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-ąćęłńóśźż]/g, "")).trim();
  const created = await prisma.extrasCategory.create({
    data: {
      name: b.name ?? "",
      description: b.description ?? "",
      icon: b.icon ?? "Sparkles",
      slug: slug || "extras",
      sortOrder: b.sortOrder ?? 0,
      isRequired: b.isRequired ?? b.is_required ?? false,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/extras-categories/:id */
router.patch("/extras-categories/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.slug !== undefined) data.slug = String(b.slug);
  if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
  if (b.isRequired !== undefined) data.isRequired = Boolean(b.isRequired);
  const updated = await prisma.extrasCategory.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/extras-categories/:id */
router.delete("/extras-categories/:id", requireCsrf, async (req, res) => {
  await prisma.extrasCategory.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Extras ───────────────────────────────────────────────────────────
/** GET /api/admin/extras - full list (admin) */
router.get("/extras", async (_req, res) => {
  const rows = await prisma.extra.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

/** POST /api/admin/extras */
router.post("/extras", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.extra.create({
    data: {
      name: b.name ?? "",
      description: b.description ?? "",
      category: b.category ?? "dodatki",
      extrasCategoryId: b.extrasCategoryId ?? b.extras_category_id ?? null,
      price: b.price ?? 0,
      unitLabel: b.unitLabel ?? b.unit_label ?? "szt.",
      sortOrder: b.sortOrder ?? b.sort_order ?? 0,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/extras/:id */
router.patch("/extras/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  ["name", "description", "category", "extrasCategoryId", "price", "unitLabel", "sortOrder"].forEach((key) => {
    const v = b[key] ?? b[key.replace(/([A-Z])/g, "_$1").toLowerCase()];
    if (v !== undefined) data[key] = key === "price" ? Number(v) : key === "sortOrder" ? Number(v) : v;
  });
  const updated = await prisma.extra.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/extras/:id */
router.delete("/extras/:id", requireCsrf, async (req, res) => {
  await prisma.extra.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Extra Bundles & extra_bundle_variants ────────────────────────────
router.get("/extra-bundles", async (_req, res) => {
  const rows = await prisma.extraBundle.findMany({
    include: { extraBundleVariants: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  res.json(rows);
});

router.post("/extra-bundles", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const bundlePayload = {
    name: b.name ?? "",
    description: b.description ?? "",
    longDescription: b.long_description ?? b.longDescription ?? "",
    imageUrl: b.image_url ?? b.imageUrl ?? null,
    category: b.category ?? "dodatki",
    extrasCategoryId: b.extras_category_id ?? b.extrasCategoryId ?? null,
    priceNetto: Number(b.price_netto ?? b.priceNetto ?? 0),
    vatRate: Number(b.vat_rate ?? b.vatRate ?? 23),
    priceBrutto: Number(b.price_brutto ?? b.priceBrutto ?? 0),
    basePrice: Number(b.base_price ?? b.basePrice ?? 0),
    minQuantity: Number(b.min_quantity ?? b.minQuantity ?? 1),
    icon: b.icon ?? "✨",
  };
  const created = await prisma.extraBundle.create({
    data: bundlePayload,
    include: { extraBundleVariants: true },
  });
  if (Array.isArray(b.extra_bundle_variants) && b.extra_bundle_variants.length > 0) {
    await prisma.extraBundleVariant.createMany({
      data: b.extra_bundle_variants.map((v, i) => ({
        bundleId: created.id,
        name: v.name ?? "",
        description: v.description ?? "",
        price: Number(v.price ?? 0),
        priceOnSite: v.price_on_site != null ? Number(v.price_on_site) : null,
        extraId: v.extra_id ?? v.extraId ?? null,
        contents: Array.isArray(v.contents) ? v.contents : [],
        sortOrder: v.sort_order ?? v.sortOrder ?? i,
      })),
    });
  }
  const withVar = await prisma.extraBundle.findUnique({
    where: { id: created.id },
    include: { extraBundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  res.status(201).json(withVar);
});

router.patch("/extra-bundles/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const b = req.body ?? {};
  const data = {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.long_description !== undefined || b.longDescription !== undefined)
    data.longDescription = String(b.long_description ?? b.longDescription);
  if (b.image_url !== undefined || b.imageUrl !== undefined)
    data.imageUrl = b.image_url ?? b.imageUrl ?? null;
  if (b.category !== undefined) data.category = String(b.category);
  if (b.extras_category_id !== undefined || b.extrasCategoryId !== undefined)
    data.extrasCategoryId = b.extras_category_id ?? b.extrasCategoryId ?? null;
  if (b.price_netto !== undefined || b.priceNetto !== undefined)
    data.priceNetto = Number(b.price_netto ?? b.priceNetto);
  if (b.vat_rate !== undefined || b.vatRate !== undefined)
    data.vatRate = Number(b.vat_rate ?? b.vatRate);
  if (b.price_brutto !== undefined || b.priceBrutto !== undefined)
    data.priceBrutto = Number(b.price_brutto ?? b.priceBrutto);
  if (b.base_price !== undefined || b.basePrice !== undefined)
    data.basePrice = Number(b.base_price ?? b.basePrice);
  if (b.min_quantity !== undefined || b.minQuantity !== undefined)
    data.minQuantity = Number(b.min_quantity ?? b.minQuantity);
  if (b.icon !== undefined) data.icon = String(b.icon);

  if (Object.keys(data).length > 0) await prisma.extraBundle.update({ where: { id }, data });

  if (Array.isArray(b.extra_bundle_variants)) {
    await prisma.extraBundleVariant.deleteMany({ where: { bundleId: id } });
    if (b.extra_bundle_variants.length > 0) {
      await prisma.extraBundleVariant.createMany({
        data: b.extra_bundle_variants.map((v, i) => ({
          bundleId: id,
          name: v.name ?? "",
          description: v.description ?? "",
          price: Number(v.price ?? 0),
          priceOnSite: v.price_on_site != null ? Number(v.price_on_site) : null,
          extraId: v.extra_id ?? v.extraId ?? null,
          contents: Array.isArray(v.contents) ? v.contents : [],
          sortOrder: v.sort_order ?? v.sortOrder ?? i,
        })),
      });
    }
  }
  const updated = await prisma.extraBundle.findUnique({
    where: { id },
    include: { extraBundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  res.json(updated);
});

router.delete("/extra-bundles/:id", requireCsrf, async (req, res) => {
  await prisma.extraBundleVariant.deleteMany({ where: { bundleId: req.params.id } });
  await prisma.extraBundle.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Delivery zones (admin: all, not only active) ─────────────────────
/** GET /api/admin/delivery-zones - all */
router.get("/delivery-zones", async (_req, res) => {
  const rows = await prisma.deliveryZone.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

/** POST /api/admin/delivery-zones */
router.post("/delivery-zones", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.deliveryZone.create({
    data: {
      name: b.name ?? "",
      description: b.description ?? "",
      cities: Array.isArray(b.cities) ? b.cities : [],
      postalCodes: Array.isArray(b.postalCodes ?? b.postal_codes) ? (b.postalCodes ?? b.postal_codes) : [],
      price: b.price ?? 0,
      freeDeliveryAbove: b.freeDeliveryAbove ?? b.free_delivery_above ?? null,
      minOrderValue: b.minOrderValue ?? b.min_order_value ?? null,
      isActive: b.isActive ?? b.is_active ?? true,
      sortOrder: b.sortOrder ?? b.sort_order ?? 0,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/delivery-zones/:id */
router.patch("/delivery-zones/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.cities !== undefined) data.cities = Array.isArray(b.cities) ? b.cities : [];
  if (b.postalCodes !== undefined) data.postalCodes = Array.isArray(b.postalCodes) ? b.postalCodes : [];
  if (b.price !== undefined) data.price = Number(b.price);
  if (b.freeDeliveryAbove !== undefined) data.freeDeliveryAbove = b.freeDeliveryAbove;
  if (b.minOrderValue !== undefined) data.minOrderValue = b.minOrderValue;
  if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
  if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
  const updated = await prisma.deliveryZone.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/delivery-zones/:id */
router.delete("/delivery-zones/:id", requireCsrf, async (req, res) => {
  await prisma.deliveryZone.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Blocked dates ───────────────────────────────────────────────────
/** GET /api/admin/blocked-dates - full rows with id */
router.get("/blocked-dates", async (_req, res) => {
  const rows = await prisma.blockedDate.findMany({
    orderBy: { blockedDate: "asc" },
  });
  res.json(rows.map((r) => ({ id: r.id, blocked_date: r.blockedDate, reason: r.reason })));
});

/** POST /api/admin/blocked-dates */
router.post("/blocked-dates", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.blockedDate.create({
    data: {
      blockedDate: new Date(b.blockedDate ?? b.blocked_date ?? Date.now()),
      reason: b.reason ?? null,
    },
  });
  res.status(201).json(created);
});

/** DELETE /api/admin/blocked-dates/:id */
router.delete("/blocked-dates/:id", requireCsrf, async (req, res) => {
  await prisma.blockedDate.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Payment methods (admin CRUD) ─────────────────────────────────────
/** GET /api/admin/payment-methods - all */
router.get("/payment-methods", async (_req, res) => {
  const rows = await prisma.paymentMethod.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

/** POST /api/admin/payment-methods */
router.post("/payment-methods", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.paymentMethod.create({
    data: {
      name: b.name ?? "",
      description: b.description ?? "",
      icon: b.icon ?? "💳",
      isActive: b.isActive ?? true,
      sortOrder: b.sortOrder ?? 0,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/payment-methods/:id */
router.patch("/payment-methods/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
  if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
  const updated = await prisma.paymentMethod.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** DELETE /api/admin/payment-methods/:id */
router.delete("/payment-methods/:id", requireCsrf, async (req, res) => {
  await prisma.paymentMethod.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Ingredients ─────────────────────────────────────────────────────
router.get("/ingredients", async (_req, res) => {
  const rows = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});
router.post("/ingredients", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.ingredient.create({
    data: {
      name: b.name ?? "",
      unit: b.unit ?? "g",
      pricePerUnit: Number(b.pricePerUnit ?? b.price_per_unit ?? 0),
      allergens: Array.isArray(b.allergens) ? b.allergens : [],
    },
  });
  res.status(201).json(created);
});
router.patch("/ingredients/:id", requireCsrf, async (req, res) => {
  const data = {};
  const b = req.body ?? {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.unit !== undefined) data.unit = String(b.unit);
  if (b.pricePerUnit !== undefined) data.pricePerUnit = Number(b.pricePerUnit);
  if (b.allergens !== undefined) data.allergens = Array.isArray(b.allergens) ? b.allergens : [];
  const updated = await prisma.ingredient.update({ where: { id: req.params.id }, data });
  res.json(updated);
});
router.delete("/ingredients/:id", requireCsrf, async (req, res) => {
  await prisma.ingredient.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Dishes & dish_ingredients ───────────────────────────────────────
router.get("/dishes", async (_req, res) => {
  const rows = await prisma.dish.findMany({
    orderBy: { createdAt: "asc" },
    include: { dishIngredients: { include: { ingredient: true } } },
  });
  res.json(rows);
});
router.post("/dishes", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const dishPayload = {
    name: b.name ?? "",
    description: b.description ?? "",
    longDescription: b.longDescription ?? "",
    imageUrl: b.imageUrl ?? b.image_url ?? null,
    categorySlug: b.categorySlug ?? b.category_slug ?? null,
    productType: b.productType ?? b.product_type ?? "dish",
    priceNetto: Number(b.priceNetto ?? b.price_netto ?? 0),
    vatRate: Number(b.vatRate ?? b.vat_rate ?? 8),
    priceBrutto: Number(b.priceBrutto ?? b.price_brutto ?? 0),
    pricePerUnit: Number(b.pricePerUnit ?? b.price_per_unit ?? 0),
    pricePerUnitOnSite: b.pricePerUnitOnSite != null ? Number(b.pricePerUnitOnSite) : null,
    unitLabel: b.unitLabel ?? b.unit_label ?? "szt.",
    minQuantity: Number(b.minQuantity ?? b.min_quantity ?? 1),
    icon: b.icon ?? "🍽️",
    contents: Array.isArray(b.contents) ? b.contents : [],
    dietaryTags: Array.isArray(b.dietaryTags ?? b.dietary_tags) ? (b.dietaryTags ?? b.dietary_tags) : [],
    allergens: Array.isArray(b.allergens) ? b.allergens : [],
  };
  const created = await prisma.dish.create({
    data: dishPayload,
    include: { dishIngredients: true },
  });
  if (Array.isArray(b.dish_ingredients) && b.dish_ingredients.length > 0) {
    await prisma.dishIngredient.createMany({
      data: b.dish_ingredients.map((di) => ({
        dishId: created.id,
        ingredientId: di.ingredient_id ?? di.ingredientId,
        quantity: Number(di.quantity ?? 0),
      })),
    });
  }
  const withIng = await prisma.dish.findUnique({
    where: { id: created.id },
    include: { dishIngredients: { include: { ingredient: true } } },
  });
  res.status(201).json(withIng);
});
router.patch("/dishes/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const b = req.body ?? {};
  const data = {};
  [
    "name", "description", "longDescription", "imageUrl", "categorySlug", "productType",
    "priceNetto", "vatRate", "priceBrutto", "pricePerUnit", "pricePerUnitOnSite",
    "unitLabel", "minQuantity", "icon", "contents", "dietaryTags", "allergens",
  ].forEach((key) => {
    const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    const v = b[key] ?? b[snake];
    if (v === undefined) return;
    if (["contents", "dietaryTags", "allergens"].includes(key)) data[key] = Array.isArray(v) ? v : [];
    else if (key.includes("price") || key.includes("Quantity") || key.includes("Rate")) data[key] = Number(v);
    else data[key] = v;
  });
  if (Object.keys(data).length > 0) {
    await prisma.dish.update({ where: { id }, data });
  }
  if (Array.isArray(b.dish_ingredients)) {
    await prisma.dishIngredient.deleteMany({ where: { dishId: id } });
    if (b.dish_ingredients.length > 0) {
      await prisma.dishIngredient.createMany({
        data: b.dish_ingredients.map((di) => ({
          dishId: id,
          ingredientId: di.ingredient_id ?? di.ingredientId,
          quantity: Number(di.quantity ?? 0),
        })),
      });
    }
  }
  const updated = await prisma.dish.findUnique({
    where: { id },
    include: { dishIngredients: { include: { ingredient: true } } },
  });
  res.json(updated);
});
router.delete("/dishes/:id", requireCsrf, async (req, res) => {
  await prisma.dishIngredient.deleteMany({ where: { dishId: req.params.id } });
  await prisma.dish.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get("/dish-ingredients", async (req, res) => {
  const dishId = req.query.dish_id;
  const rows = dishId
    ? await prisma.dishIngredient.findMany({ where: { dishId }, include: { ingredient: true } })
    : await prisma.dishIngredient.findMany({ include: { ingredient: true } });
  res.json(rows);
});

// ─── Bundles & bundle_variants ────────────────────────────────────────
router.get("/bundles", async (_req, res) => {
  const rows = await prisma.bundle.findMany({
    include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  res.json(rows);
});
router.post("/bundles", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const bundlePayload = {
    name: b.name ?? "",
    description: b.description ?? "",
    longDescription: b.longDescription ?? "",
    imageUrl: b.imageUrl ?? null,
    categorySlug: b.categorySlug ?? null,
    priceNetto: Number(b.priceNetto ?? 0),
    vatRate: Number(b.vatRate ?? 8),
    priceBrutto: Number(b.priceBrutto ?? 0),
    basePrice: Number(b.basePrice ?? b.base_price ?? 0),
    converter: Number(b.converter ?? 1),
    minQuantity: Number(b.minQuantity ?? 1),
    icon: b.icon ?? "🍽️",
    dietaryTags: Array.isArray(b.dietary_tags ?? b.dietaryTags) ? (b.dietary_tags ?? b.dietaryTags) : [],
  };
  const created = await prisma.bundle.create({
    data: bundlePayload,
    include: { bundleVariants: true },
  });
  if (Array.isArray(b.bundle_variants) && b.bundle_variants.length > 0) {
    await prisma.bundleVariant.createMany({
      data: b.bundle_variants.map((v, i) => ({
        bundleId: created.id,
        name: v.name ?? "",
        description: v.description ?? "",
        price: Number(v.price ?? 0),
        priceOnSite: v.price_on_site != null ? Number(v.price_on_site) : null,
        dishId: v.dish_id ?? v.dishId ?? null,
        dietaryTags: Array.isArray(v.dietary_tags ?? v.dietaryTags) ? (v.dietary_tags ?? v.dietaryTags) : [],
        allergens: Array.isArray(v.allergens) ? v.allergens : [],
        sortOrder: v.sort_order ?? v.sortOrder ?? i,
      })),
    });
  }
  const withVar = await prisma.bundle.findUnique({
    where: { id: created.id },
    include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  res.status(201).json(withVar);
});
router.patch("/bundles/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const b = req.body ?? {};
  const bodyForBundle = pickWithSnakeFallback(b, BUNDLE_PATCH_KEYS);
  const parsed = bundlePatchSchema.safeParse(bodyForBundle);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length > 0) await prisma.bundle.update({ where: { id }, data });
  if (Array.isArray(b.bundle_variants)) {
    await prisma.bundleVariant.deleteMany({ where: { bundleId: id } });
    if (b.bundle_variants.length > 0) {
      await prisma.bundleVariant.createMany({
        data: b.bundle_variants.map((v, i) => ({
          bundleId: id,
          name: v.name ?? "",
          description: v.description ?? "",
          price: Number(v.price ?? 0),
          priceOnSite: v.price_on_site != null ? Number(v.price_on_site) : null,
          dishId: v.dish_id ?? v.dishId ?? null,
          dietaryTags: Array.isArray(v.dietary_tags ?? v.dietaryTags) ? (v.dietary_tags ?? v.dietaryTags) : [],
          allergens: Array.isArray(v.allergens) ? v.allergens : [],
          sortOrder: v.sort_order ?? v.sortOrder ?? i,
        })),
      });
    }
  }
  const updated = await prisma.bundle.findUnique({
    where: { id },
    include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  res.json(updated);
});
router.delete("/bundles/:id", requireCsrf, async (req, res) => {
  await prisma.bundleVariant.deleteMany({ where: { bundleId: req.params.id } });
  await prisma.bundle.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Configurable sets, config_groups, config_group_options ───────────
router.get("/configurable-sets", async (_req, res) => {
  const rows = await prisma.configurableSet.findMany({
    include: {
      configGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json(rows);
});
router.post("/configurable-sets", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const setPayload = {
    name: b.name,
    description: b.description ?? "",
    longDescription: b.longDescription ?? "",
    imageUrl: b.imageUrl ?? null,
    categorySlug: b.categorySlug ?? null,
    pricePerPerson: Number(b.pricePerPerson),
    pricePerPersonOnSite: b.pricePerPersonOnSite == null ? null : Number(b.pricePerPersonOnSite),
    minPersons: Number(b.minPersons ?? 10),
    icon: b.icon ?? "🍽️",
    dietaryTags: b.dietaryTags ?? [],
  };
  const created = await prisma.configurableSet.create({ data: setPayload });
  if (Array.isArray(b.configGroups) && b.configGroups.length > 0) {
    for (const g of b.configGroups) {
      const group = await prisma.configGroup.create({
        data: {
          setId: created.id,
          name: g.name ?? "",
          minSelections: Number(g.minSelections ?? 1),
          maxSelections: Number(g.maxSelections ?? 3),
          sortOrder: Number(g.sortOrder ?? 0),
          converter: Number(g.converter ?? 1),
        },
      });
      if (Array.isArray(g.configGroupOptions) && g.configGroupOptions.length > 0) {
        await prisma.configGroupOption.createMany({
          data: g.configGroupOptions.map((o, i) => ({
            groupId: group.id,
            name: o.name ?? "",
            dishId: o.dishId ?? null,
            allergens: Array.isArray(o.allergens) ? o.allergens : [],
            dietaryTags: Array.isArray(o.dietaryTags) ? (o.dietaryTags) : [],
            sortOrder: o.sortOrder ?? i,
            converter: Number(o.converter ?? 1),
          })),
        });
      }
    }
  }
  const withGroups = await prisma.configurableSet.findUnique({
    where: { id: created.id },
    include: {
      configGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  res.status(201).json(withGroups);
});
router.patch("/configurable-sets/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const b = req.body ?? {};
  const bodyForSet = pickWithSnakeFallback(b, CONFIGURABLE_SET_PATCH_KEYS);
  const parsed = configurableSetPatchSchema.safeParse(bodyForSet);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length > 0) await prisma.configurableSet.update({ where: { id }, data });
  if (Array.isArray(b.configGroups)) {
    const existing = await prisma.configGroup.findMany({ where: { setId: id }, select: { id: true } });
    const groupIds = existing.map((g) => g.id);
    if (groupIds.length > 0) {
      await prisma.configGroupOption.deleteMany({ where: { groupId: { in: groupIds } } });
      await prisma.configGroup.deleteMany({ where: { setId: id } });
    }
    for (const g of b.configGroups) {
      const group = await prisma.configGroup.create({
        data: {
          setId: id,
          name: g.name ?? "",
          minSelections: Number(g.minSelections ?? 1),
          maxSelections: Number(g.maxSelections ?? 3),
          sortOrder: Number(g.sortOrder ?? 0),
          converter: Number(g.converter ?? 1),
        },
      });
      if (Array.isArray(g.configGroupOptions) && g.configGroupOptions.length > 0) {
        await prisma.configGroupOption.createMany({
          data: g.configGroupOptions.map((o, i) => ({
            groupId: group.id,
            name: o.name ?? "",
            dishId: o.dishId ?? null,
            allergens: Array.isArray(o.allergens) ? o.allergens : [],
            dietaryTags: Array.isArray(o.dietaryTags) ? (o.dietaryTags) : [],
            sortOrder: o.sortOrder ?? i,
            converter: Number(o.converter ?? 1),
          })),
        });
      }
    }
  }
  const updated = await prisma.configurableSet.findUnique({
    where: { id },
    include: {
      configGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  res.json(updated);
});
router.delete("/configurable-sets/:id", requireCsrf, async (req, res) => {
  const groups = await prisma.configGroup.findMany({ where: { setId: req.params.id }, select: { id: true } });
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await prisma.configGroupOption.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.configGroup.deleteMany({ where: { setId: req.params.id } });
  }
  await prisma.configurableSet.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;