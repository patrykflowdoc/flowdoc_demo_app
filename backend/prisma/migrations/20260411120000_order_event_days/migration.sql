-- Dni/sesje wydarzenia przypisane do zamówienia (np. 3-dniowe wydarzenie).
CREATE TABLE IF NOT EXISTS "order_event_days" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "date" DATE,
    "startTime" TIME,
    "endTime" TIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "order_event_days_pkey" PRIMARY KEY ("id")
);

-- Opcjonalne przypisanie linii zamówienia do dnia/sesji.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "order_event_day_id" TEXT;

-- FK: order_event_days → orders
ALTER TABLE "order_event_days"
    ADD CONSTRAINT "order_event_days_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: order_items → order_event_days (SET NULL gdy dzień usunięty)
ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_order_event_day_id_fkey"
    FOREIGN KEY ("order_event_day_id") REFERENCES "order_event_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
