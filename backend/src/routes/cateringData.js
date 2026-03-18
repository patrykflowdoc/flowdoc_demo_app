import { Router } from "express";
import { prisma } from "../config/db.js";

const router = Router();

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** GET /api/event-types */
router.get("/event-types", async (_req, res) => {
  const rows = await prisma.eventType.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(rows.map((e) => ({ id: e.id, name: e.name })));
});

/** GET /api/product-categories */
router.get("/product-categories", async (_req, res) => {
  const rows = await prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(
    rows.map((c) => ({
      id: c.slug,
      dbId: c.id,
      name: c.name,
      description: c.description ?? "",
    }))
  );
});

/** GET /api/event-category-mappings */
router.get("/event-category-mappings", async (_req, res) => {
  const rows = await prisma.eventCategoryMapping.findMany({
    select: { eventTypeId: true, categoryId: true },
  });
  res.json(
    rows.map((r) => ({ event_type_id: r.eventTypeId, category_id: r.categoryId }))
  );
});

/** GET /api/products - dishes, bundles+variants, configurable_sets+groups+options */
router.get("/products", async (_req, res) => {
  const [dishes, bundles, sets] = await Promise.all([
    prisma.dish.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.bundle.findMany({
      include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.configurableSet.findMany({
      include: {
        configGroups: {
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const products = [];

  for (const d of dishes) {
    products.push({
      type: "simple",
      id: d.id,
      name: d.name,
      description: d.description ?? "",
      longDescription: d.longDescription ?? undefined,
      image: d.imageUrl ?? undefined,
      contents: d.contents ?? [],
      allergens: d.allergens ?? [],
      dietaryTags: d.dietaryTags ?? [],
      pricePerUnit: toNum(d.pricePerUnit) ?? toNum(d.priceBrutto) ?? 0,
      pricePerUnitOnSite: toNum(d.pricePerUnitOnSite),
      unitLabel: d.unitLabel ?? "szt.",
      minQuantity: d.minQuantity ?? 1,
      category: d.categorySlug ?? "patery",
    });
  }

  for (const b of bundles) {
    const variants = (b.bundleVariants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description ?? "",
      price: toNum(v.price) ?? 0,
      priceOnSite: toNum(v.priceOnSite),
      allergens: v.allergens ?? [],
      dietaryTags: v.dietaryTags ?? [],
    }));
    products.push({
      type: "expandable",
      id: b.id,
      name: b.name,
      description: b.description ?? "",
      longDescription: b.longDescription ?? undefined,
      image: b.imageUrl ?? undefined,
      basePrice: toNum(b.basePrice) ?? 0,
      minQuantity: b.minQuantity ?? 1,
      category: b.categorySlug ?? "mini",
      dietaryTags: b.dietaryTags ?? [],
      variants,
    });
  }

  for (const s of sets) {
    const optionGroups = (s.configGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      minSelections: g.minSelections ?? 1,
      maxSelections: g.maxSelections ?? 3,
      options: (g.options ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        allergens: o.allergens ?? [],
        dietaryTags: o.dietaryTags ?? [],
      })),
    }));
    products.push({
      type: "configurable",
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      longDescription: s.longDescription ?? undefined,
      image: s.imageUrl ?? undefined,
      pricePerPerson: toNum(s.pricePerPerson) ?? 0,
      pricePerPersonOnSite: toNum(s.pricePerPersonOnSite),
      minPersons: s.minPersons ?? 10,
      category: s.categorySlug ?? "zestawy",
      dietaryTags: s.dietaryTags ?? [],
      optionGroups,
    });
  }

  res.json(products);
});

/** GET /api/extras-categories */
router.get("/extras-categories", async (_req, res) => {
  const rows = await prisma.extrasCategory.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      required: c.isRequired ?? false,
    }))
  );
});

/** GET /api/extras - returns { extraItems, packagingOptions, waiterServiceOptions, extraBundles } */
router.get("/extras", async (_req, res) => {
  const rows = await prisma.extra.findMany({ orderBy: { sortOrder: "asc" } });
  const extraItems = [];
  const packagingOptions = [];
  const waiterServiceOptions = [];

  for (const e of rows) {
    const base = {
      id: e.id,
      name: e.name,
      description: e.description ?? "",
      longDescription: e.longDescription ?? undefined,
      image: e.imageUrl ?? undefined,
      price: toNum(e.price) ?? 0,
      priceOnSite: toNum(e.priceOnSite),
      contents: e.contents ?? [],
      extrasCategoryId: e.extrasCategoryId ?? undefined,
    };
    if (e.category === "dodatki") {
      extraItems.push({
        ...base,
        unitLabel: e.unitLabel ?? "szt.",
      });
    } else if (e.category === "pakowanie") {
      packagingOptions.push({
        ...base,
        priceLabel: e.priceLabel ?? (toNum(e.price) === 0 ? "W cenie" : `${e.price} zł/os.`),
        requiresPersonCount: e.requiresPersonCount ?? false,
      });
    } else if (e.category === "obsluga") {
      waiterServiceOptions.push({
        ...base,
        duration: e.duration ?? "4h",
      });
    }
  }

  const bundleRows = await prisma.extraBundle.findMany({
    include: { extraBundleVariants: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });

  const extraBundles = bundleRows.map((b) => {
    const variants = (b.extraBundleVariants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description ?? "",
      price: toNum(v.price) ?? 0,
      priceOnSite: toNum(v.priceOnSite),
      contents: v.contents ?? [],
    }));
    return {
      type: "expandable",
      id: b.id,
      name: b.name,
      description: b.description ?? "",
      longDescription: b.longDescription ?? undefined,
      image: b.imageUrl ?? undefined,
      basePrice: toNum(b.basePrice) ?? 0,
      minQuantity: b.minQuantity ?? 1,
      extrasCategoryId: b.extrasCategoryId ?? undefined,
      variants,
    };
  });

  res.json({ extraItems, packagingOptions, waiterServiceOptions, extraBundles });
});

/** GET /api/payment-methods */
router.get("/payment-methods", async (_req, res) => {
  const rows = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json(
    rows.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? "",
      icon: m.icon ?? "💳",
    }))
  );
});

/** GET /api/blocked-dates */
router.get("/blocked-dates", async (_req, res) => {
  const rows = await prisma.blockedDate.findMany({ select: { blockedDate: true } });
  res.json(rows.map((d) => new Date(d.blockedDate)));
});

/** GET /api/delivery-config - from company_settings */
router.get("/delivery-config", async (_req, res) => {
  const row = await prisma.companySetting.findFirst();
  if (!row) {
    return res.json({
      companyLat: null,
      companyLng: null,
      pricePerKm: 3,
      maxDeliveryKm: null,
      freeDeliveryAbove: null,
    });
  }
  res.json({
    companyLat: toNum(row.companyLat),
    companyLng: toNum(row.companyLng),
    pricePerKm: toNum(row.deliveryPricePerKm) ?? 3,
    maxDeliveryKm: toNum(row.maxDeliveryKm),
    freeDeliveryAbove: toNum(row.freeDeliveryAboveKm),
  });
});

/** GET /api/order-config - from company_settings */
router.get("/order-config", async (_req, res) => {
  const row = await prisma.companySetting.findFirst();
  if (!row) {
    return res.json({ minOrderValue: 0, minLeadDays: 0 });
  }
  res.json({
    minOrderValue: toNum(row.minOrderValue) ?? 0,
    minLeadDays: toNum(row.minLeadDays) ?? 0,
  });
});

/** GET /api/company-settings - single row for admin */
router.get("/company-settings", async (_req, res) => {
  const row = await prisma.companySetting.findFirst();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/** GET /api/delivery-zones */
router.get("/delivery-zones", async (_req, res) => {
  const rows = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows);
});

export default router;
