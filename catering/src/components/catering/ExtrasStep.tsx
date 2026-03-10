import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, X, UtensilsCrossed } from "lucide-react";
import { QuantityInput } from "./QuantityInput";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ExtraItem,
  PackagingOption,
  WaiterServiceOption,
  ExtrasCategory,
} from "@/data/extras";

type ExtrasStepProps = {
  extrasCategories: ExtrasCategory[];
  selectedExtras: Record<string, number>;
  selectedPackaging: string | null;
  packagingPersonCount: number;
  selectedWaiterService: string | null;
  waiterCount: number;
  onExtraChange: (extraId: string, quantity: number) => void;
  onPackagingChange: (packagingId: string | null, personCount: number) => void;
  onWaiterServiceChange: (serviceId: string | null, count: number) => void;
  guestCount: number;
  extraItems: ExtraItem[];
  packagingOptions: PackagingOption[];
  waiterServiceOptions: WaiterServiceOption[];
};

export function ExtrasStep({
  extrasCategories,
  selectedExtras,
  selectedPackaging,
  packagingPersonCount,
  selectedWaiterService,
  waiterCount,
  onExtraChange,
  onPackagingChange,
  onWaiterServiceChange,
  guestCount,
  extraItems,
  packagingOptions,
  waiterServiceOptions,
}: ExtrasStepProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedExtraItem, setSelectedExtraItem] = useState<ExtraItem | null>(null);
  const [selectedPackagingOption, setSelectedPackagingOption] = useState<PackagingOption | null>(null);
  const [selectedWaiterOption, setSelectedWaiterOption] = useState<WaiterServiceOption | null>(null);

  // Set first category as active when categories load
  const effectiveActiveCategory = activeCategory ?? (extrasCategories?.length > 0 ? extrasCategories[0].id : null);

  // Group extras/packaging/waiter by their extras_category_id
  const extrasByCategory = useMemo(() => {
    const map: Record<string, ExtraItem[]> = {};
    for (const item of extraItems) {
      const catId = item.extrasCategoryId;
      if (catId) {
        if (!map[catId]) map[catId] = [];
        map[catId].push(item);
      }
    }
    return map;
  }, [extraItems]);

  const packagingByCategory = useMemo(() => {
    const map: Record<string, PackagingOption[]> = {};
    for (const item of packagingOptions) {
      const catId = item.extrasCategoryId;
      if (catId) {
        if (!map[catId]) map[catId] = [];
        map[catId].push(item);
      }
    }
    return map;
  }, [packagingOptions]);

  const waiterByCategory = useMemo(() => {
    const map: Record<string, WaiterServiceOption[]> = {};
    for (const item of waiterServiceOptions) {
      const catId = item.extrasCategoryId;
      if (catId) {
        if (!map[catId]) map[catId] = [];
        map[catId].push(item);
      }
    }
    return map;
  }, [waiterServiceOptions]);

  const getTotalItemsInCategory = (categoryId: string) => {
    let count = 0;
    const extras = extrasByCategory[categoryId] || [];
    count += extras.filter(e => (selectedExtras[e.id] || 0) > 0).length;
    const pkgs = packagingByCategory[categoryId] || [];
    count += pkgs.filter(p => selectedPackaging === p.id).length;
    const waiters = waiterByCategory[categoryId] || [];
    count += waiters.filter(w => selectedWaiterService === w.id).length;
    return count;
  };

  if (!extrasCategories || extrasCategories.length === 0) {
    return (
      <div className="pb-24 px-4 py-8">
        <p className="text-sm text-muted-foreground text-center">Brak kategorii dodatków</p>
      </div>
    );
  }

  const effectiveCategoryId = effectiveActiveCategory ?? "";
  const currentExtras = extrasByCategory[effectiveCategoryId] || [];
  const currentPackaging = packagingByCategory[effectiveCategoryId] || [];
  const currentWaiter = waiterByCategory[effectiveCategoryId] || [];

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex overflow-x-auto no-scrollbar px-4">
          {extrasCategories.map((category) => {
            const itemCount = getTotalItemsInCategory(category.id);
            const isActive = effectiveActiveCategory === category.id;
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
                {category.required && !itemCount && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">!</Badge>
                )}
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
      </div>

      <div className="px-4 py-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Waiter "no service" option if this category has waiter items */}
          {currentWaiter.length > 0 && (
            <Card onClick={() => onWaiterServiceChange(null, 0)} className={cn("cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] overflow-hidden", !selectedWaiterService && "ring-2 ring-primary")}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center shrink-0", !selectedWaiterService ? "bg-primary/10" : "bg-muted")}>
                    <X className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">Bez obsługi</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-primary">W cenie</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular extras */}
          {currentExtras.map((extra: ExtraItem) => {
            const quantity = selectedExtras[extra.id] || 0;
            const isSelected = quantity > 0;
            const hasImage = extra.image;
            return (
              <Card key={extra.id} onClick={() => setSelectedExtraItem(extra)} className={cn("cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] overflow-hidden", isSelected && "ring-2 ring-primary")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden", !hasImage && (isSelected ? "bg-primary/10" : "bg-muted"))}>
                      {hasImage ? <img src={extra.image} alt={extra.name} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">{extra.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-primary">{extra.price.toFixed(0)} zł / {extra.unitLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {quantity > 0 && <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5">{quantity}</Badge>}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Packaging options */}
          {currentPackaging.map((option: PackagingOption) => {
            const isSelected = selectedPackaging === option.id;
            const hasImage = option.image;
            return (
              <Card key={option.id} onClick={() => setSelectedPackagingOption(option)} className={cn("cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] overflow-hidden", isSelected && "ring-2 ring-primary")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden", !hasImage && (isSelected ? "bg-primary/10" : "bg-muted"))}>
                      {hasImage ? <img src={option.image} alt={option.name} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">{option.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-primary">{option.priceLabel}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Waiter service options */}
          {currentWaiter.map((option: WaiterServiceOption) => {
            const isSelected = selectedWaiterService === option.id;
            const hasImage = option.image;
            return (
              <Card key={option.id} onClick={() => setSelectedWaiterOption(option)} className={cn("cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] overflow-hidden", isSelected && "ring-2 ring-primary")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden", !hasImage && (isSelected ? "bg-primary/10" : "bg-muted"))}>
                      {hasImage ? <img src={option.image} alt={option.name} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">{option.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-primary">{option.price.toFixed(0)} zł / {option.duration}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {currentExtras.length === 0 && currentPackaging.length === 0 && currentWaiter.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Brak pozycji w tej kategorii</p>
        )}
      </div>

      <ExtraItemModal
        item={selectedExtraItem}
        isOpen={!!selectedExtraItem}
        onClose={() => setSelectedExtraItem(null)}
        quantity={selectedExtraItem ? selectedExtras[selectedExtraItem.id] || 0 : 0}
        onQuantityChange={(qty) => { if (selectedExtraItem) onExtraChange(selectedExtraItem.id, qty); }}
      />
      <PackagingModal
        option={selectedPackagingOption}
        isOpen={!!selectedPackagingOption}
        onClose={() => setSelectedPackagingOption(null)}
        isSelected={selectedPackaging === selectedPackagingOption?.id}
        personCount={selectedPackaging === selectedPackagingOption?.id ? packagingPersonCount : guestCount}
        onSelect={(count) => { if (selectedPackagingOption) onPackagingChange(selectedPackagingOption.id, count); }}
      />
      <WaiterServiceModal
        option={selectedWaiterOption}
        isOpen={!!selectedWaiterOption}
        onClose={() => setSelectedWaiterOption(null)}
        isSelected={selectedWaiterService === selectedWaiterOption?.id}
        waiterCount={selectedWaiterService === selectedWaiterOption?.id ? waiterCount : 1}
        onSelect={(count) => { if (selectedWaiterOption) onWaiterServiceChange(selectedWaiterOption.id, count); }}
      />
    </div>
  );
}

// ============= EXTRA ITEM MODAL =============

function ExtraItemModal({ item, isOpen, onClose, quantity, onQuantityChange }: { item: ExtraItem | null; isOpen: boolean; onClose: () => void; quantity: number; onQuantityChange: (qty: number) => void; }) {
  if (!item) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className="h-[100dvh] max-h-[100dvh] w-full max-w-full m-0 p-0 rounded-none border-0 flex flex-col md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl md:border">
        <DialogTitle className="sr-only">{item.name}</DialogTitle>
        <div className="absolute top-4 right-4 z-10">
          <Button variant="secondary" size="icon" onClick={onClose} className="rounded-full bg-background/80 backdrop-blur-sm"><X className="w-5 h-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {item.image ? (
            <div className="relative"><img src={item.image} alt={item.name} className="w-full h-56 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" /></div>
          ) : (
            <div className="pt-16 flex justify-center"><div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-muted-foreground" /></div></div>
          )}
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-xl font-bold">{item.name}</h2>
              <p className="text-muted-foreground mt-1">{item.description}</p>
              {item.longDescription && <p className="text-sm text-muted-foreground mt-2">{item.longDescription}</p>}
            </div>
            <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
              <div><span className="text-2xl font-bold">{item.price.toFixed(0)} zł</span><span className="text-muted-foreground ml-1">/ {item.unitLabel}</span></div>
              <QuantityInput value={quantity} onChange={onQuantityChange} />
            </div>
            {item.contents && item.contents.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">W zestawie:</h3>
                <div className="space-y-2">
                  {item.contents.map((content, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"><div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" /><span className="text-sm">{content}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border bg-background shrink-0"><Button onClick={onClose} className="w-full" size="lg">Dodaj</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ============= PACKAGING MODAL =============

function PackagingModal({ option, isOpen, onClose, isSelected, personCount, onSelect }: { option: PackagingOption | null; isOpen: boolean; onClose: () => void; isSelected: boolean; personCount: number; onSelect: (count: number) => void; }) {
  if (!option) return null;
  const handleSelect = () => { onSelect(option.requiresPersonCount ? personCount : 0); onClose(); };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className="h-[100dvh] max-h-[100dvh] w-full max-w-full m-0 p-0 rounded-none border-0 flex flex-col md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl md:border">
        <DialogTitle className="sr-only">{option.name}</DialogTitle>
        <div className="absolute top-4 right-4 z-10"><Button variant="secondary" size="icon" onClick={onClose} className="rounded-full bg-background/80 backdrop-blur-sm"><X className="w-5 h-5" /></Button></div>
        <div className="flex-1 overflow-y-auto">
          {option.image ? (
            <div className="relative"><img src={option.image} alt={option.name} className="w-full h-56 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" /></div>
          ) : (
            <div className="pt-16 flex justify-center"><div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-muted-foreground" /></div></div>
          )}
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-xl font-bold">{option.name}</h2>
              <p className="text-muted-foreground mt-1">{option.description}</p>
              {option.longDescription && <p className="text-sm text-muted-foreground mt-2">{option.longDescription}</p>}
            </div>
            <div className="p-4 bg-accent rounded-xl">
              <div className="flex items-center justify-between">
                <Badge variant={option.price === 0 ? "secondary" : "outline"} className={cn("text-lg px-3 py-1", option.price === 0 && "bg-green-100 text-green-700")}>{option.priceLabel}</Badge>
                {isSelected && <Badge className="bg-primary text-primary-foreground"><Check className="w-3 h-3 mr-1" />Wybrano</Badge>}
              </div>
            </div>
            {option.contents && option.contents.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">W zestawie:</h3>
                <div className="space-y-2">
                  {option.contents.map((content, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"><div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" /><span className="text-sm">{content}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border bg-background shrink-0"><Button onClick={handleSelect} className="w-full" size="lg">{isSelected ? "Wybrano ✓" : "Wybierz"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ============= WAITER SERVICE MODAL =============

function WaiterServiceModal({ option, isOpen, onClose, isSelected, waiterCount, onSelect }: { option: WaiterServiceOption | null; isOpen: boolean; onClose: () => void; isSelected: boolean; waiterCount: number; onSelect: (count: number) => void; }) {
  const [count, setCount] = useState(waiterCount);
  if (!option) return null;
  const handleSelect = () => { onSelect(count); onClose(); };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className="h-[100dvh] max-h-[100dvh] w-full max-w-full m-0 p-0 rounded-none border-0 flex flex-col md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl md:border">
        <DialogTitle className="sr-only">{option.name}</DialogTitle>
        <div className="absolute top-4 right-4 z-10"><Button variant="secondary" size="icon" onClick={onClose} className="rounded-full bg-background/80 backdrop-blur-sm"><X className="w-5 h-5" /></Button></div>
        <div className="flex-1 overflow-y-auto">
          {option.image ? (
            <div className="relative"><img src={option.image} alt={option.name} className="w-full h-56 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" /></div>
          ) : (
            <div className="pt-16 flex justify-center"><div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-muted-foreground" /></div></div>
          )}
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-xl font-bold">{option.name}</h2>
              <p className="text-muted-foreground mt-1">{option.description}</p>
              {option.longDescription && <p className="text-sm text-muted-foreground mt-2">{option.longDescription}</p>}
            </div>
            <div className="p-4 bg-accent rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div><span className="text-2xl font-bold">{option.price.toFixed(0)} zł</span><span className="text-muted-foreground ml-1">/ kelner ({option.duration})</span></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Liczba kelnerów:</span>
                <QuantityInput value={count} onChange={(v) => setCount(Math.max(1, v))} min={1} size="sm" />
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Suma:</span>
                <span className="text-lg font-bold text-primary">{(option.price * count).toFixed(0)} zł</span>
              </div>
            </div>
            {option.contents && option.contents.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">W pakiecie:</h3>
                <div className="space-y-2">
                  {option.contents.map((content, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"><div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" /><span className="text-sm">{content}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border bg-background shrink-0"><Button onClick={handleSelect} className="w-full" size="lg">{isSelected ? "Zaktualizuj" : "Wybierz"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
