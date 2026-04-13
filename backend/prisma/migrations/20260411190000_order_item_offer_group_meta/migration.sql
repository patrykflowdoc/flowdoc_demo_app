-- Metadane per grupa menu (godzina podania + uwagi) dla zestawów konfigurowalnych
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "offer_group_meta" JSONB;
