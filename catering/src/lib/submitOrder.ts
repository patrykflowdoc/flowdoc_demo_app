import { submitOrder as apiSubmitOrder } from "@/api/client";
import type { CateringOrder } from "@/hooks/useCateringOrder";
import type { Product } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption, ExpandableExtra } from "@/data/extras";
import { getSimplePrice, getVariantPrice, getConfigurablePrice, getExtraPrice, getPackagingPrice, getWaiterPrice, getExtraBundleVariantPrice } from "@/lib/pricing";

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
): Promise<{ orderId: string; orderNumber: string }> {
  const ct = order.cateringType;
  const eventType = eventTypes.find((e) => e.id === order.eventType);

  const orderItems: Array<{
    name: string;
    quantity: number;
    pricePerUnit: number;
    total: number;
    unit: string;
    itemType: string;
  }> = [];

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
        });
      }
    }
  }

  for (const [productId, variants] of Object.entries(order.expandableQuantities)) {
    const product = products.find((p) => p.id === productId);
    if (product && product.type === "expandable") {
      for (const [variantId, qty] of Object.entries(variants)) {
        if (qty > 0) {
          const variant = product.variants.find((v) => v.id === variantId);
          if (variant) {
            const price = getVariantPrice(variant, ct);
            orderItems.push({
              name: `${product.name} — ${variant.name}`,
              quantity: qty,
              pricePerUnit: price,
              total: price * qty,
              unit: "szt.",
              itemType: "expandable",
            });
          }
        }
      }
    }
  }

  for (const [productId, data] of Object.entries(order.configurableData)) {
    if (data.quantity > 0) {
      const product = products.find((p) => p.id === productId);
      if (product && product.type === "configurable") {
        const price = getConfigurablePrice(product, ct);
        orderItems.push({
          name: product.name,
          quantity: data.quantity,
          pricePerUnit: price,
          total: price * data.quantity,
          unit: "os.",
          itemType: "configurable",
        });
      }
    }
  }

  for (const [extraId, qty] of Object.entries(order.selectedExtras)) {
    if (qty > 0) {
      const extra = extraItems.find((e) => e.id === extraId);
      if (extra) {
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
    if (bundle) {
      for (const [variantId, qty] of Object.entries(variants)) {
        if (qty > 0) {
          const variant = bundle.variants.find((v) => v.id === variantId);
          if (variant) {
            const price = getExtraBundleVariantPrice(variant, ct);
            orderItems.push({
              name: `${bundle.name}: ${variant.name}`,
              quantity: qty,
              pricePerUnit: price,
              total: price * qty,
              unit: "szt.",
              itemType: "extra_bundle",
            });
          }
        }
      }
    }
  }

  if (order.selectedPackaging) {
    const packaging = packagingOptions.find((p) => p.id === order.selectedPackaging);
    if (packaging) {
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
    if (service) {
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

  const payload = {
    order: {
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      contactPhone: order.contactPhone,
      contactCity: order.contactCity,
      contactStreet: order.contactStreet,
      contactBuildingNumber: order.contactBuildingNumber,
      contactApartmentNumber: order.contactApartmentNumber,
      eventDate: order.eventDate || null,
      eventType: eventType?.name || order.eventType,
      guestCount: order.guestCount,
      deliveryZoneId: order.deliveryZoneId ?? null,
      deliveryPrice: order.deliveryPrice ?? 0,
      paymentMethod: order.paymentMethod,
      notes: order.notes || "",
    },
    totalPrice,
    orderItems,
    submissionType,
  };

  const result = await apiSubmitOrder(payload);
  return { orderId: result.orderId, orderNumber: result.orderNumber };
}
