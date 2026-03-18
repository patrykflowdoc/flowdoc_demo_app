import { useQuery } from "@tanstack/react-query";
import * as api from "../api/client";

const staleTime = 5 * 60 * 1000;

export function useAppData() {
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: api.getProductCategories,
    staleTime,
  });
  const eventTypesQuery = useQuery({
    queryKey: ["eventTypes"],
    queryFn: api.getEventTypes,
    staleTime,
  });
  const eventCategoryMappingsQuery = useQuery({
    queryKey: ["eventCategoryMappings"],
    queryFn: api.getEventCategoryMappings,
    staleTime,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
    staleTime,
  });
  const extrasCategoriesQuery = useQuery({
    queryKey: ["extrasCategories"],
    queryFn: api.getExtrasCategories,
    staleTime,
  });
  const extrasQuery = useQuery({
    queryKey: ["extras"],
    queryFn: api.getExtras,
    staleTime,
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ["paymentMethods"],
    queryFn: api.getPaymentMethods,
    staleTime,
  });
  const blockedDatesQuery = useQuery({
    queryKey: ["blockedDates"],
    queryFn: api.getBlockedDates,
    staleTime,
  });
  const deliveryConfigQuery = useQuery({
    queryKey: ["deliveryConfig"],
    queryFn: api.getDeliveryConfig,
    staleTime,
  });
  const orderConfigQuery = useQuery({
    queryKey: ["orderConfig"],
    queryFn: api.getOrderConfig,
    staleTime,
  });

  const isLoading =
    categoriesQuery.isLoading ||
    eventTypesQuery.isLoading ||
    productsQuery.isLoading ||
    extrasCategoriesQuery.isLoading ||
    extrasQuery.isLoading ||
    paymentMethodsQuery.isLoading ||
    blockedDatesQuery.isLoading ||
    deliveryConfigQuery.isLoading ||
    eventCategoryMappingsQuery.isLoading ||
    orderConfigQuery.isLoading;

  const defaultDeliveryConfig = {
    companyLat: null as number | null,
    companyLng: null as number | null,
    pricePerKm: 3,
    maxDeliveryKm: null as number | null,
    freeDeliveryAbove: null as number | null,
  };

  return {
    isLoading,
    categories: categoriesQuery.data ?? [],
    eventTypes: eventTypesQuery.data ?? [],
    products: productsQuery.data ?? [],
    extrasCategories: extrasCategoriesQuery.data ?? [],
    extraItems: extrasQuery.data?.extraItems ?? [],
    packagingOptions: extrasQuery.data?.packagingOptions ?? [],
    waiterServiceOptions: extrasQuery.data?.waiterServiceOptions ?? [],
    extraBundles: extrasQuery.data?.extraBundles ?? [],
    paymentMethods: paymentMethodsQuery.data ?? [],
    blockedDates: blockedDatesQuery.data ?? [],
    deliveryConfig: deliveryConfigQuery.data ?? defaultDeliveryConfig,
    eventCategoryMappings: eventCategoryMappingsQuery.data ?? [],
    orderConfig: orderConfigQuery.data ?? { minOrderValue: 0, minLeadDays: 0 },
  };
}
