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
    const {
      orderId,
      orderNumber,
      amount,
      customerEmail,
      customerName,
      lineItems,
      successUrl,
      cancelUrl,
    } = req.body ?? {};
    if (!orderId || amount == null || !customerEmail) {
      return res.status(400).json({
        error: "missing_params",
        message: "Brak wymaganych parametrów (orderId, amount, customerEmail)",
      });
    }

    const stripeLineItems = Array.isArray(lineItems) && lineItems.length > 0
      ? lineItems.map((item) => ({
          price_data: {
            currency: "pln",
            product_data: { name: item.name },
            unit_amount: Math.round(Number(item.unitPrice) * 100),
          },
          quantity: Number(item.quantity) || 1,
        }))
      : [
          {
            price_data: {
              currency: "pln",
              product_data: { name: `Zamówienie ${orderNumber || orderId}` },
              unit_amount: Math.round(Number(amount) * 100),
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "p24", "blik"],
      mode: "payment",
      customer_email: customerEmail,
      success_url: successUrl || `${req.protocol}://${req.get("host")}?payment=success&order=${orderNumber || orderId}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get("host")}?payment=cancelled&order=${orderNumber || orderId}`,
      metadata: {
        order_id: orderId,
        order_number: String(orderNumber || orderId),
        customer_name: customerName || "",
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
