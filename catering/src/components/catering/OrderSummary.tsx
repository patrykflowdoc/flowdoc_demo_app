import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, Calendar, MapPin, Clock, Truck, CreditCard, Send,
  PartyPopper, StickyNote
} from "lucide-react";
import type { Product, Category, EventType } from "@/data/products";
import type { ExtraItem, PackagingOption, WaiterServiceOption, PaymentMethod, ExpandableExtra } from "@/data/extras";
import type { CateringOrder } from "@/hooks/useCateringOrder";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/api/client";
import { Separator } from "@/components/ui/separator";
import { getSimplePrice, getVariantPrice, getConfigurablePrice, getExtraPrice, getPackagingPrice, getWaiterPrice } from "@/lib/pricing";

type OrderSummaryProps = {
  order: CateringOrder;
  totalPrice: number;
  onPaymentMethodChange: (method: string) => void;
  onSubmit: (submissionType: "order" | "offer") => Promise<{ orderId: string; orderNumber: string } | void>;
  onResetOrder: () => void;
  onSimpleQuantityChange: (productId: string, quantity: number) => void;
  onExpandableVariantChange: (productId: string, variantId: string, quantity: number) => void;
  onConfigurableChange: (productId: string, quantity: number, groupId?: string, optionIds?: string[]) => void;
  products: Product[];
  categories: Category[];
  eventTypes: EventType[];
  extraItems: ExtraItem[];
  packagingOptions: PackagingOption[];
  waiterServiceOptions: WaiterServiceOption[];
  extraBundles: ExpandableExtra[];
  paymentMethods: PaymentMethod[];
  minOrderValue?: number;
};

export function OrderSummary({ 
  order, totalPrice, onSubmit, onResetOrder,
  products, eventTypes, extraItems, packagingOptions, waiterServiceOptions, extraBundles,
  minOrderValue = 0,
}: OrderSummaryProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.getCompanySettings()
      .then((data) => setPrivacyPolicyUrl(data.privacyPolicyUrl ?? null))
      .catch(() => setPrivacyPolicyUrl(null));
  }, []);

  const ct = order.cateringType;
  const eventType = eventTypes.find((e) => e.id === order.eventType);

  // Build ordered items list
  type SummaryLine = { name: string; quantity: number; price: number; note?: string; time?: string };
  const productLines: SummaryLine[] = [];

  for (const [productId, qty] of Object.entries(order.simpleQuantities)) {
    if (qty > 0) {
      const product = products.find(p => p.id === productId);
      if (product && product.type === "simple") {
        productLines.push({
          name: product.name,
          quantity: qty,
          price: getSimplePrice(product, ct) * qty,
          note: order.productNotes[productId] || undefined,
          time: order.servingTimes[productId] || undefined,
        });
      }
    }
  }

  for (const [productId, variants] of Object.entries(order.expandableQuantities)) {
    const product = products.find(p => p.id === productId);
    if (product && product.type === "expandable") {
      for (const [variantId, qty] of Object.entries(variants)) {
        if (qty > 0) {
          const variant = product.variants.find(v => v.id === variantId);
          if (variant) {
            productLines.push({
              name: variant.name,
              quantity: qty,
              price: getVariantPrice(variant, ct) * qty,
              note: order.productNotes[productId] || undefined,
              time: order.servingTimes[productId] || undefined,
            });
          }
        }
      }
    }
  }

  for (const [productId, data] of Object.entries(order.configurableData)) {
    if (data.quantity > 0) {
      const product = products.find(p => p.id === productId);
      if (product && product.type === "configurable") {
        productLines.push({
          name: product.name,
          quantity: data.quantity,
          price: getConfigurablePrice(product, ct) * data.quantity,
          note: order.productNotes[productId] || undefined,
          time: order.servingTimes[productId] || undefined,
        });
      }
    }
  }

  // Sort by serving time (earliest first), items without time go last
  productLines.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  // Extras lines
  const extrasLines: SummaryLine[] = [];
  for (const [extraId, qty] of Object.entries(order.selectedExtras)) {
    if (qty > 0) {
      const extra = extraItems.find(e => e.id === extraId);
      if (extra) extrasLines.push({ name: extra.name, quantity: qty, price: getExtraPrice(extra, ct) * qty });
    }
  }

  // Expandable extras (extra bundles)
  for (const [bundleId, variants] of Object.entries(order.selectedExpandableExtras ?? {})) {
    const bundle = extraBundles.find(b => b.id === bundleId);
    if (bundle) {
      for (const [variantId, qty] of Object.entries(variants)) {
        if (qty > 0) {
          const variant = bundle.variants.find(v => v.id === variantId);
          if (variant) {
            const variantPrice = ct === "na_sali" && variant.priceOnSite != null ? variant.priceOnSite : variant.price;
            extrasLines.push({ name: `${bundle.name}: ${variant.name}`, quantity: qty, price: variantPrice * qty });
          }
        }
      }
    }
  }

  const selectedPkg = packagingOptions.find(p => p.id === order.selectedPackaging);
  if (selectedPkg && getPackagingPrice(selectedPkg, ct) > 0) {
    extrasLines.push({ name: selectedPkg.name, quantity: order.packagingPersonCount, price: getPackagingPrice(selectedPkg, ct) * order.packagingPersonCount });
  }

  const selectedService = waiterServiceOptions.find(s => s.id === order.selectedWaiterService);
  if (selectedService) {
    extrasLines.push({ name: selectedService.name, quantity: order.waiterCount, price: getWaiterPrice(selectedService, ct) * order.waiterCount });
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Do ustalenia";
    return new Date(dateStr).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  };

  const pricePerPerson = order.guestCount > 0 ? totalPrice / order.guestCount : 0;

  const handleSubmitOnline = async () => {
    if (!termsAccepted) {
      toast({ title: "Zaakceptuj regulamin", description: "Musisz zaakceptować regulamin przed kontynuacją.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onSubmit("order");
      if (!result) throw new Error("Brak odpowiedzi z zapisu zamówienia");

      const { orderId, orderNumber } = result;

      const stripeLineItems = [
        ...productLines.map(line => ({
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.price / line.quantity,
        })),
        ...extrasLines.map(line => ({
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.price / line.quantity,
        })),
      ];

      if (order.deliveryPrice > 0) {
        stripeLineItems.push({
          name: "Dostawa",
          quantity: 1,
          unitPrice: order.deliveryPrice,
        });
      }

      const checkoutData = await api.createStripeCheckout({
        orderId,
        orderNumber,
        amount: totalPrice,
        customerEmail: order.contactEmail,
        customerName: order.contactName,
        lineItems: stripeLineItems,
        successUrl: `${window.location.origin}?payment=success&order=${orderNumber}`,
        cancelUrl: `${window.location.origin}?payment=cancelled&order=${orderNumber}`,
      });

      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error("Nie udało się utworzyć sesji płatności");
      }
    } catch (err) {
      console.error("Stripe checkout error:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg === "stripe_not_configured") {
        toast({
          title: "Płatności online niedostępne",
          description: "Zamówienie zostało zapisane. Skontaktujemy się w sprawie płatności.",
        });
      } else {
        toast({ title: "Błąd", description: "Nie udało się uruchomić płatności. Zamówienie zostało zapisane.", variant: "destructive" });
      }
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!termsAccepted) {
      toast({ title: "Zaakceptuj regulamin", description: "Musisz zaakceptować regulamin przed wysłaniem.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit("offer");
      setIsSubmitted(true);
      toast({ title: "Zapytanie wysłane! 🎉", description: "Skontaktujemy się w ciągu 24h." });
    } catch {
      toast({ title: "Błąd", description: "Nie udało się wysłać zapytania.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="px-4 py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <PartyPopper className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Dziękujemy!</h1>
        <p className="text-muted-foreground">Twoje zamówienie zostało wysłane. Odezwiemy się w ciągu 24h.</p>
        <Button variant="outline" onClick={() => { onResetOrder(); setIsSubmitted(false); }}>Nowe zamówienie</Button>
      </div>
    );
  }

  const address = order.contactCity && order.contactStreet
    ? `${order.contactStreet} ${order.contactBuildingNumber}${order.contactApartmentNumber ? `/${order.contactApartmentNumber}` : ''}, ${order.contactCity}`
    : null;

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <p className="text-sm text-muted-foreground mb-1">Streszczenie</p>
      <Separator className="mb-6" />

      {/* Event info */}
      <h2 className="text-xl font-bold text-foreground mb-2">
        {eventType?.name || "Twoje zamówienie"}
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-6">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {order.guestCount} gości
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          {formatDate(order.eventDate)}
        </span>
        {order.eventTime && (
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {order.eventTime}
          </span>
        )}
      </div>

      {address && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>{address}</span>
        </div>
      )}

      <Separator className="mb-6" />

      {/* Product lines */}
      {productLines.length > 0 && (
        <div className="space-y-3 mb-6">
          {productLines.map((line, idx) => (
            <div key={idx}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">
                  {line.time && (
                    <span className="text-muted-foreground mr-2">{line.time}</span>
                  )}
                  {line.name}
                  {line.quantity > 1 && <span className="text-muted-foreground ml-1">×{line.quantity}</span>}
                </span>
                <span className="font-medium text-foreground tabular-nums ml-4 shrink-0">
                  {line.price.toFixed(2)} zł
                </span>
              </div>
              {line.note && (
                <div className="flex items-start gap-1.5 mt-1 ml-0.5">
                  <StickyNote className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground italic">{line.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Extras */}
      {extrasLines.length > 0 && (
        <>
          <Separator className="mb-4" />
          <div className="space-y-2 mb-6">
            {extrasLines.map((line, idx) => (
              <div key={idx} className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {line.quantity > 1 && `${line.quantity}× `}{line.name}
                </span>
                <span className="font-medium text-foreground tabular-nums ml-4 shrink-0">
                  {line.price.toFixed(2)} zł
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delivery */}
      {order.deliveryPrice > 0 && (
        <div className="flex items-baseline justify-between text-sm mb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Truck className="w-4 h-4" />
            Koszty dostawy{address ? ` | ${order.contactCity}` : ""}
          </span>
          <span className="font-medium text-foreground tabular-nums ml-4 shrink-0">
            {order.deliveryPrice.toFixed(2)} zł
          </span>
        </div>
      )}

      {/* Totals */}
      <Separator className="my-6" />
      <div className="space-y-1 mb-8">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-foreground">Razem</span>
          <span className="font-bold text-foreground text-lg tabular-nums">{totalPrice.toFixed(2)} zł</span>
        </div>
        {order.guestCount > 0 && (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Na osobę</span>
            <span className="text-muted-foreground tabular-nums">{pricePerPerson.toFixed(2)} zł</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-muted/50 rounded-lg p-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-1">Uwagi do zamówienia</p>
          <p className="text-sm text-foreground">{order.notes}</p>
        </div>
      )}

      {/* Terms */}
      <div className="flex items-start gap-3 mb-6">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
          Akceptuję{" "}
          {privacyPolicyUrl ? (
            <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              regulamin i politykę prywatności
            </a>
          ) : (
            "regulamin i politykę prywatności"
          )}
          <span className="text-destructive ml-0.5">*</span>
        </label>
      </div>

      {/* Min order value warning */}
      {minOrderValue > 0 && totalPrice < minOrderValue && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Minimalna wartość zamówienia to <strong>{minOrderValue} zł</strong>. Brakuje jeszcze{" "}
          <strong>{(minOrderValue - totalPrice).toFixed(2)} zł</strong>.
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          size="lg"
          onClick={handleSubmitOnline}
          disabled={isSubmitting || !termsAccepted || (minOrderValue > 0 && totalPrice < minOrderValue)}
          className="h-14 text-base"
        >
          <CreditCard className="w-5 h-5 mr-2" />
          Zapłać online
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleSubmitOffer}
          disabled={isSubmitting || !termsAccepted || (minOrderValue > 0 && totalPrice < minOrderValue)}
          className="h-14 text-base"
        >
          <Send className="w-5 h-5 mr-2" />
          Wyślij zapytanie
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
        <p className="text-[11px] text-center text-muted-foreground">Zapłać od razu za zamówienie</p>
        <p className="text-[11px] text-center text-muted-foreground">Otrzymasz ofertę mailem</p>
      </div>
    </div>
  );
}
