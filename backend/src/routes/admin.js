/**
 * Admin API: all routes require auth; mutations require CSRF.
 * Mount at /api/admin
 */
import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { createOrderFromPayload } from "../services/createOrderFromPayload.js";
import { sumContributingOrderLineTotals } from "../utils/offerOrderAmount.js";
import { dishIdIfExists } from "../utils/dishFk.js";
import { sanitizeOfferLineNotes } from "../utils/offerLineNotes.js";
import { sanitizeOfferLineServingTime } from "../utils/offerLineServingTime.js";
import {
  createImageMulter,
  deleteStoredUploadIfAppOwned,
  getUploadSubdirByKind,
  normalizeUploadedImage,
  toUploadUrl,
} from "../lib/uploads.js";

const router = Router();
router.use(requireAuth);

function numOrAdminOrder(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Prisma `OrderItem.quantity` jest Int — ułamki / stringi z JSON muszą być obcięte. */
function orderItemQuantityInt(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  if (i < 1) return 1;
  if (i > 999999) return 999999;
  return i;
}

function orderItemUnit(raw) {
  if (raw == null) return "szt.";
  const s = String(raw).trim();
  return s.length > 0 ? s : "szt.";
}

function orderItemTypeStr(raw) {
  const s = raw != null ? String(raw).trim() : "";
  return s.length > 0 ? s : "simple";
}

/** Prisma @db.Date — akceptuje YYYY-MM-DD oraz zapis zwarty YYYYMMDD (błędny klient / legacy). */
function normalizePatchEventDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00.000Z`);
  if (/^\d{8}$/.test(s)) {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00.000Z`);
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Prisma @db.Time — naprawia ISO bez myślników w części daty (np. 19700101T21:00:00.000Z). */
function normalizePatchEventTime(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw).trim();
  const compact = /^(\d{4})(\d{2})(\d{2})T(.*)$/i.exec(s);
  if (compact) {
    s = `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}`;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
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

/** Pick only keys present on obj (camelCase contract — no alias keys). */
function pickDefined(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
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

function normalizeCompanyAssetUrl(value) {
  if (value === undefined) return undefined;
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Nieprawidlowy format URL obrazu.");
  }
  if (!value.startsWith("/uploads/company/")) {
    throw new Error("Dozwolone sa tylko obrazy przeslane do /uploads/company/.");
  }
  return value;
}

async function deleteImageIfReplaced(previousUrl, nextUrl) {
  if (!previousUrl || previousUrl === nextUrl) return;
  await deleteStoredUploadIfAppOwned(previousUrl);
}

function parseUploadKind(rawKind) {
  if (rawKind === "company") return "company";
  if (rawKind === "dish") return "dish";
  if (rawKind === "bundle") return "bundle";
  if (rawKind === "configurableSet") return "configurableSet";
  if (rawKind === "extra") return "extra";
  if (rawKind === "extraBundle") return "extraBundle";
  return null;
}

router.post("/uploads/:kind", requireCsrf, async (req, res) => {
  const kind = parseUploadKind(req.params.kind);
  if (!kind) return res.status(400).json({ error: "Nieznany typ uploadu." });
  const subdir = getUploadSubdirByKind(kind);
  if (!subdir) return res.status(400).json({ error: "Nieznany katalog uploadu." });
  const upload = createImageMulter(subdir).single("file");

  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Plik jest za duzy. Maksymalny rozmiar to 10 MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Nieudany upload pliku." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku." });
    }
    try {
      const normalizedPath = await normalizeUploadedImage(req.file.path, subdir);
      return res.status(201).json({ url: toUploadUrl(normalizedPath) });
    } catch {
      return res.status(400).json({ error: "Nie udalo sie przetworzyc obrazu." });
    }
  });
});

// ─── Company settings ─────────────────────────────────────────────────
/** PATCH /api/admin/company-settings - upsert single row */
router.patch("/company-settings", requireCsrf, async (req, res) => {
  try {
    const body = req.body ?? {};
    const existing = await prisma.companySetting.findFirst();
    const logoUrl = normalizeCompanyAssetUrl(body.logoUrl);
    const faviconUrl = normalizeCompanyAssetUrl(body.faviconUrl);
    const payload = {
      companyName: body.companyName ?? existing?.companyName ?? "",
      nip: body.nip ?? existing?.nip ?? "",
      email: body.email ?? existing?.email ?? "",
      phone: body.phone ?? existing?.phone ?? "",
      address: body.address ?? existing?.address ?? "",
      bankAccount: body.bankAccount ?? existing?.bankAccount ?? "",
      logoUrl: logoUrl === undefined ? existing?.logoUrl ?? null : logoUrl,
      faviconUrl: faviconUrl === undefined ? existing?.faviconUrl ?? null : faviconUrl,
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
    await Promise.all([
      deleteImageIfReplaced(existing?.logoUrl, row.logoUrl),
      deleteImageIfReplaced(existing?.faviconUrl, row.faviconUrl),
    ]);
    res.json(row);
  } catch (err) {
    if (err instanceof Error && /Dozwolone|Nieprawidlowy/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
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
    firstName: b.firstName ?? "",
    lastName: b.lastName ?? "",
    email: b.email ?? "",
    phone: b.phone ?? "",
    phoneAlt: b.phoneAlt ?? null,
    address: b.address ?? null,
    city: b.city ?? null,
    postalCode: b.postalCode ?? null,
    companyName: b.companyName ?? null,
    nip: b.nip ?? null,
    companyAddress: b.companyAddress ?? null,
    companyCity: b.companyCity ?? null,
    companyPostalCode: b.companyPostalCode ?? null,
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
  if (b.companyAddress !== undefined) data.companyAddress = b.companyAddress;
  if (b.companyCity !== undefined) data.companyCity = b.companyCity;
  if (b.companyPostalCode !== undefined) data.companyPostalCode = b.companyPostalCode;
  if (b.notes !== undefined) data.notes = b.notes;
  const updated = await prisma.client.update({ where: { id }, data });
  res.json(updated);
});

/** DELETE /api/admin/clients/:id */
router.delete("/clients/:id", requireCsrf, async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

/** Fields joined for admin order lines (PDF offer: dish.contents, etc.). */
const ORDER_ITEM_DISH_SELECT = {
  id: true,
  name: true,
  description: true,
  longDescription: true,
  imageUrl: true,
  categorySlug: true,
  productType: true,
  pricePerUnit: true,
  pricePerUnitOnSite: true,
  unitLabel: true,
  minQuantity: true,
  bail: true,
  contents: true,
  dietaryTags: true,
  allergens: true,
};

const ORDER_ITEMS_INCLUDE = {
  orderBy: { sortOrder: "asc" },
  include: {
    subItems: { include: { dish: { select: ORDER_ITEM_DISH_SELECT } } },
    dish: { select: ORDER_ITEM_DISH_SELECT },
  },
};

const ORDER_EVENT_DAYS_INCLUDE = {
  orderBy: { sortOrder: "asc" },
};

// ─── Orders (list, one, update) ───────────────────────────────────────
/** GET /api/admin/orders */
router.get("/orders", async (_req, res) => {
  const list = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      deliveryZone: true,
      orderItems: ORDER_ITEMS_INCLUDE,
      orderFoodCostExtras: true,
      orderEventDays: ORDER_EVENT_DAYS_INCLUDE,
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
      orderItems: ORDER_ITEMS_INCLUDE,
      orderFoodCostExtras: true,
      orderEventDays: ORDER_EVENT_DAYS_INCLUDE,
    },
  });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

/** POST /api/admin/orders/:id/offer-token — publiczny link interaktywnej oferty */
router.post("/orders/:id/offer-token", requireCsrf, async (req, res) => {
  const id = req.params.id;
  const row = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "Nowa oferta") {
    return res.status(400).json({
      error: "Link interaktywnej oferty jest dostępny tylko dla statusu „Nowa oferta”.",
    });
  }
  const token = crypto.randomBytes(18).toString("base64url");
  await prisma.order.update({
    where: { id },
    data: { publicOfferToken: token },
  });
  res.status(201).json({ token, publicPath: `/offer/${token}` });
});

/** POST /api/admin/orders */
router.post("/orders", requireCsrf, async (req, res) => {
  try {
    const explicitClientId =
      typeof req.body?.clientId === "string" && req.body.clientId.trim().length > 0
        ? req.body.clientId.trim()
        : null;
    const created = await createOrderFromPayload(prisma, req.body, {
      sendEmails: false,
      explicitClientId,
    });
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/admin/orders error:", err);
    if (err instanceof Error && err.message.includes("Missing order")) {
      return res.status(400).json({ error: err.message });
    }
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "P2003") {
      return res.status(400).json({
        error:
          "Błąd powiązania z daniem w bazie (np. przestarzałe ID w katalogu). Odśwież panel i dodaj pozycję ponownie.",
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error:
        "Nie udało się utworzyć zamówienia. Jeśli problem wraca, sprawdź logi serwera lub skontaktuj się z administratorem.",
      detail: msg,
    });
  }
});

/** PATCH /api/admin/orders/:id */
router.patch("/orders/:id", requireCsrf, async (req, res) => {
  const id = req.params.id;
  try {
  const {orderItems, orderFoodCostExtras, orderEventDays, ...rest} = req.body;
  const data = { ...rest };
  if (Object.prototype.hasOwnProperty.call(data, "eventDate")) {
    data.eventDate = normalizePatchEventDate(data.eventDate);
  }
  if (Object.prototype.hasOwnProperty.call(data, "eventTime")) {
    data.eventTime = normalizePatchEventTime(data.eventTime);
  }
  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id }, data });
  }

  // Synchronize event days first so item FK references are valid
  if (Array.isArray(orderEventDays)) {
    await prisma.orderEventDay.deleteMany({ where: { orderId: id } });
    for (let i = 0; i < orderEventDays.length; i++) {
      const d = orderEventDays[i];
      let guestCountDay = null;
      if (d.guestCount != null && d.guestCount !== "") {
        const n = parseInt(String(d.guestCount), 10);
        if (Number.isFinite(n)) guestCountDay = Math.max(0, Math.min(999999, n));
      }
      await prisma.orderEventDay.create({
        data: {
          id: d.id && String(d.id).length > 10 ? String(d.id) : undefined,
          orderId: id,
          label: String(d.label ?? ""),
          date: d.date ? new Date(String(d.date)) : null,
          startTime: d.startTime ? new Date(String(d.startTime)) : null,
          endTime: d.endTime ? new Date(String(d.endTime)) : null,
          sortOrder: i,
          eventType:
            d.eventType != null && String(d.eventType).trim() ? String(d.eventType).trim() : null,
          guestCount: guestCountDay,
          deliveryAddress:
            d.deliveryAddress != null && String(d.deliveryAddress).trim()
              ? String(d.deliveryAddress).trim()
              : null,
        },
      });
    }
  }

  if (Array.isArray(orderItems)) {
    // Build map of event day IDs that now exist for this order (after upsert above)
    const existingDayIds = new Set(
      (await prisma.orderEventDay.findMany({ where: { orderId: id }, select: { id: true } }))
        .map((d) => d.id)
    );

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    for (let i = 0; i < orderItems.length; i++) {
      const it = orderItems[i];
      const lineDishId = await dishIdIfExists(prisma, it.dishId);
      const eventDayId =
        it.orderEventDayId && existingDayIds.has(String(it.orderEventDayId))
          ? String(it.orderEventDayId)
          : null;
      const created = await prisma.orderItem.create({
        data: {
          orderId: id,
          name: String(it.name ?? ""),
          quantity: orderItemQuantityInt(it.quantity),
          unit: orderItemUnit(it.unit),
          pricePerUnit: Number(it.pricePerUnit),
          total: Number(it.total) ?? 0,
          itemType: orderItemTypeStr(it.itemType),
          foodCostPerUnit:
            it.foodCostPerUnit != null
              ? Number(it.foodCostPerUnit)
              : 0,
          sortOrder: i,
          dishId: lineDishId,
          sourceProductId:
            it.sourceProductId && String(it.sourceProductId).trim()
              ? String(it.sourceProductId).trim()
              : null,
          offerClientToggle: Boolean(it.offerClientToggle),
          offerClientAccepted: Boolean(it.offerClientToggle)
            ? Boolean(it.offerClientAccepted)
            : true,
          orderEventDayId: eventDayId,
          offerLineServingTime: sanitizeOfferLineServingTime(it.offerLineServingTime) ?? undefined,
          offerLineNotes: sanitizeOfferLineNotes(it.offerLineNotes) ?? undefined,
          offerGroupMeta: null,
        },
      });
      if (Array.isArray(it.subItems) && it.subItems.length > 0) {
        const subRows = await Promise.all(
          it.subItems.map(async (s) => ({
            orderItemId: created.id,
            name: String(s.name ?? ""),
            quantity: numOrAdminOrder(s.quantity, 0),
            unit: orderItemUnit(s.unit),
            foodCostPerUnit: numOrAdminOrder(s.foodCostPerUnit, 0),
            pricePerUnit: numOrAdminOrder(s.pricePerUnit, 0),
            converter: numOrAdminOrder(s.converter, 1),
            optionConverter: numOrAdminOrder(s.optionConverter, 1),
            groupConverter: numOrAdminOrder(s.groupConverter, 1),
            dishId: await dishIdIfExists(prisma, s.dishId),
          }))
        );
        await prisma.orderItemSubItem.createMany({ data: subRows });
      }
    }

    const lines = await prisma.orderItem.findMany({
      where: { orderId: id },
      orderBy: { sortOrder: "asc" },
    });
    const ordRow = await prisma.order.findUnique({
      where: { id },
      select: { discount: true },
    });
    const disc = numOrAdminOrder(ordRow?.discount, 0);
    const newAmount = Math.max(0, sumContributingOrderLineTotals(lines) - disc);
    await prisma.order.update({ where: { id }, data: { amount: newAmount } });
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
      orderItems: ORDER_ITEMS_INCLUDE,
      orderFoodCostExtras: true,
    },
  });
  res.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/orders/:id", err);
    const msg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "P2003") {
      return res.status(400).json({
        error:
          "Błąd powiązania z daniem w bazie (np. przestarzałe ID). Odśwież panel i dodaj pozycję ponownie.",
        detail: msg,
      });
    }
    res.status(500).json({
      error: "Nie udało się zapisać zamówienia.",
      detail: process.env.NODE_ENV !== "production" ? msg : undefined,
    });
  }
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
      unitLabel: d.unitLabel,
      pricePerUnit: decimalToNum(d.pricePerUnit),
      priceBrutto: decimalToNum(d.priceBrutto),
    })),
    bundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      basePrice: decimalToNum(b.basePrice),
      converter: toNum(b.converter) ?? 1,
      bundleVariants: (b.bundleVariants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        price: decimalToNum(v.price),
        sortOrder: v.sortOrder,
        dishId: v.dishId ?? null,
      })),
    })),
    configurableSets: sets.map((s) => ({
      id: s.id,
      name: s.name,
      pricePerPerson: decimalToNum(s.pricePerPerson),
      configGroups: (s.configGroups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        sortOrder: g.sortOrder,
        converter: toNum(g.converter) ?? 1,
        options: (g.options ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          sortOrder: o.sortOrder,
          converter: toNum(o.converter) ?? 1,
          dishId: o.dishId ?? null,
        })),
      })),
    })),
    extras: extras.map((e) => ({
      id: e.id,
      name: e.name,
      price: decimalToNum(e.price),
      unitLabel: e.unitLabel,
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
      sortOrder: b.sortOrder ?? 0,
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
  res.json(rows.map((r) => ({ id: r.id, eventTypeId: r.eventTypeId, categoryId: r.categoryId })));
});

/** POST /api/admin/event-category-mappings */
router.post("/event-category-mappings", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.eventCategoryMapping.create({
    data: {
      eventTypeId: b.eventTypeId,
      categoryId: b.categoryId,
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

/** DELETE /api/admin/event-category-mappings - query: eventTypeId, categoryId */
router.delete("/event-category-mappings", requireCsrf, async (req, res) => {
  const eventTypeId = req.query.eventTypeId;
  const categoryId = req.query.categoryId;
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
      isRequired: b.isRequired ?? false,
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
      longDescription: b.longDescription ?? "",
      imageUrl: b.imageUrl ?? null,
      category: b.category ?? "dodatki",
      extrasCategoryId: b.extrasCategoryId ?? null,
      price: b.price ?? 0,
      priceNetto: b.priceNetto ?? null,
      vatRate: b.vatRate ?? 23,
      priceBrutto: b.priceBrutto ?? null,
      priceOnSite: b.priceOnSite ?? null,
      unitLabel: b.unitLabel ?? "szt.",
      priceLabel: b.priceLabel ?? "",
      requiresPersonCount: b.requiresPersonCount ?? false,
      duration: b.duration ?? null,
      contents: Array.isArray(b.contents) ? b.contents : [],
      foodCost: b.foodCost ?? null,
      sortOrder: b.sortOrder ?? 0,
    },
  });
  res.status(201).json(created);
});

/** PATCH /api/admin/extras/:id */
router.patch("/extras/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.extra.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  const data = {};
  const b = req.body ?? {};
  const parseBoolean = (value) =>
    typeof value === "string" ? value.toLowerCase() === "true" : Boolean(value);
  const numberOrNullKeys = ["price", "priceNetto", "priceBrutto", "priceOnSite", "foodCost"];
  const numberKeys = ["sortOrder", "vatRate"];
  const passthroughKeys = [
    "name",
    "description",
    "longDescription",
    "imageUrl",
    "category",
    "extrasCategoryId",
    "unitLabel",
    "priceLabel",
    "duration",
  ];

  numberOrNullKeys.forEach((key) => {
    if (b[key] !== undefined) data[key] = b[key] == null ? null : Number(b[key]);
  });
  numberKeys.forEach((key) => {
    if (b[key] !== undefined) data[key] = Number(b[key]);
  });
  if (b.requiresPersonCount !== undefined) {
    data.requiresPersonCount = parseBoolean(b.requiresPersonCount);
  }
  if (b.contents !== undefined) {
    data.contents = Array.isArray(b.contents) ? b.contents : [];
  }
  passthroughKeys.forEach((key) => {
    if (b[key] !== undefined) data[key] = b[key];
  });

  const updated = await prisma.extra.update({
    where: { id: req.params.id },
    data,
  });
  if (Object.prototype.hasOwnProperty.call(data, "imageUrl")) {
    await deleteImageIfReplaced(existing?.imageUrl, updated.imageUrl);
  }
  res.json(updated);
});

/** DELETE /api/admin/extras/:id */
router.delete("/extras/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.extra.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  await prisma.extra.delete({ where: { id: req.params.id } });
  await deleteStoredUploadIfAppOwned(existing?.imageUrl);
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
    longDescription: b.longDescription ?? "",
    imageUrl: b.imageUrl ?? null,
    category: b.category ?? "dodatki",
    extrasCategoryId: b.extrasCategoryId ?? null,
    priceNetto: Number(b.priceNetto ?? 0),
    vatRate: Number(b.vatRate ?? 23),
    priceBrutto: Number(b.priceBrutto ?? 0),
    basePrice: Number(b.basePrice ?? 0),
    minQuantity: Number(b.minQuantity ?? 1),
    icon: b.icon ?? "✨",
  };
  const created = await prisma.extraBundle.create({
    data: bundlePayload,
    include: { extraBundleVariants: true },
  });
  if (Array.isArray(b.extraBundleVariants) && b.extraBundleVariants.length > 0) {
    await prisma.extraBundleVariant.createMany({
      data: b.extraBundleVariants.map((v, i) => ({
        bundleId: created.id,
        name: v.name ?? "",
        description: v.description ?? "",
        price: Number(v.price ?? 0),
        priceOnSite: v.priceOnSite != null ? Number(v.priceOnSite) : null,
        extraId: v.extraId ?? null,
        contents: Array.isArray(v.contents) ? v.contents : [],
        sortOrder: v.sortOrder ?? i,
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
  const existing = await prisma.extraBundle.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const b = req.body ?? {};
  const data = {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.description !== undefined) data.description = String(b.description);
  if (b.longDescription !== undefined)
    data.longDescription = String(b.longDescription);
  if (b.imageUrl !== undefined)
    data.imageUrl = b.imageUrl ?? null;
  if (b.category !== undefined) data.category = String(b.category);
  if (b.extrasCategoryId !== undefined)
    data.extrasCategoryId = b.extrasCategoryId ?? null;
  if (b.priceNetto !== undefined)
    data.priceNetto = Number(b.priceNetto);
  if (b.vatRate !== undefined)
    data.vatRate = Number(b.vatRate);
  if (b.priceBrutto !== undefined)
    data.priceBrutto = Number(b.priceBrutto);
  if (b.basePrice !== undefined)
    data.basePrice = Number(b.basePrice);
  if (b.minQuantity !== undefined)
    data.minQuantity = Number(b.minQuantity);
  if (b.icon !== undefined) data.icon = String(b.icon);

  if (Object.keys(data).length > 0) await prisma.extraBundle.update({ where: { id }, data });

  if (Array.isArray(b.extraBundleVariants)) {
    await prisma.extraBundleVariant.deleteMany({ where: { bundleId: id } });
    if (b.extraBundleVariants.length > 0) {
      await prisma.extraBundleVariant.createMany({
        data: b.extraBundleVariants.map((v, i) => ({
          bundleId: id,
          name: v.name ?? "",
          description: v.description ?? "",
          price: Number(v.price ?? 0),
          priceOnSite: v.priceOnSite != null ? Number(v.priceOnSite) : null,
          extraId: v.extraId ?? null,
          contents: Array.isArray(v.contents) ? v.contents : [],
          sortOrder: v.sortOrder ?? i,
        })),
      });
    }
  }
  const updated = await prisma.extraBundle.findUnique({
    where: { id },
    include: { extraBundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  if (Object.prototype.hasOwnProperty.call(data, "imageUrl")) {
    await deleteImageIfReplaced(existing?.imageUrl, updated?.imageUrl ?? null);
  }
  res.json(updated);
});

router.delete("/extra-bundles/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.extraBundle.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  await prisma.extraBundleVariant.deleteMany({ where: { bundleId: req.params.id } });
  await prisma.extraBundle.delete({ where: { id: req.params.id } });
  await deleteStoredUploadIfAppOwned(existing?.imageUrl);
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
      postalCodes: Array.isArray(b.postalCodes) ? b.postalCodes : [],
      price: b.price ?? 0,
      freeDeliveryAbove: b.freeDeliveryAbove ?? null,
      minOrderValue: b.minOrderValue ?? null,
      isActive: b.isActive ?? true,
      sortOrder: b.sortOrder ?? 0,
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
  res.json(rows.map((r) => ({ id: r.id, blockedDate: r.blockedDate, reason: r.reason })));
});

/** POST /api/admin/blocked-dates */
router.post("/blocked-dates", requireCsrf, async (req, res) => {
  const b = req.body ?? {};
  const created = await prisma.blockedDate.create({
    data: {
      blockedDate: new Date(b.blockedDate ?? Date.now()),
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
      pricePerUnit: Number(b.pricePerUnit ?? 0),
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
    imageUrl: b.imageUrl ?? null,
    categorySlug: b.categorySlug ?? null,
    productType: b.productType ?? "dish",
    priceNetto: Number(b.priceNetto ?? 0),
    vatRate: Number(b.vatRate ?? 8),
    priceBrutto: Number(b.priceBrutto ?? 0),
    pricePerUnit: Number(b.pricePerUnit ?? 0),
    pricePerUnitOnSite: b.pricePerUnitOnSite != null ? Number(b.pricePerUnitOnSite) : null,
    unitLabel: b.unitLabel ?? "szt.",
    minQuantity: Number(b.minQuantity ?? 1),
    icon: b.icon ?? "🍽️",
    contents: Array.isArray(b.contents) ? b.contents : [],
    dietaryTags: Array.isArray(b.dietaryTags) ? b.dietaryTags : [],
    allergens: Array.isArray(b.allergens) ? b.allergens : [],
  };
  const created = await prisma.dish.create({
    data: dishPayload,
    include: { dishIngredients: true },
  });
  if (Array.isArray(b.dishIngredients) && b.dishIngredients.length > 0) {
    await prisma.dishIngredient.createMany({
      data: b.dishIngredients.map((di) => ({
        dishId: created.id,
        ingredientId: di.ingredientId,
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
  const existing = await prisma.dish.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const b = req.body ?? {};
  const data = {};
  const stringFields = [
    "name", "description", "longDescription", "imageUrl", "categorySlug", "productType",
    "unitLabel", "icon",
  ];
  stringFields.forEach((key) => {
    if (b[key] !== undefined) data[key] = b[key];
  });
  ["priceNetto", "vatRate", "priceBrutto", "pricePerUnit", "minQuantity"].forEach((key) => {
    if (b[key] !== undefined) data[key] = Number(b[key]);
  });
  if (b.pricePerUnitOnSite !== undefined) {
    data.pricePerUnitOnSite = b.pricePerUnitOnSite == null ? null : Number(b.pricePerUnitOnSite);
  }
  ["contents", "dietaryTags", "allergens"].forEach((key) => {
    if (b[key] !== undefined) data[key] = Array.isArray(b[key]) ? b[key] : [];
  });
  if (Object.keys(data).length > 0) {
    await prisma.dish.update({ where: { id }, data });
  }
  if (Array.isArray(b.dishIngredients)) {
    await prisma.dishIngredient.deleteMany({ where: { dishId: id } });
    if (b.dishIngredients.length > 0) {
      await prisma.dishIngredient.createMany({
        data: b.dishIngredients.map((di) => ({
          dishId: id,
          ingredientId: di.ingredientId,
          quantity: Number(di.quantity ?? 0),
        })),
      });
    }
  }
  const updated = await prisma.dish.findUnique({
    where: { id },
    include: { dishIngredients: { include: { ingredient: true } } },
  });
  if (Object.prototype.hasOwnProperty.call(data, "imageUrl")) {
    await deleteImageIfReplaced(existing?.imageUrl, updated?.imageUrl ?? null);
  }
  res.json(updated);
});
router.delete("/dishes/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.dish.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  await prisma.dishIngredient.deleteMany({ where: { dishId: req.params.id } });
  await prisma.dish.delete({ where: { id: req.params.id } });
  await deleteStoredUploadIfAppOwned(existing?.imageUrl);
  res.status(204).send();
});

router.get("/dish-ingredients", async (req, res) => {
  const dishId = req.query.dishId;
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
    basePrice: Number(b.basePrice ?? 0),
    converter: Number(b.converter ?? 1),
    minQuantity: Number(b.minQuantity ?? 1),
    icon: b.icon ?? "🍽️",
    dietaryTags: Array.isArray(b.dietaryTags) ? b.dietaryTags : [],
  };
  const created = await prisma.bundle.create({
    data: bundlePayload,
    include: { bundleVariants: true },
  });
  if (Array.isArray(b.bundleVariants) && b.bundleVariants.length > 0) {
    await prisma.bundleVariant.createMany({
      data: b.bundleVariants.map((v, i) => ({
        bundleId: created.id,
        name: v.name ?? "",
        description: v.description ?? "",
        price: Number(v.price ?? 0),
        priceOnSite: v.priceOnSite != null ? Number(v.priceOnSite) : null,
        dishId: v.dishId ?? null,
        dietaryTags: Array.isArray(v.dietaryTags) ? v.dietaryTags : [],
        allergens: Array.isArray(v.allergens) ? v.allergens : [],
        sortOrder: v.sortOrder ?? i,
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
  const existing = await prisma.bundle.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const b = req.body ?? {};
  const bodyForBundle = pickDefined(b, BUNDLE_PATCH_KEYS);
  const parsed = bundlePatchSchema.safeParse(bodyForBundle);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length > 0) await prisma.bundle.update({ where: { id }, data });
  if (Array.isArray(b.bundleVariants)) {
    await prisma.bundleVariant.deleteMany({ where: { bundleId: id } });
    if (b.bundleVariants.length > 0) {
      await prisma.bundleVariant.createMany({
        data: b.bundleVariants.map((v, i) => ({
          bundleId: id,
          name: v.name ?? "",
          description: v.description ?? "",
          price: Number(v.price ?? 0),
          priceOnSite: v.priceOnSite != null ? Number(v.priceOnSite) : null,
          dishId: v.dishId ?? null,
          dietaryTags: Array.isArray(v.dietaryTags) ? v.dietaryTags : [],
          allergens: Array.isArray(v.allergens) ? v.allergens : [],
          sortOrder: v.sortOrder ?? i,
        })),
      });
    }
  }
  const updated = await prisma.bundle.findUnique({
    where: { id },
    include: { bundleVariants: { orderBy: { sortOrder: "asc" } } },
  });
  if (Object.prototype.hasOwnProperty.call(data, "imageUrl")) {
    await deleteImageIfReplaced(existing?.imageUrl, updated?.imageUrl ?? null);
  }
  res.json(updated);
});
router.delete("/bundles/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.bundle.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  await prisma.bundleVariant.deleteMany({ where: { bundleId: req.params.id } });
  await prisma.bundle.delete({ where: { id: req.params.id } });
  await deleteStoredUploadIfAppOwned(existing?.imageUrl);
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
  const existing = await prisma.configurableSet.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const b = req.body ?? {};
  const bodyForSet = pickDefined(b, CONFIGURABLE_SET_PATCH_KEYS);
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
  if (Object.prototype.hasOwnProperty.call(data, "imageUrl")) {
    await deleteImageIfReplaced(existing?.imageUrl, updated?.imageUrl ?? null);
  }
  res.json(updated);
});
router.delete("/configurable-sets/:id", requireCsrf, async (req, res) => {
  const existing = await prisma.configurableSet.findUnique({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  const groups = await prisma.configGroup.findMany({ where: { setId: req.params.id }, select: { id: true } });
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await prisma.configGroupOption.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.configGroup.deleteMany({ where: { setId: req.params.id } });
  }
  await prisma.configurableSet.delete({ where: { id: req.params.id } });
  await deleteStoredUploadIfAppOwned(existing?.imageUrl);
  res.status(204).send();
});

export default router;