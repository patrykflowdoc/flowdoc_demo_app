ALTER TABLE "bundles" RENAME COLUMN "conventer" TO "converter";
ALTER TABLE "config_groups" RENAME COLUMN "conventer" TO "converter";
ALTER TABLE "config_group_options" RENAME COLUMN "conventer" TO "converter";

ALTER TABLE "order_item_sub_items" ADD COLUMN "converter" DOUBLE PRECISION DEFAULT 1;
ALTER TABLE "order_item_sub_items" ADD COLUMN "optionConverter" DOUBLE PRECISION DEFAULT 1;
ALTER TABLE "order_item_sub_items" ADD COLUMN "groupConverter" DOUBLE PRECISION DEFAULT 1;
