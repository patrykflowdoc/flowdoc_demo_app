/**
 * Order domain types for admin UI and PDFs (aligned with Prisma JSON shapes from the API).
 */
import type { Dish } from "@/data/products";
import type { CateringType } from "@/lib/pricing";

/** PDF / admin line sub-row (OrderItemSubItem). */
export type OrderSubItem = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  converter?: number;
  optionConverter?: number;
  groupConverter?: number;
  foodCostPerUnit?: number;
  dishId?: string;
  dish?: Dish;
  pricePerUnit?: number;
};

/** Dzień/sesja wydarzenia (np. dzień 1 z 3). */
export type OrderEventDay = {
  id: string;
  label: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
  /** Pełne szczegóły jak karta „Wydarzenie” (wielodniowa oferta). */
  eventType?: string | null;
  guestCount?: number;
  deliveryAddress?: string | null;
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
  /** ID produktu z katalogu (zestaw konfigurowalny / pakiet / danie) — link publicznej oferty. */
  sourceProductId?: string;
  /** Klient na stronie /offer włącza/wyłącza pozycję (dodatki, pojedyncze produkty). */
  offerClientToggle?: boolean;
  /** Gdy offerClientToggle: czy klient zaakceptował (wlicza się w kwotę). */
  offerClientAccepted?: boolean;
  /** Przypisanie do dnia/sesji wydarzenia. */
  orderEventDayId?: string | null;
  dish?: Dish;
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
  /** Token publicznej strony /offer/{token} (tylko oferty). */
  publicOfferToken?: string | null;
  cateringType: CateringType | null;
  client: string;
  clientId: string | null;
  email: string;
  phone: string;
  event: string;
  date: string;
  time: string;
  /** Z API — do pól `type="date"` / zapisu (YYYY-MM-DD). */
  eventDateIso?: string | null;
  /** Z API — do pola `type="time"` (HH:mm). */
  eventTimeHHMM?: string | null;
  deliveryAddress: string;
  companyName?: string | null;
  companyNip?: string | null;
  contactCity?: string | null;
  contactStreet?: string | null;
  contactBuilding?: string | null;
  contactApartment?: string | null;
  amount: string;
  amountNum: number;
  status: OrderStatus;
  notes: string;
  items: OrderItem[];
  eventDays: OrderEventDay[];
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
  nip?: string | null;
}

/** Editable food-cost extra line in the document view. */


export type OrderDocumentType = "offer" | "kitchen" | "food-cost" | "full";

export type EventExtrasCategoryMapping = {
  eventTypeId: string;
  extrasCategoryId: string;
};
