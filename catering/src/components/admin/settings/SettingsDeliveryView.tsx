import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Save, Search, CheckCircle2 } from "lucide-react";
import { getCompanySettings, updateCompanySettings } from "@/api/client";
import { toast } from "@/components/ui/sonner";

const SettingsDeliveryView = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [_settingsId, setSettingsId] = useState<string | null>(null);

  const [companyAddressFull, setCompanyAddressFull] = useState("");
  const [companyLat, setCompanyLat] = useState<number | null>(null);
  const [companyLng, setCompanyLng] = useState<number | null>(null);
  const [pricePerKm, setPricePerKm] = useState(3);
  const [maxDeliveryKm, setMaxDeliveryKm] = useState<number | null>(null);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number | null>(null);

  useEffect(() => {
    getCompanySettings()
      .then((data: Record<string, unknown>) => {
        if (data.id) setSettingsId(String(data.id));
        setCompanyAddressFull(String(data.companyAddressFull ?? data.company_address_full ?? ""));
        setCompanyLat(data.companyLat != null ? Number(data.companyLat) : data.company_lat != null ? Number(data.company_lat) : null);
        setCompanyLng(data.companyLng != null ? Number(data.companyLng) : data.company_lng != null ? Number(data.company_lng) : null);
        setPricePerKm(Number(data.deliveryPricePerKm ?? data.delivery_price_per_km ?? 3) || 3);
        setMaxDeliveryKm(data.maxDeliveryKm != null ? Number(data.maxDeliveryKm) : data.max_delivery_km != null ? Number(data.max_delivery_km) : null);
        setFreeDeliveryAbove(data.freeDeliveryAboveKm != null ? Number(data.freeDeliveryAboveKm) : data.free_delivery_above_km != null ? Number(data.free_delivery_above_km) : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const geocodeAddress = async () => {
    if (!companyAddressFull.trim()) {
      toast.error("Wpisz adres firmy");
      return;
    }
    setGeocoding(true);
    try {
      const cleaned = companyAddressFull.replace(/\bul\.\s*/gi, '').replace(/\baleja\s*/gi, '').replace(/\bal\.\s*/gi, '').trim();
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&countrycodes=pl&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "KingOfCatering/1.0" } });
      const data = await res.json();
      if (data && data.length > 0) {
        setCompanyLat(parseFloat(data[0].lat));
        setCompanyLng(parseFloat(data[0].lon));
        toast.success(`Znaleziono: ${data[0].display_name}`);
      } else {
        toast.error("Nie znaleziono adresu");
      }
    } catch {
      toast.error("Błąd geokodowania");
    }
    setGeocoding(false);
  };

  const handleSave = async () => {
    if (!companyLat || !companyLng) {
      toast.error("Najpierw zgeokoduj adres firmy");
      return;
    }
    setSaving(true);
    try {
      await updateCompanySettings({
        companyAddressFull,
        companyLat,
        companyLng,
        deliveryPricePerKm: pricePerKm,
        maxDeliveryKm: maxDeliveryKm ?? undefined,
        freeDeliveryAboveKm: freeDeliveryAbove ?? undefined,
      });
      toast.success("Ustawienia dostawy zapisane");
    } catch (err: unknown) {
      toast.error("Błąd zapisu: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Strefy dostaw</h1>
        <p className="text-muted-foreground text-sm">Konfiguracja dostawy na podstawie odległości w kilometrach</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Adres firmy (punkt startowy)
            </CardTitle>
            <CardDescription>Podaj adres, z którego startują dostawy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={companyAddressFull}
                onChange={(e) => setCompanyAddressFull(e.target.value)}
                placeholder="np. ul. Krakowska 10, 30-001 Kraków"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && geocodeAddress()}
              />
              <Button onClick={geocodeAddress} disabled={geocoding} variant="outline">
                <Search className="w-4 h-4 mr-1" />
                {geocoding ? "Szukam..." : "Znajdź"}
              </Button>
            </div>
            {companyLat != null && companyLng != null && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span>Współrzędne: {companyLat.toFixed(5)}, {companyLng.toFixed(5)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Cennik dostawy
            </CardTitle>
            <CardDescription>Stawka za kilometr i limity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cena za km (zł) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pricePerKm}
                  onChange={(e) => setPricePerKm(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Np. 3 zł × 15 km = 45 zł</p>
              </div>
              <div className="space-y-2">
                <Label>Maks. odległość (km)</Label>
                <Input
                  type="number"
                  min={0}
                  value={maxDeliveryKm ?? ""}
                  onChange={(e) => setMaxDeliveryKm(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Bez limitu"
                />
                <p className="text-xs text-muted-foreground">Powyżej — kontakt telefoniczny</p>
              </div>
              <div className="space-y-2">
                <Label>Darmowa dostawa powyżej (zł)</Label>
                <Input
                  type="number"
                  min={0}
                  value={freeDeliveryAbove ?? ""}
                  onChange={(e) => setFreeDeliveryAbove(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Brak progu"
                />
                <p className="text-xs text-muted-foreground">Wartość zamówienia dla darmowej dostawy</p>
              </div>
            </div>

            {pricePerKm > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Przykładowe ceny:</p>
                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                  {[5, 10, 15, 20, 30, 50].map((km) => (
                    <div key={km} className="flex justify-between">
                      <span>{km} km</span>
                      <Badge variant="secondary">{(pricePerKm * km).toFixed(0)} zł</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsDeliveryView;
