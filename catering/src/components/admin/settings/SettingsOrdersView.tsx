import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getCompanySettings, updateCompanySettings } from "@/api/client";
import { toast } from "sonner";

const SettingsOrdersView = () => {
  const [minOrder, setMinOrder] = useState("200");
  const [minLeadDays, setMinLeadDays] = useState("3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCompanySettings()
      .then((data: Record<string, unknown>) => {
        if (data.minOrderValue != null) setMinOrder(String(data.minOrderValue));
        if (data.minLeadDays != null) setMinLeadDays(String(data.minLeadDays));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompanySettings({
        minOrderValue: Number(minOrder) || 0,
        minLeadDays: Number(minLeadDays) || 3,
      });
      toast.success("Parametry zamówień zapisane");
    } catch (err: unknown) {
      toast.error("Błąd zapisu: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Zamówienia</h1>
        <p className="text-muted-foreground text-sm">Ustawienia dotyczące zamówień</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parametry zamówień</CardTitle>
            <CardDescription>Wartości minimalne i limity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minOrder">Minimalna wartość zamówienia (zł)</Label>
                <Input id="minOrder" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minLeadDays">Min. dni wyprzedzenia</Label>
                <Input id="minLeadDays" type="number" value={minLeadDays} onChange={(e) => setMinLeadDays(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsOrdersView;
