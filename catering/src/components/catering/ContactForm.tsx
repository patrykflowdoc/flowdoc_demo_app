import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Mail, Phone, MessageSquare, MapPin, Building2, Home, Truck, AlertCircle, CheckCircle2, Loader2, Briefcase } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { calculateDelivery as apiCalculateDelivery } from "@/api/client";

export interface DeliveryConfig {
  companyLat: number | null;
  companyLng: number | null;
  pricePerKm: number;
  maxDeliveryKm: number | null;
  freeDeliveryAbove: number | null;
}

type ContactFormProps = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCity: string;
  contactStreet: string;
  contactBuildingNumber: string;
  contactApartmentNumber: string;
  notes: string;
  companyName: string;
  companyNip: string;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
  onPhoneChange: (phone: string) => void;
  onCityChange: (city: string) => void;
  onStreetChange: (street: string) => void;
  onBuildingNumberChange: (num: string) => void;
  onApartmentNumberChange: (num: string) => void;
  onNotesChange: (notes: string) => void;
  onCompanyNameChange: (name: string) => void;
  onCompanyNipChange: (nip: string) => void;
  deliveryConfig: DeliveryConfig;
  orderTotal: number;
  onDeliveryCalculated: (price: number, distanceKm: number | null) => void;
};

interface DeliveryResult {
  distanceKm: number;
  durationMin: number;
  price: number;
  isFree: boolean;
  tooFar: boolean;
}

export function ContactForm({
  contactName, contactEmail, contactPhone, contactCity, contactStreet,
  contactBuildingNumber, contactApartmentNumber, notes,
  companyName, companyNip,
  onNameChange, onEmailChange, onPhoneChange, onCityChange, onStreetChange,
  onBuildingNumberChange, onApartmentNumberChange, onNotesChange,
  onCompanyNameChange, onCompanyNipChange,
  deliveryConfig, orderTotal, onDeliveryCalculated,
}: ContactFormProps) {
  const [isCompany, setIsCompany] = useState(!!(companyName || companyNip));
  const [deliveryResult, setDeliveryResult] = useState<DeliveryResult | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const calculateDelivery = useCallback(async (city: string, street: string, building: string) => {
    if (!city.trim() || !street.trim() || !building.trim()) {
      setDeliveryResult(null);
      setDeliveryError(null);
      onDeliveryCalculated(0, null);
      return;
    }

    if (!deliveryConfig.companyLat || !deliveryConfig.companyLng) {
      return;
    }

    // Clean Polish street prefixes for better geocoding
    const cleanStreet = street.replace(/\bul\.\s*/gi, '').replace(/\baleja\s*/gi, '').replace(/\bal\.\s*/gi, '').trim();
    const fullAddress = `${cleanStreet} ${building}, ${city}, Polska`;

    setCalculating(true);
    setDeliveryError(null);

    try {
      const data = await apiCalculateDelivery({
        address: fullAddress,
        companyLat: deliveryConfig.companyLat,
        companyLng: deliveryConfig.companyLng,
      });

      if (data.error === "address_not_found") {
        setDeliveryError("Nie znaleziono adresu. Sprawdź poprawność danych.");
        setDeliveryResult(null);
        onDeliveryCalculated(0, null);
      } else if (data.error === "route_not_found") {
        setDeliveryError("Nie udało się obliczyć trasy.");
        setDeliveryResult(null);
        onDeliveryCalculated(0, null);
      } else if (data.distanceKm != null) {
        const tooFar = deliveryConfig.maxDeliveryKm != null && data.distanceKm > deliveryConfig.maxDeliveryKm;
        const rawPrice = Math.round(deliveryConfig.pricePerKm * data.distanceKm);
        const isFree = deliveryConfig.freeDeliveryAbove != null && orderTotal >= deliveryConfig.freeDeliveryAbove;
        const price = isFree ? 0 : rawPrice;

        const result: DeliveryResult = {
          distanceKm: data.distanceKm,
          durationMin: data.durationMin ?? 0,
          price,
          isFree,
          tooFar,
        };
        setDeliveryResult(result);
        setDeliveryError(null);
        onDeliveryCalculated(tooFar ? 0 : price, data.distanceKm);
      }
    } catch (err) {
      console.error("Delivery calculation error:", err);
      setDeliveryError("Błąd obliczania dostawy");
      setDeliveryResult(null);
      onDeliveryCalculated(0, null);
    }

    setCalculating(false);
  }, [deliveryConfig, orderTotal, onDeliveryCalculated]);

  const debouncedCalculate = useCallback((city: string, street: string, building: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      calculateDelivery(city, street, building);
    }, 800);
  }, [calculateDelivery]);

  const handleCityChange = (value: string) => {
    onCityChange(value);
    debouncedCalculate(value, contactStreet, contactBuildingNumber);
  };

  const handleStreetChange = (value: string) => {
    onStreetChange(value);
    debouncedCalculate(contactCity, value, contactBuildingNumber);
  };

  const handleBuildingChange = (value: string) => {
    onBuildingNumberChange(value);
    debouncedCalculate(contactCity, contactStreet, value);
  };

  const hasDeliveryConfig = deliveryConfig.companyLat != null && deliveryConfig.companyLng != null;

  return (
    <div className="px-4 py-6 pb-24 space-y-6 md:max-w-5xl md:mx-auto lg:max-w-6xl">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Dane Kontaktowe</h1>
        <p className="text-muted-foreground">Wypełnij formularz kontaktowy</p>
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="pt-6 space-y-4">
          {/* Personal info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Imię i nazwisko *
              </Label>
              <Input id="name" placeholder="Jan Kowalski" value={contactName} onChange={(e) => onNameChange(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email *
              </Label>
              <Input id="email" type="email" placeholder="jan@firma.pl" value={contactEmail} onChange={(e) => onEmailChange(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                Telefon *
              </Label>
              <Input id="phone" type="tel" placeholder="+48 123 456 789" value={contactPhone} onChange={(e) => onPhoneChange(e.target.value)} className="h-12" />
            </div>
          </div>

          {/* Address section */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-medium">Adres dostawy</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Miasto *
                </Label>
                <Input id="city" placeholder="Kraków" value={contactCity} onChange={(e) => handleCityChange(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street" className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-muted-foreground" />
                  Ulica *
                </Label>
                <Input id="street" placeholder="ul. Przykładowa" value={contactStreet} onChange={(e) => handleStreetChange(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingNumber">Numer budynku *</Label>
                <Input id="buildingNumber" placeholder="123" value={contactBuildingNumber} onChange={(e) => handleBuildingChange(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apartmentNumber">Numer lokalu (opcjonalne)</Label>
                <Input id="apartmentNumber" placeholder="4A" value={contactApartmentNumber} onChange={(e) => onApartmentNumberChange(e.target.value)} className="h-12" />
              </div>
            </div>

            {/* Delivery cost feedback */}
            {hasDeliveryConfig && contactCity.trim() && contactStreet.trim() && contactBuildingNumber.trim() && (
              <div className="mt-4">
                {calculating ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <span className="text-sm text-muted-foreground">Obliczam odległość...</span>
                  </div>
                ) : deliveryError ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
                    <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{deliveryError}</p>
                      <p className="text-xs text-muted-foreground">Skontaktuj się z nami w sprawie dostawy</p>
                    </div>
                  </div>
                ) : deliveryResult?.tooFar ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Poza zasięgiem dostawy</p>
                      <p className="text-xs text-muted-foreground">
                        Odległość: {deliveryResult.distanceKm} km (maks. {deliveryConfig.maxDeliveryKm} km). Skontaktuj się telefonicznie.
                      </p>
                    </div>
                  </div>
                ) : deliveryResult ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Truck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {deliveryResult.distanceKm} km • ~{deliveryResult.durationMin} min
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                      {deliveryResult.isFree ? (
                        <p className="text-sm text-primary font-medium">Darmowa dostawa! 🎉</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Koszt dostawy: <span className="font-semibold text-foreground">{deliveryResult.price} zł</span>
                          <span className="ml-1 text-xs">({deliveryConfig.pricePerKm} zł/km)</span>
                          {deliveryConfig.freeDeliveryAbove != null && (
                            <span className="ml-1 text-xs">(darmowa od {deliveryConfig.freeDeliveryAbove} zł)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Company section */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                id="isCompany"
                checked={isCompany}
                onCheckedChange={(checked) => {
                  setIsCompany(checked === true);
                  if (!checked) { onCompanyNameChange(""); onCompanyNipChange(""); }
                }}
              />
              <label htmlFor="isCompany" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Briefcase className="w-4 h-4 text-primary" />
                Kupuję jako firma
              </label>
            </div>
            {isCompany && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Nazwa firmy
                  </Label>
                  <Input id="companyName" placeholder="Firma Sp. z o.o." value={companyName} onChange={(e) => onCompanyNameChange(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyNip">NIP</Label>
                  <Input id="companyNip" placeholder="123-456-78-90" value={companyNip} onChange={(e) => onCompanyNipChange(e.target.value)} className="h-12" />
                </div>
              </div>
            )}
          </div>


          <div className="pt-4 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Uwagi (opcjonalne)
              </Label>
              <Textarea id="notes" placeholder="Alergie, preferencje, szczegóły lokalizacji..." value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
