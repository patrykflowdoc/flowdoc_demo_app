// ============= EXTRAS DATA =============

export type ExtraItem = {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  price: number;
  priceOnSite?: number | null;
  unitLabel: string;
  contents?: string[];
  extrasCategoryId?: string;
  bail: number;
};

export type PackagingOption = {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  price: number;
  priceOnSite?: number | null;
  priceLabel: string;
  requiresPersonCount?: boolean;
  contents?: string[];
  extrasCategoryId?: string;
};

export type WaiterServiceOption = {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  duration: string;
  price: number;
  priceOnSite?: number | null;
  contents?: string[];
  extrasCategoryId?: string;
};

export type ExtrasCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  required?: boolean;
};

export type ExtraVariant = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceOnSite?: number | null;
  contents?: string[];
  extra: {
    id: string;
    bail: number;
  };
};

export type ExpandableExtra = {
  type: "expandable";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  basePrice: number;
  minQuantity: number;
  extrasCategoryId?: string;
  variants: ExtraVariant[];
};

// ============= PAYMENT METHODS =============

export type PaymentMethod = {
  id: string;
  name: string;
  description: string;
};

export const paymentMethods: PaymentMethod[] = [
  {
    id: "online",
    name: "Płatność online",
    description: "Szybka płatność kartą lub przelewem",
  },
  {
    id: "gotowka",
    name: "Gotówka",
    description: "Płatność przy odbiorze",
  },
  {
    id: "oferta",
    name: "Oferta",
    description: "Otrzymasz szczegółową ofertę mailem",
  },
  {
    id: "proforma",
    name: "Faktura proforma",
    description: "Płatność na podstawie proformy",
  },
];
