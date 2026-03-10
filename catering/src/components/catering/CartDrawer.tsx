import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingCart, Trash2, Plus, Minus, UtensilsCrossed } from "lucide-react";
import type { Product } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption } from "@/data/extras";
import type { CateringOrder } from "@/hooks/useCateringOrder";
import { getSimplePrice, getVariantPrice, getConfigurablePrice, getExtraPrice, getPackagingPrice, getWaiterPrice } from "@/lib/pricing";

type CartDrawerProps = {
  order: CateringOrder;
  totalPrice: number;
  onSimpleQuantityChange: (productId: string, quantity: number) => void;
  onExpandableVariantChange: (productId: string, variantId: string, quantity: number) => void;
  onConfigurableChange: (productId: string, quantity: number) => void;
  onExtraChange?: (extraId: string, quantity: number) => void;
  onPackagingChange?: (packagingId: string | null, personCount: number) => void;
  onWaiterServiceChange?: (serviceId: string | null, count: number) => void;
  products: Product[];
  extraItems: ExtraItem[];
  packagingOptions: PackagingOption[];
  waiterServiceOptions: WaiterServiceOption[];
};

export function CartDrawer({ 
  order, totalPrice, 
  onSimpleQuantityChange, onExpandableVariantChange, onConfigurableChange,
  onExtraChange, onPackagingChange, onWaiterServiceChange,
  products, extraItems, packagingOptions, waiterServiceOptions,
}: CartDrawerProps) {
  const ct = order.cateringType;
  type CartItem = { key: string; name: string; price: number; quantity: number; type: "simple" | "expandable" | "configurable" | "extra" | "packaging" | "waiter"; productId: string; variantId?: string; isReadOnly?: boolean; details?: string[] };
  
  const cartItems: CartItem[] = [];
  
  for (const [productId, qty] of Object.entries(order.simpleQuantities)) {
    if (qty > 0) {
      const product = products.find(p => p.id === productId);
      if (product && product.type === "simple") {
        cartItems.push({ key: productId, name: product.name, price: getSimplePrice(product, ct), quantity: qty, type: "simple", productId });
      }
    }
  }
  
  for (const [productId, variants] of Object.entries(order.expandableQuantities)) {
    const product = products.find(p => p.id === productId);
    if (product && product.type === "expandable") {
      const selectedVariants: string[] = [];
      for (const [variantId, qty] of Object.entries(variants)) {
        if (qty > 0) {
          const variant = product.variants.find(v => v.id === variantId);
          if (variant) {
            selectedVariants.push(`${variant.name} ×${qty}`);
            cartItems.push({ key: `${productId}-${variantId}`, name: variant.name, price: getVariantPrice(variant, ct), quantity: qty, type: "expandable", productId, variantId });
          }
        }
      }
    }
  }
  
  for (const [productId, data] of Object.entries(order.configurableData)) {
    if (data.quantity > 0) {
      const product = products.find(p => p.id === productId);
      if (product && product.type === "configurable") {
        // Build details from selected options
        const details: string[] = [];
        for (const group of product.optionGroups) {
          const selectedIds = data.options[group.id] || [];
          if (selectedIds.length > 0) {
            const optionNames = selectedIds
              .map(id => group.options.find(o => o.id === id)?.name)
              .filter(Boolean);
            if (optionNames.length > 0) {
              details.push(`${group.name}: ${optionNames.join(", ")}`);
            }
          }
        }
        cartItems.push({ key: productId, name: product.name, price: getConfigurablePrice(product, ct), quantity: data.quantity, type: "configurable", productId, details });
      }
    }
  }

  for (const [extraId, qty] of Object.entries(order.selectedExtras)) {
    if (qty > 0) {
      const extra = extraItems.find(e => e.id === extraId);
      if (extra) {
        cartItems.push({ key: `extra-${extraId}`, name: extra.name, price: getExtraPrice(extra, ct), quantity: qty, type: "extra", productId: extraId });
      }
    }
  }

  if (order.selectedPackaging) {
    const packaging = packagingOptions.find(p => p.id === order.selectedPackaging);
    if (packaging && getPackagingPrice(packaging, ct) > 0) {
      cartItems.push({ key: `packaging-${order.selectedPackaging}`, name: packaging.name, price: getPackagingPrice(packaging, ct), quantity: order.packagingPersonCount, type: "packaging", productId: order.selectedPackaging, isReadOnly: true });
    }
  }

  if (order.selectedWaiterService) {
    const service = waiterServiceOptions.find(s => s.id === order.selectedWaiterService);
    if (service) {
      cartItems.push({ key: `waiter-${order.selectedWaiterService}`, name: service.name, price: getWaiterPrice(service, ct), quantity: order.waiterCount, type: "waiter", productId: order.selectedWaiterService, isReadOnly: true });
    }
  }

  const itemCount = cartItems.length;

  const handleQuantityChange = (item: CartItem, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    if (item.type === "simple") onSimpleQuantityChange(item.productId, safeQty);
    else if (item.type === "expandable" && item.variantId) onExpandableVariantChange(item.productId, item.variantId, safeQty);
    else if (item.type === "configurable") onConfigurableChange(item.productId, safeQty);
    else if (item.type === "extra" && onExtraChange) onExtraChange(item.productId, safeQty);
  };

  const handleRemoveItem = (item: CartItem) => {
    if (item.type === "packaging") { onPackagingChange?.(null, 0); return; }
    if (item.type === "waiter") { onWaiterServiceChange?.(null, 0); return; }
    handleQuantityChange(item, 0);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
          <div className="relative">
            <ShoppingCart className="w-5 h-5 text-primary" />
            {itemCount > 0 && <span className="absolute -top-2 -right-2 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{itemCount}</span>}
          </div>
          <span className="font-semibold text-sm text-primary">{totalPrice.toFixed(0)} zł</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" />Twoje zamówienie</SheetTitle>
        </SheetHeader>
        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><ShoppingCart className="w-8 h-8 text-muted-foreground" /></div>
            <p className="text-muted-foreground">Koszyk jest pusty</p>
            <p className="text-sm text-muted-foreground mt-1">Dodaj produkty, aby zobaczyć je tutaj</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto py-4 space-y-3">
              {cartItems.map((item) => (
                <div key={item.key} className="flex gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground line-clamp-2">{item.name}</h4>
                    {item.details && item.details.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {item.details.map((d, idx) => (
                          <p key={idx} className="text-[11px] text-muted-foreground leading-tight">{d}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} zł × {item.quantity}</p>
                    <div className="flex items-center justify-between mt-2">
                      {item.isReadOnly ? (
                        <span className="text-xs text-muted-foreground">{item.type === "packaging" ? `${item.quantity} os.` : `${item.quantity}×`}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item, item.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                          <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item, item.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-primary">{(item.price * item.quantity).toFixed(0)} zł</span>
                        {((!item.isReadOnly) || item.type === "packaging" || item.type === "waiter") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(item)}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Produktów</span><span className="font-medium">{itemCount}</span></div>
              <div className="flex items-center justify-between text-lg"><span className="font-semibold">Razem</span><span className="font-bold text-primary">{totalPrice.toFixed(0)} zł</span></div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
