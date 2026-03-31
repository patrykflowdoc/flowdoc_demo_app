/**
 * Order domain types for admin UI and PDFs (aligned with Prisma JSON shapes from the API).
 */

/** PDF / admin line sub-row (OrderItemSubItem). */
export type OrderSubItem = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  foodCostPerUnit?: number;
  dishId?: string;
  pricePerUnit?: number;
};

/** PDF / admin order line (OrderItem + optional subItems). */
export type OrderItem = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
  type?: string;
  itemType?: string;
  foodCostPerUnit?: number;
  dishId?: string;
  subItems: OrderSubItem[] | null;
};

/** Payload for single-order PDF documents (maps from admin order view). */
export type PdfOrderDocumentData = {
  id: string;
  client: string;
  email: string;
  phone: string;
  event: string;
  date: string;
  deliveryAddress: string;
  amount: string;
  amountNum: number;
  notes: string;
  deliveryCost: number;
  guestCount: number;
  discount?: number;
  deposit?: number;
  items: OrderItem[];
};

export type FoodCostExtra = {
  id: string;
  name: string;
  amount: number;
  isNew?: boolean;
};

export type OrderStatus =
  | "Nowe zamówienie"
  | "Nowa oferta"
  | "Potwierdzone"
  | "W realizacji"
  | "Zrealizowane"
  | "Anulowane";

/** Admin list/detail/edit order view */
export interface Order {
  id: string;
  dbId: string;
  client: string;
  clientId: string | null;
  email: string;
  phone: string;
  event: string;
  date: string;
  deliveryAddress: string;
  amount: string;
  amountNum: number;
  status: OrderStatus;
  notes: string;
  items: OrderItem[];
  createdAt: string;
  deliveryCost: number;
  guestCount: number;
  discount: number;
  deposit: number;
}

/** CRM client row used when linking orders to clients. */
export interface DbClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string | null;
  city?: string | null;
  companyName?: string | null;
}

/** Editable food-cost extra line in the document view. */


export type OrderDocumentType = "offer" | "kitchen" | "food-cost" | "full";

export type EventExtrasCategoryMapping = {
  event_type_id: string;
  extras_category_id: string;
};
