/**
 * Backend API client. All requests use credentials (cookies).
 * For mutations (POST/PUT/PATCH/DELETE), send X-CSRF-Token header if available.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  method?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers: customHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    ...(typeof customHeaders === "object" && customHeaders && !(customHeaders instanceof Headers)
      ? (customHeaders as Record<string, string>)
      : {}),
  };
  let bodySerialized: BodyInit | undefined;
  if (body != null) {
    if (typeof body === "string" || body instanceof FormData) {
      bodySerialized = body as BodyInit;
    } else {
      headers["Content-Type"] = "application/json";
      bodySerialized = JSON.stringify(body);
    }
  }
  const csrf = getCsrfToken();
  if (csrf && ["POST", "PUT", "PATCH", "DELETE"].includes(method || "GET")) {
    headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    method,
    body: bodySerialized,
    headers,
    ...rest,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || String(res.status));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  login: string;
  username: string;
}

export async function login(login: string, password: string): Promise<{ user: AuthUser; csrfToken?: string }> {
  return request("/api/auth/login", { method: "POST", body: { login, password } });
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<{ user: AuthUser }> {
  return request("/api/auth/me");
}

// ─── Users (admin) ─────────────────────────────────────────────────
export interface UserListItem {
  id: string;
  username: string;
  login: string;
  createdAt: string;
}

export async function getUsers(): Promise<UserListItem[]> {
  return request("/api/users");
}

export async function createUser(data: { login: string; password: string; username?: string }): Promise<UserListItem> {
  return request("/api/users", { method: "POST", body: data });
}

export async function updateUser(
  id: string,
  data: { username?: string; password?: string }
): Promise<UserListItem> {
  return request(`/api/users/${id}`, { method: "PATCH", body: data });
}

export async function deleteUser(id: string): Promise<void> {
  return request(`/api/users/${id}`, { method: "DELETE" });
}

// ─── Catering data (read-only) ─────────────────────────────────────
export async function getEventTypes(): Promise<{ id: string; name: string }[]> {
  return request("/api/event-types");
}

export async function getProductCategories(): Promise<{ id: string; dbId: string; name: string; description: string }[]> {
  return request("/api/product-categories");
}

export async function getEventCategoryMappings(): Promise<{ event_type_id: string; category_id: string }[]> {
  return request("/api/event-category-mappings");
}

export async function getProducts(): Promise<unknown[]> {
  return request("/api/products");
}

export async function getExtrasCategories(): Promise<unknown[]> {
  return request("/api/extras-categories");
}

export async function getExtras(): Promise<{
  extraItems: unknown[];
  packagingOptions: unknown[];
  waiterServiceOptions: unknown[];
}> {
  return request("/api/extras");
}

export async function getPaymentMethods(): Promise<unknown[]> {
  return request("/api/payment-methods");
}

export async function getBlockedDates(): Promise<string[]> {
  return request("/api/blocked-dates");
}

export async function getDeliveryConfig(): Promise<{
  companyLat: number | null;
  companyLng: number | null;
  pricePerKm: number;
  maxDeliveryKm: number | null;
  freeDeliveryAbove: number | null;
}> {
  return request("/api/delivery-config");
}

export async function getOrderConfig(): Promise<{ minOrderValue: number; minLeadDays: number }> {
  return request("/api/order-config");
}

export async function getCompanySettings(): Promise<{ privacyPolicyUrl?: string | null; [key: string]: unknown }> {
  return request("/api/company-settings");
}

export async function getDeliveryZones(): Promise<unknown[]> {
  return request("/api/delivery-zones");
}

// ─── Orders & delivery & Stripe ───────────────────────────────────
export interface SubmitOrderPayload {
  order: {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCity?: string;
    contactStreet?: string;
    contactBuildingNumber?: string;
    contactApartmentNumber?: string;
    eventDate?: string | null;
    eventType?: string;
    guestCount?: number;
    deliveryZoneId?: string | null;
    deliveryPrice?: number;
    paymentMethod?: string;
    notes?: string;
  };
  totalPrice: number;
  orderItems: Array<{
    name: string;
    quantity: number;
    pricePerUnit: number;
    total: number;
    unit?: string;
    itemType?: string;
  }>;
  submissionType?: "order" | "offer";
}

export async function submitOrder(payload: SubmitOrderPayload): Promise<{ orderId: string; orderNumber: string }> {
  return request("/api/orders", { method: "POST", body: payload });
}

export async function calculateDelivery(params: {
  address: string;
  companyLat: number;
  companyLng: number;
}): Promise<{
  distanceKm?: number;
  durationMin?: number;
  customerLat?: number;
  customerLng?: number;
  customerAddress?: string;
  error?: string;
  message?: string;
}> {
  return request("/api/calculate-delivery", { method: "POST", body: params });
}

export async function createStripeCheckout(params: {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerEmail: string;
  customerName?: string;
  lineItems: Array<{ name: string; quantity: number; unitPrice: number }>;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  return request("/api/create-stripe-checkout", { method: "POST", body: params });
}

// ─── Admin API (auth required) ───────────────────────────────────────
export async function updateCompanySettings(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/company-settings", { method: "PATCH", body });
}

export async function getAdminClients(): Promise<Array<Record<string, unknown> & { orders?: number; totalSpent?: number; lastOrder?: string | null }>> {
  return request("/api/admin/clients");
}

export async function createClient(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request("/api/admin/clients", { method: "POST", body });
}

export async function updateClient(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request(`/api/admin/clients/${id}`, { method: "PATCH", body });
}

export async function deleteClient(id: string): Promise<void> {
  return request(`/api/admin/clients/${id}`, { method: "DELETE" });
}

export async function getAdminOrders(): Promise<unknown[]> {
  return request("/api/admin/orders");
}

export async function getAdminOrder(id: string): Promise<unknown> {
  return request(`/api/admin/orders/${id}`);
}

export async function updateAdminOrder(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/orders/${id}`, { method: "PATCH", body });
}

export async function getAdminCatalog(): Promise<{
  dishes: Array<{ id: string; name: string; unit_label: string; price_per_unit: number; price_brutto: number }>;
  bundles: Array<{ id: string; name: string; base_price: number; bundle_variants: Array<{ id: string; name: string; price: number; sort_order: number }> }>;
  configurable_sets: Array<{
    id: string;
    name: string;
    price_per_person: number;
    config_groups: Array<{
      id: string;
      name: string;
      min_selections: number;
      max_selections: number;
      sort_order: number;
      config_group_options: Array<{ id: string; name: string; sort_order: number }>;
    }>;
  }>;
  extras: Array<{ id: string; name: string; price: number; unit_label: string; category: string }>;
}> {
  return request("/api/admin/catalog");
}

export async function getAdminProductCategories(): Promise<unknown[]> {
  return request("/api/admin/product-categories");
}

export async function createProductCategory(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/product-categories", { method: "POST", body });
}

export async function updateProductCategory(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/product-categories/${id}`, { method: "PATCH", body });
}

export async function deleteProductCategory(id: string): Promise<void> {
  return request(`/api/admin/product-categories/${id}`, { method: "DELETE" });
}

export async function getAdminEventTypes(): Promise<unknown[]> {
  return request("/api/admin/event-types");
}

export async function createEventType(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/event-types", { method: "POST", body });
}

export async function updateEventType(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/event-types/${id}`, { method: "PATCH", body });
}

export async function deleteEventType(id: string): Promise<void> {
  return request(`/api/admin/event-types/${id}`, { method: "DELETE" });
}

export async function getAdminEventCategoryMappings(): Promise<Array<{ id: string; event_type_id: string; category_id: string }>> {
  return request("/api/admin/event-category-mappings");
}

export async function createEventCategoryMapping(body: { event_type_id: string; category_id: string }): Promise<unknown> {
  return request("/api/admin/event-category-mappings", { method: "POST", body });
}

export async function deleteEventCategoryMapping(params: { event_type_id: string; category_id: string }): Promise<void> {
  const q = new URLSearchParams(params);
  return request(`/api/admin/event-category-mappings?${q}`, { method: "DELETE" });
}

export async function getAdminExtrasCategories(): Promise<unknown[]> {
  return request("/api/admin/extras-categories");
}

export async function createExtrasCategory(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/extras-categories", { method: "POST", body });
}

export async function updateExtrasCategory(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/extras-categories/${id}`, { method: "PATCH", body });
}

export async function deleteExtrasCategory(id: string): Promise<void> {
  return request(`/api/admin/extras-categories/${id}`, { method: "DELETE" });
}

export async function getAdminExtras(): Promise<unknown[]> {
  return request("/api/admin/extras");
}

export async function createExtra(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/extras", { method: "POST", body });
}

export async function updateExtra(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/extras/${id}`, { method: "PATCH", body });
}

export async function deleteExtra(id: string): Promise<void> {
  return request(`/api/admin/extras/${id}`, { method: "DELETE" });
}

export async function getAdminDeliveryZones(): Promise<unknown[]> {
  return request("/api/admin/delivery-zones");
}

export async function createDeliveryZone(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/delivery-zones", { method: "POST", body });
}

export async function updateDeliveryZone(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/delivery-zones/${id}`, { method: "PATCH", body });
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  return request(`/api/admin/delivery-zones/${id}`, { method: "DELETE" });
}

export async function getAdminBlockedDates(): Promise<Array<{ id: string; blocked_date: Date; reason?: string | null }>> {
  return request("/api/admin/blocked-dates");
}

export async function createBlockedDate(body: { blocked_date: string; reason?: string }): Promise<unknown> {
  return request("/api/admin/blocked-dates", { method: "POST", body });
}

export async function deleteBlockedDate(id: string): Promise<void> {
  return request(`/api/admin/blocked-dates/${id}`, { method: "DELETE" });
}

export async function getAdminPaymentMethods(): Promise<unknown[]> {
  return request("/api/admin/payment-methods");
}

export async function createPaymentMethod(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/payment-methods", { method: "POST", body });
}

export async function updatePaymentMethod(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/payment-methods/${id}`, { method: "PATCH", body });
}

export async function deletePaymentMethod(id: string): Promise<void> {
  return request(`/api/admin/payment-methods/${id}`, { method: "DELETE" });
}

export async function getAdminIngredients(): Promise<unknown[]> {
  return request("/api/admin/ingredients");
}

export async function createIngredient(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/ingredients", { method: "POST", body });
}

export async function updateIngredient(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/ingredients/${id}`, { method: "PATCH", body });
}

export async function deleteIngredient(id: string): Promise<void> {
  return request(`/api/admin/ingredients/${id}`, { method: "DELETE" });
}

export async function getAdminDishes(): Promise<unknown[]> {
  return request("/api/admin/dishes");
}

export async function createDish(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/dishes", { method: "POST", body });
}

export async function updateDish(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/dishes/${id}`, { method: "PATCH", body });
}

export async function deleteDish(id: string): Promise<void> {
  return request(`/api/admin/dishes/${id}`, { method: "DELETE" });
}

export async function getAdminDishIngredients(dishId?: string): Promise<unknown[]> {
  const q = dishId ? `?dish_id=${encodeURIComponent(dishId)}` : "";
  return request(`/api/admin/dish-ingredients${q}`);
}

export async function getAdminBundles(): Promise<unknown[]> {
  return request("/api/admin/bundles");
}

export async function createBundle(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/bundles", { method: "POST", body });
}

export async function updateBundle(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/bundles/${id}`, { method: "PATCH", body });
}

export async function deleteBundle(id: string): Promise<void> {
  return request(`/api/admin/bundles/${id}`, { method: "DELETE" });
}

export async function getAdminConfigurableSets(): Promise<unknown[]> {
  return request("/api/admin/configurable-sets");
}

export async function createConfigurableSet(body: Record<string, unknown>): Promise<unknown> {
  return request("/api/admin/configurable-sets", { method: "POST", body });
}

export async function updateConfigurableSet(id: string, body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/admin/configurable-sets/${id}`, { method: "PATCH", body });
}

export async function deleteConfigurableSet(id: string): Promise<void> {
  return request(`/api/admin/configurable-sets/${id}`, { method: "DELETE" });
}
