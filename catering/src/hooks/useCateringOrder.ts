import { useState, useMemo, useCallback } from "react";
import type { Product } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption, ExpandableExtra } from "@/data/extras";
import type { CateringType } from "@/lib/pricing";
import { getSimplePrice, getVariantPrice, getConfigurablePrice, getExtraPrice, getPackagingPrice, getWaiterPrice, getExtraBundleVariantPrice } from "@/lib/pricing";

export type OrderItem = {
  productId: string;
  quantity: number;
  suggestedQuantity: number;
};

export type CateringOrder = {
  cateringType: CateringType;
  guestCount: number;
  eventType: string;
  eventDate: string;
  eventTime: string;
  simpleQuantities: Record<string, number>;
  expandableQuantities: Record<string, Record<string, number>>;
  configurableData: Record<string, { quantity: number; options: Record<string, string[]> }>;
  servingTimes: Record<string, string>;
  productNotes: Record<string, string>;
  selectedExtras: Record<string, number>;
  selectedExpandableExtras: Record<string, Record<string, number>>;
  selectedPackaging: string | null;
  packagingPersonCount: number;
  selectedWaiterService: string | null;
  waiterCount: number;
  items: Record<string, OrderItem>;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCity: string;
  contactStreet: string;
  contactBuildingNumber: string;
  contactApartmentNumber: string;
  companyName: string;
  companyNip: string;
  notes: string;
  paymentMethod: string;
  deliveryZoneId: string | null;
  deliveryPrice: number;
};

const initialOrder: CateringOrder = {
  cateringType: "wyjazdowy",
  guestCount: 50,
  eventType: "",
  eventDate: "",
  eventTime: "",
  simpleQuantities: {},
  expandableQuantities: {},
  configurableData: {},
  servingTimes: {},
  productNotes: {},
  selectedExtras: {},
  selectedExpandableExtras: {},
  selectedPackaging: null,
  packagingPersonCount: 0,
  selectedWaiterService: null,
  waiterCount: 1,
  items: {},
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactCity: "",
  contactStreet: "",
  contactBuildingNumber: "",
  contactApartmentNumber: "",
  companyName: "",
  companyNip: "",
  notes: "",
  paymentMethod: "",
  deliveryZoneId: null,
  deliveryPrice: 0,
};

export function useCateringOrder(
  products: Product[] = [],
  extraItems: ExtraItem[] = [],
  packagingOptionsList: PackagingOption[] = [],
  waiterServiceOptionsList: WaiterServiceOption[] = [],
  extraBundles: ExpandableExtra[] = [],
) {
  const [order, setOrder] = useState<CateringOrder>(initialOrder);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = useMemo(
    () => [
      { id: "event", name: "Wydarzenie", icon: "📋" },
      { id: "products", name: "Produkty", icon: "🍽️" },
      { id: "extras", name: "Dodatki", icon: "✨" },
      { id: "contact", name: "Kontakt", icon: "📧" },
      { id: "summary", name: "Podsumowanie", icon: "✅" },
    ],
    []
  );

  const totalPrice = useMemo(() => {
    let total = 0;
    const ct = order.cateringType;
    
    for (const [productId, qty] of Object.entries(order.simpleQuantities)) {
      if (qty > 0) {
        const product = products.find(p => p.id === productId);
        if (product && product.type === "simple") {
          total += getSimplePrice(product, ct) * qty;
        }
      }
    }
    
    for (const [productId, variants] of Object.entries(order.expandableQuantities)) {
      const product = products.find(p => p.id === productId);
      if (product && product.type === "expandable") {
        for (const [variantId, qty] of Object.entries(variants)) {
          if (qty > 0) {
            const variant = product.variants.find(v => v.id === variantId);
            if (variant) {
              total += getVariantPrice(variant, ct) * qty;
            }
          }
        }
      }
    }
    
    for (const [productId, data] of Object.entries(order.configurableData)) {
      if (data.quantity > 0) {
        const product = products.find(p => p.id === productId);
        if (product && product.type === "configurable") {
          total += getConfigurablePrice(product, ct) * data.quantity;
        }
      }
    }

    for (const [extraId, qty] of Object.entries(order.selectedExtras)) {
      if (qty > 0) {
        const extra = extraItems.find((e) => e.id === extraId);
        if (extra) {
          total += getExtraPrice(extra, ct) * qty;
        }
      }
    }

    for (const [bundleId, variants] of Object.entries(order.selectedExpandableExtras)) {
      const bundle = extraBundles.find(b => b.id === bundleId);
      if (bundle) {
        for (const [variantId, qty] of Object.entries(variants)) {
          if (qty > 0) {
            const variant = bundle.variants.find(v => v.id === variantId);
            if (variant) {
              total += getExtraBundleVariantPrice(variant, ct) * qty;
            }
          }
        }
      }
    }

    if (order.selectedPackaging) {
      const packaging = packagingOptionsList.find(p => p.id === order.selectedPackaging);
      if (packaging && getPackagingPrice(packaging, ct) > 0) {
        total += getPackagingPrice(packaging, ct) * order.packagingPersonCount;
      }
    }

    if (order.selectedWaiterService) {
      const service = waiterServiceOptionsList.find(s => s.id === order.selectedWaiterService);
      if (service) {
        total += getWaiterPrice(service, ct) * order.waiterCount;
      }
    }
    // Delivery cost
    total += order.deliveryPrice;
    
    return total;
  }, [order.cateringType, order.simpleQuantities, order.expandableQuantities, order.configurableData, order.selectedExtras, order.selectedExpandableExtras, order.selectedPackaging, order.packagingPersonCount, order.selectedWaiterService, order.waiterCount, order.deliveryPrice, products, extraItems, packagingOptionsList, waiterServiceOptionsList, extraBundles]);

  const updateSimpleQuantity = useCallback((productId: string, quantity: number) => {
    setOrder((prev) => ({
      ...prev,
      simpleQuantities: { ...prev.simpleQuantities, [productId]: quantity },
    }));
  }, []);

  const updateExpandableVariant = useCallback((productId: string, variantId: string, quantity: number) => {
    setOrder((prev) => ({
      ...prev,
      expandableQuantities: {
        ...prev.expandableQuantities,
        [productId]: { ...(prev.expandableQuantities[productId] || {}), [variantId]: quantity },
      },
    }));
  }, []);

  const updateConfigurable = useCallback((productId: string, quantity: number, groupId?: string, optionIds?: string[]) => {
    setOrder((prev) => {
      const currentData = prev.configurableData[productId] || { quantity: 0, options: {} };
      const newData = {
        quantity,
        options: groupId && optionIds ? { ...currentData.options, [groupId]: optionIds } : currentData.options,
      };
      return { ...prev, configurableData: { ...prev.configurableData, [productId]: newData } };
    });
  }, []);

  const updateServingTime = useCallback((productId: string, time: string) => {
    setOrder((prev) => ({ ...prev, servingTimes: { ...prev.servingTimes, [productId]: time } }));
  }, []);

  const updateProductNotes = useCallback((productId: string, notes: string) => {
    setOrder((prev) => ({ ...prev, productNotes: { ...prev.productNotes, [productId]: notes } }));
  }, []);

  const updateExtra = useCallback((extraId: string, quantity: number) => {
    setOrder((prev) => ({ ...prev, selectedExtras: { ...prev.selectedExtras, [extraId]: quantity } }));
  }, []);

  const updateExpandableExtra = useCallback((bundleId: string, variantId: string, quantity: number) => {
    setOrder((prev) => ({
      ...prev,
      selectedExpandableExtras: {
        ...prev.selectedExpandableExtras,
        [bundleId]: { ...(prev.selectedExpandableExtras[bundleId] || {}), [variantId]: quantity },
      },
    }));
  }, []);

  const updatePackaging = useCallback((packagingId: string | null, personCount: number) => {
    setOrder((prev) => ({ ...prev, selectedPackaging: packagingId, packagingPersonCount: packagingId ? personCount : 0 }));
  }, []);

  const updateWaiterService = useCallback((serviceId: string | null, count: number) => {
    setOrder((prev) => ({ ...prev, selectedWaiterService: serviceId, waiterCount: count }));
  }, []);

  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (product?.type === "simple") {
      setOrder((prev) => ({ ...prev, simpleQuantities: { ...prev.simpleQuantities, [productId]: quantity } }));
    }
  }, [products]);

  const setGuestCount = useCallback((count: number) => {
    setOrder((prev) => ({ ...prev, guestCount: count }));
  }, []);

  const updateOrder = useCallback((updates: Partial<CateringOrder>) => {
    setOrder((prev) => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const getSuggestedQuantity = useCallback(
    (product: Product): number => {
      if (product.type === "simple") return Math.max(1, Math.ceil(order.guestCount / 8));
      if (product.type === "expandable") return product.minQuantity;
      if (product.type === "configurable") return Math.max(product.minPersons, order.guestCount);
      return 1;
    },
    [order.guestCount]
  );

  const resetOrder = useCallback(() => {
    setOrder(initialOrder);
    setCurrentStep(0);
  }, []);

  return {
    order,
    steps,
    currentStep,
    totalPrice,
    setGuestCount,
    updateSimpleQuantity,
    updateExpandableVariant,
    updateConfigurable,
    updateServingTime,
    updateProductNotes,
    updateExtra,
    updateExpandableExtra,
    updatePackaging,
    updateWaiterService,
    updateItemQuantity,
    getSuggestedQuantity,
    nextStep,
    prevStep,
    goToStep,
    updateOrder,
    resetOrder,
  };
}
