import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { isSkipAuth } from "./config/skipAuth.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import cateringDataRoutes from "./routes/cateringData.js";
import ordersRoutes from "./routes/orders.js";
import deliveryRoutes from "./routes/delivery.js";
import stripeRoutes, { stripeWebhookHandler } from "./routes/stripe.js";
import adminRoutes from "./routes/admin.js";

// Log and avoid silent exit on uncaught errors
// process.on("uncaughtException", (err) => {
//   console.error("uncaughtException:", err);
//   process.exitCode = 1;
// });
// process.on("unhandledRejection", (reason, promise) => {
//   console.error("unhandledRejection:", reason);
//   process.exitCode = 1;
// });

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(cookieParser());

// Stripe webhook needs raw body for signature verification — register before express.json()
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Szczypta Smaku API");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", cateringDataRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api", deliveryRoutes);
app.use("/api", stripeRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 25044;
const server = app.listen(port, () => {
  console.log(`Backend is running on port ${port}`);
  if (isSkipAuth()) {
    console.warn("SKIP_AUTH is enabled: auth and CSRF are bypassed. Use only in trusted/dev environments.");
  }
});

// Keep reference so the process stays alive and log listen errors (e.g. port in use)
server.on("error", (err) => {
  console.error("Server listen error:", err);
  process.exitCode = 1;
});
