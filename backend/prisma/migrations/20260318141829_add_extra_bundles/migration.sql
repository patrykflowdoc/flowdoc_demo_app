-- CreateTable
CREATE TABLE "extra_bundles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "longDescription" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'dodatki',
    "extrasCategoryId" TEXT,
    "priceNetto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 23,
    "priceBrutto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "icon" TEXT NOT NULL DEFAULT '✨',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_bundle_variants" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "priceOnSite" DECIMAL(65,30),
    "extraId" TEXT,
    "contents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "extra_bundle_variants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "extra_bundles" ADD CONSTRAINT "extra_bundles_extrasCategoryId_fkey" FOREIGN KEY ("extrasCategoryId") REFERENCES "extras_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_bundle_variants" ADD CONSTRAINT "extra_bundle_variants_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "extra_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_bundle_variants" ADD CONSTRAINT "extra_bundle_variants_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "extras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
