-- AlterTable
ALTER TABLE "order_item_sub_items" ADD COLUMN     "dishId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "dishId" TEXT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_sub_items" ADD CONSTRAINT "order_item_sub_items_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
