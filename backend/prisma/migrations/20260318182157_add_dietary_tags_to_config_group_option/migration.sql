-- AlterTable
ALTER TABLE "config_group_options" ADD COLUMN     "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
