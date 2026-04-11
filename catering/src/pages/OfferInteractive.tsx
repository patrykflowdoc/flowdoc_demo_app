import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicOffer, putPublicOfferSelections } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Loader2, Minus, Plus, UtensilsCrossed } from "lucide-react";

function resolvePublicOfferImageUrl(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const base = import.meta.env.VITE_API_URL || "";
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
}

/** Czas z API (ISO, @db.Time) → HH:mm dla pola formularza. */
function formatEventTimeHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function PublicOfferImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          className
        )}
        aria-hidden
      >
        <UtensilsCrossed className="size-[45%] max-h-6 max-w-6" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 rounded-lg object-cover", className)}
      loading="lazy"
    />
  );
}

type PublicOfferGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: Array<{ id: string; name: string; imageUrl?: string | null; dishId?: string | null }>;
};

type PublicOfferConfigurableSet = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pricePerPerson: number;
  configGroups: PublicOfferGroup[];
};

type PublicOfferLine = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
  itemType: string;
  offerClientToggle?: boolean;
  offerClientAccepted?: boolean;
  orderEventDayId?: string | null;
  imageUrl?: string | null;
  subItems: Array<{ id?: string; name: string; quantity: number; unit: string; dishId?: string | null }>;
  configurableSet: PublicOfferConfigurableSet | null;
};

function isInteractiveConfigurableLine(item: PublicOfferLine): boolean {
  return item.itemType === "configurable" && item.configurableSet != null;
}

function offerLineKindLabel(itemType: string): string | undefined {
  const t = String(itemType ?? "").toLowerCase();
  if (t === "extra") return "Dodatek";
  if (t === "extra_bundle") return "Zestaw dodatków";
  if (t === "expandable" || t === "bundle") return "Pakiet";
  if (t === "service") return "Usługa";
  if (t === "packaging") return "Opakowanie";
  if (t === "waiter") return "Obsługa";
  if (t === "simple") return "Pozycja";
  if (t === "configurable") return "Zestaw";
  return undefined;
}

type PublicOfferDay = {
  id: string;
  label: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
  eventType: string | null;
  guestCount: number | null;
  deliveryAddress: string | null;
};

type PublicOfferPayload = {
  order: {
    orderNumber: string;
    clientName: string;
    clientEmail: string | null;
    eventType: string | null;
    eventDate: string | null;
    eventTime: string | null;
    guestCount: number | null;
    deliveryAddress: string | null;
    amount: number;
    discount: number;
    notes: string | null;
  };
  items: PublicOfferLine[];
  days: PublicOfferDay[];
};

function inferSelectionsFromSubitems(item: PublicOfferLine): Record<string, string> {
  const out: Record<string, string> = {};
  const set = item.configurableSet;
  if (!set) return out;
  for (const group of set.configGroups) {
    const sub = item.subItems?.find((s) => {
      if (!s.name.startsWith(`${group.name}:`)) return false;
      return group.options.some((o) => s.name.includes(o.name));
    });
    if (!sub) continue;
    const opt = group.options.find((o) => sub.name.includes(o.name));
    if (opt) out[group.id] = opt.id;
  }
  return out;
}

const QTY_MAX = 99999;

function clampOfferQty(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(QTY_MAX, Math.floor(n));
}

/** Ilość widoczna w podglądzie: uwzględnia szkic z pola tekstowego. */
function qtyFromDraft(draft: string | undefined, fallback: number): number {
  if (draft === undefined) return fallback;
  if (draft === "") return 0;
  const n = parseInt(draft, 10);
  return Number.isFinite(n) ? clampOfferQty(n) : fallback;
}

function resolveOptionalQtyForSubmit(
  id: string,
  draft: Record<string, string>,
  quantities: Record<string, number>
): number {
  const raw = draft[id];
  if (raw !== undefined) {
    const n = raw === "" ? 0 : parseInt(raw, 10);
    return clampOfferQty(Number.isFinite(n) ? n : quantities[id] ?? 0);
  }
  return clampOfferQty(quantities[id] ?? 0);
}

function resolveConfigurableQtyForSubmit(
  id: string,
  draft: Record<string, string>,
  quantities: Record<string, number>,
  item: PublicOfferLine
): number {
  const raw = draft[id];
  const fallback = quantities[id] ?? Math.max(0, Number(item.quantity) || 0);
  if (raw !== undefined) {
    const n = raw === "" ? 0 : parseInt(raw, 10);
    return clampOfferQty(Number.isFinite(n) ? n : fallback);
  }
  return clampOfferQty(fallback);
}

function parseGuestCountField(s: string): number {
  const n = parseInt(String(s).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? clampOfferQty(n) : 0;
}

function contributesToPreview(
  item: PublicOfferLine,
  optionalQuantities: Record<string, number>,
  optionalQtyDraft: Record<string, string>
): boolean {
  if (item.itemType === "configurable") return true;
  if (!item.offerClientToggle) return true;
  const base = optionalQuantities[item.id] ?? 0;
  return qtyFromDraft(optionalQtyDraft[item.id], base) > 0;
}

function linePreviewContributionTotal(
  item: PublicOfferLine,
  optionalQuantities: Record<string, number>,
  configurableQuantities: Record<string, number>,
  optionalQtyDraft: Record<string, string>,
  configurableQtyDraft: Record<string, string>
): number {
  if (item.itemType === "configurable") {
    const base = configurableQuantities[item.id] ?? Math.max(0, Number(item.quantity) || 0);
    const q = qtyFromDraft(configurableQtyDraft[item.id], base);
    return q * item.pricePerUnit;
  }
  if (item.offerClientToggle && item.itemType !== "configurable") {
    const base = optionalQuantities[item.id] ?? 0;
    const q = qtyFromDraft(optionalQtyDraft[item.id], base);
    return q * item.pricePerUnit;
  }
  return item.total;
}

// ===== Reużywalne karty dla pozycji oferty =====

const ConfigurableLineCard = ({
  item,
  selections,
  setSelections,
  configurableQuantities,
  setConfigurableQuantities,
  configurableQtyDraft,
  setConfigurableQtyDraft,
  guestCountForSync,
}: {
  item: PublicOfferLine;
  selections: Record<string, Record<string, string>>;
  setSelections: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  configurableQuantities: Record<string, number>;
  setConfigurableQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  configurableQtyDraft: Record<string, string>;
  setConfigurableQtyDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Liczba gości do przycisku „jak liczba gości” — z dnia lub z zamówienia. */
  guestCountForSync: string;
}) => {
  const set = item.configurableSet!;
  const sel = selections[item.id] ?? {};
  const cfgQ = configurableQuantities[item.id] ?? Math.max(0, Number(item.quantity) || 0);
  const cfgQEff = qtyFromDraft(configurableQtyDraft[item.id], cfgQ);
  const cfgLineSum = cfgQEff * item.pricePerUnit;
  const guestsN = parseGuestCountField(guestCountForSync);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex gap-3 min-w-0 flex-1">
            <PublicOfferImage src={resolvePublicOfferImageUrl(set.imageUrl)} alt={item.name} className="h-20 w-20" />
            <div className="min-w-0">
              <CardTitle className="text-lg">{item.name}</CardTitle>
              {set.description ? <p className="text-sm text-muted-foreground mt-1 leading-snug">{set.description}</p> : null}
              <p className="text-sm text-muted-foreground mt-1">{item.pricePerUnit.toFixed(2)} zł / {item.unit} × {cfgQEff} {item.unit}</p>
            </div>
          </div>
          <div className="text-right text-sm shrink-0"><p className="font-semibold">{cfgLineSum.toFixed(2)} zł</p></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm font-medium">Ilość zestawów (porcji / osób)</Label>
            {guestsN > 0 ? (
              <button type="button" className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => { setConfigurableQtyDraft(({ [item.id]: _, ...rest }) => rest); setConfigurableQuantities((prev) => ({ ...prev, [item.id]: guestsN })); }}>
                Ustaw jak liczba gości ({guestsN})
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Domyślnie bierzemy liczbę gości z oferty; możesz ją zmienić.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={cfgQ <= 0} aria-label="Zmniejsz"
                onClick={() => { setConfigurableQtyDraft(({ [item.id]: _, ...rest }) => rest); setConfigurableQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? cfgQ) - 1) })); }}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input type="text" inputMode="numeric" autoComplete="off" aria-label="Ilość zestawów"
                className="h-9 w-[5.5rem] text-center tabular-nums"
                value={configurableQtyDraft[item.id] ?? String(cfgQ)}
                onChange={(e) => { const digits = e.target.value.replace(/\D/g, ""); setConfigurableQtyDraft((d) => ({ ...d, [item.id]: digits })); }}
                onBlur={() => { const raw = configurableQtyDraft[item.id]; if (raw === undefined) return; const n = raw === "" ? 0 : parseInt(raw, 10); setConfigurableQuantities((prev) => ({ ...prev, [item.id]: clampOfferQty(Number.isFinite(n) ? n : 0) })); setConfigurableQtyDraft(({ [item.id]: _, ...rest }) => rest); }}
              />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Zwiększ"
                onClick={() => { setConfigurableQtyDraft(({ [item.id]: _, ...rest }) => rest); setConfigurableQuantities((prev) => ({ ...prev, [item.id]: Math.min(QTY_MAX, (prev[item.id] ?? cfgQ) + 1) })); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {set.configGroups.map((group) => (
          <div key={group.id} className="space-y-3 rounded-lg border border-border p-4 bg-background">
            <div className="flex justify-between gap-2">
              <Label className="text-base font-medium">{group.name}</Label>
              <span className="text-xs text-muted-foreground">{group.minSelections >= 1 ? "Wybierz 1" : "Opcjonalnie"}</span>
            </div>
            <RadioGroup value={sel[group.id] ?? ""} onValueChange={(v) => { setSelections((prev) => ({ ...prev, [item.id]: { ...prev[item.id], [group.id]: v } })); }} className="space-y-2">
              {group.options.map((opt) => (
                <div key={opt.id} className={cn("flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/50", sel[group.id] === opt.id && "border-primary/30 bg-primary/5")}>
                  <PublicOfferImage src={resolvePublicOfferImageUrl(opt.imageUrl ?? null)} alt={opt.name} className="h-10 w-10" />
                  <RadioGroupItem value={opt.id} id={`${item.id}-${group.id}-${opt.id}`} />
                  <Label htmlFor={`${item.id}-${group.id}-${opt.id}`} className="cursor-pointer flex-1 font-normal leading-snug">{opt.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const OptionalLinesCard = ({
  items,
  optionalQuantities,
  setOptionalQuantities,
  optionalQtyDraft,
  setOptionalQtyDraft,
}: {
  items: PublicOfferLine[];
  optionalQuantities: Record<string, number>;
  setOptionalQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  optionalQtyDraft: Record<string, string>;
  setOptionalQtyDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) => (
  <div className="space-y-3">
    {items.map((item) => {
      const q = optionalQuantities[item.id] ?? 0;
      const qEff = qtyFromDraft(optionalQtyDraft[item.id], q);
      const lineSum = qEff * item.pricePerUnit;
      return (
        <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 bg-background sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 min-w-0 flex-1 items-start">
            <PublicOfferImage src={resolvePublicOfferImageUrl(item.imageUrl)} alt={item.name} className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{item.pricePerUnit.toFixed(2)} zł / {item.unit}</p>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={q <= 0} aria-label="Zmniejsz"
                onClick={() => { setOptionalQtyDraft(({ [item.id]: _, ...rest }) => rest); setOptionalQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) })); }}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input type="text" inputMode="numeric" autoComplete="off" aria-label={`Ilość: ${item.name}`}
                className="h-9 w-[5.5rem] text-center tabular-nums"
                value={optionalQtyDraft[item.id] ?? String(q)}
                onChange={(e) => { const digits = e.target.value.replace(/\D/g, ""); setOptionalQtyDraft((d) => ({ ...d, [item.id]: digits })); }}
                onBlur={() => { const raw = optionalQtyDraft[item.id]; if (raw === undefined) return; const n = raw === "" ? 0 : parseInt(raw, 10); setOptionalQuantities((prev) => ({ ...prev, [item.id]: clampOfferQty(Number.isFinite(n) ? n : 0) })); setOptionalQtyDraft(({ [item.id]: _, ...rest }) => rest); }}
              />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Zwiększ"
                onClick={() => { setOptionalQtyDraft(({ [item.id]: _, ...rest }) => rest); setOptionalQuantities((prev) => ({ ...prev, [item.id]: Math.min(QTY_MAX, (prev[item.id] ?? 0) + 1) })); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-semibold tabular-nums">{lineSum.toFixed(2)} zł</span>
          </div>
        </div>
      );
    })}
  </div>
);

const ReadOnlyLinesCard = ({ items }: { items: PublicOfferLine[] }) => (
  <div className="space-y-3">
    {items.map((item) => {
      const kind = offerLineKindLabel(item.itemType);
      const subs = item.subItems ?? [];
      return (
        <div key={item.id} className="rounded-lg border border-border bg-background p-4 space-y-2">
          <div className="flex gap-3 items-start">
            <PublicOfferImage src={resolvePublicOfferImageUrl(item.imageUrl)} alt={item.name} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              {kind ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{kind}</span> : null}
              <p className="font-medium text-foreground leading-snug">{item.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{item.quantity} {item.unit} × {item.pricePerUnit.toFixed(2)} zł</p>
              {subs.length > 0 ? (
                <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 border-l-2 border-primary/20 pl-3">
                  {subs.map((s, idx) => <li key={s.id ?? idx}>{s.name} — {Number(s.quantity)} {s.unit}</li>)}
                </ul>
              ) : null}
            </div>
            <span className="text-sm font-semibold shrink-0">{item.total.toFixed(2)} zł</span>
          </div>
        </div>
      );
    })}
  </div>
);

const OfferInteractive = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicOfferPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** orderItemId -> groupId -> optionId */
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({});
  /** orderItemId -> ilość pozycji opcjonalnej (0 = nie wliczamy) */
  const [optionalQuantities, setOptionalQuantities] = useState<Record<string, number>>({});
  /** orderItemId -> ilość zestawów konfigurowalnych (porcje / osoby) */
  const [configurableQuantities, setConfigurableQuantities] = useState<Record<string, number>>({});
  /** Tymczasowy tekst w polu ilości (wpisywanie wielocyfrowe) — czyszczony po blur / +/- */
  const [optionalQtyDraft, setOptionalQtyDraft] = useState<Record<string, string>>({});
  const [configurableQtyDraft, setConfigurableQtyDraft] = useState<Record<string, string>>({});
  const [orderEdit, setOrderEdit] = useState({
    guestCount: "",
    eventDate: "",
    eventTime: "",
    deliveryAddress: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError("Brak identyfikatora oferty w adresie.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = (await getPublicOffer(token)) as PublicOfferPayload;
      setData(json);
      const init: Record<string, Record<string, string>> = {};
      const initQty: Record<string, number> = {};
      const initCfgQty: Record<string, number> = {};
      const guests =
        json.order.guestCount != null ? Math.max(0, Number(json.order.guestCount) || 0) : 0;
      for (const item of json.items) {
        if (item.itemType === "configurable" && item.configurableSet) {
          init[item.id] = inferSelectionsFromSubitems(item);
          const fromOrder = Math.max(0, Number(item.quantity) || 0);
          initCfgQty[item.id] = fromOrder > 0 ? fromOrder : guests > 0 ? guests : 1;
        }
        if (item.offerClientToggle && item.itemType !== "configurable") {
          initQty[item.id] = item.offerClientAccepted ? Math.max(0, Number(item.quantity) || 0) : 0;
        }
      }
      setSelections(init);
      setOptionalQuantities(initQty);
      setConfigurableQuantities(initCfgQty);
      setOptionalQtyDraft({});
      setConfigurableQtyDraft({});
      setOrderEdit({
        guestCount: json.order.guestCount != null ? String(json.order.guestCount) : "",
        eventDate: json.order.eventDate ?? "",
        eventTime: formatEventTimeHHMM(json.order.eventTime),
        deliveryAddress: json.order.deliveryAddress ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wczytać oferty.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const configurableLines = useMemo(
    () => (data?.items ?? []).filter((i) => i.itemType === "configurable" && i.configurableSet),
    [data]
  );

  const optionalLines = useMemo(
    () => (data?.items ?? []).filter((i) => i.offerClientToggle && i.itemType !== "configurable"),
    [data]
  );

  /** Pozycje na stałe w ofercie (bez wyboru menu i bez przełącznika klienta). */
  const readOnlyLines = useMemo(
    () =>
      (data?.items ?? []).filter((i) => !isInteractiveConfigurableLine(i) && !i.offerClientToggle),
    [data]
  );

  const showEmptyOffer = readOnlyLines.length === 0 && configurableLines.length === 0 && optionalLines.length === 0;

  const previewAmount = useMemo(() => {
    if (!data) return 0;
    let sum = 0;
    for (const item of data.items) {
      if (contributesToPreview(item, optionalQuantities, optionalQtyDraft)) {
        sum += linePreviewContributionTotal(
          item,
          optionalQuantities,
          configurableQuantities,
          optionalQtyDraft,
          configurableQtyDraft
        );
      }
    }
    return Math.max(0, sum - data.order.discount);
  }, [data, optionalQuantities, configurableQuantities, optionalQtyDraft, configurableQtyDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data) return;

    // Walidacja wyborów: każda wymagana grupa musi mieć zaznaczoną opcję
    const validationErrors: string[] = [];
    for (const item of configurableLines) {
      const set = item.configurableSet;
      if (!set) continue;
      const sel = selections[item.id] ?? {};
      const qty = resolveConfigurableQtyForSubmit(item.id, configurableQtyDraft, configurableQuantities, item);
      if (qty === 0) continue; // pozycja z 0 szt. — pominięta
      for (const group of set.configGroups) {
        if (group.minSelections > 0 && !sel[group.id]) {
          validationErrors.push(`„${item.name}" → ${group.name}: wybierz opcję`);
        }
      }
    }
    if (validationErrors.length > 0) {
      setError(`Uzupełnij wymagane pola:\n• ${validationErrors.join("\n• ")}`);
      return;
    }

    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const lineQuantities: Record<string, number> = {};
      for (const item of optionalLines) {
        lineQuantities[item.id] = resolveOptionalQtyForSubmit(item.id, optionalQtyDraft, optionalQuantities);
      }
      for (const item of configurableLines) {
        lineQuantities[item.id] = resolveConfigurableQtyForSubmit(
          item.id,
          configurableQtyDraft,
          configurableQuantities,
          item
        );
      }
      const orderDetails = {
        guestCount: orderEdit.guestCount.trim() === "" ? null : orderEdit.guestCount,
        eventDate: orderEdit.eventDate.trim() || null,
        eventTime: orderEdit.eventTime.trim() || null,
        deliveryAddress: orderEdit.deliveryAddress.trim() || null,
      };
      const res = (await putPublicOfferSelections(token, {
        selections,
        ...(Object.keys(lineQuantities).length > 0 ? { lineQuantities } : {}),
        orderDetails,
      })) as { message?: string };
      setSavedMsg(res.message ?? "Zapisano.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Oferta niedostępna</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { order } = data;

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4 pb-32">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Interaktywna oferta</p>
          <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
          {order.clientName ? <p className="text-muted-foreground">{order.clientName}</p> : null}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wydarzenie</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Możesz poprawić datę, liczbę gości i miejsce — zapisze się po wysłaniu oferty.
            </p>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            {order.eventType ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Typ: </span>
                {order.eventType}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="offer-event-date">Data</Label>
                <Input
                  id="offer-event-date"
                  type="date"
                  value={orderEdit.eventDate}
                  onChange={(e) => setOrderEdit((o) => ({ ...o, eventDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-event-time">Godzina</Label>
                <Input
                  id="offer-event-time"
                  type="time"
                  value={orderEdit.eventTime}
                  onChange={(e) => setOrderEdit((o) => ({ ...o, eventTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="offer-guests">Liczba gości</Label>
                <Input
                  id="offer-guests"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="np. 50"
                  value={orderEdit.guestCount}
                  onChange={(e) => setOrderEdit((o) => ({ ...o, guestCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="offer-place">Miejsce / adres dostawy</Label>
                <Input
                  id="offer-place"
                  placeholder="Adres lub opis miejsca"
                  value={orderEdit.deliveryAddress}
                  onChange={(e) => setOrderEdit((o) => ({ ...o, deliveryAddress: e.target.value }))}
                />
              </div>
            </div>
            {order.notes ? (
              <p className="pt-2 border-t border-border text-foreground">
                <span className="text-muted-foreground">Uwagi (tylko do odczytu): </span>
                {order.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <form id="offer-interactive" onSubmit={handleSubmit} className="space-y-6">
          {showEmptyOffer ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                W tej ofercie nie ma pozycji. Skontaktuj się z biurem cateringowym.
              </CardContent>
            </Card>
          ) : null}

          {configurableLines.map((item) => (
            <ConfigurableLineCard
              key={item.id}
              item={item}
              selections={selections}
              setSelections={setSelections}
              configurableQuantities={configurableQuantities}
              setConfigurableQuantities={setConfigurableQuantities}
              configurableQtyDraft={configurableQtyDraft}
              setConfigurableQtyDraft={setConfigurableQtyDraft}
              guestCountForSync={orderEdit.guestCount}
            />
          ))}

          {optionalLines.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dodatki i pozycje opcjonalne</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Wpisz ilość w polu lub użyj +/−. Kwota = ilość × cena jednostkowa. Zero — pozycja poza ofertą.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <OptionalLinesCard
                  items={optionalLines}
                  optionalQuantities={optionalQuantities}
                  setOptionalQuantities={setOptionalQuantities}
                  optionalQtyDraft={optionalQtyDraft}
                  setOptionalQtyDraft={setOptionalQtyDraft}
                />
              </CardContent>
            </Card>
          ) : null}

          {readOnlyLines.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pozycje w ofercie</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Ustalone przez biuro — bez wyboru na tej stronie.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReadOnlyLinesCard items={readOnlyLines} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Podsumowanie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Szacunkowa wartość (z Twoich wyborów)</span>
                <span className="font-medium">{previewAmount.toFixed(2)} zł</span>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between text-destructive">
                  <span>Rabat</span>
                  <span>-{order.discount.toFixed(2)} zł</span>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground pt-1">
                Po wysłaniu oferty kwota zostanie zaktualizowana po stronie biura.
              </p>
            </CardContent>
          </Card>

          {error && data ? <p className="text-sm text-destructive text-center">{error}</p> : null}
          {savedMsg ? <p className="text-sm text-center text-green-600 dark:text-green-500">{savedMsg}</p> : null}
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex justify-center">
          <Button
            type="submit"
            form="offer-interactive"
            size="lg"
            disabled={saving}
            className="min-w-[min(100%,280px)] w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wysyłanie…
              </>
            ) : (
              "Wyślij ofertę"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OfferInteractive;
