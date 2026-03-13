import { useState, useEffect } from "react";
import { Search, Trash2, User, Building2, MapPin, FileText, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ClientDetailView from "./ClientDetailView";
import { toast } from "@/components/ui/sonner";
import * as api from "@/api/client";
import { randomUUID } from "@/lib/utils";

export interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneAlt: string;
  companyName: string;
  nip: string;
  companyAddress: string;
  companyCity: string;
  companyPostalCode: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  orders: number;
  totalSpent: string;
  lastOrder: string;
  createdAt: string;
}

type View = "list" | "detail";

const newClientForm = (): ClientData => ({
  id: randomUUID(), firstName: "", lastName: "", email: "", phone: "", phoneAlt: "",
  companyName: "", nip: "", companyAddress: "", companyCity: "", companyPostalCode: "",
  address: "", city: "", postalCode: "",
  notes: "", orders: 0, totalSpent: "0,00 zł", lastOrder: "—", createdAt: "",
});

const fmtPLN = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  const date = new Date(d);
  const months = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

function mapApiClientsToClientData(data: Record<string, unknown>[]): ClientData[] {
  return (data || []).map((c: Record<string, unknown>) => {
    const createdAt = c.createdAt != null ? new Date(c.createdAt as string).toISOString() : "";
    return {
      id: String(c.id),
      firstName: String(c.firstName ?? ""),
      lastName: String(c.lastName ?? ""),
      email: String(c.email ?? ""),
      phone: String(c.phone ?? ""),
      phoneAlt: String(c.phoneAlt ?? ""),
      companyName: String(c.companyName ?? ""),
      nip: String(c.nip ?? ""),
      companyAddress: String(c.companyAddress ?? ""),
      companyCity: String(c.companyCity ?? ""),
      companyPostalCode: String(c.companyPostalCode ?? ""),
      address: String(c.address ?? ""),
      city: String(c.city ?? ""),
      postalCode: String(c.postalCode ?? ""),
      notes: String(c.notes ?? ""),
      orders: Number(c.orders ?? 0),
      totalSpent: fmtPLN(Number(c.totalSpent ?? 0)) + " zł",
      lastOrder: c.lastOrder ? fmtDate(String(c.lastOrder)) : "—",
      createdAt: createdAt ? fmtDate(createdAt) : "",
    };
  });
}

const ClientsView = () => {
  const [view, setView] = useState<View>("list");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [addForm, setAddForm] = useState<ClientData>(newClientForm());

  const fetchClients = async () => {
    try {
      const data = await api.getAdminClients();
      setClients(mapApiClientsToClientData(data || []));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getAdminClients();
        if (cancelled) return;
        setClients(mapApiClientsToClientData(data || []));
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = clients.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (client: ClientData) => {
    setSelectedClient(client);
    setView("detail");
  };

  const handleAdd = () => {
    setAddForm(newClientForm());
    setIsAddSheetOpen(true);
  };

  const setAddField = (field: keyof ClientData, value: string) =>
    setAddForm((prev) => ({ ...prev, [field]: value }));

  const handleAddSave = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone) {
      toast.error("Wypełnij wymagane pola (imię, nazwisko, email, telefon)");
      return;
    }
    const payload = {
      id: addForm.id,
      firstName: addForm.firstName,
      lastName: addForm.lastName,
      email: addForm.email,
      phone: addForm.phone,
      phoneAlt: addForm.phoneAlt || null,
      companyName: addForm.companyName || null,
      nip: addForm.nip || null,
      companyAddress: addForm.companyAddress || null,
      companyCity: addForm.companyCity || null,
      companyPostalCode: addForm.companyPostalCode || null,
      address: addForm.address || null,
      city: addForm.city || null,
      postalCode: addForm.postalCode || null,
      notes: addForm.notes || null,
    };
    try {
      await api.createClient(payload);
    } catch (err: unknown) {
      toast.error("Błąd zapisu: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    toast.success("Klient dodany");
    setIsAddSheetOpen(false);
    fetchClients();
  };

  const handleSave = async (client: ClientData) => {
    const payload = {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      phoneAlt: client.phoneAlt || null,
      companyName: client.companyName || null,
      nip: client.nip || null,
      companyAddress: client.companyAddress || null,
      companyCity: client.companyCity || null,
      companyPostalCode: client.companyPostalCode || null,
      address: client.address || null,
      city: client.city || null,
      postalCode: client.postalCode || null,
      notes: client.notes || null,
    };

    const exists = clients.find((c) => c.id === client.id);
    try {
      if (exists) {
        await api.updateClient(client.id, payload);
      } else {
        await api.createClient({ id: client.id, ...payload });
      }
    } catch (err: unknown) {
      toast.error("Błąd zapisu: " + (err instanceof Error ? err.message : String(err)));
      return;
    }

    toast.success("Zapisano");
    fetchClients();
    setSelectedClient(client);
  };

  const handleDelete = async (client: ClientData) => {
    try {
      await api.deleteClient(client.id);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    toast.success("Klient usunięty");
  };

  const handleBack = () => {
    setView("list");
    setSelectedClient(null);
    fetchClients();
  };

  if (view === "detail" && selectedClient) {
    return <ClientDetailView client={selectedClient} onBack={handleBack} onSave={handleSave} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Klienci</h1>
          <p className="text-muted-foreground text-sm">Zarządzaj bazą klientów ({clients.length})</p>
        </div>
        <Button className="gap-2" onClick={handleAdd}>+ Dodaj klienta</Button>
      </div>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj klientów..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">Klient</TableHead>
              <TableHead className="font-semibold text-foreground">Telefon</TableHead>
              <TableHead className="font-semibold text-foreground">Firma</TableHead>
              <TableHead className="font-semibold text-foreground">Zamówienia</TableHead>
              <TableHead className="font-semibold text-foreground">Łączna kwota</TableHead>
              <TableHead className="font-semibold text-foreground">Ostatnie zamówienie</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {search ? "Nie znaleziono klientów" : "Brak klientów w bazie"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer" onClick={() => handleOpen(client)}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">{client.firstName} {client.lastName}</div>
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{client.companyName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.orders}</TableCell>
                  <TableCell className="font-semibold text-foreground">{client.totalSpent}</TableCell>
                  <TableCell className="text-muted-foreground">{client.lastOrder}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(client)}
                        className="p-1.5 rounded-md transition-colors text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Client Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Nowy klient
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {/* Dane osobowe */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Dane osobowe
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Imię *</Label>
                    <Input value={addForm.firstName} onChange={(e) => setAddField("firstName", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nazwisko *</Label>
                    <Input value={addForm.lastName} onChange={(e) => setAddField("lastName", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email *</Label>
                  <Input type="email" value={addForm.email} onChange={(e) => setAddField("email", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefon *</Label>
                    <Input value={addForm.phone} onChange={(e) => setAddField("phone", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefon dodatkowy</Label>
                    <Input value={addForm.phoneAlt} onChange={(e) => setAddField("phoneAlt", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Dane firmowe */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Dane firmowe
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nazwa firmy</Label>
                    <Input value={addForm.companyName} onChange={(e) => setAddField("companyName", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">NIP</Label>
                    <Input value={addForm.nip} onChange={(e) => setAddField("nip", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Adres firmy</Label>
                  <Input value={addForm.companyAddress} onChange={(e) => setAddField("companyAddress", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Miasto</Label>
                    <Input value={addForm.companyCity} onChange={(e) => setAddField("companyCity", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Kod pocztowy</Label>
                    <Input value={addForm.companyPostalCode} onChange={(e) => setAddField("companyPostalCode", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Adres */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Adres zamieszkania
                </h3>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Adres</Label>
                  <Input value={addForm.address} onChange={(e) => setAddField("address", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Miasto</Label>
                    <Input value={addForm.city} onChange={(e) => setAddField("city", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Kod pocztowy</Label>
                    <Input value={addForm.postalCode} onChange={(e) => setAddField("postalCode", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Notatki */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Notatki
                </h3>
                <Textarea
                  value={addForm.notes}
                  onChange={(e) => setAddField("notes", e.target.value)}
                  placeholder="Dodatkowe informacje o kliencie..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t border-border flex gap-3">
            <Button className="flex-1 gap-2" onClick={handleAddSave}>
              <Save className="w-4 h-4" />
              Dodaj klienta
            </Button>
            <Button variant="outline" onClick={() => setIsAddSheetOpen(false)}>Anuluj</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientsView;
