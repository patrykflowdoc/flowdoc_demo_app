-- Prisma schema expects bundles.minQuantity; older DBs may lack this column.
ALTER TABLE "bundles" ADD COLUMN "minQuantity" INTEGER NOT NULL DEFAULT 1;
