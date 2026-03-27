import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../config/db.js";

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

/** POST /api/create-stripe-checkout - body: orderId, orderNumber, amount, customerEmail, customerName?, lineItems, successUrl?, cancelUrl? */
router.post("/create-stripe-checkout", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: "stripe_not_configured",
      message: "Płatności online nie są jeszcze skonfigurowane.",
    });
  }
  try {
    const { orderId, customerEmail, customerName, successUrl, cancelUrl } = req.body ?? {};
    if (!orderId) {
      return res.status(400).json({
        error: "missing_params",
        message: "Brak identyfikatora zamówienia (orderId).",
      });
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!order) {
      return res.status(404).json({
        error: "order_not_found",
        message: "Nie znaleziono zamówienia.",
      });
    }
    if (order.status === "Potwierdzone") {
      return res.status(409).json({
        error: "already_paid",
        message: "To zamówienie jest już opłacone lub potwierdzone.",
      });
    }
    const amountGrosze = Math.round(order.deposit * 100);
    if (!Number.isFinite(amountGrosze) || amountGrosze < 0) {
      return res.status(400).json({
        error: "invalid_amount",
        message: "Kwota do zapłaty musi być większa od zera.",
      });
    }
    const emailOrder = order.clientEmail;
    const emailRequest = customerEmail;
    if (emailRequest && emailOrder && emailRequest !== emailOrder) {
      return res.status(403).json({
        error: "email_mismatch",
        message: "Adres e-mail nie zgadza się z zamówieniem.",
      });
    }
    const stripeEmail = order.clientEmail?.trim() || customerEmail?.trim();
    if (!stripeEmail) {
      return res.status(400).json({
        error: "missing_email",
        message: "Brak adresu e-mail przy zamówieniu.",
      });
    }
    const itemized = [];
    for (const item of order.orderItems) {
      const q = Math.max(1, Number(item.quantity) || 1);
      const unitGrosze = Math.round(item.pricePerUnit * 100);
      if (unitGrosze < 0) continue;
      itemized.push({
        price_data: {
          currency: "pln",
          product_data: { name: item.name || "Pozycja" },
          unit_amount: unitGrosze,
        },
        quantity: q,
      });
    }
    const deliveryGrosze = Math.round(order.deliveryPrice * 100);
    if (deliveryGrosze > 0) {
      itemized.push({
        price_data: {
          currency: "pln",
          product_data: { name: "Dostawa" },
          unit_amount: deliveryGrosze,
        },
        quantity: 1,
      });
    }
    const itemizedSumGrosze = itemized.reduce(
      (sum, li) => sum + li.price_data.unit_amount * li.quantity,
      0
    );
    const stripeLineItems =
      itemized.length > 0 && Math.abs(itemizedSumGrosze - amountGrosze) <= 1
        ? itemized
        : [
            {
              price_data: {
                currency: "pln",
                product_data: { name: `Zadatek ${order.createdAt.toLocaleDateString("pl-PL")} ${order.clientName}, Zamówienie ${order.orderNumber}` },
                unit_amount: amountGrosze,
              },
              quantity: 1,
            },
          ];
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "p24", "blik"],
      mode: "payment",
      customer_email: stripeEmail,
      success_url:
        successUrl ||
        `${req.protocol}://${req.get("host")}?payment=success&order=${encodeURIComponent(order.orderNumber)}`,
      cancel_url:
        cancelUrl ||
        `${req.protocol}://${req.get("host")}?payment=cancelled&order=${encodeURIComponent(order.orderNumber)}`,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        customer_name: customerName?.trim() || order.clientName || "",
      },
      line_items: stripeLineItems,
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error("create-stripe-checkout error:", err);
    res.status(500).json({
      error: "stripe_error",
      message: err.message || "Błąd Stripe",
    });
  }
});

/**
 * Stripe webhook handler. Must be mounted with express.raw({ type: 'application/json' }).
 * Export for use in index.js.
 */
export async function stripeWebhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];
  const rawBody = req.body; // Buffer from express.raw()

  let event;
  if (secret && sig && rawBody) {
    try {
      const stripeLib = stripe || new Stripe(stripeSecret || "sk_fake");
      const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
      event = stripeLib.webhooks.constructEvent(buf, sig, secret);
    } catch (e) {
      console.error("Stripe webhook signature verification failed:", e.message);
      return res.status(400).send("Invalid signature");
    }
  } else {
    try {
      const str = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
      event = JSON.parse(str);
    } catch {
      return res.status(400).send("Invalid JSON");
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = session?.metadata?.order_id;
    const paymentStatus = session?.payment_status;
    if (orderId && paymentStatus === "paid") {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "Potwierdzone", paymentMethod: "Stripe" },
        });
      } catch (err) {
        console.error("Error updating order after Stripe webhook:", err);
      }
    }
  }

  res.json({ received: true });
}

export default router;
