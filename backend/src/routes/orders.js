import { Router } from "express";
import { prisma } from "../config/db.js";
import { createOrderFromPayload } from "../services/createOrderFromPayload.js";

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
    const created = await createOrderFromPayload(prisma, req.body);
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/orders error:", err);
    if (err instanceof Error && err.message.includes("Missing order")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
