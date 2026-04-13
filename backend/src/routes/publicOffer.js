/**
 * Public interactive offer — no auth. Token in URL; only orders status "Nowa oferta".
 */
import { Router } from "express";
import { prisma } from "../config/db.js";
import { sumContributingOrderLineTotals } from "../utils/offerOrderAmount.js";
import { sanitizeOfferLineNotes } from "../utils/offerLineNotes.js";

const router = Router();

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const configurableInclude = {
  configGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          dish: { select: { imageUrl: true } },
        },
      },
    },
  },
};

/** Miniatura katalogowa dla linii (danie / pakiet / dodatek / zestaw dodatków). */
async function resolvePublicOfferLineImage(tx, item) {
  const trimmed = (u) => (u != null && String(u).trim() ? String(u).trim() : null);
  const sid =
    item.sourceProductId != null && String(item.sourceProductId).trim()
      ? String(item.sourceProductId).trim()
      : null;
  const t = String(item.itemType ?? "simple").toLowerCase();

  try {
    if (sid) {
      if (t === "configurable") {
        const s = await tx.configurableSet.findUnique({ where: { id: sid }, select: { imageUrl: true } });
        return trimmed(s?.imageUrl);
      }
      if (t === "expandable" || t === "bundle") {
        const b = await tx.bundle.findUnique({ where: { id: sid }, select: { imageUrl: true } });
        return trimmed(b?.imageUrl);
      }
      if (t === "extra_bundle") {
        const eb = await tx.extraBundle.findUnique({ where: { id: sid }, select: { imageUrl: true } });
        return trimmed(eb?.imageUrl);
      }
      if (t === "extra" || t === "service" || t === "packaging" || t === "waiter") {
        const e = await tx.extra.findUnique({ where: { id: sid }, select: { imageUrl: true } });
        return trimmed(e?.imageUrl);
      }
      if (t === "simple") {
        const d = await tx.dish.findUnique({ where: { id: sid }, select: { imageUrl: true } });
        return trimmed(d?.imageUrl);
      }
    }
    if (item.dishId) {
      const d = await tx.dish.findUnique({ where: { id: String(item.dishId) }, select: { imageUrl: true } });
      return trimmed(d?.imageUrl);
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveConfigurableSet(tx, item) {
  if (item.itemType !== "configurable") return null;
  if (item.sourceProductId) {
    return tx.configurableSet.findUnique({
      where: { id: item.sourceProductId },
      include: configurableInclude,
    });
  }
  return tx.configurableSet.findFirst({
    where: { name: item.name },
    include: configurableInclude,
  });
}

async function loadOrderByToken(token) {
  return prisma.order.findFirst({
    where: { publicOfferToken: token },
    include: {
      orderItems: {
        orderBy: { sortOrder: "asc" },
        include: { subItems: { orderBy: { id: "asc" } } },
      },
      orderEventDays: { orderBy: { sortOrder: "asc" } },
    },
  });
}

function serializeOrderHeader(order) {
  return {
    orderNumber: order.orderNumber,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    clientPhone: order.clientPhone,
    eventType: order.eventType,
    eventDate: order.eventDate ? order.eventDate.toISOString().slice(0, 10) : null,
    eventTime: order.eventTime != null ? order.eventTime.toISOString() : null,
    guestCount: order.guestCount,
    deliveryAddress: order.deliveryAddress,
    cateringType: order.cateringType,
    amount: numOr(order.amount),
    discount: numOr(order.discount),
    deliveryCost: numOr(order.deliveryCost),
    deposit: numOr(order.deposit),
    notes: order.notes,
    status: order.status,
  };
}

/** Pola zamówienia edytowalne przez klienta na publicznej ofercie (częściowy PATCH). */
function buildPublicOfferOrderDetailsData(od) {
  if (od == null || typeof od !== "object") return null;
  const data = {};
  if ("guestCount" in od) {
    const g = od.guestCount;
    if (g === "" || g == null) data.guestCount = null;
    else {
      const n = parseInt(String(g), 10);
      data.guestCount = Number.isFinite(n) ? Math.max(0, Math.min(999999, n)) : null;
    }
  }
  if ("deliveryAddress" in od) {
    data.deliveryAddress =
      od.deliveryAddress == null || String(od.deliveryAddress).trim() === ""
        ? null
        : String(od.deliveryAddress);
  }
  if ("eventDate" in od) {
    const raw = od.eventDate;
    if (raw === "" || raw == null) data.eventDate = null;
    else {
      const d = new Date(String(raw));
      data.eventDate = !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if ("eventTime" in od) {
    const et = od.eventTime;
    if (et === "" || et == null) data.eventTime = null;
    else if (typeof et === "string" && et.includes(":")) {
      const [h, m] = et.split(":").map(Number);
      data.eventTime =
        Number.isFinite(h) && Number.isFinite(m) ? new Date(Date.UTC(1970, 0, 1, h, m, 0)) : null;
    }
  }
  return Object.keys(data).length > 0 ? data : null;
}

/** PATCH pól OrderEventDay z body publicznej oferty (klient). */
function buildPublicOfferDayDetailsData(od) {
  if (od == null || typeof od !== "object") return null;
  const data = {};
  if ("guestCount" in od) {
    const g = od.guestCount;
    if (g === "" || g == null) data.guestCount = null;
    else {
      const n = parseInt(String(g), 10);
      data.guestCount = Number.isFinite(n) ? Math.max(0, Math.min(999999, n)) : null;
    }
  }
  if ("deliveryAddress" in od) {
    data.deliveryAddress =
      od.deliveryAddress == null || String(od.deliveryAddress).trim() === ""
        ? null
        : String(od.deliveryAddress);
  }
  if ("eventDate" in od) {
    const raw = od.eventDate;
    if (raw === "" || raw == null) data.date = null;
    else {
      const d = new Date(String(raw));
      data.date = !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if ("eventTime" in od) {
    const et = od.eventTime;
    if (et === "" || et == null) data.startTime = null;
    else if (typeof et === "string" && et.includes(":")) {
      const [h, m] = et.split(":").map(Number);
      data.startTime =
        Number.isFinite(h) && Number.isFinite(m) ? new Date(Date.UTC(1970, 0, 1, h, m, 0)) : null;
    }
  }
  if ("eventType" in od) {
    data.eventType =
      od.eventType == null || String(od.eventType).trim() === ""
        ? null
        : String(od.eventType).trim();
  }
  return Object.keys(data).length > 0 ? data : null;
}

/** GET /api/public/offers/:token */
router.get("/offers/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ error: "Brak tokenu." });

  const order = await loadOrderByToken(token);
  if (!order || order.status !== "Nowa oferta") {
    return res.status(404).json({ error: "Oferta nie została znaleziona lub wygasła." });
  }

  const items = [];
  for (const item of order.orderItems) {
    const row = {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      pricePerUnit: numOr(item.pricePerUnit),
      total: numOr(item.total),
      itemType: item.itemType,
      sourceProductId: item.sourceProductId,
      offerClientToggle: Boolean(item.offerClientToggle),
      offerClientAccepted: Boolean(item.offerClientAccepted),
      orderEventDayId: item.orderEventDayId ?? null,
      offerLineNotes:
        item.offerLineNotes != null && String(item.offerLineNotes).trim() !== ""
          ? String(item.offerLineNotes).trim()
          : null,
      imageUrl: null,
      subItems: (item.subItems ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        quantity: numOr(s.quantity),
        unit: s.unit,
        dishId: s.dishId,
      })),
      configurableSet: null,
    };

    row.imageUrl = await resolvePublicOfferLineImage(prisma, item);

    if (item.itemType === "configurable") {
      const set = await resolveConfigurableSet(prisma, item);
      if (set) {
        row.configurableSet = {
          id: set.id,
          name: set.name,
          description: set.description != null && String(set.description).trim() ? String(set.description).trim() : null,
          imageUrl: set.imageUrl != null && String(set.imageUrl).trim() ? String(set.imageUrl).trim() : null,
          pricePerPerson: numOr(set.pricePerPerson),
          pricePerPersonOnSite:
            set.pricePerPersonOnSite != null ? numOr(set.pricePerPersonOnSite) : null,
          configGroups: (set.configGroups ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
            converter: numOr(g.converter, 1),
            options: (g.options ?? []).map((o) => {
              const optImg = o.dish?.imageUrl != null && String(o.dish.imageUrl).trim() ? String(o.dish.imageUrl).trim() : null;
              return {
                id: o.id,
                name: o.name,
                converter: numOr(o.converter, 1),
                dishId: o.dishId,
                imageUrl: optImg,
              };
            }),
          })),
        };
      }
    }
    items.push(row);
  }

  const days = (order.orderEventDays ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    date: d.date ? d.date.toISOString().slice(0, 10) : null,
    startTime: d.startTime ? d.startTime.toISOString() : null,
    endTime: d.endTime ? d.endTime.toISOString() : null,
    sortOrder: d.sortOrder,
    eventType: d.eventType ?? null,
    guestCount: d.guestCount ?? null,
    deliveryAddress: d.deliveryAddress ?? null,
  }));

  res.json({
    order: serializeOrderHeader(order),
    items,
    days,
  });
});

/**
 * PUT /api/public/offers/:token
 * body: { selections?, toggles?, lineQuantities?, lineNotes?: { [orderItemId]: string }, orderDetails?, dayOrderDetails? }
 */
router.put("/offers/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ error: "Brak tokenu." });

  const order = await loadOrderByToken(token);
  if (!order || order.status !== "Nowa oferta") {
    return res.status(404).json({ error: "Oferta nie została znaleziona lub wygasła." });
  }

  const selections = req.body?.selections;
  const toggles = req.body?.toggles;
  const lineQuantities = req.body?.lineQuantities;
  const orderDetails = req.body?.orderDetails;
  const dayOrderDetails = req.body?.dayOrderDetails;
  const lineNotes = req.body?.lineNotes;
  if (selections != null && typeof selections !== "object") {
    return res.status(400).json({ error: "Nieprawidłowy format (selections)." });
  }
  if (toggles != null && typeof toggles !== "object") {
    return res.status(400).json({ error: "Nieprawidłowy format (toggles)." });
  }
  if (lineQuantities != null && typeof lineQuantities !== "object") {
    return res.status(400).json({ error: "Nieprawidłowy format (lineQuantities)." });
  }
  if (orderDetails != null && typeof orderDetails !== "object") {
    return res.status(400).json({ error: "Nieprawidłowy format (orderDetails)." });
  }
  if (dayOrderDetails != null && !Array.isArray(dayOrderDetails)) {
    return res.status(400).json({ error: "Nieprawidłowy format (dayOrderDetails)." });
  }
  if (lineNotes != null && (typeof lineNotes !== "object" || Array.isArray(lineNotes))) {
    return res.status(400).json({ error: "Nieprawidłowy format (lineNotes)." });
  }

  const selMap = selections && typeof selections === "object" ? selections : {};
  const useLineQuantities = lineQuantities != null && typeof lineQuantities === "object";

  try {
    await prisma.$transaction(async (tx) => {
      const odPatch = buildPublicOfferOrderDetailsData(orderDetails);
      if (odPatch) {
        await tx.order.update({
          where: { id: order.id },
          data: odPatch,
        });
      }

      if (Array.isArray(dayOrderDetails) && dayOrderDetails.length > 0) {
        const dayRows = await tx.orderEventDay.findMany({
          where: { orderId: order.id },
          select: { id: true },
        });
        const allowed = new Set(dayRows.map((r) => r.id));
        for (const row of dayOrderDetails) {
          if (row == null || typeof row !== "object") continue;
          const dayId = String(row.dayId ?? "").trim();
          if (!dayId || !allowed.has(dayId)) continue;
          const patch = buildPublicOfferDayDetailsData(row);
          if (patch && Object.keys(patch).length > 0) {
            await tx.orderEventDay.update({
              where: { id: dayId },
              data: patch,
            });
          }
        }
      }

      for (const item of order.orderItems) {
        if (!item.offerClientToggle) continue;
        const ppu = numOr(item.pricePerUnit);
        if (useLineQuantities && Object.prototype.hasOwnProperty.call(lineQuantities, item.id)) {
          let q = parseInt(String(lineQuantities[item.id]), 10);
          if (!Number.isFinite(q) || q < 0) q = 0;
          if (q > 99999) q = 99999;
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              quantity: q,
              total: ppu * q,
              offerClientAccepted: q > 0,
            },
          });
        } else if (!useLineQuantities && toggles && Object.prototype.hasOwnProperty.call(toggles, item.id)) {
          const on = Boolean(toggles[item.id]);
          const q = on ? Math.max(1, numOr(item.quantity, 1)) : 0;
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              quantity: q,
              total: ppu * q,
              offerClientAccepted: on,
            },
          });
        }
      }

      for (const item of order.orderItems) {
        if (item.itemType !== "configurable") continue;

        let lineQty = numOr(item.quantity, 0);
        if (useLineQuantities && Object.prototype.hasOwnProperty.call(lineQuantities, item.id)) {
          let q = parseInt(String(lineQuantities[item.id]), 10);
          if (!Number.isFinite(q) || q < 0) q = 0;
          if (q > 99999) q = 99999;
          lineQty = q;
        }

        const pricePerUnit = numOr(item.pricePerUnit);
        const sel = selMap[item.id];

        if (lineQty === 0) {
          await tx.orderItemSubItem.deleteMany({ where: { orderItemId: item.id } });
          await tx.orderItem.update({
            where: { id: item.id },
            data: { quantity: 0, total: 0 },
          });
          continue;
        }

        if (!sel || typeof sel !== "object") {
          if (useLineQuantities && Object.prototype.hasOwnProperty.call(lineQuantities, item.id)) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { quantity: lineQty, total: pricePerUnit * lineQty },
            });
            await tx.orderItemSubItem.updateMany({
              where: { orderItemId: item.id },
              data: { quantity: lineQty },
            });
          }
          continue;
        }

        const set = await resolveConfigurableSet(tx, item);
        if (!set) {
          throw new Error(`Brak definicji zestawu dla pozycji: ${item.name}`);
        }

        const subRows = [];
        for (const group of set.configGroups ?? []) {
          const optionId = sel[group.id];
          if (!optionId) {
            if ((group.minSelections ?? 0) >= 1) {
              throw new Error(`Wybierz opcję w grupie: ${group.name}`);
            }
            continue;
          }
          const opt = (group.options ?? []).find((o) => o.id === optionId);
          if (!opt) {
            throw new Error(`Nieprawidłowa opcja w grupie: ${group.name}`);
          }
          const optionConverter = numOr(opt.converter, 1);
          const groupConverter = numOr(group.converter, 1);
          subRows.push({
            orderItemId: item.id,
            name: `${group.name}: ${opt.name}`,
            quantity: lineQty,
            unit: "os.",
            dishId: opt.dishId ?? null,
            foodCostPerUnit: 0,
            pricePerUnit: 0,
            converter: optionConverter !== 1 ? optionConverter : groupConverter,
            optionConverter,
            groupConverter,
          });
        }

        await tx.orderItemSubItem.deleteMany({ where: { orderItemId: item.id } });
        if (subRows.length > 0) {
          await tx.orderItemSubItem.createMany({ data: subRows });
        }

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            quantity: lineQty,
            total: pricePerUnit * lineQty,
          },
        });
      }

      if (lineNotes != null && typeof lineNotes === "object" && !Array.isArray(lineNotes)) {
        const allowedIds = new Set(order.orderItems.map((i) => i.id));
        for (const [rawId, rawVal] of Object.entries(lineNotes)) {
          const id = String(rawId ?? "").trim();
          if (!id || !allowedIds.has(id)) continue;
          const sanitized = sanitizeOfferLineNotes(rawVal);
          await tx.orderItem.update({
            where: { id },
            data: { offerLineNotes: sanitized },
          });
        }
      }

      const lines = await tx.orderItem.findMany({
        where: { orderId: order.id },
        orderBy: { sortOrder: "asc" },
      });
      const sumLines = sumContributingOrderLineTotals(lines);
      const discount = numOr(order.discount);
      const newAmount = Math.max(0, sumLines - discount);

      await tx.order.update({
        where: { id: order.id },
        data: { amount: newAmount },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd zapisu";
    return res.status(400).json({ error: msg });
  }

  const updated = await loadOrderByToken(token);
  res.json({
    ok: true,
    order: serializeOrderHeader(updated),
    message: "Oferta została wysłana. Biuro cateringowe zobaczy aktualną wersję w panelu.",
  });
});

export default router;
