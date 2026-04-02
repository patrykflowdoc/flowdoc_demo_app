-- AlterTable
ALTER TABLE "blocked_dates" ADD COLUMN     "blockedTime" TIME;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "eventTime" TIME;
