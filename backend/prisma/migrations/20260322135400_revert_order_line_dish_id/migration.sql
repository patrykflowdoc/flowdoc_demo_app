/*
  Warnings:

  - You are about to drop the column `dishId` on the `order_item_sub_items` table. All the data in the column will be lost.
  - You are about to drop the column `dishId` on the `order_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "order_item_sub_items" DROP CONSTRAINT "order_item_sub_items_dishId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_dishId_fkey";

-- AlterTable
ALTER TABLE "order_item_sub_items" DROP COLUMN "dishId";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "dishId";
