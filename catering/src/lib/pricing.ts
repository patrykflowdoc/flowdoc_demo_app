import type { Product, SimpleProduct, ConfigurableProduct, ProductVariant } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption, ExtraVariant } from "@/data/extras";

export type CateringType = "wyjazdowy" | "na_sali" | "odbior_osobisty";

export function isNaSaliCatering(cateringType: CateringType): boolean {
  return cateringType === "na_sali";
}

/** Catering wyjazdowy / odbiór — ten sam przepływ co „Catering” w kreatorze (nie na sali). */
export function isOffPremiseCatering(cateringType: CateringType): boolean {
  return cateringType === "wyjazdowy" || cateringType === "odbior_osobisty";
}

export function needsDeliveryAddress(cateringType: CateringType): boolean {
  return cateringType === "wyjazdowy";
}

export function includesDeliveryFee(cateringType: CateringType): boolean {
  return cateringType === "wyjazdowy";
}

/** Get effective price for a simple product */
export function getSimplePrice(product: SimpleProduct, cateringType: CateringType): number {
  if (cateringType === "na_sali" && product.pricePerUnitOnSite != null) {
    return product.pricePerUnitOnSite;
  }
  return product.pricePerUnit;
}

/** Get effective price for a variant */
export function getVariantPrice(variant: ProductVariant, cateringType: CateringType): number {
  if (cateringType === "na_sali" && variant.priceOnSite != null) {
    return variant.priceOnSite;
  }
  return variant.price;
}

/** Get effective price per person for a configurable product */
export function getConfigurablePrice(product: ConfigurableProduct, cateringType: CateringType): number {
  if (cateringType === "na_sali" && product.pricePerPersonOnSite != null) {
    return product.pricePerPersonOnSite;
  }
  return product.pricePerPerson;
}

/** Get effective price for an extra item */
export function getExtraPrice(extra: ExtraItem, cateringType: CateringType): number {
  if (cateringType === "na_sali" && extra.priceOnSite != null) {
    return extra.priceOnSite;
  }
  return extra.price;
}

/** Get effective price for packaging */
export function getPackagingPrice(pkg: PackagingOption, cateringType: CateringType): number {
  if (cateringType === "na_sali" && pkg.priceOnSite != null) {
    return pkg.priceOnSite;
  }
  return pkg.price;
}

/** Get effective price for waiter service */
export function getWaiterPrice(service: WaiterServiceOption, cateringType: CateringType): number {
  if (cateringType === "na_sali" && service.priceOnSite != null) {
    return service.priceOnSite;
  }
  return service.price;
}

/** Get effective price for an extra bundle variant */
export function getExtraBundleVariantPrice(variant: ExtraVariant, cateringType: CateringType): number {
  if (cateringType === "na_sali" && variant.priceOnSite != null) {
    return variant.priceOnSite;
  }
  return variant.price;
}

/** Get effective price for any product type */
export function getProductPrice(product: Product, cateringType: CateringType): number {
  if (product.type === "simple") return getSimplePrice(product, cateringType);
  if (product.type === "configurable") return getConfigurablePrice(product, cateringType);
  if (product.type === "expandable") {
    const prices = product.variants.map(v => getVariantPrice(v, cateringType));
    return Math.min(...prices);
  }
  return 0;
}
