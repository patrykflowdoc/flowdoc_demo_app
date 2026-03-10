import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "./CartDrawer";
import type { CateringOrder } from "@/hooks/useCateringOrder";
import type { Product } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption } from "@/data/extras";

type Step = { id: string; name: string; icon: string; };

type MobileNavProps = {
  steps: Step[];
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  canGoNext?: boolean;
  nextLabel?: string;
  showNav?: boolean;
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

export function MobileNav({
  steps: _steps,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  canGoNext: _canGoNext = true,
  nextLabel = "Dalej",
  showNav = true,
  order,
  totalPrice,
  onSimpleQuantityChange,
  onExpandableVariantChange,
  onConfigurableChange,
  onExtraChange,
  onPackagingChange,
  onWaiterServiceChange,
  products,
  extraItems,
  packagingOptions,
  waiterServiceOptions,
}: MobileNavProps) {
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <>
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="px-4 py-3 md:max-w-3xl md:mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Krok {currentStep + 1} z {totalSteps}</span>
            <CartDrawer
              order={order}
              totalPrice={totalPrice}
              onSimpleQuantityChange={onSimpleQuantityChange}
              onExpandableVariantChange={onExpandableVariantChange}
              onConfigurableChange={onConfigurableChange}
              onExtraChange={onExtraChange}
              onPackagingChange={onPackagingChange}
              onWaiterServiceChange={onWaiterServiceChange}
              products={products}
              extraItems={extraItems}
              packagingOptions={packagingOptions}
              waiterServiceOptions={waiterServiceOptions}
            />
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 ease-out rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
      </div>
      {showNav && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t border-border safe-area-bottom">
          <div className="flex items-center justify-between p-4 gap-3 md:max-w-4xl md:mx-auto lg:max-w-5xl">
            <Button variant="outline" onClick={onPrev} disabled={isFirstStep} className="flex-1 h-12 md:flex-none md:w-40">
              <ChevronLeft className="w-5 h-5 mr-1" />Wstecz
            </Button>
            <Button onClick={onNext} disabled={isLastStep} className="flex-1 h-12 md:flex-none md:w-40">
              {nextLabel}<ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
