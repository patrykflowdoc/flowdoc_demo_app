import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, icons, AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import * as api from "@/api/client";
import { toast } from "@/components/ui/sonner";

type LucideIconName = keyof typeof icons;

interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIconName;
  slug: string;
}

interface ExtrasCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIconName;
  slug: string;
  isRequired: boolean;
}

interface EventType {
  id: string;
  name: string;
  icon: LucideIconName;
  allowedCategoryIds: string[];
  allowedExtrasCategoryIds: string[];
}

const popularIcons: LucideIconName[] = [
  "Salad", "Cookie", "UtensilsCrossed", "Pizza", "Sandwich", "Soup",
  "Beef", "Fish", "Egg", "Apple", "CakeSlice", "Candy",
  "Wine", "Coffee", "GlassWater", "Drumstick", "Popcorn", "Cherry",
];

const IconPickerSmall = ({ value, onChange }: { value: LucideIconName; onChange: (v: LucideIconName) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const CurrentIcon = icons[value] as LucideIcon;

  const allIcons = search.trim()
    ? (Object.keys(icons) as LucideIconName[]).filter((n) => n.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : popularIcons;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn("w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors", open && "bg-muted ring-1 ring-primary")}
      >
        <CurrentIcon className="w-4 h-4 text-foreground" />
      </button>
      {open && (
        <div className="absolute top-11 left-0 z-50 w-64 bg-popover border border-border rounded-xl shadow-lg p-3 space-y-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj ikony..." className="h-8 text-xs" autoFocus />
          <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto">
            {allIcons.map((name) => {
              const Icon = icons[name] as LucideIcon;
              return (
                <button key={name} type="button" onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                  className={cn("w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors", value === name && "bg-primary text-primary-foreground")}
                  title={name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          {allIcons.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Brak wyników</p>}
        </div>
      )}
    </div>
  );
};

const SettingsFormView = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [extrasCategories, setExtrasCategories] = useState<ExtrasCategory[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatIcon, setNewCatIcon] = useState<LucideIconName>("Salad");

  const [showExCatForm, setShowExCatForm] = useState(false);
  const [newExCatName, setNewExCatName] = useState("");
  const [newExCatDesc, setNewExCatDesc] = useState("");
  const [newExCatIcon, setNewExCatIcon] = useState<LucideIconName>("Sparkles");
  const [newExCatRequired, setNewExCatRequired] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, evtsRes, mappingsRes, exCatsRes, exMappingsRes] = await Promise.all([
          api.getAdminProductCategories(),
          api.getAdminEventTypes(),
          api.getAdminEventCategoryMappings(),
          api.getAdminExtrasCategories(),
          api.getAdminEventExtrasCategoryMappings(),
        ]);
        const cats = (Array.isArray(catsRes) ? catsRes : []) as Record<string, unknown>[];
        const evts = (Array.isArray(evtsRes) ? evtsRes : []) as Record<string, unknown>[];
        const mappings = (Array.isArray(mappingsRes) ? mappingsRes : []) as Record<string, unknown>[];
        const exCats = (Array.isArray(exCatsRes) ? exCatsRes : []) as Record<string, unknown>[];
        const exMappings = (Array.isArray(exMappingsRes) ? exMappingsRes : []) as Record<string, unknown>[];

        const categoryIconErrors: string[] = [];
        const mappedCategories: ProductCategory[] = [];
        for (const c of cats) {
          const iconName = String(c.icon ?? "");
          if (!(iconName in icons)) {
            categoryIconErrors.push(`produkt id=${String(c.id)} icon="${iconName}"`);
            continue;
          }
          mappedCategories.push({
            id: String(c.id), name: String(c.name ?? ""), description: String(c.description ?? ""),
            icon: iconName as LucideIconName, slug: String(c.slug ?? ""),
          });
        }
        setCategories(mappedCategories);

        const extrasIconErrors: string[] = [];
        const mappedExtrasCategories: ExtrasCategory[] = [];
        for (const c of exCats) {
          const iconName = String(c.icon ?? "");
          if (!(iconName in icons)) {
            extrasIconErrors.push(`dodatek id=${String(c.id)} icon="${iconName}"`);
            continue;
          }
          mappedExtrasCategories.push({
            id: String(c.id), name: String(c.name ?? ""), description: String(c.description ?? ""),
            icon: iconName as LucideIconName, slug: String(c.slug ?? ""),
            isRequired: Boolean(c.isRequired),
          });
        }
        setExtrasCategories(mappedExtrasCategories);

        const mappingsByEvent: Record<string, string[]> = {};
        mappings.forEach((m) => {
          const eid = String(m.eventTypeId);
          const cid = String(m.categoryId);
          if (!mappingsByEvent[eid]) mappingsByEvent[eid] = [];
          mappingsByEvent[eid].push(cid);
        });
        const extrasMappingsByEvent: Record<string, string[]> = {};
        exMappings.forEach((m) => {
          const eid = String(m.eventTypeId);
          const exid = String(m.extrasCategoryId);
          if (!extrasMappingsByEvent[eid]) extrasMappingsByEvent[eid] = [];
          extrasMappingsByEvent[eid].push(exid);
        });
        const eventIconErrors: string[] = [];
        const mappedEvents: EventType[] = [];
        for (const e of evts) {
          const iconName = String(e.icon ?? "");
          if (!(iconName in icons)) {
            eventIconErrors.push(`wydarzenie id=${String(e.id)} icon="${iconName}"`);
            continue;
          }
          mappedEvents.push({
            id: String(e.id), name: String(e.name ?? ""),
            icon: iconName as LucideIconName,
            allowedCategoryIds: mappingsByEvent[String(e.id)] || [],
            allowedExtrasCategoryIds: extrasMappingsByEvent[String(e.id)] || [],
          });
        }
        setEvents(mappedEvents);

        const allIconErrors = [...categoryIconErrors, ...extrasIconErrors, ...eventIconErrors];
        if (allIconErrors.length > 0) {
          toast.error(`Pominięto rekordy z nieznaną ikoną (${allIconErrors.length}). Szczegóły w konsoli.`);
          console.error("[SettingsFormView] Nieznane ikony:", allIconErrors);
        }
      } catch (err: unknown) {
        toast.error("Błąd ładowania formularza: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const slug = newCatName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const nextOrder = categories.length;

    try {
      const data = await api.createProductCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        icon: newCatIcon,
        slug,
        sortOrder: nextOrder,
      }) as Record<string, unknown>;
      const iconName = String(data.icon ?? "");
      if (!(iconName in icons)) {
        throw new Error(`Nieznana ikona nowej kategorii produktu: "${iconName}" (id: ${String(data.id)})`);
      }
      setCategories([...categories, {
        id: String(data.id),
        name: String(data.name ?? ""),
        description: String(data.description ?? ""),
        icon: iconName as LucideIconName,
        slug: String(data.slug ?? ""),
      }]);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setNewCatName("");
    setNewCatDesc("");
    setNewCatIcon("Salad");
    setShowCatForm(false);
    toast.success("Dodano kategorię");
  };

  const removeCategory = async (id: string) => {
    try {
      await api.deleteProductCategory(id);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setCategories(categories.filter((c) => c.id !== id));
    setEvents(events.map((e) => ({ ...e, allowedCategoryIds: e.allowedCategoryIds.filter((cid) => cid !== id) })));
    toast.success("Usunięto kategorię");
  };

  const toggleCategoryForEvent = async (eventId: string, categoryId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const has = event.allowedCategoryIds.includes(categoryId);

    try {
      if (has) {
        await api.deleteEventCategoryMapping({ eventTypeId: eventId, categoryId });
      } else {
        await api.createEventCategoryMapping({ eventTypeId: eventId, categoryId });
      }
    } catch {
      // ignore
    }

    setEvents(events.map((e) => {
      if (e.id !== eventId) return e;
      return {
        ...e,
        allowedCategoryIds: has
          ? e.allowedCategoryIds.filter((cid) => cid !== categoryId)
          : [...e.allowedCategoryIds, categoryId],
      };
    }));
  };

  // ─── Extras categories CRUD ───
  const addExtrasCategory = async () => {
    if (!newExCatName.trim()) return;
    const slug = newExCatName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-ąćęłńóśźż]/g, "");
    const nextOrder = extrasCategories.length;

    try {
      const data = await api.createExtrasCategory({
        name: newExCatName.trim(),
        description: newExCatDesc.trim(),
        icon: newExCatIcon,
        slug,
        sortOrder: nextOrder,
        isRequired: newExCatRequired,
      }) as Record<string, unknown>;
      const iconName = String(data.icon ?? "");
      if (!(iconName in icons)) {
        throw new Error(`Nieznana ikona nowej kategorii dodatków: "${iconName}" (id: ${String(data.id)})`);
      }
      setExtrasCategories([...extrasCategories, {
        id: String(data.id), name: String(data.name ?? ""), description: String(data.description ?? ""),
        icon: iconName as LucideIconName, slug: String(data.slug ?? ""),
        isRequired: Boolean(data.isRequired),
      }]);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setNewExCatName(""); setNewExCatDesc(""); setNewExCatIcon("Sparkles"); setNewExCatRequired(false);
    setShowExCatForm(false);
    toast.success("Dodano kategorię dodatków");
  };

  const removeExtrasCategory = async (id: string) => {
    try {
      await api.deleteExtrasCategory(id);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setExtrasCategories(extrasCategories.filter(c => c.id !== id));
    setEvents(events.map((e) => ({
      ...e,
      allowedExtrasCategoryIds: e.allowedExtrasCategoryIds.filter((exid) => exid !== id),
    })));
    toast.success("Usunięto kategorię dodatków");
  };

  const toggleExtrasCategoryRequired = async (id: string) => {
    const cat = extrasCategories.find(c => c.id === id);
    if (!cat) return;
    const newVal = !cat.isRequired;
    try {
      await api.updateExtrasCategory(id, { isRequired: newVal });
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setExtrasCategories(extrasCategories.map(c => c.id === id ? { ...c, isRequired: newVal } : c));
  };

  const toggleExtrasCategoryForEvent = async (eventId: string, extrasCategoryId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const has = event.allowedExtrasCategoryIds.includes(extrasCategoryId);

    try {
      if (has) {
        await api.deleteEventExtrasCategoryMapping({ eventTypeId: eventId, extrasCategoryId });
      } else {
        await api.createEventExtrasCategoryMapping({ eventTypeId: eventId, extrasCategoryId });
      }
    } catch {
      // ignore
    }

    setEvents(events.map((e) => {
      if (e.id !== eventId) return e;
      return {
        ...e,
        allowedExtrasCategoryIds: has
          ? e.allowedExtrasCategoryIds.filter((cid) => cid !== extrasCategoryId)
          : [...e.allowedExtrasCategoryIds, extrasCategoryId],
      };
    }));
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
        <h1 className="text-2xl font-bold text-foreground">Formularz</h1>
        <p className="text-muted-foreground text-sm">Zarządzaj kategoriami produktów, dodatków i ich dostępnością</p>
      </div>

      <div className="space-y-6">
        {/* Product categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Kategorie produktów</CardTitle>
                <CardDescription>Dodawaj i zarządzaj kategoriami widocznymi w formularzu zamówienia</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCatForm(!showCatForm)}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj kategorię
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showCatForm && (
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-start gap-3">
                  <IconPickerSmall value={newCatIcon} onChange={setNewCatIcon} />
                  <div className="flex-1 space-y-2">
                    <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nazwa kategorii" />
                    <Input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Krótki opis (opcjonalnie)" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCategory} disabled={!newCatName.trim()}>Dodaj</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCatForm(false)}>Anuluj</Button>
                </div>
              </div>
            )}

            {categories.map((cat) => {
              const catIconName = String(cat.icon ?? "");
              if (!(catIconName in icons)) {
                throw new Error(`Nieznana ikona kategorii: "${catIconName}" (id=${String(cat.id)})`);
              }
              const CatIcon = icons[catIconName as LucideIconName] as LucideIcon;
              return (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <CatIcon className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Extras categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Kategorie dodatków</CardTitle>
                <CardDescription>Zarządzaj kategoriami dodatków. Zaznacz "wymagane" aby klient musiał wybrać co najmniej jeden element z tej kategorii.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowExCatForm(!showExCatForm)}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj kategorię
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showExCatForm && (
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-start gap-3">
                  <IconPickerSmall value={newExCatIcon} onChange={setNewExCatIcon} />
                  <div className="flex-1 space-y-2">
                    <Input value={newExCatName} onChange={(e) => setNewExCatName(e.target.value)} placeholder="Nazwa kategorii dodatków" />
                    <Input value={newExCatDesc} onChange={(e) => setNewExCatDesc(e.target.value)} placeholder="Krótki opis (opcjonalnie)" />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={newExCatRequired} onCheckedChange={(v) => setNewExCatRequired(!!v)} className="w-4 h-4" />
                      <span className="font-medium">Wymagane</span>
                      <span className="text-muted-foreground text-xs">— klient musi wybrać min. 1 element</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addExtrasCategory} disabled={!newExCatName.trim()}>Dodaj</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowExCatForm(false)}>Anuluj</Button>
                </div>
              </div>
            )}

            {extrasCategories.map((cat) => {
              const CatIcon = icons[cat.icon] as LucideIcon;
              return (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <CatIcon className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{cat.name}</p>
                      {cat.isRequired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Wymagane
                        </span>
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                  <button
                    onClick={() => toggleExtrasCategoryRequired(cat.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                      cat.isRequired
                        ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cat.isRequired ? "Wymagane ✓" : "Opcjonalne"}
                  </button>
                  <button
                    onClick={() => removeExtrasCategory(cat.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {extrasCategories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak kategorii dodatków — dodaj pierwszą</p>}
          </CardContent>
        </Card>

        {/* Event → category mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kategorie dla rodzajów wydarzeń</CardTitle>
            <CardDescription>Określ, które kategorie produktów są widoczne dla danego typu wydarzenia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event) => {
                const EventIcon = icons[event.icon] as LucideIcon;
                return (
                  <div key={event.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <EventIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{event.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => {
                        const isChecked = event.allowedCategoryIds.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                              isChecked
                                ? "bg-accent border-primary/30 text-accent-foreground"
                                : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCategoryForEvent(event.id, cat.id)}
                              className="w-3.5 h-3.5"
                            />
                            {cat.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event -> extras category mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kategorie dodatkow dla rodzajow wydarzen</CardTitle>
            <CardDescription>Okresl, ktore kategorie dodatkow sa widoczne dla danego typu wydarzenia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event) => {
                const EventIcon = icons[event.icon] as LucideIcon;
                return (
                  <div key={event.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <EventIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{event.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {extrasCategories.map((cat) => {
                        const isChecked = event.allowedExtrasCategoryIds.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                              isChecked
                                ? "bg-accent border-primary/30 text-accent-foreground"
                                : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleExtrasCategoryForEvent(event.id, cat.id)}
                              className="w-3.5 h-3.5"
                            />
                            {cat.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsFormView;
