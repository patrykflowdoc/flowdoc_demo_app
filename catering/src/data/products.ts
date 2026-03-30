// ============= PRODUCT TYPES =============

// Type 1: Simple Product (Patery) - just display, add to cart
export type SimpleProduct = {
  type: "simple";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  contents: string[];
  allergens: string[];
  dietaryTags: string[];
  pricePerUnit: number;
  pricePerUnitOnSite?: number | null;
  unitLabel: string;
  minQuantity: number;
  category: string;
  bail: number;
};

// Type 2: Expandable Product (Mini) - has variants/options to choose
export type ExpandableProduct = {
  type: "expandable";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  basePrice: number;
  minQuantity: number;
  category: string;
  dietaryTags: string[];
  variants: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceOnSite?: number | null;
  allergens: string[];
  dietaryTags: string[];
  dish: {
    id: string;
    bail: number;
  };
};

// Type 3: Configurable Set - price per person, select options from groups
export type ConfigurableProduct = {
  type: "configurable";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  pricePerPerson: number;
  pricePerPersonOnSite?: number | null;
  minPersons: number;
  category: string;
  optionGroups: OptionGroup[];
  dietaryTags: string[];
};

export type OptionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: GroupOption[];
};

export type GroupOption = {
  id: string;
  name: string;
  allergens: string[];
  dietaryTags: string[];
  dish: {
    id: string;
    bail: number;
  };
};

export type Product = SimpleProduct | ExpandableProduct | ConfigurableProduct;

export type EventType = {
  id: string;
  name: string;
  isCatering: boolean;
};

export type Category = {
  id: string;
  dbId?: string;
  name: string;
  description: string;
};
