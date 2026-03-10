import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, Category } from "@/data/products";
import type { CateringType } from "@/lib/pricing";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";

type ProductsStepProps = {
  simpleQuantities: Record<string, number>;
  expandableQuantities: Record<string, Record<string, number>>;
  configurableData: Record<string, { quantity: number; options: Record<string, string[]> }>;
  servingTimes: Record<string, string>;
  productNotes: Record<string, string>;
  onSimpleQuantityChange: (productId: string, quantity: number) => void;
  onExpandableVariantChange: (productId: string, variantId: string, quantity: number) => void;
  onConfigurableChange: (productId: string, quantity: number, groupId?: string, optionIds?: string[]) => void;
  onServingTimeChange: (productId: string, time: string) => void;
  onProductNotesChange: (productId: string, notes: string) => void;
  products: Product[];
  categories: Category[];
  cateringType: CateringType;
};

export function ProductsStep({
  simpleQuantities,
  expandableQuantities,
  configurableData,
  servingTimes,
  productNotes,
  onSimpleQuantityChange,
  onExpandableVariantChange,
  onConfigurableChange,
  onServingTimeChange,
  onProductNotesChange,
  products,
  categories,
  cateringType,
}: ProductsStepProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categoryProducts = products.filter((p) => p.category === activeCategory);
  
  const getTotalItemsInCategory = (categoryId: string) => {
    return products.filter(p => p.category === categoryId).reduce((count, product) => {
      if (product.type === "simple") {
        return count + (simpleQuantities[product.id] > 0 ? 1 : 0);
      } else if (product.type === "expandable") {
        const variants = expandableQuantities[product.id] || {};
        return count + (Object.values(variants).some(q => q > 0) ? 1 : 0);
      } else if (product.type === "configurable") {
        return count + ((configurableData[product.id]?.quantity || 0) > 0 ? 1 : 0);
      }
      return count;
    }, 0);
  };

  const isProductSelected = (product: Product): boolean => {
    if (product.type === "simple") return (simpleQuantities[product.id] || 0) > 0;
    if (product.type === "expandable") {
      const variants = expandableQuantities[product.id] || {};
      return Object.values(variants).some(q => q > 0);
    }
    if (product.type === "configurable") return (configurableData[product.id]?.quantity || 0) > 0;
    return false;
  };

  const getProductSelectedCount = (product: Product): number => {
    if (product.type === "simple") return simpleQuantities[product.id] || 0;
    if (product.type === "expandable") {
      const variants = expandableQuantities[product.id] || {};
      return Object.values(variants).reduce((sum, q) => sum + q, 0);
    }
    if (product.type === "configurable") return configurableData[product.id]?.quantity || 0;
    return 0;
  };

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="relative flex items-center">
          <button
            onClick={() => {
              const container = document.getElementById('category-tabs');
              if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
            }}
            className="absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-background via-background to-transparent hidden md:flex items-center"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div id="category-tabs" className="flex overflow-x-auto no-scrollbar px-6 md:px-8">
            {categories.map((category) => {
              const itemCount = getTotalItemsInCategory(category.id);
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors shrink-0",
                    isActive
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-sm">{category.name}</span>
                  {itemCount > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {itemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => {
              const container = document.getElementById('category-tabs');
              if (container) container.scrollBy({ left: 150, behavior: 'smooth' });
            }}
            className="absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-background via-background to-transparent hidden md:flex items-center"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {categoryProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={isProductSelected(product)}
              selectedCount={getProductSelectedCount(product)}
              cateringType={cateringType}
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      </div>

      <ProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        simpleQuantity={selectedProduct?.type === "simple" ? simpleQuantities[selectedProduct.id] || 0 : 0}
        onSimpleQuantityChange={onSimpleQuantityChange}
        expandableQuantities={selectedProduct?.type === "expandable" ? expandableQuantities[selectedProduct.id] || {} : {}}
        onExpandableVariantChange={onExpandableVariantChange}
        configurableQuantity={selectedProduct?.type === "configurable" ? configurableData[selectedProduct.id]?.quantity || 0 : 0}
        configurableOptions={selectedProduct?.type === "configurable" ? configurableData[selectedProduct.id]?.options || {} : {}}
        onConfigurableChange={onConfigurableChange}
        servingTime={selectedProduct ? servingTimes[selectedProduct.id] || "" : ""}
        onServingTimeChange={onServingTimeChange}
        productNotes={selectedProduct ? productNotes[selectedProduct.id] || "" : ""}
        onProductNotesChange={onProductNotesChange}
        cateringType={cateringType}
      />
    </div>
  );
}
