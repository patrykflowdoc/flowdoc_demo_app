import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ClientData } from "@/components/admin/ClientsView";
import { randomUUID } from "@/lib/utils";

interface Props {
  client?: ClientData | null; // null = add new
  onBack: () => void;
  onSave: (client: ClientData) => void;
}

const emptyClient: ClientData = {
  id: "", firstName: "", lastName: "", email: "", phone: "", phoneAlt: "",
  companyName: "", nip: "", companyAddress: "", companyCity: "", companyPostalCode: "",
  address: "", city: "", postalCode: "",
  notes: "", orders: 0, totalSpent: "0,00 zł", lastOrder: "—", createdAt: "",
};

const ClientFormView = ({ client, onBack, onSave }: Props) => {
  const isEditing = !!client;
  const [form, setForm] = useState<ClientData>(client || { ...emptyClient, id: randomUUID() });

  useEffect(() => {
    if (client) {
      /* eslint-disable react-hooks/set-state-in-effect -- sync form when client prop changes */
      setForm(client);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [client]);

  const set = (field: keyof ClientData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    const toSave = { ...form };
    if (!toSave.createdAt) {
      const now = new Date();
      const months = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
      toSave.createdAt = `${String(now.getDate()).padStart(2, "0")} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    onSave(toSave);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? "Edytuj klienta" : "Nowy klient"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isEditing ? `${client.firstName} ${client.lastName}` : "Wypełnij dane nowego klienta"}
          </p>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Personal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dane osobowe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imię *</Label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nazwisko *</Label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon *</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefon dodatkowy</Label>
                <Input value={form.phoneAlt} onChange={(e) => set("phoneAlt", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adres zamieszkania</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adres</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miasto</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Kod pocztowy</Label>
                <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dane firmowe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nazwa firmy</Label>
                <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>NIP</Label>
                <Input value={form.nip} onChange={(e) => set("nip", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adres firmy</Label>
              <Input value={form.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miasto</Label>
                <Input value={form.companyCity} onChange={(e) => set("companyCity", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Kod pocztowy</Label>
                <Input value={form.companyPostalCode} onChange={(e) => set("companyPostalCode", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notatki</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Dodatkowe informacje o kliencie..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave}>
            {isEditing ? "Zapisz zmiany" : "Dodaj klienta"}
          </Button>
          <Button variant="outline" onClick={onBack}>Anuluj</Button>
        </div>
      </div>
    </div>
  );
};

export default ClientFormView;
