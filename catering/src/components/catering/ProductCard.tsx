import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import type { Product } from "@/data/products";
import type { CateringType } from "@/lib/pricing";
import { getSimplePrice, getVariantPrice, getConfigurablePrice } from "@/lib/pricing";

type ProductCardProps = {
  product: Product;
  isSelected: boolean;
  selectedCount?: number;
  subtitle?: string;
  cateringType: CateringType;
  onClick: () => void;
};

export function ProductCard({
  product,
  isSelected,
  selectedCount = 0,
  subtitle,
  cateringType,
  onClick,
}: ProductCardProps) {
  const getPrice = () => {
    if (product.type === "simple") {
      return `${getSimplePrice(product, cateringType).toFixed(2)} zł`;
    }
    if (product.type === "expandable") {
      const prices = product.variants.map(v => getVariantPrice(v, cateringType));
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? `${min.toFixed(2)} zł` : `od ${min.toFixed(2)} zł`;
    }
    if (product.type === "configurable") {
      return `${getConfigurablePrice(product, cateringType).toFixed(2)} zł/os.`;
    }
    return "";
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    
    if (product.type === "simple") {
      return `${product.contents.length} pozycji`;
    }
    if (product.type === "expandable") {
      return `${product.variants.length} wariantów`;
    }
    if (product.type === "configurable") {
      return `min. ${product.minPersons} osób`;
    }
    return "";
  };

  // Check if product has an image
  const hasImage = 'image' in product && product.image;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] overflow-hidden",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Image */}
          <div
            className={cn(
              "w-16 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden",
              !hasImage && (isSelected ? "bg-primary/10" : "bg-muted")
            )}
          >
            {hasImage ? (
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">{product.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {product.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-primary">
                {getPrice()}
              </span>
              <span className="text-xs text-muted-foreground">
                • {getSubtitle()}
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
                {selectedCount}
              </Badge>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
