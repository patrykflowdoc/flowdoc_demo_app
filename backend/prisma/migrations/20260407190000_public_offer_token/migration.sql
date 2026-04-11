-- AlterTable
ALTER TABLE "orders" ADD COLUMN "public_offer_token" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "source_product_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_offer_token_key" ON "orders"("public_offer_token");
