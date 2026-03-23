-- AlterTable
ALTER TABLE "bundles" ADD COLUMN     "conventer" DOUBLE PRECISION DEFAULT 1;

-- AlterTable
ALTER TABLE "config_group_options" ADD COLUMN     "conventer" DOUBLE PRECISION DEFAULT 1;

-- AlterTable
ALTER TABLE "config_groups" ADD COLUMN     "conventer" DOUBLE PRECISION DEFAULT 1;

-- AlterTable
ALTER TABLE "order_item_sub_items" ADD COLUMN     "pricePerUnit" DOUBLE PRECISION DEFAULT 0;
