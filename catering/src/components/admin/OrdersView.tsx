import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "@/api/client";
import { Search, Eye, Pencil, Trash2, ChevronDown, ArrowLeft, FileText, ShoppingCart, X, Check, Calculator, FileDown, CookingPot, ClipboardList, Plus, User, CalendarDays, MapPin, MessageSquare, Download, Clock, ChevronRight, Loader2, CheckCircle2, AlertCircle, Truck } from "lucide-react";
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
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { FullscreenDateTimePicker } from "@/components/catering/FullscreenDateTimePicker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  effectiveLineItemType,
  isAddonLineItem,
  isExpandableLineItem,
  isFoodCostEligibleLineItem,
  splitPrimaryAndAddonItems,
} from "@/lib/orderLineItems";
import { adminOrderItemToPdfLineItem } from "@/lib/pdfOrderMappers";
import type {
  DbClient,
  FoodCostExtra,
  Order,
  OrderDocumentType,
  OrderStatus,
  PdfOrderLineItem,
} from "@/types/orders";

type OrderItem = PdfOrderLineItem;

const statusColors: Record<OrderStatus, string> = {
  "Nowe zamówienie": "bg-blue-50 text-blue-700 border-blue-200",
  "Nowa oferta": "bg-purple-50 text-purple-700 border-purple-200",
  "Potwierdzone": "bg-green-50 text-green-700 border-green-200",
  "W realizacji": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Zrealizowane": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Anulowane": "bg-red-50 text-red-700 border-red-200",
};

const allStatuses: OrderStatus[] = ["Nowe zamówienie", "Nowa oferta", "Potwierdzone", "W realizacji", "Zrealizowane", "Anulowane"];

const mockOrders: Order[] = [
  {
    id: "ZAM-KOC8L7K", dbId: "", clientId: null, client: "Anna Kowalska", email: "anna.k@email.pl", phone: "+48 500 111 222",
    event: "Urodziny", date: "28 sty 2026", deliveryAddress: "ul. Kwiatowa 5, Warszawa",
    amount: "2 211,00 zł", amountNum: 2211, status: "Nowe zamówienie", notes: "Bez orzechów - alergia",
    createdAt: "15 sty 2026", deliveryCost: 50, guestCount: 30, discount: 0,
    items: [
      { name: "Patera Serów Europejskich", quantity: 2, unit: "szt.", pricePerUnit: 450, total: 900, type: "simple", foodCostPerUnit: 135,
        subItems: [
          { name: "Brie francuski", quantity: 300, unit: "g", foodCostPerUnit: 0.045 },
          { name: "Camembert z ziołami", quantity: 300, unit: "g", foodCostPerUnit: 0.04 },
          { name: "Gouda długo dojrzewająca", quantity: 400, unit: "g", foodCostPerUnit: 0.035 },
          { name: "Roquefort", quantity: 200, unit: "g", foodCostPerUnit: 0.08 },
          { name: "Winogrona", quantity: 400, unit: "g", foodCostPerUnit: 0.012 },
          { name: "Orzechy włoskie", quantity: 200, unit: "g", foodCostPerUnit: 0.06 },
          { name: "Miód akacjowy", quantity: 100, unit: "ml", foodCostPerUnit: 0.04 },
        ]
      },
      { name: "Patera Wędlin Premium", quantity: 1, unit: "szt.", pricePerUnit: 520, total: 520, type: "simple", foodCostPerUnit: 180,
        subItems: [
          { name: "Szynka parmeńska", quantity: 200, unit: "g", foodCostPerUnit: 0.12 },
          { name: "Salami Milano", quantity: 150, unit: "g", foodCostPerUnit: 0.06 },
          { name: "Chorizo Iberico", quantity: 150, unit: "g", foodCostPerUnit: 0.07 },
          { name: "Oliwki Kalamata", quantity: 150, unit: "g", foodCostPerUnit: 0.03 },
        ]
      },
      { name: "Mini Burgery", quantity: 20, unit: "szt.", pricePerUnit: 15, total: 300, type: "bundle", foodCostPerUnit: 5.5,
        subItems: [
          { name: "Mini Burger Klasyczny", quantity: 12, unit: "szt.", foodCostPerUnit: 5.5 },
          { name: "Mini Burger Vege", quantity: 8, unit: "szt.", foodCostPerUnit: 4.2 },
        ]
      },
      { name: "Sushi Nigiri Sake", quantity: 30, unit: "szt.", pricePerUnit: 8, total: 240, type: "simple", foodCostPerUnit: 3.2 },
      { name: "Obsługa kelnerska 4h", quantity: 1, unit: "szt.", pricePerUnit: 251, total: 251, type: "service" },
    ],
  },
  {
    id: "ZAM-KOC01SQ", dbId: "", clientId: null, client: "Jan Nowak", email: "jan.nowak@email.pl", phone: "+48 600 333 444",
    event: "", date: "21 sty 2026", deliveryAddress: "ul. Długa 12, Kraków",
    amount: "350,00 zł", amountNum: 350, status: "Potwierdzone", notes: "",
    createdAt: "10 sty 2026", deliveryCost: 0, guestCount: 10, discount: 0,
    items: [
      { name: "Antipasto Włoskie", quantity: 1, unit: "szt.", pricePerUnit: 350, total: 350 },
    ],
  },
  {
    id: "ZAM-KOC5CJA", dbId: "", clientId: null, client: "Maria Wiśniewska", email: "maria.w@email.pl", phone: "+48 700 555 666",
    event: "Wesele", date: "28 sty 2026", deliveryAddress: "Dworek pod Lipami, Piaseczno",
    amount: "3 276,00 zł", amountNum: 3276, status: "Zrealizowane", notes: "Dekoracja stołu premium",
    createdAt: "5 sty 2026", deliveryCost: 0, guestCount: 30, discount: 0,
    items: [
      { name: "Zestaw nr 2 Premium", quantity: 30, unit: "os.", pricePerUnit: 95, total: 2850, type: "configurable", foodCostPerUnit: 32,
        subItems: [
          { name: "Polędwica wołowa z sosem z zielonym pieprzem", quantity: 30, unit: "os.", foodCostPerUnit: 12 },
          { name: "Łosoś grillowany z masłem czosnkowym", quantity: 30, unit: "os.", foodCostPerUnit: 9 },
          { name: "Carpaccio z polędwicy", quantity: 30, unit: "os.", foodCostPerUnit: 6 },
          { name: "Crème brûlée", quantity: 30, unit: "os.", foodCostPerUnit: 3 },
          { name: "Fondant czekoladowy", quantity: 30, unit: "os.", foodCostPerUnit: 2 },
        ]
      },
      { name: "Dekoracja stołu", quantity: 3, unit: "szt.", pricePerUnit: 142, total: 426, type: "extra", foodCostPerUnit: 45 },
    ],
  },
  {
    id: "ZAM-KOC1RA9", dbId: "", clientId: null, client: "Piotr Zieliński", email: "piotr.z@email.pl", phone: "+48 800 777 888",
    event: "", date: "21 sty 2026", deliveryAddress: "ul. Polna 8, Gdańsk",
    amount: "246,00 zł", amountNum: 246, status: "Anulowane", notes: "Klient zrezygnował",
    createdAt: "8 sty 2026", deliveryCost: 30, guestCount: 12, discount: 0,
    items: [
      { name: "Tacos z kurczakiem", quantity: 12, unit: "szt.", pricePerUnit: 18, total: 216, type: "simple", foodCostPerUnit: 6 },
      { name: "Opakowanie jednorazowe", quantity: 1, unit: "szt.", pricePerUnit: 30, total: 30, type: "extra", foodCostPerUnit: 8 },
    ],
  },
  {
    id: "ZAM-KOC0MII", dbId: "", clientId: null, client: "Katarzyna Wójcik", email: "k.wojcik@email.pl", phone: "+48 500 999 000",
    event: "Stypa", date: "26 sty 2026", deliveryAddress: "ul. Cicha 3, Warszawa",
    amount: "402,00 zł", amountNum: 402, status: "Zrealizowane", notes: "",
    createdAt: "12 sty 2026", deliveryCost: 0, guestCount: 15, discount: 0,
    items: [
      { name: "Patera Serów Europejskich", quantity: 1, unit: "szt.", pricePerUnit: 450, total: 450, type: "simple", foodCostPerUnit: 135,
        subItems: [
          { name: "Brie francuski", quantity: 150, unit: "g", foodCostPerUnit: 0.045 },
          { name: "Camembert z ziołami", quantity: 150, unit: "g", foodCostPerUnit: 0.04 },
          { name: "Gouda długo dojrzewająca", quantity: 200, unit: "g", foodCostPerUnit: 0.035 },
          { name: "Roquefort", quantity: 100, unit: "g", foodCostPerUnit: 0.08 },
          { name: "Winogrona", quantity: 200, unit: "g", foodCostPerUnit: 0.012 },
          { name: "Orzechy włoskie", quantity: 100, unit: "g", foodCostPerUnit: 0.06 },
          { name: "Miód akacjowy", quantity: 50, unit: "ml", foodCostPerUnit: 0.04 },
        ]
      },
    ],
  },
  {
    id: "ZAM-KOCX6J3", dbId: "", clientId: null, client: "Tomasz Kamiński", email: "t.kaminski@email.pl", phone: "+48 600 111 333",
    event: "Impreza firmowa", date: "13 sty 2026", deliveryAddress: "Biurowiec Centrum, al. Jerozolimskie 100",
    amount: "14 970,00 zł", amountNum: 14970, status: "Potwierdzone", notes: "Faktura na firmę",
    createdAt: "2 sty 2026", deliveryCost: 120, guestCount: 100, discount: 0,
    items: [
      { name: "Zestaw nr 2 Premium", quantity: 100, unit: "os.", pricePerUnit: 95, total: 9500, type: "configurable", foodCostPerUnit: 32,
        subItems: [
          { name: "Polędwica wołowa z sosem z zielonym pieprzem", quantity: 100, unit: "os.", foodCostPerUnit: 12 },
          { name: "Kaczka konfitowana z jabłkami", quantity: 100, unit: "os.", foodCostPerUnit: 10 },
          { name: "Tatar z łososia z awokado", quantity: 100, unit: "os.", foodCostPerUnit: 6 },
          { name: "Crème brûlée", quantity: 100, unit: "os.", foodCostPerUnit: 3 },
          { name: "Panna cotta z malinami", quantity: 100, unit: "os.", foodCostPerUnit: 2.5 },
        ]
      },
      { name: "Obsługa kelnerska 8h", quantity: 3, unit: "szt.", pricePerUnit: 450, total: 1350, type: "service" },
      { name: "Patera Owoców Morza", quantity: 5, unit: "szt.", pricePerUnit: 680, total: 3400, type: "simple", foodCostPerUnit: 220,
        subItems: [
          { name: "Krewetki tygrysie", quantity: 1500, unit: "g", foodCostPerUnit: 0.09 },
          { name: "Łosoś wędzony", quantity: 1000, unit: "g", foodCostPerUnit: 0.06 },
          { name: "Tuńczyk sashimi", quantity: 750, unit: "g", foodCostPerUnit: 0.1 },
          { name: "Kawior czerwony", quantity: 250, unit: "g", foodCostPerUnit: 0.25 },
        ]
      },
      { name: "Dekoracja stołu", quantity: 5, unit: "szt.", pricePerUnit: 142, total: 710, type: "extra", foodCostPerUnit: 45 },
    ],
  },
  {
    id: "ZAM-KOC3UTX", dbId: "", clientId: null, client: "Agnieszka Lewandowska", email: "a.lew@email.pl", phone: "+48 700 222 444",
    event: "Impreza firmowa", date: "20 sty 2026", deliveryAddress: "Hotel Marriott, Warszawa",
    amount: "4 648,00 zł", amountNum: 4648, status: "W realizacji", notes: "",
    createdAt: "6 sty 2026", deliveryCost: 0, guestCount: 50, discount: 0,
    items: [
      { name: "Zestaw nr 1 Klasyczny", quantity: 50, unit: "os.", pricePerUnit: 70, total: 3500, type: "configurable", foodCostPerUnit: 22,
        subItems: [
          { name: "Roladki z indyka ze szpinakiem", quantity: 50, unit: "os.", foodCostPerUnit: 8 },
          { name: "Staropolski schabowy", quantity: 50, unit: "os.", foodCostPerUnit: 6 },
          { name: "Ziemniaki opiekane z rozmarynem", quantity: 50, unit: "os.", foodCostPerUnit: 2 },
          { name: "Ryż z warzywami", quantity: 50, unit: "os.", foodCostPerUnit: 1.5 },
          { name: "Sałatka grecka", quantity: 50, unit: "os.", foodCostPerUnit: 3 },
        ]
      },
      { name: "Patera Serów Europejskich", quantity: 2, unit: "szt.", pricePerUnit: 450, total: 900, type: "simple", foodCostPerUnit: 135 },
      { name: "Opakowanie jednorazowe", quantity: 1, unit: "szt.", pricePerUnit: 248, total: 248, type: "extra", foodCostPerUnit: 60 },
    ],
  },
];

// ===== DOCUMENT TYPES =====
const docLabels: Record<OrderDocumentType, { label: string; Icon: LucideIcon }> = {
  "offer": { label: "Oferta", Icon: FileText },
  "kitchen": { label: "Rozpiska na kuchnię", Icon: CookingPot },
  "food-cost": { label: "Food cost", Icon: Calculator },
  "full": { label: "Wszystko w jednym", Icon: ClipboardList },
};

const fmtNum = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  type KitchenDishRow = { name: string; totalQty: number; unit: string; source: string };
  const dishMap: Record<string, KitchenDishRow> = {};
  order.items.forEach((item) => {
    const t = effectiveLineItemType(item);
    if (isAddonLineItem(t)) return;
    if (isExpandableLineItem(t) && item.subItems) {
      item.subItems.forEach((sub) => {
        const key = sub.name;
        if (!dishMap[key]) dishMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit, source: item.name };
        dishMap[key].totalQty += sub.quantity;
      });
    } else {
      const key = item.name;
      if (!dishMap[key]) dishMap[key] = { name: item.name, totalQty: 0, unit: item.unit, source: "" };
      dishMap[key].totalQty += item.quantity;
    }
  });
  const kitchenDishes = Object.values(dishMap).sort((a, b) => a.name.localeCompare(b.name, "pl"));

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
            <CardDescription>{order.client} · {order.event || "Wydarzenie"} · {order.date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1 mb-4">
              <p><span className="text-muted-foreground">Adres dostawy:</span> {order.deliveryAddress}</p>
              {order.notes && <p><span className="text-muted-foreground">Uwagi:</span> {order.notes}</p>}
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Produkty</h4>
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
                    {offerPrimary.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtNum(item.pricePerUnit)} zł</TableCell>
                        <TableCell className="text-right font-semibold">{fmtNum(item.total)} zł</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.name}</TableCell>
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
                    <TableHead className="font-semibold text-foreground">Źródło</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitchenDishes.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {d.totalQty} {d.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.source || "—"}</TableCell>
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
                    <TableCell className="font-medium">{item.name}</TableCell>
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
          <p className="text-muted-foreground text-sm">Utworzono: {order.createdAt}</p>
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
            <div><span className="text-muted-foreground">Adres dostawy:</span> <span className="font-medium">{order.deliveryAddress}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Podsumowanie</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Pozycji:</span> <span className="font-medium">{order.items.length}</span></div>
            {order.guestCount > 0 && <div><span className="text-muted-foreground">Gości:</span> <span className="font-medium">{order.guestCount}</span></div>}
            {order.deliveryCost > 0 && <div><span className="text-muted-foreground">Dostawa:</span> <span className="font-medium">{fmtNum(order.deliveryCost)} zł</span></div>}
            <div><span className="text-muted-foreground">Kwota:</span> <span className="font-semibold text-primary text-lg">{order.amount}</span></div>
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
                  {detailPrimary.map((item, i) => {
                    if(item.subItems && item.subItems.length > 0) {
                      return item.subItems.map((subItem, j) => (
                        <>
                        <TableRow key={`${i}-${j}`}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.pricePerUnit.toFixed(2)} zł</TableCell>
                          <TableCell className="text-right font-semibold">{item.total.toFixed(2)} zł</TableCell>
                        </TableRow>
                        <TableRow key={`${i}-${j}`}>
                          <TableCell className="font-medium">{subItem.name}</TableCell>
                          <TableCell className="text-center">{subItem.quantity} {subItem.unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{subItem.foodCostPerUnit?.toFixed(2) ?? "0.00"} zł</TableCell>
                          {/* <TableCell className="text-right font-semibold">{(subItem.pricePerUnit * subItem.quantity).toFixed(2)} zł</TableCell> */}
                        </TableRow>
                        </>
                      ));
                    }
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.pricePerUnit.toFixed(2)} zł</TableCell>
                        <TableCell className="text-right font-semibold">{item.total.toFixed(2)} zł</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                        <TableCell className="font-medium">{item.name}</TableCell>
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

// ===== DYNAMIC PRODUCT CATALOG =====
type CatalogProduct = { id: string; name: string; unit: string; defaultPrice: number; type: string; variants?: { id: string; name: string; price: number }[]; optionGroups?: { id: string; name: string; minSelections: number; maxSelections: number; options: { id: string; name: string }[] }[] };

function useCatalogProducts() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    api.getAdminCatalog().then((data) => {
      const items: CatalogProduct[] = [];
      for (const d of data.dishes ?? []) {
        items.push({ id: d.id, name: d.name, unit: d.unit_label || "szt.", defaultPrice: Number(d.price_per_unit ?? d.price_brutto), type: "simple" });
      }
      for (const b of data.bundles ?? []) {
        const variants = (b.bundle_variants ?? []).sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ id: v.id, name: v.name, price: v.price }));
        items.push({ id: b.id, name: b.name, unit: "szt.", defaultPrice: Number(b.base_price), type: "bundle", variants });
      }
      for (const s of data.configurable_sets ?? []) {
        const optionGroups = (s.config_groups ?? []).sort((a, b) => a.sort_order - b.sort_order).map((g) => ({
          id: g.id, name: g.name, minSelections: g.min_selections, maxSelections: g.max_selections,
          options: (g.config_group_options ?? []).sort((a, b) => a.sort_order - b.sort_order).map((o) => ({ id: o.id, name: o.name })),
        }));
        items.push({ id: s.id, name: s.name, unit: "os.", defaultPrice: Number(s.price_per_person), type: "configurable", optionGroups });
      }
      for (const e of data.extras ?? []) {
        const t = e.category === "obsluga" ? "service" as const : "extra" as const;
        items.push({ id: e.id, name: e.name, unit: e.unit_label || "szt.", defaultPrice: Number(e.price), type: t });
      }
      setCatalog(items);
    }).catch(console.error);
  }, []);
  return catalog;
}

// ===== SUB-ITEM SELECTOR (for bundles & configurable sets) =====
const SubItemSelector = ({ product, onConfirm, onCancel }: {
  product: CatalogProduct;
  onConfirm: (subItems: OrderItem["subItems"]) => void;
  onCancel: () => void;
}) => {
  // For bundles: select which variants
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  // For configurable: select options per group
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

  if (product.type === "bundle" && product.variants) {
    const handleConfirm = () => {
      const subs = Object.entries(selectedVariants)
        .filter(([, qty]) => qty > 0)
        .map(([vId, qty]) => {
          const v = product.variants!.find(v => v.id === vId)!;
          return { name: v.name, quantity: qty, unit: "szt." };
        });
      onConfirm(subs);
    };
    return (
      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 mt-2">
        <p className="text-sm font-semibold text-foreground">Wybierz warianty: {product.name}</p>
        {product.variants.map(v => (
          <div key={v.id} className="flex items-center justify-between gap-2">
            <span className="text-sm flex-1">{v.name} <span className="text-muted-foreground text-xs">({fmtNum(v.price)} zł)</span></span>
            <Input type="number" min={0} value={selectedVariants[v.id] || 0}
              onChange={(e) => setSelectedVariants(prev => ({ ...prev, [v.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-16 h-7 text-xs text-center" />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleConfirm} disabled={Object.values(selectedVariants).every(q => q === 0)}>
            <Check className="w-3 h-3 mr-1" />Dodaj
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
        </div>
      </div>
    );
  }

  if (product.type === "configurable" && product.optionGroups) {
    const toggleOption = (groupId: string, optionId: string, maxSel: number) => {
      setSelectedOptions(prev => {
        const current = prev[groupId] || [];
        if (current.includes(optionId)) return { ...prev, [groupId]: current.filter(id => id !== optionId) };
        if (current.length >= maxSel) return prev;
        return { ...prev, [groupId]: [...current, optionId] };
      });
    };
    const handleConfirm = () => {
      const subs: OrderItem["subItems"] = [];
      for (const g of product.optionGroups!) {
        const ids = selectedOptions[g.id] || [];
        for (const id of ids) {
          const opt = g.options.find(o => o.id === id);
          if (opt) subs!.push({ name: `${g.name}: ${opt.name}`, quantity: 1, unit: "szt." });
        }
      }
      onConfirm(subs);
    };
    const allGroupsSatisfied = product.optionGroups.every(g => (selectedOptions[g.id] || []).length >= g.minSelections);
    return (
      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3 mt-2">
        <p className="text-sm font-semibold text-foreground">Konfiguruj: {product.name}</p>
        {product.optionGroups.map(g => (
          <div key={g.id}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{g.name} (min {g.minSelections}, max {g.maxSelections})</p>
            <div className="flex flex-wrap gap-1.5">
              {g.options.map(o => {
                const isSelected = (selectedOptions[g.id] || []).includes(o.id);
                return (
                  <button key={o.id} onClick={() => toggleOption(g.id, o.id, g.maxSelections)}
                    className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors",
                      isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                    )}
                  >{o.name}</button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleConfirm} disabled={!allGroupsSatisfied}>
            <Check className="w-3 h-3 mr-1" />Dodaj
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
        </div>
      </div>
    );
  }

  return null;
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
      name: product.name, quantity: 1, unit: product.unit,
      pricePerUnit: product.defaultPrice, total: product.defaultPrice, type: product.type,
    }]);
    setShowAddProduct(false);
    setAddSearch("");
  };

  const handleSubItemConfirm = (subItems: OrderItem["subItems"]) => {
    if (!configuringProduct) return;
    setItems(prev => [...prev, {
      name: configuringProduct.name, quantity: 1, unit: configuringProduct.unit,
      pricePerUnit: configuringProduct.defaultPrice, total: configuringProduct.defaultPrice,
      type: configuringProduct.type, subItems,
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
          {(item.subItems?.length ?? 0) > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                Szczegóły ({item.subItems!.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-5 pt-1 space-y-1">
                {item.subItems!.map((sub, si) => (
                  <p key={si} className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">
                    {sub.name} — {fmtNum(sub.quantity)} {sub.unit}
                  </p>
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
const eventTypes = ["Urodziny", "Wesele", "Stypa", "Impreza firmowa", "Komunia", "Chrzciny", "Konferencja", "Inne"];

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
      <SelectTrigger className="h-7 text-xs w-[140px] border-transparent bg-transparent hover:border-border focus:border-border transition-colors text-muted-foreground">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Brak —</SelectItem>
        {eventTypes.map((e) => (
          <SelectItem key={e} value={e}>{e}</SelectItem>
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

// ===== ADD ORDER SHEET =====

const AddOrderSheet = ({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (order: Order) => void }) => {
  const [clientSearch, setClientSearch] = useState("");
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [cateringType, setCateringType] = useState<"wyjazdowy" | "na_sali">("wyjazdowy");
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryBuilding, setDeliveryBuilding] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryCalculating, setDeliveryCalculating] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<{ companyLat: number | null; companyLng: number | null; pricePerKm: number; maxDeliveryKm: number | null; freeDeliveryAbove: number | null } | null>(null);
  const deliveryDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    api.getBlockedDates().then((dates) => {
      setBlockedDates((dates || []).map((d) => new Date(d)));
    }).catch(() => {});
  }, [open]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  // Fetch company settings for delivery calculation
  useEffect(() => {
    if (!open) return;
    api.getDeliveryConfig().then((data) => {
      setCompanySettings({
        companyLat: data.companyLat,
        companyLng: data.companyLng,
        pricePerKm: data.pricePerKm ?? 3,
        maxDeliveryKm: data.maxDeliveryKm ?? null,
        freeDeliveryAbove: data.freeDeliveryAbove ?? null,
      });
    }).catch(() => {});
  }, [open]);

  const calculateDelivery = useCallback(async (city: string, street: string, building: string) => {
    if (!city.trim() || !street.trim() || !building.trim()) {
      setDeliveryCost(0); setDeliveryDistanceKm(null); setDeliveryError(null);
      return;
    }
    if (!companySettings?.companyLat || !companySettings?.companyLng) return;

    const cleanStreet = street.replace(/\bul\.\s*/gi, '').replace(/\baleja\s*/gi, '').replace(/\bal\.\s*/gi, '').trim();
    const fullAddress = `${cleanStreet} ${building}, ${city}, Polska`;
    setDeliveryAddress(fullAddress);
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
        setDeliveryCost(0); setDeliveryDistanceKm(null);
      } else if (data.error === "route_not_found") {
        setDeliveryError("Nie udało się obliczyć trasy");
        setDeliveryCost(0); setDeliveryDistanceKm(null);
      } else if (data.distanceKm != null) {
        const tooFar = companySettings.maxDeliveryKm != null && data.distanceKm > companySettings.maxDeliveryKm;
        const rawPrice = Math.round(companySettings.pricePerKm * data.distanceKm);
        const isFree = companySettings.freeDeliveryAbove != null && totalAmount >= companySettings.freeDeliveryAbove;
        setDeliveryDistanceKm(data.distanceKm);
        if (tooFar) {
          setDeliveryError(`Za daleko (${data.distanceKm.toFixed(1)} km, max ${companySettings.maxDeliveryKm} km)`);
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
  }, [companySettings, totalAmount]);

  const debouncedDeliveryCalc = useCallback((city: string, street: string, building: string) => {
    if (deliveryDebounceRef.current) clearTimeout(deliveryDebounceRef.current);
    deliveryDebounceRef.current = window.setTimeout(() => calculateDelivery(city, street, building), 800);
  }, [calculateDelivery]);
  const [notes, setNotes] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [configuringProduct, setConfiguringProduct] = useState<CatalogProduct | null>(null);
  const catalogProducts = useCatalogProducts();

  useEffect(() => {
    if (!open) return;
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
      })));
    }).catch(() => {});
  }, [open]);

  const filteredClients = dbClients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.companyName || "").toLowerCase().includes(clientSearch.toLowerCase())
  );

  const selectClient = (id: string) => {
    const c = dbClients.find(cl => cl.id === id);
    if (!c) return;
    setSelectedClientId(id);
    setClientName(`${c.firstName} ${c.lastName}`);
    setClientEmail(c.email);
    setClientPhone(c.phone);
    if (c.address && c.city) setDeliveryAddress(`${c.address}, ${c.city}`);
    setClientSearch("");
  };

  const clearClient = () => {
    setSelectedClientId(null);
    setClientName(""); setClientEmail(""); setClientPhone("");
  };

  const addProduct = (product: CatalogProduct) => {
    if ((product.type === "bundle" && product.variants && product.variants.length > 0) ||
        (product.type === "configurable" && product.optionGroups && product.optionGroups.length > 0)) {
      setConfiguringProduct(product);
      return;
    }
    setItems(prev => [...prev, {
      name: product.name, quantity: 1, unit: product.unit,
      pricePerUnit: product.defaultPrice, total: product.defaultPrice, type: product.type,
    }]);
    setShowProducts(false);
    setProductSearch("");
  };

  const handleSubItemConfirm = (subItems: OrderItem["subItems"]) => {
    if (!configuringProduct) return;
    setItems(prev => [...prev, {
      name: configuringProduct.name, quantity: 1, unit: configuringProduct.unit,
      pricePerUnit: configuringProduct.defaultPrice, total: configuringProduct.defaultPrice,
      type: configuringProduct.type, subItems,
    }]);
    setConfiguringProduct(null);
    setShowProducts(false);
    setProductSearch("");
  };

  const updateItem = (index: number, field: "quantity" | "pricePerUnit", value: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.pricePerUnit;
      return updated;
    }));
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  // totalAmount is declared above near items state

  const filteredCatalogAdd = catalogProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!clientName.trim()) { toast.error("Podaj dane klienta"); return; }
    if (items.length === 0) { toast.error("Dodaj przynajmniej jedną pozycję"); return; }

    const now = new Date();
    const months = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
    const dateStr = `${String(now.getDate()).padStart(2,"0")} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const effectiveDeliveryCost = cateringType === "na_sali" ? 0 : deliveryCost;
    const newOrder: Order = {
      id: `ZAM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      dbId: "", clientId: selectedClientId,
      client: clientName, email: clientEmail, phone: clientPhone,
      event, date: date || dateStr, deliveryAddress: cateringType === "na_sali" ? "Na sali" : (deliveryAddress || `${deliveryStreet} ${deliveryBuilding}, ${deliveryCity}`), notes, items,
      amount: fmtNum(totalAmount + effectiveDeliveryCost) + " zł", amountNum: totalAmount + effectiveDeliveryCost,
      status: "Nowe zamówienie", createdAt: dateStr,
      deliveryCost: effectiveDeliveryCost, guestCount: 0, discount: 0,
    };

    onAdd(newOrder);
    toast.success("Zamówienie dodane");

    // Reset
    setSelectedClientId(null); setClientName(""); setClientEmail(""); setClientPhone("");
    setCateringType("wyjazdowy"); setEvent(""); setDate(""); setTime(""); setDeliveryCity(""); setDeliveryStreet(""); setDeliveryBuilding(""); setDeliveryAddress(""); setDeliveryCost(0); setDeliveryDistanceKm(null); setDeliveryError(null); setNotes(""); setItems([]);
    setClientSearch("");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Nowe zamówienie</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Client section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Klient
            </Label>

            {selectedClientId ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{clientName}</p>
                  <p className="text-xs text-muted-foreground">{clientEmail} · {clientPhone}</p>
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
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-b-0"
                      >
                        <span className="font-medium">{c.firstName} {c.lastName}</span>
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
                  <Input placeholder="Imię i nazwisko" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                    <Input placeholder="Telefon" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Event info */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Wydarzenie
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={event || "__none__"} onValueChange={(v) => setEvent(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Typ wydarzenia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Brak —</SelectItem>
                  {eventTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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

          {/* Catering type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              Rodzaj cateringu
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "wyjazdowy" as const, label: "Wyjazdowy", desc: "Dostawa na adres" },
                { id: "na_sali" as const, label: "Na sali", desc: "Bez dostawy" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setCateringType(opt.id);
                    if (opt.id === "na_sali") {
                      setDeliveryCost(0); setDeliveryDistanceKm(null); setDeliveryError(null);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm",
                    "hover:border-primary focus:outline-none",
                    cateringType === opt.id ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <span className={cn("font-medium", cateringType === opt.id ? "text-primary" : "text-foreground")}>{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery - only for wyjazdowy */}
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
                {deliveryDistanceKm.toFixed(1)} km — dostawa: {deliveryCost > 0 ? `${fmtNum(deliveryCost)} zł` : "bezpłatna"}
              </div>
            )}
          </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Uwagi
            </Label>
            <Textarea placeholder="Alergie, preferencje..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Products */}
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
                  <Input placeholder="Szukaj produktu..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" autoFocus />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredCatalogAdd.map(p => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                    >
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground text-xs">{fmtNum(p.defaultPrice)} zł/{p.unit}</span>
                    </button>
                  ))}
                  {filteredCatalogAdd.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Brak wyników</p>}
                </div>
                {configuringProduct && (
                  <SubItemSelector product={configuringProduct} onConfirm={handleSubItemConfirm} onCancel={() => setConfiguringProduct(null)} />
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{item.name}</span>
                      {item.subItems && item.subItems.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {item.subItems.map((sub, si) => (
                            <p key={si} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-primary/20">{sub.name}{sub.quantity > 1 ? ` ×${sub.quantity}` : ""}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      type="number" min={1} value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-7 text-xs text-center"
                    />
                    <span className="text-xs text-muted-foreground w-6">{item.unit}</span>
                    <Input
                      type="number" min={0} step={0.01} value={item.pricePerUnit}
                      onChange={(e) => updateItem(i, "pricePerUnit", Math.max(0, parseFloat(e.target.value) || 0))}
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
                  {cateringType === "wyjazdowy" && deliveryCost > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Dostawa</span>
                      <span>{fmtNum(deliveryCost)} zł</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-bold">Razem</span>
                    <span className="text-sm font-bold text-primary">{fmtNum(totalAmount + (cateringType === "wyjazdowy" ? deliveryCost : 0))} zł</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button className="w-full" size="lg" onClick={handleSubmit}>
            <Check className="w-4 h-4 mr-2" />
            Utwórz zamówienie
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
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

  const formatOrderDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const fetchOrders = useCallback(async () => {
    try {
      const dbOrders = await api.getAdminOrders();
      if (!dbOrders || dbOrders.length === 0) return;

      const mapped: Order[] = dbOrders.map((o) => {
        const orderItems = o.orderItems ?? [];
        const items: OrderItem[] = orderItems.map(adminOrderItemToPdfLineItem);

        return {
          id: String(o.orderNumber ?? ""),
          dbId: String(o.id ?? ""),
          clientId: o.clientId ? String(o.clientId) : null,
          client: o.clientName ?? "",
          email: o.clientEmail ?? "",
          phone: o.clientPhone ?? "",
          event: o.eventType ?? "",
          date: formatOrderDate(o.eventDate != null ? String(o.eventDate) : null),
          deliveryAddress: o.deliveryAddress ?? "",
          amount: fmtNum(Number(o.amount ?? 0)) + " zł",
          amountNum: Number(o.amount ?? 0),
          status: (o.status as OrderStatus) || "Nowe zamówienie",
          notes: o.notes ?? "",
          items,
          createdAt: formatOrderDate(o.createdAt != null ? String(o.createdAt) : null),
          deliveryCost: Number(o.deliveryCost ?? 0) || 0,
          guestCount: Number(o.guestCount ?? 0) || 0,
          discount: Number(o.discount ?? 0) || 0,
        };
      });

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
          orderItems: updated.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            total: item.total,
            itemType: item.type || "simple",
            foodCostPerUnit: item.foodCostPerUnit ?? 0,
            subItems: (item.subItems ?? []).map((sub) => ({
              name: sub.name,
              quantity: sub.quantity,
              unit: sub.unit,
              foodCostPerUnit: sub.foodCostPerUnit ?? 0,
            })),
          })),
        });
        toast.success("Zamówienie zapisane");
      } catch {
        toast.error("Błąd zapisu zamówienia");
      }
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

      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">Nr zamówienia</TableHead>
              <TableHead className="font-semibold text-foreground">Klient</TableHead>
              <TableHead className="font-semibold text-foreground">Wydarzenie</TableHead>
              <TableHead className="font-semibold text-foreground">Data</TableHead>
              <TableHead className="font-semibold text-foreground">Kwota</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => openDetail(order)}>
                <TableCell className="font-mono text-sm text-muted-foreground">{order.id}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-foreground">{order.client}</div>
                    <div className="text-xs text-muted-foreground">{order.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <InlineEventSelect
                    value={order.event}
                    onChange={(v) => updateOrderField(order.id, { event: v })}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{order.date}</TableCell>
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
                <TableCell>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openDetail(order)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(order)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddOrderSheet
        open={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        onAdd={(order) => setOrders(prev => [order, ...prev])}
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
