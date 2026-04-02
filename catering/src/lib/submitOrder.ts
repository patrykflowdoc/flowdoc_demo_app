import { submitOrder as apiSubmitOrder, type SubmitOrderPayload } from "@/api/client";
import type { CateringOrder } from "@/hooks/useCateringOrder";
import type { Product } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption, ExpandableExtra } from "@/data/extras";
import {
  getSimplePrice,
  getVariantPrice,
  getConfigurablePrice,
  getExtraPrice,
  getPackagingPrice,
  getWaiterPrice,
  getExtraBundleVariantPrice,
  includesDeliveryFee,
} from "@/lib/pricing";

export type SubmissionType = "order" | "offer";

export async function submitOrder(
  order: CateringOrder,
  totalPrice: number,
  products: Product[],
  extraItems: ExtraItem[],
  packagingOptions: PackagingOption[],
  waiterServiceOptions: WaiterServiceOption[],
  extraBundles: ExpandableExtra[],
  eventTypes: { id: string; name: string }[],
  submissionType: SubmissionType = "offer",
  allowedExtrasCategoryIds?: Set<string>,
): Promise<{ orderId: string; orderNumber: string }> {
  const ct = order.cateringType;
  const eventType = eventTypes.find((e) => e.id === order.eventType.id);

  type OrderLinePayload = SubmitOrderPayload["orderItems"][number];
  const orderItems: OrderLinePayload[] = [];

  for (const [productId, qty] of Object.entries(order.simpleQuantities)) {
    if (qty > 0) {
      const product = products.find((p) => p.id === productId);
      if (product && product.type === "simple") {
        const price = getSimplePrice(product, ct);
        orderItems.push({
          name: product.name,
          quantity: qty,
          pricePerUnit: price,
          total: price * qty,
          unit: product.unitLabel,
          itemType: "simple",
          dishId: product.id,
        });
      }
    }
  }

  for (const [productId, variants] of Object.entries(order.expandableQuantities)) {
    const product = products.find((p) => p.id === productId);
    if (!product || product.type !== "expandable") continue;

    const subItems: NonNullable<OrderLinePayload["subItems"]> = [];
    let lineTotal = 0;
    for (const [variantId, qty] of Object.entries(variants)) {
      if (qty <= 0) continue;
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) continue;
      const price = getVariantPrice(variant, ct);
      lineTotal += price * qty;
      subItems.push({
        name: variant.name,
        quantity: qty,
        unit: "szt.",
        dishId: variant.dish.id,
        converter: product.converter ?? 1,
        pricePerUnit: price,
      });
    }
    if (subItems.length > 0) {
      orderItems.push({
        name: product.name,
        quantity: 1,
        pricePerUnit: lineTotal,
        total: lineTotal,
        unit: "kpl.",
        itemType: "expandable",
        subItems,
      });
    }
  }

  for (const [productId, data] of Object.entries(order.configurableData)) {
    if (data.quantity > 0) {
      const product = products.find((p) => p.id === productId);
      if (product && product.type === "configurable") {
        const price = getConfigurablePrice(product, ct);
        const chosenSubItems = Object.entries(data.options ?? {}).flatMap(([groupId, optionIds]) => {
          const group = product.optionGroups.find((g) => g.id === groupId);
          return (optionIds ?? []).map((optionId) => {
            const option = group?.options.find((o) => o.id === optionId);
            const optionConverter = option?.converter ?? 1;
            const groupConverter = group?.converter ?? 1;
            return {
              name: group?.name ? `${group.name}: ${option?.name ?? optionId}` : (option?.name ?? optionId),
              quantity: data.quantity,
              unit: "os.",
              dishId: option?.dish?.id,
              converter: optionConverter !== 1 ? optionConverter : groupConverter,
              optionConverter,
              groupConverter,
            };
          });
        });
        orderItems.push({
          name: product.name,
          quantity: data.quantity,
          pricePerUnit: price,
          total: price * data.quantity,
          unit: "os.",
          itemType: "configurable",
          subItems: chosenSubItems,
        });
      }
    }
  }

  for (const [extraId, qty] of Object.entries(order.selectedExtras)) {
    if (qty > 0) {
      const extra = extraItems.find((e) => e.id === extraId);
      const isAllowedByCategory =
        !allowedExtrasCategoryIds ||
        !extra?.extrasCategoryId ||
        allowedExtrasCategoryIds.has(extra.extrasCategoryId);
      if (extra && isAllowedByCategory) {
        const price = getExtraPrice(extra, ct);
        orderItems.push({
          name: extra.name,
          quantity: qty,
          pricePerUnit: price,
          total: price * qty,
          unit: extra.unitLabel,
          itemType: "extra",
        });
      }
    }
  }

  for (const [bundleId, variants] of Object.entries(order.selectedExpandableExtras ?? {})) {
    const bundle = extraBundles.find((b) => b.id === bundleId);
    if (!bundle) continue;
    const isAllowedByCategory =
      !allowedExtrasCategoryIds ||
      !bundle.extrasCategoryId ||
      allowedExtrasCategoryIds.has(bundle.extrasCategoryId);
    if (!isAllowedByCategory) continue;
    const subItems: NonNullable<OrderLinePayload["subItems"]> = [];
    let bundleTotal = 0;
    for (const [variantId, qty] of Object.entries(variants)) {
      if (qty <= 0) continue;
      const variant = bundle.variants.find((v) => v.id === variantId);
      if (!variant) continue;
      const price = getExtraBundleVariantPrice(variant, ct);
      const lineTotal = price * qty;
      bundleTotal += lineTotal;
      subItems.push({ name: variant.name, quantity: qty, unit: "szt." });
    }
    if (subItems.length > 0) {
      orderItems.push({
        name: bundle.name,
        quantity: 1,
        pricePerUnit: bundleTotal,
        total: bundleTotal,
        unit: "kpl.",
        itemType: "extra_bundle",
        subItems,
      });
    }
  }

  if (order.selectedPackaging) {
    const packaging = packagingOptions.find((p) => p.id === order.selectedPackaging);
    const isAllowedByCategory =
      !allowedExtrasCategoryIds ||
      !packaging?.extrasCategoryId ||
      allowedExtrasCategoryIds.has(packaging.extrasCategoryId);
    if (packaging && isAllowedByCategory) {
      const price = getPackagingPrice(packaging, ct);
      orderItems.push({
        name: packaging.name,
        quantity: price > 0 ? order.packagingPersonCount : 1,
        pricePerUnit: price,
        total: price * (price > 0 ? order.packagingPersonCount : 1),
        unit: price > 0 ? "os." : "szt.",
        itemType: "packaging",
      });
    }
  }

  if (order.selectedWaiterService) {
    const service = waiterServiceOptions.find((s) => s.id === order.selectedWaiterService);
    const isAllowedByCategory =
      !allowedExtrasCategoryIds ||
      !service?.extrasCategoryId ||
      allowedExtrasCategoryIds.has(service.extrasCategoryId);
    if (service && isAllowedByCategory) {
      const price = getWaiterPrice(service, ct);
      orderItems.push({
        name: service.name,
        quantity: order.waiterCount,
        pricePerUnit: price,
        total: price * order.waiterCount,
        unit: "szt.",
        itemType: "waiter",
      });
    }
  }
  // TODO: czy doliczamy kaucje do zaliczki?
  const bail = order.bail;
  const deposit = Number((totalPrice * 0.1).toFixed(2));
  const deliveryOut = includesDeliveryFee(order.cateringType) ? (order.deliveryPrice ?? 0) : 0;
  const payload = {
    order: {
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      contactPhone: order.contactPhone,
      contactCity: order.contactCity,
      contactStreet: order.contactStreet,
      contactBuildingNumber: order.contactBuildingNumber,
      contactApartmentNumber: order.contactApartmentNumber,
      companyName: order.companyName?.trim() || null,
      companyNip: order.companyNip?.trim() || null,
      eventDate: order.eventDate || null,
      eventTime: order.eventTime || null,
      eventType: eventType?.name || order.eventType.name,
      guestCount: order.guestCount,
      cateringType: order.cateringType,
      deliveryZoneId: includesDeliveryFee(order.cateringType) ? (order.deliveryZoneId ?? null) : null,
      deliveryPrice: deliveryOut,
      paymentMethod: order.paymentMethod,
      notes: order.notes || "",
      deposit: deposit,
      bail: bail,
    },
    totalPrice,
    orderItems,
    submissionType,
  };
  const result = await apiSubmitOrder(payload);
  return { orderId: result.orderId, orderNumber: result.orderNumber };
}
