/*
  Warnings:

  - You are about to drop the column `deposit` on the `dishes` table. All the data in the column will be lost.
  - You are about to drop the column `deposit` on the `extras` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dishes" DROP COLUMN "deposit",
ADD COLUMN     "bail" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "extras" DROP COLUMN "deposit",
ADD COLUMN     "bail" DECIMAL(65,30) DEFAULT 0;
