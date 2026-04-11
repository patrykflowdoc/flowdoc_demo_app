-- Szczegóły wydarzenia per dzień (jak w panelu / ofercie interaktywnej)
ALTER TABLE "order_event_days" ADD COLUMN IF NOT EXISTS "event_type" TEXT;
ALTER TABLE "order_event_days" ADD COLUMN IF NOT EXISTS "guest_count" INTEGER;
ALTER TABLE "order_event_days" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;
