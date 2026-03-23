-- CreateTable
CREATE TABLE "event_extras_category_mappings" (
    "id" TEXT NOT NULL,
    "event_type_id" TEXT NOT NULL,
    "extras_category_id" TEXT NOT NULL,

    CONSTRAINT "event_extras_category_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_extras_category_mappings_event_type_id_extras_category_i_key"
ON "event_extras_category_mappings"("event_type_id", "extras_category_id");

-- CreateIndex
CREATE INDEX "event_extras_category_mappings_event_type_id_idx"
ON "event_extras_category_mappings"("event_type_id");

-- CreateIndex
CREATE INDEX "event_extras_category_mappings_extras_category_id_idx"
ON "event_extras_category_mappings"("extras_category_id");

-- AddForeignKey
ALTER TABLE "event_extras_category_mappings"
ADD CONSTRAINT "event_extras_category_mappings_event_type_id_fkey"
FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_extras_category_mappings"
ADD CONSTRAINT "event_extras_category_mappings_extras_category_id_fkey"
FOREIGN KEY ("extras_category_id") REFERENCES "extras_categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
