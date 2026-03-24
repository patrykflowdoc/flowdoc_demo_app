/**
 * Order domain types for admin UI and PDFs (aligned with Prisma JSON shapes from the API).
 */

/** PDF / admin line sub-row (OrderItemSubItem). */
export type PdfOrderSubItem = {
  name: string;
  quantity: number;
  unit: string;
  foodCostPerUnit?: number;
  // pricePerUnit: number;
};

/** PDF / admin order line (OrderItem + optional subItems). */
export type PdfOrderLineItem = {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
  /** View/API line type (e.g. simple, bundle, extra, extra_bundle). */
  type?: string;
  itemType?: string;
  foodCostPerUnit?: number;
  subItems?: PdfOrderSubItem[];
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
  items: PdfOrderLineItem[];
};

/** @deprecated Use PdfOrderDocumentData */
export type PdfOrder = PdfOrderDocumentData;

export type PdfFoodCostExtra = {
  id: string;
  name: string;
  amount: number;
};

export type OrderStatus =
  | "Nowe zamówienie"
  | "Nowa oferta"
  | "Potwierdzone"
  | "W realizacji"
  | "Zrealizowane"
  | "Anulowane";

/** Admin list/detail/edit order view (not the Zod-parsed API row). */
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
  items: PdfOrderLineItem[];
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
export interface FoodCostExtra {
  id: string;
  name: string;
  amount: number;
  isNew?: boolean;
}

export type OrderDocumentType = "offer" | "kitchen" | "food-cost" | "full";

export type EventExtrasCategoryMapping = {
  event_type_id: string;
  extras_category_id: string;
};
