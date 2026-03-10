import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "@/api/client";
import { toast } from "@/components/ui/sonner";

const VAT_RATES = [0, 5, 8, 23];
const EXTRA_TYPES = [
  { value: "dodatki", label: "Dodatek" },
  { value: "pakowanie", label: "Pakowanie" },
  { value: "obsluga", label: "Obsługa kelnerska" },
];

interface ExtrasCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Extra {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  image: string | null;
  category: string;
  extrasCategoryId: string | null;
  price: number;
  priceNetto: number;
  vatRate: number;
  priceBrutto: number;
  priceOnSite: number | null;
  unitLabel: string;
  priceLabel: string;
  requiresPersonCount: boolean;
  duration: string | null;
  contents: string[];
  foodCost: number;
}

type Props = {
  extras: Extra[];
  extrasCategories: ExtrasCategory[];
  reload: () => void;
};

const ImageUpload = ({ image, onChange }: { image: string | null; onChange: (img: string | null) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(URL.createObjectURL(file));
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">Zdjęcie</Label>
      <button type="button" onClick={() => fileRef.current?.click()}
        className={cn("w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors", image && "border-solid border-border")}>
        {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-6 h-6 text-muted-foreground" />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

export function ExtrasTab({ extras, extrasCategories, reload }: Props) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLongDesc, setFormLongDesc] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState("dodatki");
  const [formExtrasCategoryId, setFormExtrasCategoryId] = useState<string | null>(null);
  const [formPriceNetto, setFormPriceNetto] = useState("");
  const [formVat, setFormVat] = useState(23);
  const [formPriceBrutto, setFormPriceBrutto] = useState("");
  const [formUnitLabel, setFormUnitLabel] = useState("szt.");
  const [formPriceLabel, setFormPriceLabel] = useState("");
  const [formRequiresPersonCount, setFormRequiresPersonCount] = useState(false);
  const [formDuration, setFormDuration] = useState("");
  const [formContents, setFormContents] = useState("");
  const [formFoodCost, setFormFoodCost] = useState("");
  const [formPriceOnSite, setFormPriceOnSite] = useState("");

  const filtered = extras.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormLongDesc(""); setFormImage(null);
    setFormCategory("dodatki"); setFormExtrasCategoryId(null);
    setFormPriceNetto(""); setFormVat(23); setFormPriceBrutto("");
    setFormUnitLabel("szt."); setFormPriceLabel(""); setFormRequiresPersonCount(false);
    setFormDuration(""); setFormContents(""); setFormFoodCost(""); setFormPriceOnSite("");
    setShowForm(false); setEditingId(null);
  };

  const updatePriceFromNetto = (netto: string, vat: number) => {
    setFormPriceNetto(netto);
    const n = parseFloat(netto) || 0;
    setFormPriceBrutto((n * (1 + vat / 100)).toFixed(2));
  };

  const updatePriceFromBrutto = (brutto: string, vat: number) => {
    setFormPriceBrutto(brutto);
    const b = parseFloat(brutto) || 0;
    setFormPriceNetto((b / (1 + vat / 100)).toFixed(2));
  };

  const updateVat = (vat: number) => {
    setFormVat(vat);
    const n = parseFloat(formPriceNetto) || 0;
    setFormPriceBrutto((n * (1 + vat / 100)).toFixed(2));
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    setFormName(extra.name);
    setFormDesc(extra.description);
    setFormLongDesc(extra.longDescription);
    setFormImage(extra.image);
    setFormCategory(extra.category);
    setFormExtrasCategoryId(extra.extrasCategoryId);
    setFormPriceNetto(extra.priceNetto.toFixed(2));
    setFormVat(extra.vatRate);
    setFormPriceBrutto(extra.priceBrutto.toFixed(2));
    setFormUnitLabel(extra.unitLabel);
    setFormPriceLabel(extra.priceLabel);
    setFormRequiresPersonCount(extra.requiresPersonCount);
    setFormDuration(extra.duration || "");
    setFormContents(extra.contents.join("\n"));
    setFormFoodCost(extra.foodCost.toFixed(2));
    setFormPriceOnSite(extra.priceOnSite != null ? extra.priceOnSite.toFixed(2) : "");
    setShowForm(true);
  };

  const saveExtra = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    const priceBrutto = parseFloat(formPriceBrutto) || 0;
    const priceNetto = parseFloat(formPriceNetto) || 0;
    const contents = formContents.split("\n").map(s => s.trim()).filter(Boolean);

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      description: formDesc.trim(),
      longDescription: formLongDesc.trim(),
      imageUrl: formImage,
      category: formCategory,
      priceOnSite: formPriceOnSite ? parseFloat(formPriceOnSite) || null : null,
      extrasCategoryId: formExtrasCategoryId,
      price: priceBrutto,
      priceNetto: priceNetto,
      priceBrutto: priceBrutto,
      vatRate: formVat,
      unitLabel: formUnitLabel,
      priceLabel: formPriceLabel.trim() || (priceBrutto === 0 ? "W cenie" : `${priceBrutto.toFixed(0)} zł`),
      requiresPersonCount: formRequiresPersonCount,
      duration: formCategory === "obsluga" ? formDuration || null : null,
      contents,
      foodCost: parseFloat(formFoodCost) || 0,
    };

    try {
      if (editingId) {
        await api.updateExtra(editingId, payload);
      } else {
        await api.createExtra(payload);
      }
    } catch (err: unknown) {
      setSaving(false);
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setSaving(false);
    toast.success(editingId ? "Dodatek zaktualizowany" : "Dodatek dodany");
    resetForm();
    reload();
  };

  const removeExtra = async (id: string) => {
    try {
      await api.deleteExtra(id);
      toast.success("Usunięto");
      reload();
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    return extrasCategories.find(c => c.id === id)?.name || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Szukaj dodatku..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Dodaj dodatek
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-4">
              <ImageUpload image={formImage} onChange={setFormImage} />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nazwa *</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="np. Wniesienie na salę" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Typ</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXTRA_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Kategoria dodatku</Label>
                    <Select value={formExtrasCategoryId ?? "none"} onValueChange={(v) => setFormExtrasCategoryId(v === "none" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Brak kategorii" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Brak kategorii</SelectItem>
                        {extrasCategories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jednostka</Label>
                    <Input value={formUnitLabel} onChange={(e) => setFormUnitLabel(e.target.value)} placeholder="szt." />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Opis</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Krótki opis" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opis szczegółowy</Label>
              <textarea value={formLongDesc} onChange={(e) => setFormLongDesc(e.target.value)} placeholder="Szczegółowy opis..."
                className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cena netto (zł)</Label>
                <Input type="number" step="0.01" value={formPriceNetto} onChange={(e) => updatePriceFromNetto(e.target.value, formVat)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">VAT %</Label>
                <Select value={String(formVat)} onValueChange={(v) => updateVat(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena brutto (zł)</Label>
                <Input type="number" step="0.01" value={formPriceBrutto} onChange={(e) => updatePriceFromBrutto(e.target.value, formVat)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena brutto sala (zł)</Label>
                <Input type="number" step="0.01" value={formPriceOnSite} onChange={(e) => setFormPriceOnSite(e.target.value)} placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Food cost (zł)</Label>
                <Input type="number" step="0.01" value={formFoodCost} onChange={(e) => setFormFoodCost(e.target.value)} />
              </div>
            </div>

            {formCategory === "pakowanie" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formRequiresPersonCount} onChange={(e) => setFormRequiresPersonCount(e.target.checked)} />
                Wymaga podania liczby osób (cena × osoby)
              </label>
            )}

            {formCategory === "obsluga" && (
              <div className="space-y-1">
                <Label className="text-xs">Czas trwania</Label>
                <Select value={formDuration} onValueChange={setFormDuration}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4h">4 godziny</SelectItem>
                    <SelectItem value="8h">8 godzin</SelectItem>
                    <SelectItem value="12h">12 godzin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Zawartość (każda linia = osobna pozycja)</Label>
              <textarea value={formContents} onChange={(e) => setFormContents(e.target.value)} placeholder="Wpisz co jest w zestawie..."
                className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={saveExtra} disabled={!formName.trim() || saving}>
                {saving ? "Zapisuję..." : editingId ? "Zapisz" : "Dodaj"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1.5">
        {filtered.map((extra) => (
          <div key={extra.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {extra.image && <img src={extra.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
              <div>
                <p className="text-sm font-medium">{extra.name}</p>
                {getCategoryName(extra.extrasCategoryId) && (
                  <p className="text-xs text-muted-foreground">{getCategoryName(extra.extrasCategoryId)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary">{extra.priceBrutto.toFixed(2)} zł</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(extra)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeExtra(extra.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak dodatków</p>}
      </div>
    </div>
  );
}
