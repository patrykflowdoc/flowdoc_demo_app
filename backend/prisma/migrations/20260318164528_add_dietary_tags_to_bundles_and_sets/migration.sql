-- AlterTable
ALTER TABLE "bundles" ADD COLUMN     "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "configurable_sets" ADD COLUMN     "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
