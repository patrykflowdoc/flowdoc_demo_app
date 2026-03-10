import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SettingsView = () => {
  const [companyName, setCompanyName] = useState("King of Catering");
  const [email, setEmail] = useState("kontakt@kingofcatering.pl");
  const [phone, setPhone] = useState("+48 500 000 000");
  const [address, setAddress] = useState("ul. Przykładowa 12, 00-001 Warszawa");
  const [minOrder, setMinOrder] = useState("200");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ustawienia</h1>
        <p className="text-muted-foreground text-sm">Konfiguracja systemu cateringowego</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Company info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dane firmy</CardTitle>
            <CardDescription>Podstawowe informacje o firmie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nazwa firmy</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Order settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zamówienia</CardTitle>
            <CardDescription>Ustawienia dotyczące zamówień</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minOrder">Minimalna wartość zamówienia (zł)</Label>
              <Input id="minOrder" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="max-w-[200px]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Automatyczne potwierdzanie</Label>
                <p className="text-xs text-muted-foreground">Automatycznie potwierdzaj zamówienia poniżej kwoty minimalnej</p>
              </div>
              <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Powiadomienia</CardTitle>
            <CardDescription>Zarządzaj powiadomieniami</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Powiadomienia email</Label>
                <p className="text-xs text-muted-foreground">Otrzymuj powiadomienia o nowych zamówieniach na email</p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Powiadomienia SMS</Label>
                <p className="text-xs text-muted-foreground">Otrzymuj powiadomienia SMS o nowych zamówieniach</p>
              </div>
              <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full sm:w-auto">Zapisz zmiany</Button>
      </div>
    </div>
  );
};

export default SettingsView;
