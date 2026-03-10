import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AlertTriangle, X, Clock } from "lucide-react";
import { QuantityInput } from "./QuantityInput";
import type { Product, SimpleProduct, ExpandableProduct, ConfigurableProduct } from "@/data/products";
import type { CateringType } from "@/lib/pricing";
import { getSimplePrice, getVariantPrice, getConfigurablePrice } from "@/lib/pricing";

type ProductModalProps = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  simpleQuantity?: number;
  onSimpleQuantityChange?: (productId: string, quantity: number) => void;
  expandableQuantities?: Record<string, number>;
  onExpandableVariantChange?: (productId: string, variantId: string, quantity: number) => void;
  configurableQuantity?: number;
  configurableOptions?: Record<string, string[]>;
  onConfigurableChange?: (productId: string, quantity: number, groupId?: string, optionIds?: string[]) => void;
  servingTime?: string;
  onServingTimeChange?: (productId: string, time: string) => void;
  productNotes?: string;
  onProductNotesChange?: (productId: string, notes: string) => void;
  cateringType?: CateringType;
};

export function ProductModal({
  product,
  isOpen,
  onClose,
  simpleQuantity = 0,
  onSimpleQuantityChange,
  expandableQuantities = {},
  onExpandableVariantChange,
  configurableQuantity = 0,
  configurableOptions = {},
  onConfigurableChange,
  servingTime = "",
  onServingTimeChange,
  productNotes = "",
  onProductNotesChange,
  cateringType = "wyjazdowy",
}: ProductModalProps) {
  if (!product) return null;

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        hideCloseButton 
        className="h-[100dvh] max-h-[100dvh] w-full max-w-full m-0 p-0 rounded-none border-0 flex flex-col md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl md:border"
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        
        <div className="absolute top-4 right-4 z-10">
          <Button variant="secondary" size="icon" onClick={handleClose} className="rounded-full bg-background/80 backdrop-blur-sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {product.type === "simple" && (
            <SimpleProductContent
              product={product}
              quantity={simpleQuantity}
              onQuantityChange={(qty) => onSimpleQuantityChange?.(product.id, qty)}
              servingTime={servingTime}
              onServingTimeChange={(time) => onServingTimeChange?.(product.id, time)}
              notes={productNotes}
              onNotesChange={(n) => onProductNotesChange?.(product.id, n)}
              cateringType={cateringType}
            />
          )}
          {product.type === "expandable" && (
            <ExpandableProductContent
              product={product}
              quantities={expandableQuantities}
              onVariantQuantityChange={(variantId, qty) => 
                onExpandableVariantChange?.(product.id, variantId, qty)
              }
              servingTime={servingTime}
              onServingTimeChange={(time) => onServingTimeChange?.(product.id, time)}
              notes={productNotes}
              onNotesChange={(n) => onProductNotesChange?.(product.id, n)}
              cateringType={cateringType}
            />
          )}
          {product.type === "configurable" && (
            <ConfigurableProductContent
              product={product}
              quantity={configurableQuantity}
              selectedOptions={configurableOptions}
              onQuantityChange={(qty) => onConfigurableChange?.(product.id, qty)}
              onOptionsChange={(groupId, optionIds) => 
                onConfigurableChange?.(product.id, configurableQuantity, groupId, optionIds)
              }
              servingTime={servingTime}
              onServingTimeChange={(time) => onServingTimeChange?.(product.id, time)}
              notes={productNotes}
              onNotesChange={(n) => onProductNotesChange?.(product.id, n)}
              cateringType={cateringType}
            />
          )}
        </div>

        <div className="p-4 border-t border-border bg-background shrink-0 md:rounded-b-2xl">
          <Button onClick={handleClose} className="w-full" size="lg">
            Dodaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Shared serving time + notes picker
function ServingTimeAndNotes({ 
  time, 
  onTimeChange, 
  notes, 
  onNotesChange 
}: { 
  time: string; 
  onTimeChange: (t: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => (i + 8).toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  const [selectedHour, selectedMinute] = time ? time.split(":") : ["", ""];

  const handleHourChange = (h: string) => {
    const m = selectedMinute || "00";
    onTimeChange(`${h}:${m}`);
  };

  const handleMinuteChange = (m: string) => {
    const h = selectedHour || "08";
    onTimeChange(`${h}:${m}`);
  };

  return (
    <div className="p-4 bg-muted/50 rounded-xl space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Godzina podania</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedHour}
            onChange={(e) => handleHourChange(e.target.value)}
            className="flex-1 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Godz.</option>
            {hours.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-lg font-bold text-muted-foreground">:</span>
          <select
            value={selectedMinute}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className="flex-1 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Min.</option>
            {minutes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Uwagi</h3>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Dodatkowe uwagi do tego produktu..."
          className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function SimpleProductContent({
  product,
  quantity,
  onQuantityChange,
  servingTime,
  onServingTimeChange,
  notes,
  onNotesChange,
  cateringType = "wyjazdowy",
}: {
  product: SimpleProduct;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  servingTime: string;
  onServingTimeChange: (time: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  cateringType?: CateringType;
}) {
  const effectivePrice = getSimplePrice(product, cateringType);
  return (
    <div>
      {product.image && (
        <div className="relative">
          <img src={product.image} alt={product.name} className="w-full h-56 object-cover md:rounded-t-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
      )}

      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-xl font-bold">{product.name}</h2>
          <p className="text-muted-foreground mt-1">{product.description}</p>
          {product.longDescription && (
            <p className="text-sm text-muted-foreground mt-2">{product.longDescription}</p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
          <div>
            <span className="text-2xl font-bold">{effectivePrice.toFixed(2)} zł</span>
            <span className="text-muted-foreground ml-1">/ {product.unitLabel}</span>
          </div>
          <QuantityInput value={quantity} onChange={onQuantityChange} />
        </div>

        <div>
          <h3 className="font-semibold mb-3">Zawartość patery:</h3>
          <div className="space-y-2">
            {product.contents.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {product.allergens.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-sm text-orange-700 dark:text-orange-400">
              Alergeny: {product.allergens.join(", ")}
            </span>
          </div>
        )}

        <ServingTimeAndNotes time={servingTime} onTimeChange={onServingTimeChange} notes={notes} onNotesChange={onNotesChange} />
      </div>
    </div>
  );
}

function ExpandableProductContent({
  product,
  quantities,
  onVariantQuantityChange,
  servingTime,
  onServingTimeChange,
  notes,
  onNotesChange,
  cateringType = "wyjazdowy",
}: {
  product: ExpandableProduct;
  quantities: Record<string, number>;
  onVariantQuantityChange: (variantId: string, qty: number) => void;
  servingTime: string;
  onServingTimeChange: (time: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  cateringType?: CateringType;
}) {
  return (
    <div>
      {product.image && (
        <div className="relative">
          <img src={product.image} alt={product.name} className="w-full h-56 object-cover md:rounded-t-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
      )}

      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-xl font-bold">{product.name}</h2>
          <p className="text-muted-foreground mt-1">{product.description}</p>
          {product.longDescription && (
            <p className="text-sm text-muted-foreground mt-2">{product.longDescription}</p>
          )}
        </div>

        <h3 className="font-semibold">Wybierz warianty:</h3>
        {product.variants.map((variant) => {
          const qty = quantities[variant.id] || 0;
          return (
            <div
              key={variant.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all",
                qty > 0 ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <div className="flex-1">
                <div className="font-medium">{variant.name}</div>
                <div className="text-sm text-muted-foreground">{getVariantPrice(variant, cateringType).toFixed(2)} zł / szt.</div>
                {variant.allergens.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    <span className="text-xs text-orange-600">{variant.allergens.join(", ")}</span>
                  </div>
                )}
              </div>
              <QuantityInput value={qty} onChange={(newQty) => onVariantQuantityChange(variant.id, newQty)} size="sm" />
            </div>
          );
        })}

        <ServingTimeAndNotes time={servingTime} onTimeChange={onServingTimeChange} notes={notes} onNotesChange={onNotesChange} />
      </div>
    </div>
  );
}

function ConfigurableProductContent({
  product,
  quantity,
  selectedOptions,
  onQuantityChange,
  onOptionsChange,
  servingTime,
  onServingTimeChange,
  notes,
  onNotesChange,
  cateringType = "wyjazdowy",
}: {
  product: ConfigurableProduct;
  quantity: number;
  selectedOptions: Record<string, string[]>;
  onQuantityChange: (qty: number) => void;
  onOptionsChange: (groupId: string, optionIds: string[]) => void;
  servingTime: string;
  onServingTimeChange: (time: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  cateringType?: CateringType;
}) {
  const effectivePrice = getConfigurablePrice(product, cateringType);
  const toggleOption = (groupId: string, optionId: string) => {
    const group = product.optionGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const currentSelected = selectedOptions[groupId] || [];
    const isCurrentlySelected = currentSelected.includes(optionId);
    
    let newSelected: string[];
    if (isCurrentlySelected) {
      newSelected = currentSelected.filter(id => id !== optionId);
    } else {
      if (currentSelected.length >= group.maxSelections) {
        newSelected = [...currentSelected.slice(1), optionId];
      } else {
        newSelected = [...currentSelected, optionId];
      }
    }
    
    onOptionsChange(groupId, newSelected);
  };

  return (
    <div>
      {product.image && (
        <div className="relative">
          <img src={product.image} alt={product.name} className="w-full h-56 object-cover md:rounded-t-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
      )}

      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-xl font-bold">{product.name}</h2>
          <p className="text-muted-foreground mt-1">{product.description}</p>
          {product.longDescription && (
            <p className="text-sm text-muted-foreground mt-2">{product.longDescription}</p>
          )}
        </div>

        <div className="p-4 bg-accent rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-bold">{effectivePrice.toFixed(2)} zł</span>
              <span className="text-muted-foreground ml-1">/ osoba</span>
            </div>
            <Badge variant="outline" className="text-primary border-primary">
              min. {product.minPersons} osób
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Liczba osób:</span>
            <QuantityInput
              value={quantity}
              min={product.minPersons}
              onChange={(newQty) => {
                if (newQty > 0 && newQty < product.minPersons) {
                  onQuantityChange(product.minPersons);
                } else {
                  onQuantityChange(newQty);
                }
              }}
            />
          </div>
          
          {quantity > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Suma:</span>
                <span className="text-lg font-bold text-primary">
                  {(quantity * effectivePrice).toFixed(2)} zł
                </span>
              </div>
            </div>
          )}
        </div>

        {product.optionGroups.map((group) => {
          const selected = selectedOptions[group.id] || [];
          
          return (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{group.name}</h3>
                <span className="text-xs text-muted-foreground uppercase">
                  Wybierz {selected.length} z {group.maxSelections}
                </span>
              </div>
              
              <div className="space-y-2">
                {group.options.map((option) => {
                  const isChecked = selected.includes(option.id);
                  
                  return (
                    <div
                      key={option.id}
                      onClick={() => toggleOption(group.id, option.id)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                        isChecked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Checkbox checked={isChecked} className="pointer-events-none" />
                      <div className="flex-1">
                        <span className="font-medium">{option.name}</span>
                        {option.allergens.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                            <span className="text-xs text-orange-600">{option.allergens.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <ServingTimeAndNotes time={servingTime} onTimeChange={onServingTimeChange} notes={notes} onNotesChange={onNotesChange} />
      </div>
    </div>
  );
}
