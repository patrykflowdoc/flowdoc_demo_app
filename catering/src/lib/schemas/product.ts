import { z } from "zod";

export const GroupOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  allergens: z.array(z.string()),
  dietaryTags: z.array(z.string()),
  dish: z.object({
    id: z.string(),
    bail: z.number(),
  }),
});

export const OptionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  minSelections: z.number(),
  maxSelections: z.number(),
  options: z.array(GroupOptionSchema),
});

export const ProductVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  priceOnSite: z.number().nullable().optional(),
  allergens: z.array(z.string()),
  dietaryTags: z.array(z.string()),
  dish: z.object({
    id: z.string(),
    bail: z.number(),
  }),
});

export const SimpleProductSchema = z.object({
  type: z.literal("simple"),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string().optional(),
  image: z.string().optional(),
  contents: z.array(z.string()),
  allergens: z.array(z.string()),
  dietaryTags: z.array(z.string()),
  pricePerUnit: z.number(),
  pricePerUnitOnSite: z.number().nullable().optional(),
  unitLabel: z.string(),
  minQuantity: z.number(),
  category: z.string(),
  bail: z.number(),
});

export const ExpandableProductSchema = z.object({
  type: z.literal("expandable"),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string().optional(),
  image: z.string().optional(),
  basePrice: z.number(),
  minQuantity: z.number(),
  category: z.string(),
  dietaryTags: z.array(z.string()),
  variants: z.array(ProductVariantSchema),
});

export const ConfigurableProductSchema = z.object({
  type: z.literal("configurable"),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string().optional(),
  image: z.string().optional(),
  pricePerPerson: z.number(),
  pricePerPersonOnSite: z.number().nullable().optional(),
  minPersons: z.number(),
  category: z.string(),
  optionGroups: z.array(OptionGroupSchema),
  dietaryTags: z.array(z.string()),
});

export const ProductSchema = z.discriminatedUnion("type", [
  SimpleProductSchema,
  ExpandableProductSchema,
  ConfigurableProductSchema,
]);

export type ProductFromSchema = z.infer<typeof ProductSchema>;
