import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FullscreenDateTimePicker } from "@/components/catering/FullscreenDateTimePicker";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Package,
  MessageSquare,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import type { DbClient, OrderItem } from "@/types/orders";
import { OrderLineDishContents } from "./ProductTable";
import { useAdminEventTypes, SubItemSelector, type CatalogProduct, useCatalogProducts } from "./OrderCatalogPicker";
import { includesDeliveryFee, isOffPremiseCatering, type CateringType } from "@/lib/pricing";
const fmtNum = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mapItemType(type?: string) {
  if (!type) return "simple";
  return type === "bundle" ? "expandable" : type;
}

export const AddOrderSheet = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  /** Po udanym zapisie — odśwież listę z API (np. reset filtrów + fetch). */
  onSuccess?: () => void | Promise<void>;
}) => {
  const [clientSearch, setClientSearch] = useState("");
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [orderCompanyName, setOrderCompanyName] = useState("");
  const [orderCompanyNip, setOrderCompanyNip] = useState("");
  const [cateringType, setCateringType] = useState<CateringType>("wyjazdowy");
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryBuilding, setDeliveryBuilding] = useState("");
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryCalculating, setDeliveryCalculating] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<{
    companyLat: number | null;
    companyLng: number | null;
    pricePerKm: number;
    maxDeliveryKm: number | null;
    freeDeliveryAbove: number | null;
  } | null>(null);
  const deliveryDebounceRef = useRef<number | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [configuringProduct, setConfiguringProduct] = useState<CatalogProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const catalogProducts = useCatalogProducts();
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  useEffect(() => {
    if (!open) return;
    api
      .getBlockedDates()
      .then((dates) => {
        setBlockedDates((dates || []).map((d) => new Date(d)));
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api
      .getDeliveryConfig()
      .then((data) => {
        setCompanySettings({
          companyLat: data.companyLat,
          companyLng: data.companyLng,
          pricePerKm: data.pricePerKm ?? 3,
          maxDeliveryKm: data.maxDeliveryKm ?? null,
          freeDeliveryAbove: data.freeDeliveryAbove ?? null,
        });
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api
      .getAdminClients()
      .then((data) => {
        setDbClients(
          (data || []).map((c: Record<string, unknown>) => ({
            id: String(c.id),
            firstName: String(c.firstName ?? ""),
            lastName: String(c.lastName ?? ""),
            email: String(c.email ?? ""),
            phone: String(c.phone ?? ""),
            address: c.address != null ? String(c.address) : null,
            city: c.city != null ? String(c.city) : null,
            companyName: c.companyName != null ? String(c.companyName) : null,
            nip: c.nip != null ? String(c.nip) : null,
          }))
        );
      })
      .catch(() => {});
  }, [open]);

  const calculateDelivery = useCallback(
    async (city: string, street: string, building: string) => {
      if (!city.trim() || !street.trim() || !building.trim()) {
        setDeliveryCost(0);
        setDeliveryDistanceKm(null);
        setDeliveryError(null);
        return;
      }
      if (!companySettings?.companyLat || !companySettings?.companyLng) return;

      const cleanStreet = street
        .replace(/\bul\.\s*/gi, "")
        .replace(/\baleja\s*/gi, "")
        .replace(/\bal\.\s*/gi, "")
        .trim();
      const fullAddress = `${cleanStreet} ${building}, ${city}, Polska`;
      setDeliveryCalculating(true);
      setDeliveryError(null);

      try {
        const data = await api.calculateDelivery({
          address: fullAddress,
          companyLat: companySettings.companyLat,
          companyLng: companySettings.companyLng,
        });
        if (data.error === "address_not_found") {
          setDeliveryError("Nie znaleziono adresu");
          setDeliveryCost(0);
          setDeliveryDistanceKm(null);
        } else if (data.error === "route_not_found") {
          setDeliveryError("Nie udało się obliczyć trasy");
          setDeliveryCost(0);
          setDeliveryDistanceKm(null);
        } else if (data.distanceKm != null) {
          const tooFar =
            companySettings.maxDeliveryKm != null && data.distanceKm > companySettings.maxDeliveryKm;
          const rawPrice = Math.round(companySettings.pricePerKm * data.distanceKm);
          const isFree =
            companySettings.freeDeliveryAbove != null && totalAmount >= companySettings.freeDeliveryAbove;
          setDeliveryDistanceKm(data.distanceKm);
          if (tooFar) {
            setDeliveryError(
              `Za daleko (${data.distanceKm.toFixed(1)} km, max ${companySettings.maxDeliveryKm} km)`
            );
            setDeliveryCost(0);
          } else {
            setDeliveryCost(isFree ? 0 : rawPrice);
          }
        }
      } catch (err) {
        console.error("Delivery error:", err);
        setDeliveryError("Błąd obliczania dostawy");
        setDeliveryCost(0);
      }
      setDeliveryCalculating(false);
    },
    [companySettings, totalAmount]
  );

  const debouncedDeliveryCalc = useCallback(
    (city: string, street: string, building: string) => {
      if (deliveryDebounceRef.current) clearTimeout(deliveryDebounceRef.current);
      deliveryDebounceRef.current = window.setTimeout(() => {
        void calculateDelivery(city, street, building);
      }, 800);
    },
    [calculateDelivery]
  );

  const filteredClients = dbClients.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.companyName || "").toLowerCase().includes(clientSearch.toLowerCase())
  );

  const selectClient = (id: string) => {
    const c = dbClients.find((cl) => cl.id === id);
    if (!c) return;
    setSelectedClientId(id);
    setClientName(`${c.firstName} ${c.lastName}`);
    setClientEmail(c.email);
    setClientPhone(c.phone);
    setClientSearch("");
  };

  const clearClient = () => {
    setSelectedClientId(null);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
  };

  const addProduct = (product: CatalogProduct) => {
    if (
      (product.type === "bundle" && product.variants && product.variants.length > 0) ||
      (product.type === "configurable" && product.optionGroups && product.optionGroups.length > 0)
    ) {
      setConfiguringProduct(product);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        quantity: 1,
        unit: product.unit,
        pricePerUnit: product.defaultPrice,
        total: product.defaultPrice,
        type: product.type,
        itemType: mapItemType(product.type),
        // Tylko dania mają wpis w tabeli Dish — extra/service mają inne ID (FK by się wywaliło).
        dishId: product.type === "simple" ? product.id : undefined,
        subItems: null,
      },
    ]);
    setShowProducts(false);
    setProductSearch("");
  };

  const handleSubItemConfirm = (subItems: OrderItem["subItems"]) => {
    if (!configuringProduct) return;
    setItems((prev) => [
      ...prev,
      {
        id: configuringProduct.id,
        name: configuringProduct.name,
        quantity: 1,
        unit: configuringProduct.unit,
        pricePerUnit: configuringProduct.defaultPrice,
        total: configuringProduct.defaultPrice,
        type: configuringProduct.type,
        itemType: mapItemType(configuringProduct.type),
        dishId: configuringProduct.type === "simple" ? configuringProduct.id : undefined,
        subItems: subItems ?? null,
      },
    ]);
    setConfiguringProduct(null);
    setShowProducts(false);
    setProductSearch("");
  };

  const updateItem = (index: number, field: "quantity" | "pricePerUnit", value: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.pricePerUnit;
        return updated;
      })
    );
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const filteredCatalogAdd = catalogProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const resetForm = () => {
    setSelectedClientId(null);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setOrderCompanyName("");
    setOrderCompanyNip("");
    setCateringType("wyjazdowy");
    setEvent("");
    setDate("");
    setTime("");
    setDeliveryCity("");
    setDeliveryStreet("");
    setDeliveryBuilding("");
    setDeliveryCost(0);
    setDeliveryDistanceKm(null);
    setDeliveryError(null);
    setNotes("");
    setItems([]);
    setClientSearch("");
    setShowProducts(false);
    setProductSearch("");
    setConfiguringProduct(null);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Dodaj przynajmniej jedną pozycję");
      return;
    }
    const effectiveDeliveryCost = includesDeliveryFee(cateringType) ? deliveryCost : 0;
    const totalPrice = totalAmount + effectiveDeliveryCost;
    const deposit = Number((totalPrice * 0.1).toFixed(2));
    const orderNotes = [notes? `${notes}` : ""].filter(Boolean).join("\n");
    const resolvedContactName = clientName.trim() || "Do uzupełnienia";

    setIsSubmitting(true);
    try {
      await api.createAdminOrder({
        clientId: selectedClientId,
        order: {
          contactName: resolvedContactName,
          contactEmail: clientEmail,
          contactPhone: clientPhone,
          contactCity:
            cateringType === "na_sali"
              ? "Na sali"
              : cateringType === "odbior_osobisty"
                ? "Odbiór osobisty"
                : deliveryCity,
          contactStreet: cateringType === "na_sali" || cateringType === "odbior_osobisty" ? "" : deliveryStreet,
          contactBuildingNumber:
            cateringType === "na_sali" || cateringType === "odbior_osobisty" ? "" : deliveryBuilding,
          companyName: orderCompanyName.trim() || undefined,
          companyNip: orderCompanyNip.trim() || undefined,
          cateringType,
          eventDate: date || null,
          eventTime: time || null,
          eventType: event || "",
          guestCount: 0,
          deliveryPrice: effectiveDeliveryCost,
          paymentMethod: "",
          notes: orderNotes,
          deposit,
        },
        totalPrice,
        submissionType: "order",
        orderItems: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          total: item.total,
          itemType: mapItemType(item.itemType ?? item.type),
          foodCostPerUnit: item.foodCostPerUnit ?? 0,
          dishId: item.dishId ?? (item.type === "simple" ? item.id : undefined),
          sourceProductId: item.id,
          subItems: (item.subItems ?? []).map((sub) => ({
            name: sub.name,
            quantity: sub.quantity,
            unit: sub.unit,
            converter: sub.converter ?? 1,
            optionConverter: sub.optionConverter ?? 1,
            groupConverter: sub.groupConverter ?? 1,
            foodCostPerUnit: sub.foodCostPerUnit ?? 0,
            pricePerUnit: sub.pricePerUnit ?? 0,
            dishId: sub.dishId ?? undefined,
          })),
        })),
      });

      if (onSuccess) await onSuccess();

      toast.success("Zamówienie dodane");
      resetForm();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Błąd tworzenia zamówienia";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Nowe zamówienie</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Klient
            </Label>

            {selectedClientId ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {clientEmail} · {clientPhone}
                  </p>
                </div>
                <button onClick={clearClient} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj klienta..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {clientSearch && (
                  <div className="border border-border rounded-lg max-h-36 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-b-0"
                      >
                        <span className="font-medium">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">{c.email}</span>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nie znaleziono</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">lub wpisz ręcznie:</p>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    placeholder="Imię i nazwisko"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                    <Input placeholder="Telefon" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Firma (opcjonalnie)"
                      value={orderCompanyName}
                      onChange={(e) => setOrderCompanyName(e.target.value)}
                    />
                    <Input
                      placeholder="NIP (opcjonalnie)"
                      value={orderCompanyNip}
                      onChange={(e) => setOrderCompanyNip(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Wydarzenie
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={event || "__none__"} onValueChange={(v) => setEvent(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Typ wydarzenia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Brak —</SelectItem>
                  {useAdminEventTypes().map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setIsDatePickerOpen(true)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm",
                  "hover:border-primary focus:outline-none",
                  date && time ? "border-primary bg-accent" : "border-input"
                )}
              >
                <div className="text-left">
                  {date && time ? (
                    <>
                      <p className="font-medium text-foreground">
                        {format(new Date(date), "d MMMM yyyy", { locale: pl })}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {time}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Wybierz datę i godzinę</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <FullscreenDateTimePicker
                isOpen={isDatePickerOpen}
                selectedDate={date ? new Date(date) : undefined}
                selectedTime={time}
                onConfirm={(d, t) => {
                  setDate(format(d, "yyyy-MM-dd"));
                  setTime(t);
                }}
                onClose={() => setIsDatePickerOpen(false)}
                busyDates={blockedDates}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              Rodzaj cateringu
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (cateringType === "na_sali") setCateringType("wyjazdowy");
                }}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm",
                  "hover:border-primary focus:outline-none",
                  isOffPremiseCatering(cateringType) ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <Truck className={cn("w-4 h-4", isOffPremiseCatering(cateringType) ? "text-primary" : "text-muted-foreground")} />
                <span
                  className={cn(
                    "font-medium",
                    isOffPremiseCatering(cateringType) ? "text-primary" : "text-foreground"
                  )}
                >
                  Catering
                </span>
                <span className="text-[10px] text-muted-foreground text-center">Poza salą</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCateringType("na_sali");
                  setDeliveryCost(0);
                  setDeliveryDistanceKm(null);
                  setDeliveryError(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm",
                  "hover:border-primary focus:outline-none",
                  cateringType === "na_sali" ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <span className={cn("font-medium", cateringType === "na_sali" ? "text-primary" : "text-foreground")}>
                  Na sali
                </span>
                <span className="text-[10px] text-muted-foreground text-center">Bez dostawy</span>
              </button>
            </div>

            {isOffPremiseCatering(cateringType) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCateringType("wyjazdowy")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-xs",
                    "hover:border-primary focus:outline-none",
                    cateringType === "wyjazdowy" ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span className={cn("font-medium", cateringType === "wyjazdowy" ? "text-primary" : "text-foreground")}>
                    Dostawa
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCateringType("odbior_osobisty");
                    setDeliveryCost(0);
                    setDeliveryDistanceKm(null);
                    setDeliveryError(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-xs",
                    "hover:border-primary focus:outline-none",
                    cateringType === "odbior_osobisty" ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span
                    className={cn(
                      "font-medium",
                      cateringType === "odbior_osobisty" ? "text-primary" : "text-foreground"
                    )}
                  >
                    Odbiór
                  </span>
                </button>
              </div>
            )}
          </div>

          {cateringType === "wyjazdowy" && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Adres dostawy
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Miasto"
                  value={deliveryCity}
                  onChange={(e) => {
                    setDeliveryCity(e.target.value);
                    debouncedDeliveryCalc(e.target.value, deliveryStreet, deliveryBuilding);
                  }}
                />
                <Input
                  placeholder="Ulica"
                  value={deliveryStreet}
                  onChange={(e) => {
                    setDeliveryStreet(e.target.value);
                    debouncedDeliveryCalc(deliveryCity, e.target.value, deliveryBuilding);
                  }}
                />
                <Input
                  placeholder="Nr budynku"
                  value={deliveryBuilding}
                  onChange={(e) => {
                    setDeliveryBuilding(e.target.value);
                    debouncedDeliveryCalc(deliveryCity, deliveryStreet, e.target.value);
                  }}
                />
              </div>
              {deliveryCalculating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Obliczanie dostawy...
                </div>
              )}
              {deliveryError && !deliveryCalculating && (
                <div className="flex items-center gap-2 text-xs text-destructive p-2 bg-destructive/10 rounded-md">
                  <AlertCircle className="w-3 h-3" />
                  {deliveryError}
                </div>
              )}
              {deliveryDistanceKm && !deliveryError && !deliveryCalculating && (
                <div className="flex items-center gap-2 text-xs text-green-700 p-2 bg-green-50 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  {deliveryDistanceKm.toFixed(1)} km — dostawa:{" "}
                  {deliveryCost > 0 ? `${fmtNum(deliveryCost)} zł` : "bezpłatna"}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Uwagi
            </Label>
            <Textarea
              placeholder="Alergie, preferencje..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                Pozycje ({items.length})
              </Label>
              <Button variant="outline" size="sm" onClick={() => setShowProducts(!showProducts)}>
                {showProducts ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {showProducts ? "Zamknij" : "Dodaj"}
              </Button>
            </div>

            {showProducts && (
              <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj produktu..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredCatalogAdd.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                    >
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {fmtNum(p.defaultPrice)} zł/{p.unit}
                      </span>
                    </button>
                  ))}
                  {filteredCatalogAdd.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Brak wyników</p>
                  )}
                </div>
                {configuringProduct && (
                  <SubItemSelector
                    product={configuringProduct}
                    onConfirm={handleSubItemConfirm}
                    onCancel={() => setConfiguringProduct(null)}
                  />
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{item.name}</span>
                      <OrderLineDishContents contents={item.dish?.contents} />
                      {item.subItems && item.subItems.length > 0 && (
                        <div className="mt-0.5 space-y-1">
                          {item.subItems.map((sub, si) => (
                            <div key={si} className="space-y-0.5">
                              <p className="text-[11px] text-muted-foreground pl-2 border-l-2 border-primary/20">
                                {sub.name}
                                {sub.quantity > 1 ? ` ×${sub.quantity}` : ""}
                              </p>
                              <OrderLineDishContents contents={sub.dish?.contents} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(i, "quantity", Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-16 h-7 text-xs text-center"
                    />
                    <span className="text-xs text-muted-foreground w-6">{item.unit}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.pricePerUnit}
                      onChange={(e) =>
                        updateItem(i, "pricePerUnit", Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-20 h-7 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">zł</span>
                    <span className="text-xs font-semibold w-16 text-right">{fmtNum(item.total)} zł</span>
                    <button onClick={() => removeItem(i)} className="p-1 text-destructive/60 hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="pt-2 border-t border-border space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Produkty</span>
                    <span>{fmtNum(totalAmount)} zł</span>
                  </div>
                  {includesDeliveryFee(cateringType) && deliveryCost > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Dostawa</span>
                      <span>{fmtNum(deliveryCost)} zł</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-bold">Razem</span>
                    <span className="text-sm font-bold text-primary">
                      {fmtNum(totalAmount + (includesDeliveryFee(cateringType) ? deliveryCost : 0))} zł
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button className="w-full" size="lg" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Utwórz zamówienie
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
