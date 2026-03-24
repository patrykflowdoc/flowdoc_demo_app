-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "deposit" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "extras" ADD COLUMN     "deposit" DECIMAL(65,30) DEFAULT 0;

-- RenameIndex
ALTER INDEX "event_extras_category_mappings_event_type_id_extras_category_i_" RENAME TO "event_extras_category_mappings_event_type_id_extras_categor_key";
