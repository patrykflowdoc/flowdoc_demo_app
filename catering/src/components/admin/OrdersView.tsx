import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import * as api from "@/api/client";
import { Search, Eye, Pencil, Trash2, ChevronDown, ArrowLeft, FileText, X, Check, Calculator, FileDown, CookingPot, ClipboardList, Plus, Download, ChevronRight, CalendarDays } from "lucide-react";
import { generateOfferPdf, generateFoodCostPdf, generateKitchenPdf, generateSummaryPdf, type SummaryDocType } from "@/lib/generatePdf";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, randomUUID } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  effectiveLineItemType,
  isAddonLineItem,
  isFoodCostEligibleLineItem,
  splitPrimaryAndAddonItems,
} from "@/lib/orderLineItems";
import { calculateKitchenRows } from "@/lib/templates/pdf/kitchenCalc";
import type {
  DbClient,
  FoodCostExtra,
  Order,
  OrderDocumentType,
  OrderStatus,
  OrderItem,
} from "@/types/orders";
import { ProductTable, OrderLineDishContents } from "./ProductTable";
import { useAdminEventTypes, SubItemSelector, type CatalogProduct, useCatalogProducts } from "./OrderCatalogPicker";
import { AddOrderSheet } from "./AddOrderSheet";
import { mapAdminApiOrderToOrder } from "@/lib/adminOrderViewMap";
import type { CateringType } from "@/lib/pricing";


const statusColors: Record<OrderStatus, string> = {
  "Nowe zamówienie": "bg-blue-50 text-blue-700 border-blue-200",
  "Nowa oferta": "bg-purple-50 text-purple-700 border-purple-200",
  "Potwierdzone": "bg-green-50 text-green-700 border-green-200",
  "W realizacji": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Zrealizowane": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Anulowane": "bg-red-50 text-red-700 border-red-200",
};

const allStatuses: OrderStatus[] = ["Nowe zamówienie", "Nowa oferta", "Potwierdzone", "W realizacji", "Zrealizowane", "Anulowane"];

const mockOrders: Order[] = [];

// ===== DOCUMENT TYPES =====
const docLabels: Record<OrderDocumentType, { label: string; Icon: LucideIcon }> = {
  "offer": { label: "Oferta", Icon: FileText },
  "kitchen": { label: "Rozpiska na kuchnię", Icon: CookingPot },
  "food-cost": { label: "Food cost", Icon: Calculator },
  // TODO: Change to "Lista zakupów" when implemented
  "full": { label: "Lista zakupów", Icon: ClipboardList },
};

const fmtNum = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATERING_TYPE_LABELS: Record<CateringType, string> = {
  wyjazdowy: "Catering wyjazdowy",
  na_sali: "Na sali",
  odbior_osobisty: "Odbiór osobisty",
};

export function formatCateringTypeLabel(ct: CateringType | null): string {
  if (!ct) return "—";
  return CATERING_TYPE_LABELS[ct] ?? "—";
}

/** Przyklejona kolumna Akcje — bez box-shadow (mniej repaintów przy scrollu). */
const ordersListStickyActionHeadClass =
  "sticky right-0 z-[6] bg-card border-l border-border/80";
const ordersListStickyActionCellClass =
  "sticky right-0 z-[5] bg-card border-l border-border/80 group-hover/ordRow:bg-muted/50";

const ordersListScrollbarHidden =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0";
const ordersListScrollbarVisible =
  "[scrollbar-width:thin] [scrollbar-color:hsl(var(--foreground)/0.35)_hsl(var(--muted))] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/35 [&::-webkit-scrollbar-track]:bg-muted/80";

// ===== ORDER DOCUMENT VIEW =====
const OrderDocumentView = ({ order, docType, onBack }: { order: Order; docType: OrderDocumentType; onBack: () => void }) => {
  const showOffer = docType === "offer" || docType === "full";
  const showKitchen = docType === "kitchen" || docType === "full";
  const showFoodCost = docType === "food-cost" || docType === "full";

  // Food cost extras state
  const [fcExtras, setFcExtras] = useState<FoodCostExtra[]>([]);
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraAmount, setNewExtraAmount] = useState("");

  // Load saved extras from DB
  useEffect(() => {
    if (!order.dbId || !showFoodCost) return;
    api.getAdminOrder(order.dbId)
      .then((ord) => {
        const extras = ord.orderFoodCostExtras ?? [];
        setFcExtras(extras.map((d) => ({ id: String(d.id ?? ""), name: d.name ?? "", amount: Number(d.amount ?? 0) })));
      })
      .catch(() => {});
  }, [order.dbId, showFoodCost]);

  const handleAddExtra = () => {
    const amount = parseFloat(newExtraAmount.replace(",", "."));
    if (!newExtraName.trim() || isNaN(amount)) return;
    const entry: FoodCostExtra = { id: randomUUID(), name: newExtraName.trim(), amount, isNew: true };
    setFcExtras(prev => [...prev, entry]);
    setNewExtraName("");
    setNewExtraAmount("");
  };

  const handleRemoveExtra = (id: string) => {
    setFcExtras(prev => prev.filter(e => e.id !== id));
  };

  const handleSaveExtras = async () => {
    if (!order.dbId) return;
    try {
      await api.updateAdminOrder(order.dbId, {
        orderFoodCostExtras: fcExtras.map((e) => ({ name: e.name, amount: e.amount })),
      });
    } catch {
      toast.error("Błąd zapisu");
      return;
    }
    setFcExtras((prev) => prev.map((e) => ({ ...e, isNew: false })));
    toast.success("Pozycje kosztowe zapisane");
  };

  const kitchenDishes = calculateKitchenRows(order.items);

  // Food cost
  const foodCostItems = order.items.filter(isFoodCostEligibleLineItem).map((item) => {
    const fc = item.foodCostPerUnit!;
    const totalFoodCost = fc * item.quantity;
    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      foodCostPerUnit: fc,
      totalFoodCost,
      revenue: item.total,
      margin: item.total > 0 ? ((item.total - totalFoodCost) / item.total) * 100 : 0,
      dishContents: item.dish?.contents,
    };
  });

  const { primary: offerPrimary, addons: offerAddons } = splitPrimaryAndAddonItems(order.items);
  const extrasTotal = fcExtras.reduce((s, e) => s + e.amount, 0);
  const totalFC = foodCostItems.reduce((s, i) => s + i.totalFoodCost, 0) + extrasTotal;
  const totalRev = foodCostItems.reduce((s, i) => s + i.revenue, 0);
  const totalMargin = totalRev > 0 ? ((totalRev - totalFC) / totalRev) * 100 : 0;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Powrót
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {docType === "full" ? "Pełna dokumentacja" : docLabels[docType].label} — {order.id}
          </h1>
          <p className="text-muted-foreground text-sm">{order.client} · {order.date}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            if (showOffer) await generateOfferPdf(order);
            else if (showKitchen) await generateKitchenPdf(order);
            else if (showFoodCost) await generateFoodCostPdf(order, fcExtras);
          }}>
            <Download className="w-4 h-4 mr-1" />
            Pobierz PDF
          </Button>
        </div>
      </div>

      {/* OFERTA */}
      {showOffer && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Oferta</CardTitle>
            <CardDescription>{order.client} · {order.event || "Wydarzenie"} · {order.date} · {order.time}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1 mb-4">
              <p><span className="text-muted-foreground">Adres dostawy:</span> {order.deliveryAddress}</p>
              {order.notes && <p><span className="text-muted-foreground">Uwagi:</span> {order.notes}</p>}
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Produkty</h4>
                <ProductTable items={offerPrimary} />
              </div>
              {offerAddons.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Dodatki i usługi</h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">Pozycja</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Ilość</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Cena jedn.</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Razem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offerAddons.map((item, i) => (
                        <TableRow key={ i+4}>
                          <TableCell className="font-medium">
                            <div>{item.name}</div>
                            <OrderLineDishContents contents={item.dish?.contents} />
                          </TableCell>
                          <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmtNum(item.pricePerUnit)} zł</TableCell>
                          <TableCell className="text-right font-semibold">{fmtNum(item.total)} zł</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              <Table>
                <TableBody>
                  {order.deliveryCost > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">Dostawa</TableCell>
                      <TableCell className="text-center">1</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtNum(order.deliveryCost)} zł</TableCell>
                      <TableCell className="text-right font-semibold">{fmtNum(order.deliveryCost)} zł</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="hover:bg-transparent border-t-2">
                    <TableCell colSpan={3} className="text-right font-semibold">Suma:</TableCell>
                    <TableCell className="text-right font-bold text-primary text-lg">{order.amount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROZPISKA NA KUCHNIĘ */}
      {showKitchen && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CookingPot className="w-5 h-5 text-primary" /> Rozpiska na kuchnię</CardTitle>
            <CardDescription>Łączne ilości dań (jak w PDF „Rozpiska na kuchnię”).</CardDescription>
          </CardHeader>
          <CardContent>
            {kitchenDishes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Brak pozycji kuchennych do wyświetlenia.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-foreground">Danie</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Ilość</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitchenDishes.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <div>{d.name}</div>
                        <OrderLineDishContents contents={d.dish?.contents} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {d.totalQty} .szt
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* FOOD COST */}
      {showFoodCost && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Food cost</CardTitle>
            <CardDescription>Analiza kosztów i marży</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Produkt</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Ilość</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">FC/jedn.</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">FC łącznie</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Przychód</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Marża</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foodCostItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <div>{item.name}</div>
                      <OrderLineDishContents contents={item.dishContents} />
                    </TableCell>
                    <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtNum(item.foodCostPerUnit)} zł</TableCell>
                    <TableCell className="text-right">{fmtNum(item.totalFoodCost)} zł</TableCell>
                    <TableCell className="text-right">{fmtNum(item.revenue)} zł</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("text-xs",
                        item.margin >= 60 ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                        item.margin >= 40 ? "border-yellow-300 text-yellow-700 bg-yellow-50" :
                        "border-red-300 text-red-700 bg-red-50"
                      )}>{item.margin.toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Custom extras */}
                {fcExtras.map((extra) => (
                  <TableRow key={extra.id} className="bg-muted/30">
                    <TableCell className="font-medium flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">⊕</span>
                      {extra.name}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-semibold">{fmtNum(extra.amount)} zł</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => handleRemoveExtra(extra.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Add extra row */}
                <TableRow className="hover:bg-transparent border-t border-dashed">
                  <TableCell colSpan={6}>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nazwa pozycji (np. Obsługa kierowcy)"
                        value={newExtraName}
                        onChange={(e) => setNewExtraName(e.target.value)}
                        className="h-8 text-sm flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleAddExtra()}
                      />
                      <Input
                        placeholder="Kwota"
                        value={newExtraAmount}
                        onChange={(e) => setNewExtraAmount(e.target.value)}
                        className="h-8 text-sm w-28"
                        onKeyDown={(e) => e.key === "Enter" && handleAddExtra()}
                      />
                      <Button size="sm" variant="outline" className="h-8 px-3" onClick={handleAddExtra}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Dodaj
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow className="hover:bg-transparent border-t-2">
                  <TableCell colSpan={3} className="text-right font-semibold">Suma:</TableCell>
                  <TableCell className="text-right font-bold">{fmtNum(totalFC)} zł</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmtNum(totalRev)} zł</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={cn("text-xs font-bold",
                      totalMargin >= 60 ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                      totalMargin >= 40 ? "border-yellow-300 text-yellow-700 bg-yellow-50" :
                      "border-red-300 text-red-700 bg-red-50"
                    )}>{totalMargin.toFixed(1)}%</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {fcExtras.length > 0 && (
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={handleSaveExtras}>
                  <Check className="w-4 h-4 mr-1" />
                  Zapisz pozycje kosztowe
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function orderContactStreetLine(o: Order): string {
  const parts = [o.contactStreet, o.contactBuilding, o.contactApartment].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  return parts.join(" ").trim();
}

// ===== ORDER DETAIL VIEW =====
const OrderDetailView = ({ order, onBack, onEdit, onGenerateDoc, onLinkClient }: { order: Order; onBack: () => void; onEdit: () => void; onGenerateDoc: (type: OrderDocumentType) => void; onLinkClient: (orderId: string, clientId: string) => void }) => {
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newFirstName, setNewFirstName] = useState(order.client.split(" ")[0] || "");
  const [newLastName, setNewLastName] = useState(order.client.split(" ").slice(1).join(" ") || "");
  const [newEmail, setNewEmail] = useState(order.email);
  const [newPhone, setNewPhone] = useState(order.phone);
  const [newCompanyName, setNewCompanyName] = useState(order.companyName?.trim() ?? "");
  const [newNip, setNewNip] = useState(order.companyNip?.trim() ?? "");
  const [newAddressLine, setNewAddressLine] = useState(orderContactStreetLine(order));
  const [newCity, setNewCity] = useState(order.contactCity?.trim() ?? "");

  useEffect(() => {
    setNewFirstName(order.client.split(" ")[0] || "");
    setNewLastName(order.client.split(" ").slice(1).join(" ") || "");
    setNewEmail(order.email);
    setNewPhone(order.phone);
    setNewCompanyName(order.companyName?.trim() ?? "");
    setNewNip(order.companyNip?.trim() ?? "");
    setNewAddressLine(orderContactStreetLine(order));
    setNewCity(order.contactCity?.trim() ?? "");
  }, [
    order.dbId,
    order.client,
    order.email,
    order.phone,
    order.companyName,
    order.companyNip,
    order.contactCity,
    order.contactStreet,
    order.contactBuilding,
    order.contactApartment,
  ]);

  useEffect(() => {
    api.getAdminClients().then((data) => {
      setDbClients((data || []).map((c: Record<string, unknown>) => ({
        id: String(c.id),
        firstName: String(c.firstName ?? ""),
        lastName: String(c.lastName ?? ""),
        email: String(c.email ?? ""),
        phone: String(c.phone ?? ""),
        address: c.address != null ? String(c.address) : null,
        city: c.city != null ? String(c.city) : null,
        companyName: c.companyName != null ? String(c.companyName) : null,
        nip: c.nip != null ? String(c.nip) : null,
      })));
    }).catch(() => {});
  }, []);

  const filteredClients = dbClients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleCreateClient = async () => {
    try {
      const data = await api.createClient({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        phone: newPhone,
        address: newAddressLine.trim() || null,
        city: newCity.trim() || null,
        companyName: newCompanyName.trim() || null,
        nip: newNip.trim() || null,
      }) as Record<string, unknown>;
      onLinkClient(order.dbId, String(data.id));
      setShowCreateClient(false);
      toast.success("Klient utworzony i powiązany");
    } catch {
      toast.error("Błąd tworzenia klienta");
    }
  };

  const linkedClient = order.clientId ? dbClients.find(c => c.id === order.clientId) : null;
  const { primary: detailPrimary, addons: detailAddons } = splitPrimaryAndAddonItems(order.items);
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Powrót
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{order.id}</h1>
        </div>
        <Badge className={cn("text-xs border", statusColors[order.status])}>{order.status}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-1" />
              Generuj
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {(Object.keys(docLabels) as OrderDocumentType[]).map((type) => {
              const DocIcon = docLabels[type].Icon;
              return (
                <DropdownMenuItem key={type} onClick={() => onGenerateDoc(type)} className="cursor-pointer">
                  <DocIcon className="w-4 h-4 mr-2" />
                  {docLabels[type].label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-1" />
          Edytuj
        </Button>
      </div>

        {/* CLIENT DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Klient</CardTitle>
              {order.clientId ? (
                <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">Powiązany</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Niepowiązany</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Imię i nazwisko:</span> <span className="font-medium">{linkedClient ? `${linkedClient.firstName} ${linkedClient.lastName}` : order.client}</span></div>
            <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{linkedClient?.email || order.email}</span></div>
            <div><span className="text-muted-foreground">Telefon:</span> <span className="font-medium">{linkedClient?.phone || order.phone}</span></div>
            {(order.companyName || order.companyNip) && (
              <>
                {order.companyName ? (
                  <div><span className="text-muted-foreground">Firma:</span> <span className="font-medium">{order.companyName}</span></div>
                ) : null}
                {order.companyNip ? (
                  <div><span className="text-muted-foreground">NIP:</span> <span className="font-medium">{order.companyNip}</span></div>
                ) : null}
              </>
            )}
            {!order.clientId && (
              <div className="pt-2 border-t border-border space-y-2">
                {!showClientSearch && !showCreateClient && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowClientSearch(true)}>
                      <Search className="w-3 h-3 mr-1" />
                      Przypisz klienta
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCreateClient(true)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Nowy klient
                    </Button>
                  </div>
                )}
                {showClientSearch && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input placeholder="Szukaj klienta..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="pl-8 h-8 text-xs" autoFocus />
                    </div>
                    <div className="max-h-28 overflow-y-auto border border-border rounded-md">
                      {filteredClients.map(c => (
                        <button key={c.id} onClick={() => { onLinkClient(order.dbId, c.id); setShowClientSearch(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors border-b border-border last:border-b-0">
                          <span className="font-medium">{c.firstName} {c.lastName}</span>
                          <span className="text-muted-foreground ml-1.5">{c.email}</span>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nie znaleziono</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowClientSearch(false)}>Anuluj</Button>
                  </div>
                )}
                {showCreateClient && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input placeholder="Imię" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="h-8 text-xs" />
                      <Input placeholder="Nazwisko" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Telefon" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Firma (opcjonalnie)" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="NIP (opcjonalnie)" value={newNip} onChange={(e) => setNewNip(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Ulica i numer (opcjonalnie)" value={newAddressLine} onChange={(e) => setNewAddressLine(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Miasto (opcjonalnie)" value={newCity} onChange={(e) => setNewCity(e.target.value)} className="h-8 text-xs" />
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={handleCreateClient}>Utwórz i przypisz</Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowCreateClient(false)}>Anuluj</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Wydarzenie</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Typ:</span> <span className="font-medium">{order.event || "Nie podano"}</span></div>
            <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{order.date}</span></div>
            <div><span className="text-muted-foreground">Godzina:</span> <span className="font-medium">{order.time}</span></div>
            <div><span className="text-muted-foreground">Adres dostawy:</span> <span className="font-medium">{order.deliveryAddress}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Podsumowanie</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Pozycji:</span> <span className="font-medium">{order.items.length}</span></div>
            {order.guestCount > 0 && <div><span className="text-muted-foreground">Gości:</span> <span className="font-medium">{order.guestCount}</span></div>}
            {order.deliveryCost > 0 && <div><span className="text-muted-foreground">Dostawa:</span> <span className="font-medium">{fmtNum(order.deliveryCost)} zł</span></div>}
            {order.discount > 0 && <div><span className="text-muted-foreground">Rabat:</span> <span className="font-medium">- {fmtNum(order.discount)} zł</span></div>}
            {order.deposit > 0 && <div><span className="text-muted-foreground">Zaliczka:</span> <span className="font-medium">{fmtNum(order.deposit)} zł | {order.status === "Potwierdzone" ? <span className="text-green-500">zapłacona</span> : <span className="text-red-500">niezapłacona</span>}</span></div>}
            <div><span className="text-muted-foreground">Kwota:</span> <span className="font-medium">{order.amount}</span></div>
            {order.notes && (
              <div className="pt-2 border-t border-border">
                <span className="text-muted-foreground">Uwagi:</span>
                <p className="font-medium mt-1">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3"><CardTitle className="text-base">Pozycje zamówienia</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Produkty</h4>
              <ProductTable items={detailPrimary} />
            </div>
            {detailAddons.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <h4 className="text-sm font-semibold text-foreground mb-2">Dodatki i usługi</h4>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-foreground">Produkt</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Ilość</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Cena jedn.</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Razem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailAddons.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <div>{item.name}</div>
                          <OrderLineDishContents contents={item.dish?.contents} />
                        </TableCell>
                        <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.pricePerUnit.toFixed(2)} zł</TableCell>
                        <TableCell className="text-right font-semibold">{item.total.toFixed(2)} zł</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <Table>
              <TableBody>
                <TableRow className="hover:bg-transparent border-t-2">
                  <TableCell colSpan={3} className="text-right font-semibold text-foreground">
                    {order.discount > 0 ? "Suma pozycji:" : "Suma:"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {order.discount > 0 ? `${fmtNum(order.items.reduce((s, i) => s + i.total, 0))} zł` : order.amount}
                  </TableCell>
                </TableRow>
                {order.discount > 0 && (
                  <>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="text-right font-semibold text-destructive">Rabat:</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">-{fmtNum(order.discount)} zł</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="text-right font-bold text-foreground text-base">Do zapłaty:</TableCell>
                      <TableCell className="text-right font-bold text-primary text-lg">{order.amount}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ===== ORDER EDIT VIEW =====
const OrderEditView = ({ order, onBack, onSave }: { order: Order; onBack: () => void; onSave: (o: Order) => void }) => {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [notes, setNotes] = useState(order.notes);
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress);
  const [items, setItems] = useState<OrderItem[]>(order.items.map(i => ({ ...i })));
  const [discount, setDiscount] = useState(order.discount || 0);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [configuringProduct, setConfiguringProduct] = useState<CatalogProduct | null>(null);
  const catalogProducts = useCatalogProducts();

  const updateItem = (index: number, field: "quantity" | "pricePerUnit", value: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.pricePerUnit;
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product: CatalogProduct) => {
    if ((product.type === "bundle" && product.variants && product.variants.length > 0) ||
        (product.type === "configurable" && product.optionGroups && product.optionGroups.length > 0)) {
      setConfiguringProduct(product);
      return;
    }
    setItems(prev => [...prev, {
      id: product.id,
      name: product.name, quantity: 1, unit: product.unit,
      pricePerUnit: product.defaultPrice, total: product.defaultPrice, type: product.type,
      subItems: null,
    }]);
    setShowAddProduct(false);
    setAddSearch("");
  };

  const handleSubItemConfirm = (subItems: OrderItem["subItems"]) => {
    if (!configuringProduct) return;
    setItems(prev => [...prev, {
      id: configuringProduct.id,
      name: configuringProduct.name, quantity: 1, unit: configuringProduct.unit,
      pricePerUnit: configuringProduct.defaultPrice, total: configuringProduct.defaultPrice,
      type: configuringProduct.type, subItems: subItems ?? null,
    }]);
    setConfiguringProduct(null);
    setShowAddProduct(false);
    setAddSearch("");
  };

  const totalAmount = items.reduce((s, i) => s + i.total, 0);
  const finalAmount = totalAmount - discount;

  const handleSave = () => {
    onSave({
      ...order, status, notes, deliveryAddress, items, discount,
      amount: fmtNum(finalAmount) + " zł",
      amountNum: finalAmount,
    });
  };

  const filteredCatalog = catalogProducts.filter(p =>
    p.name.toLowerCase().includes(addSearch.toLowerCase())
  );

  const primaryRows = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isAddonLineItem(effectiveLineItemType(item)));
  const addonRows = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isAddonLineItem(effectiveLineItemType(item)));

  const renderEditRow = ({ item, index }: { item: OrderItem; index: number }) => (
    <TableRow key={index}>
      <TableCell>
        <div className="space-y-1">
          <span className="font-medium">{item.name}</span>
          <OrderLineDishContents contents={item.dish?.contents} />
          {(item.subItems?.length ?? 0) > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                Szczegóły ({item.subItems!.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-5 pt-1 space-y-2">
                {item.subItems!.map((sub, si) => (
                  <div key={si} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">
                      {sub.name} — {fmtNum(sub.quantity)} {sub.unit}
                    </p>
                    <OrderLineDishContents contents={sub.dish?.contents} />
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center gap-1 justify-center">
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20 h-8 text-center text-sm"
          />
          <span className="text-xs text-muted-foreground">{item.unit}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={item.pricePerUnit}
            onChange={(e) => updateItem(index, "pricePerUnit", Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-28 h-8 text-right text-sm"
          />
          <span className="text-xs text-muted-foreground">zł</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{fmtNum(item.total)} zł</TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => removeItem(index)}
          className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Powrót
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Edycja: {order.id}</h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allStatuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Adres dostawy</CardTitle></CardHeader>
            <CardContent>
              <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Rabat</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="text-right"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">zł</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Uwagi</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Uwagi..." />
            </CardContent>
          </Card>
        </div>

        {/* Items editing */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pozycje zamówienia</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddProduct(!showAddProduct)}>
                {showAddProduct ? <X className="w-4 h-4 mr-1" /> : <span className="mr-1">+</span>}
                {showAddProduct ? "Anuluj" : "Dodaj pozycję"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add product panel */}
            {showAddProduct && (
              <div className="mb-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj produktu..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCatalog.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                    >
                      <span className="font-medium text-foreground">{product.name}</span>
                      <span className="text-muted-foreground text-xs">{fmtNum(product.defaultPrice)} zł / {product.unit}</span>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Nie znaleziono produktów</p>
                  )}
                </div>
                {configuringProduct && (
                  <SubItemSelector product={configuringProduct} onConfirm={handleSubItemConfirm} onCancel={() => setConfiguringProduct(null)} />
                )}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Produkty</h4>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-foreground">Produkt</TableHead>
                      <TableHead className="font-semibold text-foreground text-center w-32">Ilość</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-40">Cena jedn.</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-32">Razem</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{primaryRows.map(renderEditRow)}</TableBody>
                </Table>
              </div>
              {addonRows.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Dodatki i usługi</h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">Produkt</TableHead>
                        <TableHead className="font-semibold text-foreground text-center w-32">Ilość</TableHead>
                        <TableHead className="font-semibold text-foreground text-right w-40">Cena jedn.</TableHead>
                        <TableHead className="font-semibold text-foreground text-right w-32">Razem</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{addonRows.map(renderEditRow)}</TableBody>
                  </Table>
                </div>
              ) : null}
              <Table>
                <TableBody>
                <TableRow className="hover:bg-transparent border-t-2">
                  <TableCell colSpan={3} className="text-right font-semibold text-foreground">Suma pozycji:</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{fmtNum(totalAmount)} zł</TableCell>
                  <TableCell />
                </TableRow>
                {discount > 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="text-right font-semibold text-destructive">Rabat:</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">-{fmtNum(discount)} zł</TableCell>
                    <TableCell />
                  </TableRow>
                )}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="text-right font-bold text-foreground text-base">Do zapłaty:</TableCell>
                  <TableCell className="text-right font-bold text-primary text-lg">{fmtNum(finalAmount)} zł</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave}>
            <Check className="w-4 h-4 mr-1" />
            Zapisz zmiany
          </Button>
          <Button variant="outline" onClick={onBack}>Anuluj</Button>
        </div>
      </div>
    </div>
  );
};

// ===== SUMMARY SHEET =====
const summaryDocLabels: Record<SummaryDocType, { label: string; Icon: LucideIcon }> = {
  "zamowienia": { label: "Lista zamówień", Icon: FileText },
  "lista-dan": { label: "Lista dań", Icon: CookingPot },
  "food-cost": { label: "Food cost", Icon: Calculator },
  // TODO: Change to "Lista zakupów" when implemented
  "full": { label: "Lista zakupów", Icon: ClipboardList },
};

const parseSimpleDate = (dateStr: string): Date | null => {
  const months: Record<string, number> = {
    "sty": 0, "lut": 1, "mar": 2, "kwi": 3, "maj": 4, "cze": 5,
    "lip": 6, "sie": 7, "wrz": 8, "paź": 9, "lis": 10, "gru": 11,
  };
  const parts = dateStr.trim().split(" ");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0]);
  const month = months[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
};

const SummarySheet = ({ open, onClose, orders }: { open: boolean; onClose: () => void; orders: Order[] }) => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [docType, setDocType] = useState<SummaryDocType>("zamowienia");

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    if (!matchStatus) return false;
    if (dateFrom || dateTo) {
      const orderDate = parseSimpleDate(o.date);
      if (!orderDate) return true;
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
    }
    return true;
  });

  const handleDownload = async () => {
    const dateFromStr = dateFrom ? dateFrom.toLocaleDateString("pl-PL") : "";
    const dateToStr = dateTo ? dateTo.toLocaleDateString("pl-PL") : "";
    const dateRange = dateFromStr || dateToStr ? `${dateFromStr} - ${dateToStr}` : "Wszystkie daty";
    await generateSummaryPdf(filteredOrders, docType, dateRange);
    toast.success("PDF pobrany");
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Generuj podsumowanie</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Date range */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Zakres dat
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Od</Label>
                <Input
                  type="date"
                  value={dateFrom ? dateFrom.toISOString().slice(0, 10) : ""}
                  onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Do</Label>
                <Input
                  type="date"
                  value={dateTo ? dateTo.toISOString().slice(0, 10) : ""}
                  onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Status zamówień</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                {allStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Document type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Rodzaj dokumentu</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(summaryDocLabels) as SummaryDocType[]).map(type => {
                const { label, Icon } = summaryDocLabels[type];
                const isSelected = docType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setDocType(type)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("font-medium", isSelected && "text-foreground")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview count */}
          <div className="px-4 py-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Zamówień w zakresie: </span>
            <span className="font-semibold text-foreground">{filteredOrders.length}</span>
            <span className="text-muted-foreground"> · Łączna kwota: </span>
            <span className="font-semibold text-primary">{fmtNum(filteredOrders.reduce((s, o) => s + o.amountNum, 0))} zł</span>
          </div>

          {/* Download */}
          <Button className="w-full" size="lg" onClick={handleDownload} disabled={filteredOrders.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Pobierz {summaryDocLabels[docType].label} (PDF)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ===== INLINE EDITABLE CELL COMPONENTS =====
const InlineStatusSelect = ({ value, onChange }: { value: OrderStatus; onChange: (v: OrderStatus) => void }) => (
  <div onClick={(e) => e.stopPropagation()}>
    <Select value={value} onValueChange={(v) => onChange(v as OrderStatus)}>
      <SelectTrigger className="h-7 text-xs w-[130px] border-transparent bg-transparent hover:border-border focus:border-border transition-colors">
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", statusColors[value])}>
          {value}
        </span>
      </SelectTrigger>
      <SelectContent>
        {allStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", statusColors[s])}>
              {s}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const InlineEventSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div onClick={(e) => e.stopPropagation()}>
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="h-7 text-xs w-[100px] border-transparent bg-transparent hover:border-border focus:border-border transition-colors text-muted-foreground">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Brak —</SelectItem>
        {useAdminEventTypes().map((e) => (
          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const InlineAmountInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value.toString());

  const commit = () => {
    const num = parseFloat(tempVal.replace(",", "."));
    if (!isNaN(num) && num >= 0) onChange(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={tempVal}
          onChange={(e) => setTempVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 text-xs w-[100px] font-semibold"
        />
      </div>
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setTempVal(value.toString()); setEditing(true); }}
      className="font-semibold text-foreground cursor-text hover:bg-muted/50 px-1.5 py-0.5 rounded transition-colors"
      title="Kliknij aby edytować"
    >
      {fmtNum(value)} zł
    </span>
  );
};


export const formatOrderDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
export const formatOrderTime = (timeStr: string | null) => {
  if (!timeStr) return "—";
  const t = new Date(timeStr).getUTCHours().toString().padStart(2, "0") + ":" + new Date(timeStr).getUTCMinutes().toString().padStart(2, "0");
  return t;
};

// ===== MAIN VIEW =====
const OrdersView = () => {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "detail" | "edit" | "document">("list");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<OrderDocumentType>("offer");
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const ordersListScrollRef = useRef<HTMLDivElement>(null);
  const ordersListDragRef = useRef({ active: false, moved: false, startX: 0, startScrollLeft: 0 });
  const suppressOrdersListRowClickRef = useRef(false);
  const ordersListPointerXRef = useRef(0);
  const ordersListScrollRafRef = useRef(0);
  /** Bez setPointerCapture — przechwytuje zdarzenia i psuje Radix Select w portalu. */
  const ordersListWinDragCleanupRef = useRef<(() => void) | null>(null);
  const [ordersListShowHScrollbar, setOrdersListShowHScrollbar] = useState(false);
  const [ordersListDragScrolling, setOrdersListDragScrolling] = useState(false);

  const clearOrdersListWinDragListeners = useCallback(() => {
    const off = ordersListWinDragCleanupRef.current;
    if (off) {
      ordersListWinDragCleanupRef.current = null;
      off();
    }
  }, []);

  const applyOrdersListDragScroll = useCallback(() => {
    ordersListScrollRafRef.current = 0;
    const d = ordersListDragRef.current;
    const el = ordersListScrollRef.current;
    if (!d.active || !el) return;
    const x = ordersListPointerXRef.current;
    const dx = x - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) <= 5) return;
      d.moved = true;
      setOrdersListDragScrolling(true);
      setOrdersListShowHScrollbar(true);
    }
    el.scrollLeft = d.startScrollLeft - dx;
  }, []);

  const endOrdersListDrag = useCallback(
    (didMove: boolean) => {
      clearOrdersListWinDragListeners();
      if (ordersListScrollRafRef.current) {
        cancelAnimationFrame(ordersListScrollRafRef.current);
        ordersListScrollRafRef.current = 0;
      }
      const wrap = ordersListScrollRef.current;
      if (wrap) wrap.style.userSelect = "";
      const d = ordersListDragRef.current;
      d.active = false;
      d.moved = false;
      setOrdersListDragScrolling(false);
      window.setTimeout(() => setOrdersListShowHScrollbar(false), didMove ? 700 : 250);
    },
    [clearOrdersListWinDragListeners]
  );

  useEffect(
    () => () => {
      clearOrdersListWinDragListeners();
      if (ordersListScrollRafRef.current) cancelAnimationFrame(ordersListScrollRafRef.current);
    },
    [clearOrdersListWinDragListeners]
  );

  const onOrdersListPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (
      t.closest(
        "button, a, input, textarea, select, [role='combobox'], [role='listbox'], [role='option'], [data-radix-select-viewport], [data-radix-popper-content-wrapper], [data-slot='select-trigger']"
      )
    ) {
      return;
    }
    const el = ordersListScrollRef.current;
    if (!el) return;
    clearOrdersListWinDragListeners();
    ordersListDragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };
    ordersListPointerXRef.current = e.clientX;
    el.style.userSelect = "none";

    const pid = e.pointerId;
    const onWinMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid || !ordersListDragRef.current.active) return;
      ordersListPointerXRef.current = ev.clientX;
      if (!ordersListScrollRafRef.current) {
        ordersListScrollRafRef.current = requestAnimationFrame(applyOrdersListDragScroll);
      }
      if (ordersListDragRef.current.moved && ev.cancelable) ev.preventDefault();
    };
    const onWinUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (!ordersListDragRef.current.active) return;
      const didMove = ordersListDragRef.current.moved;
      if (didMove) suppressOrdersListRowClickRef.current = true;
      endOrdersListDrag(didMove);
    };

    ordersListWinDragCleanupRef.current = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    };
    window.addEventListener("pointermove", onWinMove, { passive: false });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const dbOrders = await api.getAdminOrders();
      if (!dbOrders || dbOrders.length === 0) return;
      const mapped: Order[] = dbOrders.map((o) => mapAdminApiOrderToOrder(o, formatOrderDate, formatOrderTime, fmtNum));

      setOrders(mapped);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initial data fetch on mount */
    void fetchOrders();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchOrders]);
  const filtered = orders.filter((o) => {
    const q = search.toLowerCase().trim();
    const cateringLabel = formatCateringTypeLabel(o.cateringType).toLowerCase();
    const submittedUtc = o.createdAt;
    const submittedRaw = (o.createdAt ?? "").toLowerCase();
    const matchSearch = !q ||
      o.id.toLowerCase().includes(q) ||
      o.client.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      o.event.toLowerCase().includes(q) ||
      o.date.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      o.amount.toLowerCase().includes(q) ||
      o.deliveryAddress.toLowerCase().includes(q) ||
      o.notes.toLowerCase().includes(q) ||
      cateringLabel.includes(q) ||
      (o.cateringType != null && o.cateringType.toLowerCase().includes(q)) ||
      submittedUtc.includes(q) ||
      submittedRaw.includes(q) ||
      o.items.some(item => item.name.toLowerCase().includes(q));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openDetail = (order: Order) => { setSelectedOrder(order); setView("detail"); };
  const openEdit = (order: Order) => { setSelectedOrder(order); setView("edit"); };
  const goBack = () => { setView("list"); setSelectedOrder(null); };

  const handleLinkClient = async (orderDbId: string, clientId: string) => {
    if (orderDbId) {
      try {
        await api.updateAdminOrder(orderDbId, { clientId });
      } catch {
        toast.error("Błąd powiązania klienta");
        return;
      }
    }
    setOrders((prev) => prev.map((o) => (o.dbId === orderDbId ? { ...o, clientId } : o)));
    if (selectedOrder?.dbId === orderDbId) {
      setSelectedOrder((prev) => (prev ? { ...prev, clientId } : prev));
    }
    toast.success("Klient powiązany z zamówieniem");
  };

  const updateOrderField = (orderId: string, field: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...field } : o));
  };

  const handleSaveOrder = async (updated: Order) => {
    setOrders(orders.map((o) => o.id === updated.id ? updated : o));
    setSelectedOrder(updated);
    setView("detail");

    if (updated.dbId) {
      try {
        await api.updateAdminOrder(updated.dbId, {
          status: updated.status,
          notes: updated.notes,
          deliveryAddress: updated.deliveryAddress,
          amount: updated.amountNum,
          discount: updated.discount,
          deposit: updated.deposit,
          orderItems: updated.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            total: item.total,
            itemType: item.type || "simple",
            foodCostPerUnit: item.foodCostPerUnit ?? 0,
            ...(item.dishId ? { dishId: item.dishId } : {}),
            subItems: (item.subItems ?? []).map((sub) => ({
              name: sub.name,
              quantity: sub.quantity,
              unit: sub.unit,
              converter: sub.converter ?? 1,
              optionConverter: sub.optionConverter ?? 1,
              groupConverter: sub.groupConverter ?? 1,
              foodCostPerUnit: sub.foodCostPerUnit ?? 0,
              pricePerUnit: sub.pricePerUnit ?? 0,
              ...(sub.dishId ? { dishId: sub.dishId } : {}),
            })),
          })),
        });
        toast.success("Zamówienie zapisane");
      } catch {
        toast.error("Błąd zapisu zamówienia");
      }
    }
  };
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await api.deleteAdminOrder(orderId);
    
      await fetchOrders();
      toast.success("Zamówienie usunięte");
    } catch {
      toast.error("Błąd usuwania zamówienia");
    }
  };

  const handleGenerateDoc = (type: OrderDocumentType) => {
    setSelectedDocType(type);
    setView("document");
  };
  if (view === "document" && selectedOrder) {
    return <OrderDocumentView order={selectedOrder} docType={selectedDocType} onBack={() => setView("detail")} />;
  }

  if (view === "detail" && selectedOrder) {
    return <OrderDetailView order={selectedOrder} onBack={goBack} onEdit={() => setView("edit")} onGenerateDoc={handleGenerateDoc} onLinkClient={handleLinkClient} />;
  }

  if (view === "edit" && selectedOrder) {
    return <OrderEditView order={selectedOrder} onBack={() => setView("detail")} onSave={handleSaveOrder} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zamówienia</h1>
          <p className="text-muted-foreground text-sm">Zarządzaj zamówieniami cateringowymi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSummary(true)}>
            <FileDown className="w-4 h-4 mr-1" />
            Generuj podsumowanie
          </Button>
          <Button className="gap-2" onClick={() => setShowAddOrder(true)}>
            <Plus className="w-4 h-4" />
            Dodaj zamówienie
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Szukaj zamówień..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Wszystkie statusy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {allStatuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div
          ref={ordersListScrollRef}
          role="region"
          aria-label="Lista zamówień — przewijanie w poziomie przeciągnięciem"
          title="Przeciągnij w poziomie, aby przewinąć tabelę"
          onPointerDown={onOrdersListPointerDown}
          className={cn(
            "relative w-full overflow-x-auto overflow-y-hidden",
            ordersListDragScrolling && "cursor-grabbing select-none",
            !ordersListDragScrolling && "cursor-grab",
            ordersListShowHScrollbar ? ordersListScrollbarVisible : ordersListScrollbarHidden
          )}
        >
          <table className="w-full min-w-[1320px] caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-foreground">Nr zamówienia</TableHead>
                <TableHead className="font-semibold text-foreground">Typ kateringu</TableHead>
                <TableHead className="font-semibold text-foreground">Klient</TableHead>
                <TableHead className="font-semibold text-foreground whitespace-nowrap">Data wpłynięcia</TableHead>
                <TableHead className="font-semibold text-foreground">Wydarzenie</TableHead>
                <TableHead className="font-semibold text-foreground whitespace-nowrap">Data</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Kwota</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className={cn("font-semibold text-foreground text-center", ordersListStickyActionHeadClass)}>
                  Akcje
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow
                  key={order.id}
                  className="group/ordRow cursor-pointer"
                  onClick={() => {
                    if (suppressOrdersListRowClickRef.current) {
                      suppressOrdersListRowClickRef.current = false;
                      return;
                    }
                    openDetail(order);
                  }}
                >
                  <TableCell className="font-mono text-sm text-muted-foreground">{order.id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCateringTypeLabel(order.cateringType)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">{order.client}</div>
                      <div className="text-xs text-muted-foreground">{order.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {order.createdAt}
                  </TableCell>
                  <TableCell>
                    <InlineEventSelect
                      value={order.event}
                      onChange={(v) => updateOrderField(order.id, { event: v })}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{order.date}</TableCell>
                  <TableCell>
                    <InlineAmountInput
                      value={order.amountNum}
                      onChange={(v) => updateOrderField(order.id, { amountNum: v, amount: fmtNum(v) + " zł" })}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineStatusSelect
                      value={order.status}
                      onChange={(v) => updateOrderField(order.id, { status: v })}
                    />
                  </TableCell>
                  <TableCell className={ordersListStickyActionCellClass}>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openDetail(order)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => openEdit(order)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDeleteOrder(order.dbId)} className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </div>

      <AddOrderSheet
        open={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        onCreated={(order) => setOrders((prev) => [order, ...prev])}
        onRefresh={fetchOrders}
      />

      <SummarySheet
        open={showSummary}
        onClose={() => setShowSummary(false)}
        orders={orders}
      />
    </div>
  );
};

export default OrdersView;
