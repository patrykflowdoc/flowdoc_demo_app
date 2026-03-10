import { Router } from "express";
import { prisma } from "../config/db.js";

const router = Router();

/**
 * POST /api/orders
 * Body: {
 *   order: { contactName, contactEmail, contactPhone, contactCity, contactStreet, contactBuildingNumber, contactApartmentNumber, eventDate, eventType, guestCount, deliveryZoneId, deliveryPrice, paymentMethod, notes },
 *   totalPrice: number,
 *   orderItems: [ { name, quantity, pricePerUnit, total, unit, itemType } ],
 *   submissionType?: "order" | "offer"
 * }
 * Returns: { orderId, orderNumber }
 */
router.post("/", async (req, res) => {
  try {
    const { order, totalPrice, orderItems, submissionType = "offer" } = req.body ?? {};
    if (!order || totalPrice == null || !Array.isArray(orderItems)) {
      return res.status(400).json({ error: "Missing order, totalPrice, or orderItems" });
    }

    const now = new Date();
    const orderNumber =
      `KC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    let clientId = null;
    if (order.contactEmail) {
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
    const fullAddress = deliveryAddress && order.contactCity ? `${deliveryAddress}, ${order.contactCity}` : order.contactCity || deliveryAddress || "";

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
      },
    });

    if (orderItems.length > 0) {
      await prisma.orderItem.createMany({
        data: orderItems.map((item, idx) => ({
          orderId: created.id,
          name: String(item.name),
          quantity: Number(item.quantity) || 1,
          unit: item.unit ?? "szt.",
          pricePerUnit: Number(item.pricePerUnit) ?? 0,
          total: Number(item.total) ?? 0,
          itemType: item.itemType ?? "simple",
          sortOrder: idx,
        })),
      });
    }

    res.status(201).json({ orderId: created.id, orderNumber });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
