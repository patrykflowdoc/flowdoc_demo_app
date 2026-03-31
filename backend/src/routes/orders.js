import { Router } from "express";
import { prisma } from "../config/db.js";
import { sendOrderPlacedAdminEmail, sendOrderPlacedClientEmail } from "../utils/mail.js";

const router = Router();

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
  
    const orderNumber = `KC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`; 
    let clientId = null;
    if (order.contactEmail) {
      const existing = await prisma.client.findFirst({
        where: { email: String(order.contactEmail).trim() },
        select: { id: true },
      });
      if (existing) clientId = existing.id;
    }
    console.log("bail", order.bail);
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
            foodCostPerUnit:
              item.foodCostPerUnit != null ? Number(item.foodCostPerUnit) : 0,
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
              foodCostPerUnit: numOr(sub.foodCostPerUnit, 0),
              pricePerUnit: numOr(sub.pricePerUnit, 0),
              dishId: sub.dishId ? String(sub.dishId) : null,
            })),
          });
        }
      }
    }

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
      orderItems: orderItems,
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

    res.status(201).json({ orderId: created.id, orderNumber });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
