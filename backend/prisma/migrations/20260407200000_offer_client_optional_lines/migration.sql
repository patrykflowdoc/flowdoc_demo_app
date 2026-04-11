-- Optional lines on interactive offer: client toggles inclusion on public page.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "offer_client_toggle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "offer_client_accepted" BOOLEAN NOT NULL DEFAULT true;
