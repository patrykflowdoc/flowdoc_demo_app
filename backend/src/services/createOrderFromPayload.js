import { sendOrderPlacedAdminEmail, sendOrderPlacedClientEmail } from "../utils/mail.js";

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildOrderNumber(now) {
  return `KC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
}

const ALLOWED_CATERING_TYPES = new Set(["wyjazdowy", "na_sali", "odbior_osobisty"]);

function normalizeCateringType(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  return ALLOWED_CATERING_TYPES.has(s) ? s : null;
}

function trimOrNull(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function splitContactName(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const i = s.indexOf(" ");
  if (i === -1) return { firstName: s, lastName: "" };
  return { firstName: s.slice(0, i).trim(), lastName: s.slice(i + 1).trim() };
}

function buildClientStreetLine(order) {
  const parts = [
    order.contactStreet,
    order.contactBuildingNumber,
    order.contactApartmentNumber ? `/${order.contactApartmentNumber}` : "",
  ].filter(Boolean);
  const line = parts.join(" ").trim();
  return line || null;
}

function clientCityFromOrder(order) {
  const c = trimOrNull(order.contactCity);
  if (!c) return null;
  const low = c.toLowerCase();
  if (low === "na sali" || low === "odbiór osobisty" || low === "odbior osobisty") return null;
  return c;
}

async function resolveClientIdFromOrder(prisma, order, explicitClientId) {
  if (explicitClientId) {
    const row = await prisma.client.findUnique({
      where: { id: String(explicitClientId) },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  const email = trimOrNull(order.contactEmail);
  if (!email) return null;

  const { firstName, lastName } = splitContactName(order.contactName);
  const phone = trimOrNull(order.contactPhone) ?? "";
  const streetLine = buildClientStreetLine(order);
  const city = clientCityFromOrder(order);
  const companyName = trimOrNull(order.companyName);
  const nip = trimOrNull(order.companyNip);

  const existing = await prisma.client.findFirst({
    where: { email },
  });

  if (existing) {
    const data = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (phone) data.phone = phone;
    if (streetLine) data.address = streetLine;
    if (city) data.city = city;
    if (companyName) data.companyName = companyName;
    if (nip) data.nip = nip;
    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }

  const created = await prisma.client.create({
    data: {
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      phone,
      address: streetLine,
      city,
      companyName,
      nip,
    },
  });
  return created.id;
}

export async function createOrderFromPayload(
  prisma,
  body,
  options = {}
) {
  const { order, totalPrice, orderItems, submissionType = "offer" } = body ?? {};
  if (!order || totalPrice == null || !Array.isArray(orderItems)) {
    throw new Error("Missing order, totalPrice, or orderItems");
  }

  const { sendEmails = true, explicitClientId = null } = options;
  const now = new Date();
  const orderNumber = buildOrderNumber(now);

  const explicit =
    explicitClientId && String(explicitClientId).trim() ? String(explicitClientId).trim() : null;
  const clientId = await resolveClientIdFromOrder(prisma, order, explicit);

  const status = submissionType === "order" ? "Nowe zamówienie" : "Nowa oferta";
  const deliveryAddress = [
    order.contactStreet,
    order.contactBuildingNumber,
    order.contactApartmentNumber ? `/${order.contactApartmentNumber}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullAddress =
    deliveryAddress && order.contactCity
      ? `${deliveryAddress}, ${order.contactCity}`
      : order.contactCity || deliveryAddress || "";

  let eventTime = null;
  if (typeof order.eventTime === "string" && order.eventTime.includes(":")) {
    const [h, m] = order.eventTime.split(":").map(Number);
    eventTime =
      Number.isFinite(h) && Number.isFinite(m) ? new Date(Date.UTC(1970, 0, 1, h, m, 0)) : null;
  }
  const created = await prisma.order.create({
    data: {
      orderNumber,
      status,
      amount: Number(totalPrice),
      cateringType: normalizeCateringType(order.cateringType),
      clientId,
      clientName: order.contactName ?? "",
      clientEmail: order.contactEmail ?? "",
      clientPhone: order.contactPhone ?? "",
      companyName: trimOrNull(order.companyName),
      companyNip: trimOrNull(order.companyNip),
      contactCity: order.contactCity ?? "",
      contactStreet: order.contactStreet ?? "",
      contactBuilding: order.contactBuildingNumber ?? "",
      contactApartment: order.contactApartmentNumber ?? "",
      deliveryAddress: fullAddress || undefined,
      eventDate: order.eventDate ? new Date(order.eventDate) : null,
      eventType: order.eventType ?? "",
      eventTime: eventTime,
      guestCount: order.guestCount ?? null,
      deliveryZoneId: order.deliveryZoneId || null,
      deliveryCost: Number(order.deliveryPrice ?? 0),
      paymentMethod: order.paymentMethod ?? "",
      notes: order.notes ?? "",
      deposit: order.deposit,
      bail: order.bail,
    },
  });

  if (orderItems.length > 0) {
    for (let idx = 0; idx < orderItems.length; idx += 1) {
      const item = orderItems[idx];
      const createdItem = await prisma.orderItem.create({
        data: {
          orderId: created.id,
          name: String(item.name),
          quantity: Number(item.quantity),
          unit: item.unit,
          pricePerUnit: Number(item.pricePerUnit),
          total: Number(item.total),
          itemType: item.itemType,
          foodCostPerUnit: item.foodCostPerUnit != null ? Number(item.foodCostPerUnit) : 0,
          sortOrder: idx,
          dishId: item.dishId ? String(item.dishId) : null,
        },
      });

      if (Array.isArray(item.subItems) && item.subItems.length > 0) {
        await prisma.orderItemSubItem.createMany({
          data: item.subItems.map((sub) => ({
            orderItemId: createdItem.id,
            name: String(sub.name),
            quantity: numOr(sub.quantity, 0),
            unit: sub.unit,
            converter: numOr(sub.converter, 1),
            optionConverter: numOr(sub.optionConverter, 1),
            groupConverter: numOr(sub.groupConverter, 1),
            foodCostPerUnit: numOr(sub.foodCostPerUnit, 0),
            pricePerUnit: numOr(sub.pricePerUnit, 0),
            dishId: sub.dishId ? String(sub.dishId) : null,
          })),
        });
      }
    }
  }

  if (sendEmails) {
    const emailVariables = {
      orderNumber,
      status,
      submissionType,
      clientName: order.contactName ?? "",
      clientEmail: order.contactEmail ?? "",
      clientPhone: order.contactPhone ?? "",
      deliveryAddress: fullAddress || "",
      eventDate: order.eventDate ?? null,
      eventType: order.eventType ?? "",
      guestCount: order.guestCount ?? null,
      paymentMethod: order.paymentMethod ?? "",
      notes: order.notes ?? "",
      orderItems,
      totalPrice,
    };

    sendOrderPlacedAdminEmail(emailVariables).catch((err) =>
      console.error("Order admin email failed:", err)
    );
    if (order.contactEmail && String(order.contactEmail).trim()) {
      sendOrderPlacedClientEmail(order.contactEmail.trim(), emailVariables).catch((err) =>
        console.error("Order client email failed:", err)
      );
    }
  }

  return { orderId: created.id, orderNumber };
}
