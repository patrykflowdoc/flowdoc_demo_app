import { sendOrderPlacedAdminEmail, sendOrderPlacedClientEmail } from "../utils/mail.js";

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildOrderNumber(now) {
  return `KC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
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

  let clientId = null;
  if (explicitClientId) {
    const explicitClient = await prisma.client.findUnique({
      where: { id: String(explicitClientId) },
      select: { id: true },
    });
    if (explicitClient) clientId = explicitClient.id;
  }
  if (!clientId && order.contactEmail) {
    const existing = await prisma.client.findFirst({
      where: { email: String(order.contactEmail).trim() },
      select: { id: true },
    });
    if (existing) clientId = existing.id;
  }

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

  const created = await prisma.order.create({
    data: {
      orderNumber,
      status,
      amount: Number(totalPrice),
      clientId,
      clientName: order.contactName ?? "",
      clientEmail: order.contactEmail ?? "",
      clientPhone: order.contactPhone ?? "",
      contactCity: order.contactCity ?? "",
      contactStreet: order.contactStreet ?? "",
      contactBuilding: order.contactBuildingNumber ?? "",
      contactApartment: order.contactApartmentNumber ?? "",
      deliveryAddress: fullAddress || undefined,
      eventDate: order.eventDate ? new Date(order.eventDate) : null,
      eventType: order.eventType ?? "",
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
