import { useState, useEffect, useRef, useCallback } from "react";
import { ExtrasTab as ExtrasTabComponent, type Extra } from "./ExtrasTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Search, Apple, CookingPot, X, Check, ImagePlus, Package, Settings2, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as api from "@/api/client";
import { toast } from "@/components/ui/sonner";

const ALLERGEN_OPTIONS = [
  "gluten", "mleko", "jaja", "ryby", "skorupiaki", "soja",
  "orzechy", "sezam", "seler", "gorczyca", "łubin", "mięczaki",
];
const DIETARY_OPTIONS = ["Wegetariańskie", "Wegańskie", "Bezglutenowe", "Bez laktozy", "Keto"];
const VAT_RATES = [0, 5, 8, 23];

// ===== TYPES =====
type UnitType = "g" | "ml" | "szt.";

interface CategoryOption { slug: string; name: string; }

interface Ingredient {
  id: string; name: string; unit: UnitType; allergens: string[]; pricePerUnit: number;
}

interface DishIngredient {
  ingredientId: string; quantity: number;
}

interface Dish {
  id: string; name: string; description: string; longDescription: string;
  image: string | null; priceNetto: number; vatRate: number; priceBrutto: number;
  pricePerUnit: number; pricePerUnitOnSite: number | null; unitLabel: string; minQuantity: number; icon: string;
  categorySlug: string | null; contents: string[]; allergens: string[];
  dietaryTags: string[]; productType: string;
  dishIngredients: DishIngredient[];
}

interface BundleVariant {
  id: string; name: string; description: string; price: number; priceOnSite: number | null;
  allergens: string[]; dietaryTags: string[]; sortOrder: number;
  dishId: string | null;
}

interface Bundle {
  id: string; name: string; description: string; longDescription: string;
  image: string | null; priceNetto: number; vatRate: number; priceBrutto: number;
  basePrice: number; minQuantity: number; icon: string; categorySlug: string | null;
  variants: BundleVariant[];
}

interface ConfigGroupOption {
  id: string; name: string; allergens: string[]; sortOrder: number;
  dishId: string | null;
}

interface ConfigGroup {
  id: string; name: string; minSelections: number; maxSelections: number;
  options: ConfigGroupOption[]; sortOrder: number;
}

interface ConfigSet {
  id: string; name: string; description: string; longDescription: string;
  image: string | null; pricePerPerson: number; pricePerPersonOnSite: number | null; minPersons: number;
  icon: string; categorySlug: string | null; groups: ConfigGroup[];
}

// ===== IMAGE UPLOAD =====
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

// ===== CATEGORY SELECTOR =====
const CategorySelect = ({ value, onChange, categories }: { value: string | null; onChange: (v: string | null) => void; categories: CategoryOption[] }) => (
  <div className="space-y-1">
    <Label className="text-xs">Kategoria (wyświetlana w formularzu)</Label>
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger><SelectValue placeholder="Wybierz kategorię" /></SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// ===== DISH PICKER (reusable) =====
const DishPicker = ({ dishes, selectedDishId, onSelect }: { dishes: Dish[]; selectedDishId: string | null; onSelect: (dish: Dish) => void }) => {
  const [search, setSearch] = useState("");
  const filtered = dishes.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj dania..." className="h-8 text-xs pl-8" />
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Brak dań — dodaj je najpierw w zakładce "Dania"</p>}
        {filtered.map(d => (
          <button key={d.id} type="button" onClick={() => onSelect(d)}
            className={cn("w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors",
              selectedDishId === d.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{d.name}</span>
            </span>
            <span className="text-[10px] opacity-70">{d.priceBrutto.toFixed(2)} zł</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ===== INGREDIENT PICKER for Dishes =====
const IngredientPicker = ({ ingredients, dishIngredients, onChange }: {
  ingredients: Ingredient[];
  dishIngredients: DishIngredient[];
  onChange: (di: DishIngredient[]) => void;
}) => {
  const [search, setSearch] = useState("");
  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const selectedIds = dishIngredients.map(di => di.ingredientId);

  const toggleIngredient = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(dishIngredients.filter(di => di.ingredientId !== id));
    } else {
      onChange([...dishIngredients, { ingredientId: id, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, qty: number) => {
    onChange(dishIngredients.map(di => di.ingredientId === id ? { ...di, quantity: qty } : di));
  };

  const totalFoodCost = dishIngredients.reduce((sum, di) => {
    const ing = ingredients.find(i => i.id === di.ingredientId);
    return sum + (ing ? ing.pricePerUnit * di.quantity : 0);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Składniki ({dishIngredients.length})</Label>
        {dishIngredients.length > 0 && (
          <span className="text-xs font-medium text-primary">Food cost: {totalFoodCost.toFixed(2)} zł</span>
        )}
      </div>

      {/* Selected ingredients with quantities */}
      {dishIngredients.length > 0 && (
        <div className="space-y-1">
          {dishIngredients.map(di => {
            const ing = ingredients.find(i => i.id === di.ingredientId);
            if (!ing) return null;
            return (
              <div key={di.ingredientId} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-primary/5 border border-primary/10">
                <span className="text-xs font-medium flex-1">{ing.name}</span>
                <Input type="number" step="0.1" min="0" value={di.quantity}
                  onChange={e => updateQuantity(di.ingredientId, parseFloat(e.target.value) || 0)}
                  className="h-7 w-20 text-xs text-right" />
                <span className="text-[10px] text-muted-foreground w-8">{ing.unit}</span>
                <span className="text-[10px] text-muted-foreground w-16 text-right">
                  {(ing.pricePerUnit * di.quantity).toFixed(2)} zł
                </span>
                <button onClick={() => toggleIngredient(di.ingredientId)} className="p-0.5 text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search and add */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Dodaj składnik..." className="h-8 text-xs pl-8" />
      </div>
      {search && (
        <div className="max-h-32 overflow-y-auto space-y-0.5 border border-border rounded-md p-1">
          {filtered.filter(i => !selectedIds.includes(i.id)).map(i => (
            <button key={i.id} type="button" onClick={() => toggleIngredient(i.id)}
              className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-muted flex items-center justify-between">
              <span>{i.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {i.unit === "szt." ? `${i.pricePerUnit.toFixed(2)} zł/szt.` : `${(i.pricePerUnit * 1000).toFixed(2)} zł/${i.unit === "g" ? "kg" : "l"}`}
              </span>
            </button>
          ))}
          {filtered.filter(i => !selectedIds.includes(i.id)).length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-1">Brak wyników</p>
          )}
        </div>
      )}
    </div>
  );
};

// ===== INGREDIENTS TAB =====
const IngredientsTab = ({ ingredients, reload }: { ingredients: Ingredient[]; reload: () => void }) => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState<UnitType>("g");
  const [formPrice, setFormPrice] = useState("");
  const [formAllergens, setFormAllergens] = useState<string[]>([]);

  const filtered = ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const toggleAllergen = (a: string) => setFormAllergens((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  const resetForm = () => {
    setFormName(""); setFormUnit("g"); setFormPrice(""); setFormAllergens([]);
    setShowForm(false); setEditingId(null);
  };

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setFormName(ing.name);
    setFormUnit(ing.unit);
    // Convert back to display price (kg/l)
    const displayPrice = ing.unit === "szt." ? ing.pricePerUnit : ing.pricePerUnit * 1000;
    setFormPrice(displayPrice.toFixed(2));
    setFormAllergens([...ing.allergens]);
    setShowForm(true);
  };

  const saveIngredient = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const enteredPrice = parseFloat(formPrice) || 0;
    const pricePerUnit = formUnit === "szt." ? enteredPrice : enteredPrice / 1000;
    const payload = {
      name: formName.trim(),
      unit: formUnit,
      allergens: formAllergens,
      pricePerUnit: pricePerUnit,
    };
    try {
      if (editingId) {
        await api.updateIngredient(editingId, payload);
      } else {
        await api.createIngredient(payload);
      }
    } catch (err: unknown) {
      setSaving(false);
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setSaving(false);
    toast.success(editingId ? "Składnik zaktualizowany" : "Składnik dodany");
    resetForm();
    reload();
  };

  const removeIngredient = async (id: string) => {
    try {
      await api.deleteIngredient(id);
      reload();
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Szukaj składnika..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Dodaj składnik
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nazwa</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="np. Kurczak" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jednostka</Label>
                <Select value={formUnit} onValueChange={(v) => setFormUnit(v as UnitType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">g (gramy)</SelectItem>
                    <SelectItem value="ml">ml (mililitry)</SelectItem>
                    <SelectItem value="szt.">szt. (sztuki)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {formUnit === "szt." ? "Cena za 1 szt. (zł)" : formUnit === "g" ? "Cena za 1 kg (zł)" : "Cena za 1 litr (zł)"}
                </Label>
                <Input type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alergeny</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGEN_OPTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleAllergen(a)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      formAllergens.includes(a) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    )}>{a}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveIngredient} disabled={!formName.trim() || saving}>
                {saving ? "Zapisuję..." : editingId ? "Zapisz" : "Dodaj"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="space-y-1.5">
        {filtered.map((ingredient) => (
          <div key={ingredient.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Apple className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{ingredient.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ingredient.unit}</Badge>
              <span className="text-xs text-muted-foreground">
                {ingredient.unit === "szt."
                  ? `${ingredient.pricePerUnit.toFixed(2)} zł/szt.`
                  : `${(ingredient.pricePerUnit * 1000).toFixed(2)} zł/${ingredient.unit === "g" ? "kg" : "l"}`
                }
              </span>
              {ingredient.allergens.map((a) => (
                <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">{a}</Badge>
              ))}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(ingredient)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => removeIngredient(ingredient.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak składników</p>}
      </div>
    </div>
  );
};

// ===== DISHES TAB =====
const DishesTab = ({ dishes, ingredients, categories, reload }: { dishes: Dish[]; ingredients: Ingredient[]; categories: CategoryOption[]; reload: () => void }) => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLongDesc, setFormLongDesc] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formPriceNetto, setFormPriceNetto] = useState("");
  const [formVat, setFormVat] = useState(8);
  const [formPriceBrutto, setFormPriceBrutto] = useState("");
  const [formUnitLabel, setFormUnitLabel] = useState("szt.");
  const [formMinQty, setFormMinQty] = useState("1");
  const [formIcon, setFormIcon] = useState("🍽️");
  const [formCategorySlug, setFormCategorySlug] = useState<string | null>(null);
  const [formAllergens, setFormAllergens] = useState<string[]>([]);
  const [formDietaryTags, setFormDietaryTags] = useState<string[]>([]);
  const [formContents, setFormContents] = useState("");
  const [formIngredients, setFormIngredients] = useState<DishIngredient[]>([]);
  const [formPriceBruttoOnSite, setFormPriceBruttoOnSite] = useState("");

  const filtered = dishes.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const calcBrutto = (n: number, v: number) => +(n * (1 + v / 100)).toFixed(2);
  const calcNetto = (b: number, v: number) => +(b / (1 + v / 100)).toFixed(2);

  const handleNettoChange = (val: string) => { setFormPriceNetto(val); const n = parseFloat(val); if (!isNaN(n)) setFormPriceBrutto(calcBrutto(n, formVat).toString()); };
  const handleBruttoChange = (val: string) => { setFormPriceBrutto(val); const b = parseFloat(val); if (!isNaN(b)) setFormPriceNetto(calcNetto(b, formVat).toString()); };
  const handleVatChange = (val: string) => { const vat = parseInt(val); setFormVat(vat); const n = parseFloat(formPriceNetto); if (!isNaN(n)) setFormPriceBrutto(calcBrutto(n, vat).toString()); };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormLongDesc(""); setFormImage(null); setFormPriceNetto(""); setFormVat(8);
    setFormPriceBrutto(""); setFormUnitLabel("szt."); setFormMinQty("1"); setFormIcon("🍽️");
    setFormCategorySlug(null); setFormAllergens([]); setFormDietaryTags([]); setFormContents("");
    setFormIngredients([]); setFormPriceBruttoOnSite(""); setShowForm(false); setEditingId(null);
  };

  const startEdit = (d: Dish) => {
    setEditingId(d.id); setFormName(d.name); setFormDesc(d.description); setFormLongDesc(d.longDescription);
    setFormImage(d.image); setFormPriceNetto(d.priceNetto.toString()); setFormVat(d.vatRate);
    setFormPriceBrutto(d.priceBrutto.toString()); setFormUnitLabel(d.unitLabel); setFormMinQty(d.minQuantity.toString());
    setFormIcon(d.icon); setFormCategorySlug(d.categorySlug); setFormAllergens([...d.allergens]);
    setFormDietaryTags([...d.dietaryTags]); setFormContents(d.contents.join("\n"));
    setFormIngredients([...d.dishIngredients]);
    setFormPriceBruttoOnSite(d.pricePerUnitOnSite != null ? d.pricePerUnitOnSite.toString() : "");
    setShowForm(true);
  };

  const saveDish = async () => {
    if (!formName.trim() || !formCategorySlug) { toast.error("Podaj nazwę i wybierz kategorię"); return; }
    setSaving(true);
    const priceBrutto = parseFloat(formPriceBrutto) || 0;
    const payload = {
      name: formName.trim(), description: formDesc.trim(), long_description: formLongDesc.trim(),
      image_url: formImage, price_netto: parseFloat(formPriceNetto) || 0, vat_rate: formVat,
      price_brutto: priceBrutto, price_per_unit: priceBrutto,
      price_per_unit_on_site: formPriceBruttoOnSite ? parseFloat(formPriceBruttoOnSite) || null : null,
      unit_label: formUnitLabel,
      min_quantity: parseInt(formMinQty) || 1, icon: formIcon, category_slug: formCategorySlug,
      allergens: formAllergens, dietary_tags: formDietaryTags,
      contents: formContents.split("\n").map(s => s.trim()).filter(Boolean),
      product_type: "simple",
    };

    const payloadWithIngredients = {
      ...payload,
      dish_ingredients: formIngredients.map((di) => ({ ingredient_id: di.ingredientId, quantity: di.quantity })),
    };
    try {
      if (editingId) {
        await api.updateDish(editingId, payloadWithIngredients);
      } else {
        await api.createDish(payloadWithIngredients);
      }
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success(editingId ? "Danie zaktualizowane" : "Danie dodane");
    resetForm();
    reload();
  };

  const removeDish = async (id: string) => {
    try {
      await api.deleteDish(id);
      toast.success("Usunięto");
      reload();
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Szukaj dania..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Dodaj danie
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? "Edytuj danie" : "Nowe danie"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <ImageUpload image={formImage} onChange={setFormImage} />
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nazwa dania</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="np. Patera Serów" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Krótki opis</Label>
                  <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="np. Dla 7-8 osób" />
                </div>
              </div>
            </div>

            <CategorySelect value={formCategorySlug} onChange={setFormCategorySlug} categories={categories} />

            <div className="space-y-1">
              <Label className="text-xs">Długi opis (modal)</Label>
              <Input value={formLongDesc} onChange={(e) => setFormLongDesc(e.target.value)} placeholder="Szczegółowy opis widoczny w modalu..." />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cena netto (zł)</Label>
                <Input type="number" step="0.01" value={formPriceNetto} onChange={(e) => handleNettoChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">VAT</Label>
                <Select value={formVat.toString()} onValueChange={handleVatChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map((r) => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena brutto (zł)</Label>
                <Input type="number" step="0.01" value={formPriceBrutto} onChange={(e) => handleBruttoChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena brutto sala (zł)</Label>
                <Input type="number" step="0.01" value={formPriceBruttoOnSite} onChange={(e) => setFormPriceBruttoOnSite(e.target.value)} placeholder="—" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Jednostka</Label>
                <Input value={formUnitLabel} onChange={(e) => setFormUnitLabel(e.target.value)} placeholder="szt." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min. ilość</Label>
                <Input type="number" value={formMinQty} onChange={(e) => setFormMinQty(e.target.value)} />
              </div>
            </div>

            {/* INGREDIENTS */}
            <IngredientPicker ingredients={ingredients} dishIngredients={formIngredients} onChange={setFormIngredients} />

            <div className="space-y-1">
              <Label className="text-xs">Zawartość (każdy element w nowej linii)</Label>
              <textarea value={formContents} onChange={(e) => setFormContents(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={"Brie francuski 150g\nCamembert z ziołami 150g\n..."} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Alergeny</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGEN_OPTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => setFormAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      formAllergens.includes(a) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    )}>{a}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tagi dietetyczne</Label>
              <div className="flex flex-wrap gap-1.5">
                {DIETARY_OPTIONS.map((t) => (
                  <button key={t} type="button" onClick={() => setFormDietaryTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      formDietaryTags.includes(t) ? "bg-accent text-accent-foreground border-accent" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    )}>{t}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={saveDish} disabled={!formName.trim() || saving}>
                <Check className="w-4 h-4 mr-1" />{saving ? "Zapisuję..." : editingId ? "Zapisz" : "Dodaj danie"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((dish) => (
          <Card key={dish.id} className="group hover:shadow-sm transition-shadow">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {dish.image ? <img src={dish.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <CookingPot className="w-5 h-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium">{dish.name}</p>
                  {dish.categorySlug && <p className="text-xs text-muted-foreground">{dish.categorySlug}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary">{dish.priceBrutto.toFixed(2)} zł</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(dish)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeDish(dish.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak dań</p>}
      </div>
    </div>
  );
};

// ===== BUNDLES TAB =====
const BundlesTab = ({ bundles, dishes, categories, reload }: { bundles: Bundle[]; dishes: Dish[]; categories: CategoryOption[]; reload: () => void }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLongDesc, setFormLongDesc] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formPriceNetto, setFormPriceNetto] = useState("");
  const [formVat, setFormVat] = useState(8);
  const [formPriceBrutto, setFormPriceBrutto] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("");
  const [formMinQty, setFormMinQty] = useState("1");
  const [formIcon, setFormIcon] = useState("🍽️");
  const [formCategorySlug, setFormCategorySlug] = useState<string | null>(null);
  const [formVariants, setFormVariants] = useState<BundleVariant[]>([]);

  // Variant: pick from dishes
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  const calcBrutto = (n: number, v: number) => +(n * (1 + v / 100)).toFixed(2);
  const calcNetto = (b: number, v: number) => +(b / (1 + v / 100)).toFixed(2);

  const handleNettoChange = (val: string) => { setFormPriceNetto(val); const n = parseFloat(val); if (!isNaN(n)) setFormPriceBrutto(calcBrutto(n, formVat).toString()); };
  const handleBruttoChange = (val: string) => { setFormPriceBrutto(val); const b = parseFloat(val); if (!isNaN(b)) setFormPriceNetto(calcNetto(b, formVat).toString()); };
  const handleVatChange = (val: string) => { const vat = parseInt(val); setFormVat(vat); const n = parseFloat(formPriceNetto); if (!isNaN(n)) setFormPriceBrutto(calcBrutto(n, vat).toString()); };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormLongDesc(""); setFormImage(null); setFormPriceNetto("");
    setFormVat(8); setFormPriceBrutto(""); setFormBasePrice(""); setFormMinQty("1"); setFormIcon("🍽️");
    setFormCategorySlug(null); setFormVariants([]); setShowForm(false); setEditingId(null);
    setShowVariantPicker(false);
  };

  const addDishAsVariant = (dish: Dish) => {
    // Don't add duplicate
    if (formVariants.some(v => v.dishId === dish.id)) {
      toast.info("To danie jest już dodane jako wariant");
      return;
    }
    const v: BundleVariant = {
      id: crypto.randomUUID(), name: dish.name, description: dish.description,
      price: dish.priceBrutto, priceOnSite: null, allergens: [...dish.allergens],
      dietaryTags: [...dish.dietaryTags], sortOrder: formVariants.length,
      dishId: dish.id,
    };
    setFormVariants([...formVariants, v]);
    setShowVariantPicker(false);
  };

  const startEdit = (b: Bundle) => {
    setEditingId(b.id); setFormName(b.name); setFormDesc(b.description); setFormLongDesc(b.longDescription);
    setFormImage(b.image); setFormPriceNetto(b.priceNetto.toString()); setFormVat(b.vatRate);
    setFormPriceBrutto(b.priceBrutto.toString()); setFormBasePrice(b.basePrice.toString());
    setFormMinQty(b.minQuantity.toString()); setFormIcon(b.icon); setFormCategorySlug(b.categorySlug);
    setFormVariants([...b.variants]); setShowForm(true);
  };

  const save = async () => {
    if (!formName.trim() || !formCategorySlug) { toast.error("Podaj nazwę i wybierz kategorię"); return; }
    setSaving(true);
    const priceBrutto = parseFloat(formPriceBrutto) || 0;
    const bundlePayload = {
      name: formName.trim(), description: formDesc.trim(), long_description: formLongDesc.trim(),
      image_url: formImage, price_netto: parseFloat(formPriceNetto) || 0, vat_rate: formVat,
      price_brutto: priceBrutto, base_price: parseFloat(formBasePrice) || priceBrutto,
      min_quantity: parseInt(formMinQty) || 1, icon: formIcon, category_slug: formCategorySlug,
    };

    const bundleVariantsPayload = formVariants.map((v, i) => ({
      name: v.name,
      description: v.description ?? "",
      price: v.price,
      price_on_site: v.priceOnSite,
      allergens: v.allergens ?? [],
      dietary_tags: v.dietaryTags ?? [],
      sort_order: i,
      dish_id: v.dishId || null,
    }));
    try {
      if (editingId) {
        await api.updateBundle(editingId, { ...bundlePayload, bundle_variants: bundleVariantsPayload });
      } else {
        await api.createBundle({ ...bundlePayload, bundle_variants: bundleVariantsPayload });
      }
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success(editingId ? "Pakiet zaktualizowany" : "Pakiet dodany");
    resetForm();
    reload();
  };

  const remove = async (id: string) => {
    try {
      await api.deleteBundle(id);
      toast.success("Usunięto");
      reload();
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Pakiety z wariantami — warianty tworzone z istniejących dań</p>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Dodaj pakiet
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? "Edytuj pakiet" : "Nowy pakiet"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <ImageUpload image={formImage} onChange={setFormImage} />
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nazwa</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="np. Meksykańskie Tacos" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Opis</Label>
                  <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                </div>
              </div>
            </div>

            <CategorySelect value={formCategorySlug} onChange={setFormCategorySlug} categories={categories} />

            <div className="space-y-1">
              <Label className="text-xs">Długi opis</Label>
              <Input value={formLongDesc} onChange={(e) => setFormLongDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cena netto</Label>
                <Input type="number" step="0.01" value={formPriceNetto} onChange={(e) => handleNettoChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">VAT</Label>
                <Select value={formVat.toString()} onValueChange={handleVatChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map((r) => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena brutto</Label>
                <Input type="number" step="0.01" value={formPriceBrutto} onChange={(e) => handleBruttoChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min. ilość</Label>
                <Input type="number" value={formMinQty} onChange={(e) => setFormMinQty(e.target.value)} />
              </div>
            </div>

            {/* Variants from dishes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Warianty z dań ({formVariants.length})</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowVariantPicker(!showVariantPicker)} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />Dodaj danie jako wariant
                </Button>
              </div>

              {formVariants.map((v) => {
                const linkedDish = v.dishId ? dishes.find(d => d.id === v.dishId) : null;
                return (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v.name}</span>
                        <span className="text-xs text-muted-foreground">{v.price.toFixed(2)} zł</span>
                        {v.priceOnSite != null && <span className="text-xs text-muted-foreground">(sala: {v.priceOnSite.toFixed(2)} zł)</span>}
                        {linkedDish && <Badge variant="outline" className="text-[10px] px-1.5 py-0">🔗 danie</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Input type="number" step="0.01" value={v.price} onChange={(e) => setFormVariants(formVariants.map(fv => fv.id === v.id ? {...fv, price: parseFloat(e.target.value) || 0} : fv))} className="h-7 w-24 text-xs" placeholder="Cena" />
                        <Input type="number" step="0.01" value={v.priceOnSite ?? ""} onChange={(e) => setFormVariants(formVariants.map(fv => fv.id === v.id ? {...fv, priceOnSite: e.target.value ? parseFloat(e.target.value) : null} : fv))} className="h-7 w-24 text-xs" placeholder="Cena sala" />
                      </div>
                      {v.allergens.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {v.allergens.map(a => <Badge key={a} variant="secondary" className="text-[9px] px-1 py-0">{a}</Badge>)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setFormVariants(formVariants.filter(fv => fv.id !== v.id))}
                      className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}

              {showVariantPicker && (
                <div className="p-3 rounded-lg border-2 border-dashed border-primary/30">
                  <Label className="text-xs mb-2 block">Wybierz danie jako wariant:</Label>
                  <DishPicker dishes={dishes} selectedDishId={null} onSelect={addDishAsVariant} />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={save} disabled={!formName.trim() || saving}>
                <Check className="w-4 h-4 mr-1" />{saving ? "Zapisuję..." : editingId ? "Zapisz" : "Dodaj pakiet"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {bundles.map((b) => (
          <Card key={b.id} className="group hover:shadow-sm transition-shadow">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {b.image ? <img src={b.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Package className="w-5 h-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  {b.categorySlug && <p className="text-xs text-muted-foreground">{b.categorySlug}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary">{b.priceBrutto.toFixed(2)} zł</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(b)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(b.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {bundles.length === 0 && !showForm && <p className="text-sm text-muted-foreground text-center py-6">Brak pakietów</p>}
      </div>
    </div>
  );
};

// ===== CONFIG SETS TAB =====
const ConfigSetsTab = ({ configSets, dishes, categories, reload }: { configSets: ConfigSet[]; dishes: Dish[]; categories: CategoryOption[]; reload: () => void }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLongDesc, setFormLongDesc] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formPrice, setFormPrice] = useState("");
  const [formPriceOnSite, setFormPriceOnSite] = useState("");
  const [formMinPersons, setFormMinPersons] = useState("10");
  const [formIcon, setFormIcon] = useState("🍽️");
  const [formCategorySlug, setFormCategorySlug] = useState<string | null>(null);
  const [formGroups, setFormGroups] = useState<ConfigGroup[]>([]);

  // Group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupMin, setGroupMin] = useState("1");
  const [groupMax, setGroupMax] = useState("3");
  const [groupOptions, setGroupOptions] = useState<ConfigGroupOption[]>([]);

  // Option: pick from dishes
  const [showDishPickerForGroup, setShowDishPickerForGroup] = useState(false);

  const resetGroupForm = () => {
    setGroupName(""); setGroupMin("1"); setGroupMax("3"); setGroupOptions([]);
    setShowGroupForm(false); setEditingGroupId(null); setShowDishPickerForGroup(false);
  };
  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormLongDesc(""); setFormImage(null); setFormPrice("");
    setFormPriceOnSite("");
    setFormMinPersons("10"); setFormIcon("🍽️"); setFormCategorySlug(null); setFormGroups([]);
    setShowForm(false); setEditingId(null); resetGroupForm();
  };

  const addDishAsOption = (dish: Dish) => {
    if (groupOptions.some(o => o.dishId === dish.id)) {
      toast.info("To danie jest już dodane");
      return;
    }
    setGroupOptions([...groupOptions, {
      id: crypto.randomUUID(), name: dish.name,
      allergens: [...dish.allergens], sortOrder: groupOptions.length,
      dishId: dish.id,
    }]);
    setShowDishPickerForGroup(false);
  };

  const saveGroup = () => {
    if (!groupName.trim()) return;
    const g: ConfigGroup = {
      id: editingGroupId || crypto.randomUUID(), name: groupName.trim(),
      minSelections: parseInt(groupMin) || 1, maxSelections: parseInt(groupMax) || 3,
      options: groupOptions, sortOrder: formGroups.length,
    };
    if (editingGroupId) setFormGroups(formGroups.map(fg => fg.id === editingGroupId ? g : fg));
    else setFormGroups([...formGroups, g]);
    resetGroupForm();
  };

  const editGroup = (g: ConfigGroup) => {
    setEditingGroupId(g.id); setGroupName(g.name); setGroupMin(g.minSelections.toString());
    setGroupMax(g.maxSelections.toString()); setGroupOptions([...g.options]); setShowGroupForm(true);
  };

  const startEdit = (cs: ConfigSet) => {
    setEditingId(cs.id); setFormName(cs.name); setFormDesc(cs.description); setFormLongDesc(cs.longDescription);
    setFormImage(cs.image); setFormPrice(cs.pricePerPerson.toString());
    setFormPriceOnSite(cs.pricePerPersonOnSite != null ? cs.pricePerPersonOnSite.toString() : "");
    setFormMinPersons(cs.minPersons.toString());
    setFormIcon(cs.icon); setFormCategorySlug(cs.categorySlug); setFormGroups([...cs.groups]); setShowForm(true);
  };

  const save = async () => {
    if (!formName.trim() || !formCategorySlug) { toast.error("Podaj nazwę i wybierz kategorię"); return; }
    setSaving(true);
    const setPayload = {
      name: formName.trim(), description: formDesc.trim(), long_description: formLongDesc.trim(),
      image_url: formImage, price_per_person: parseFloat(formPrice) || 0,
      price_per_person_on_site: formPriceOnSite ? parseFloat(formPriceOnSite) || null : null,
      min_persons: parseInt(formMinPersons) || 10, icon: formIcon, category_slug: formCategorySlug,
    };

    const configGroupsPayload = formGroups.map((g, gi) => ({
      name: g.name,
      min_selections: g.minSelections,
      max_selections: g.maxSelections,
      sort_order: gi,
      config_group_options: g.options.map((o, oi) => ({
        name: o.name,
        allergens: o.allergens ?? [],
        sort_order: oi,
        dish_id: o.dishId || null,
      })),
    }));
    try {
      if (editingId) {
        await api.updateConfigurableSet(editingId, { ...setPayload, config_groups: configGroupsPayload });
      } else {
        await api.createConfigurableSet({ ...setPayload, config_groups: configGroupsPayload });
      }
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success(editingId ? "Zestaw zaktualizowany" : "Zestaw dodany");
    resetForm();
    reload();
  };

  const remove = async (id: string) => {
    try {
      await api.deleteConfigurableSet(id);
      toast.success("Usunięto");
      reload();
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Zestawy konfigurowalne — opcje tworzone z istniejących dań</p>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Dodaj zestaw
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? "Edytuj zestaw" : "Nowy zestaw"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <ImageUpload image={formImage} onChange={setFormImage} />
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nazwa</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="np. Zestaw Obiadowy" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Opis</Label>
                  <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                </div>
              </div>
            </div>

            <CategorySelect value={formCategorySlug} onChange={setFormCategorySlug} categories={categories} />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cena za osobę (zł)</Label>
                <Input type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena za osobę sala (zł)</Label>
                <Input type="number" step="0.01" value={formPriceOnSite} onChange={(e) => setFormPriceOnSite(e.target.value)} placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min. osób</Label>
                <Input type="number" value={formMinPersons} onChange={(e) => setFormMinPersons(e.target.value)} />
              </div>
            </div>

            {/* Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Grupy opcji ({formGroups.length})</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => { resetGroupForm(); setShowGroupForm(true); }} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />Dodaj grupę
                </Button>
              </div>

              {formGroups.map((g) => (
                <div key={g.id} className="p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">(wybór: {g.minSelections}–{g.maxSelections})</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => editGroup(g)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setFormGroups(formGroups.filter(fg => fg.id !== g.id))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => (
                      <Badge key={o.id} variant="secondary" className="text-[10px]">
                        {o.dishId && "🔗 "}{o.name}
                        {o.allergens.length > 0 && <span className="ml-1 opacity-60">({o.allergens.join(", ")})</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}

              {showGroupForm && (
                <div className="p-3 rounded-lg border-2 border-dashed border-primary/30 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nazwa grupy</Label>
                      <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="np. Dania główne" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Min. wybór</Label>
                      <Input type="number" value={groupMin} onChange={(e) => setGroupMin(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max. wybór</Label>
                      <Input type="number" value={groupMax} onChange={(e) => setGroupMax(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>

                  {/* Options from dishes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Opcje z dań ({groupOptions.length})</Label>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowDishPickerForGroup(!showDishPickerForGroup)} className="text-xs h-7">
                        <Plus className="w-3 h-3 mr-1" />Dodaj danie
                      </Button>
                    </div>

                    {groupOptions.map((o) => (
                      <div key={o.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs">
                        <span>{o.dishId && "🔗 "}{o.name} {o.allergens.length > 0 && <span className="text-muted-foreground">({o.allergens.join(", ")})</span>}</span>
                        <button onClick={() => setGroupOptions(groupOptions.filter(go => go.id !== o.id))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ))}

                    {showDishPickerForGroup && (
                      <DishPicker dishes={dishes} selectedDishId={null} onSelect={addDishAsOption} />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveGroup} disabled={!groupName.trim()} className="text-xs">
                      {editingGroupId ? "Zapisz grupę" : "Dodaj grupę"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetGroupForm} className="text-xs">Anuluj</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={save} disabled={!formName.trim() || saving}>
                <Check className="w-4 h-4 mr-1" />{saving ? "Zapisuję..." : editingId ? "Zapisz" : "Dodaj zestaw"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {configSets.map((cs) => (
          <Card key={cs.id} className="group hover:shadow-sm transition-shadow">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {cs.image ? <img src={cs.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Settings2 className="w-5 h-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium">{cs.name}</p>
                  {cs.categorySlug && <p className="text-xs text-muted-foreground">{cs.categorySlug}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary">{cs.pricePerPerson} zł/os.</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(cs)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(cs.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {configSets.length === 0 && !showForm && <p className="text-sm text-muted-foreground text-center py-6">Brak zestawów</p>}
      </div>
    </div>
  );
};

// ===== MAIN =====
const SettingsDishesView = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extrasCategories, setExtrasCategories] = useState<{id:string;name:string;slug:string}[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catData, ecData, ingData, diData, dishData, bundleData, setData, extrasData] = await Promise.all([
        api.getAdminProductCategories(),
        api.getAdminExtrasCategories(),
        api.getAdminIngredients(),
        api.getAdminDishIngredients(),
        api.getAdminDishes(),
        api.getAdminBundles(),
        api.getAdminConfigurableSets(),
        api.getAdminExtras(),
      ]);
      const cats = (Array.isArray(catData) ? catData : []) as Record<string, unknown>[];
      setCategories(cats.map((c) => ({ slug: String(c.slug ?? ""), name: String(c.name ?? "") })));

      const ec = (Array.isArray(ecData) ? ecData : []) as Record<string, unknown>[];
      setExtrasCategories(ec.map((c) => ({ id: String(c.id), name: String(c.name ?? ""), slug: String(c.slug ?? "") })));

      const ing = (Array.isArray(ingData) ? ingData : []) as Record<string, unknown>[];
      setIngredients(ing.map((i) => ({
        id: String(i.id),
        name: String(i.name ?? ""),
        unit: (i.unit as UnitType) ?? "g",
        allergens: (i.allergens as string[]) ?? [],
        pricePerUnit: Number(i.pricePerUnit ?? i.price_per_unit ?? 0),
      })));

      const di = (Array.isArray(diData) ? diData : []) as Record<string, unknown>[];
      const dishIngredientsMap: Record<string, DishIngredient[]> = {};
      di.forEach((row) => {
        const dishId = String(row.dishId ?? row.dish_id);
        if (!dishIngredientsMap[dishId]) dishIngredientsMap[dishId] = [];
        dishIngredientsMap[dishId].push({
          ingredientId: String(row.ingredientId ?? row.ingredient_id),
          quantity: Number(row.quantity ?? 0),
        });
      });

      const dishesArr = (Array.isArray(dishData) ? dishData : []) as Record<string, unknown>[];
      setDishes(dishesArr.map((d) => ({
        id: String(d.id),
        name: String(d.name ?? ""),
        description: String(d.description ?? ""),
        longDescription: String(d.longDescription ?? d.long_description ?? ""),
        image: (d.imageUrl ?? d.image_url ?? null) as string | null,
        priceNetto: Number(d.priceNetto ?? d.price_netto ?? 0),
        vatRate: Number(d.vatRate ?? d.vat_rate ?? 8),
        priceBrutto: Number(d.priceBrutto ?? d.price_brutto ?? 0),
        pricePerUnit: Number(d.pricePerUnit ?? d.price_per_unit ?? d.priceBrutto ?? d.price_brutto ?? 0),
        pricePerUnitOnSite: d.pricePerUnitOnSite ?? d.price_per_unit_on_site != null ? Number(d.pricePerUnitOnSite ?? d.price_per_unit_on_site) : null,
        unitLabel: String(d.unitLabel ?? d.unit_label ?? "szt."),
        minQuantity: Number(d.minQuantity ?? d.min_quantity ?? 1),
        icon: String(d.icon ?? "🍽️"),
        categorySlug: (d.categorySlug ?? d.category_slug ?? null) as string | null,
        contents: (d.contents as string[]) ?? [],
        allergens: (d.allergens as string[]) ?? [],
        dietaryTags: (d.dietaryTags as string[]) ?? (d.dietary_tags as string[]) ?? [],
        productType: String(d.productType ?? d.product_type ?? "dish"),
        dishIngredients: dishIngredientsMap[String(d.id)] ?? [],
      })));

      const bundlesArr = (Array.isArray(bundleData) ? bundleData : []) as Record<string, unknown>[];
      setBundles(bundlesArr.map((b) => {
        const vars = (b.bundleVariants ?? b.bundle_variants ?? []) as Array<Record<string, unknown>>;
        const sorted = [...vars].sort((a, b) => (Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)));
        return {
          id: String(b.id),
          name: String(b.name ?? ""),
          description: String(b.description ?? ""),
          longDescription: String(b.longDescription ?? b.long_description ?? ""),
          image: (b.imageUrl ?? b.image_url ?? null) as string | null,
          priceNetto: Number(b.priceNetto ?? b.price_netto ?? 0),
          vatRate: Number(b.vatRate ?? b.vat_rate ?? 8),
          priceBrutto: Number(b.priceBrutto ?? b.price_brutto ?? 0),
          basePrice: Number(b.basePrice ?? b.base_price ?? 0),
          minQuantity: Number(b.minQuantity ?? b.min_quantity ?? 1),
          icon: String(b.icon ?? "🍽️"),
          categorySlug: (b.categorySlug ?? b.category_slug ?? null) as string | null,
          variants: sorted.map((v) => ({
            id: String(v.id),
            name: String(v.name ?? ""),
            description: String(v.description ?? ""),
            price: Number(v.price ?? 0),
            priceOnSite: v.priceOnSite ?? v.price_on_site != null ? Number(v.priceOnSite ?? v.price_on_site) : null,
            allergens: (v.allergens as string[]) ?? [],
            dietaryTags: (v.dietaryTags as string[]) ?? (v.dietary_tags as string[]) ?? [],
            sortOrder: Number(v.sortOrder ?? v.sort_order ?? 0),
            dishId: (v.dishId ?? v.dish_id ?? null) as string | null,
          })),
        };
      }));

      const setsArr = (Array.isArray(setData) ? setData : []) as Record<string, unknown>[];
      setConfigSets(setsArr.map((s) => {
        const grps = (s.configGroups ?? s.config_groups ?? []) as Array<Record<string, unknown>>;
        const sortedGrps = [...grps].sort((a, b) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0));
        return {
          id: String(s.id),
          name: String(s.name ?? ""),
          description: String(s.description ?? ""),
          longDescription: String(s.longDescription ?? s.long_description ?? ""),
          image: (s.imageUrl ?? s.image_url ?? null) as string | null,
          pricePerPerson: Number(s.pricePerPerson ?? s.price_per_person ?? 0),
          pricePerPersonOnSite: s.pricePerPersonOnSite ?? s.price_per_person_on_site != null ? Number(s.pricePerPersonOnSite ?? s.price_per_person_on_site) : null,
          minPersons: Number(s.minPersons ?? s.min_persons ?? 10),
          icon: String(s.icon ?? "🍽️"),
          categorySlug: (s.categorySlug ?? s.category_slug ?? null) as string | null,
          groups: sortedGrps.map((g: Record<string, unknown>) => {
            const opts = (g.options ?? g.config_group_options ?? []) as Array<Record<string, unknown>>;
            const sortedOpts = [...opts].sort((a, b) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0));
            return {
              id: String(g.id),
              name: String(g.name ?? ""),
              minSelections: Number(g.minSelections ?? g.min_selections ?? 1),
              maxSelections: Number(g.maxSelections ?? g.max_selections ?? 3),
              sortOrder: Number(g.sortOrder ?? g.sort_order ?? 0),
              options: sortedOpts.map((o: Record<string, unknown>) => ({
                id: String(o.id),
                name: String(o.name ?? ""),
                allergens: (o.allergens as string[]) ?? [],
                sortOrder: Number(o.sortOrder ?? o.sort_order ?? 0),
                dishId: (o.dishId ?? o.dish_id ?? null) as string | null,
              })),
            };
          }),
        };
      }));

      const extrasArr = (Array.isArray(extrasData) ? extrasData : []) as Record<string, unknown>[];
      setExtras(extrasArr.map((e) => ({
        id: String(e.id),
        name: String(e.name ?? ""),
        description: String(e.description ?? ""),
        longDescription: String(e.longDescription ?? e.long_description ?? ""),
        image: (e.imageUrl ?? e.image_url ?? null) as string | null,
        category: String(e.category ?? ""),
        extrasCategoryId: (e.extrasCategoryId ?? e.extras_category_id ?? null) as string | null,
        price: Number(e.price ?? 0),
        priceNetto: Number(e.priceNetto ?? e.price_netto ?? 0),
        vatRate: Number(e.vatRate ?? e.vat_rate ?? 23),
        priceBrutto: Number(e.priceBrutto ?? e.price_brutto ?? e.price ?? 0),
        priceOnSite: e.priceOnSite ?? e.price_on_site != null ? Number(e.priceOnSite ?? e.price_on_site) : null,
        unitLabel: String(e.unitLabel ?? e.unit_label ?? "szt."),
        priceLabel: String(e.priceLabel ?? e.price_label ?? ""),
        requiresPersonCount: Boolean(e.requiresPersonCount ?? e.requires_person_count ?? false),
        duration: (e.duration ?? null) as string | null,
        contents: (e.contents as string[]) ?? [],
        foodCost: Number(e.foodCost ?? e.food_cost ?? 0),
      })));
    } catch (err) {
      console.error("loadAll", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initial data load on mount */
    void loadAll();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Katalog produktów</h1>
        <p className="text-muted-foreground text-sm">Zarządzaj składnikami, daniami, pakietami, zestawami i dodatkami</p>
      </div>

      <Tabs defaultValue="dishes">
        <TabsList className="mb-4">
          <TabsTrigger value="ingredients" className="gap-1.5">
            <Apple className="w-3.5 h-3.5" />Składniki
          </TabsTrigger>
          <TabsTrigger value="dishes" className="gap-1.5">
            <CookingPot className="w-3.5 h-3.5" />Dania
          </TabsTrigger>
          <TabsTrigger value="bundles" className="gap-1.5">
            <Package className="w-3.5 h-3.5" />Pakiety
          </TabsTrigger>
          <TabsTrigger value="configsets" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />Zestawy
          </TabsTrigger>
          <TabsTrigger value="extras" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />Dodatki
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients">
          <IngredientsTab ingredients={ingredients} reload={loadAll} />
        </TabsContent>
        <TabsContent value="dishes">
          <DishesTab dishes={dishes} ingredients={ingredients} categories={categories} reload={loadAll} />
        </TabsContent>
        <TabsContent value="bundles">
          <BundlesTab bundles={bundles} dishes={dishes} categories={categories} reload={loadAll} />
        </TabsContent>
        <TabsContent value="configsets">
          <ConfigSetsTab configSets={configSets} dishes={dishes} categories={categories} reload={loadAll} />
        </TabsContent>
        <TabsContent value="extras">
          <ExtrasTabComponent extras={extras} extrasCategories={extrasCategories} reload={loadAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsDishesView;
