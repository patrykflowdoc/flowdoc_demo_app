import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, icons } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { Checkbox } from "@/components/ui/checkbox";

export type LucideIconName = keyof typeof icons;

const popularIcons: LucideIconName[] = [
  "Heart", "Gift", "Briefcase", "Music", "CalendarDays", "Presentation",
  "PartyPopper", "Cake", "GlassWater", "Utensils", "Baby", "Church",
  "Building2", "Mic", "Trophy", "Star", "Users", "Handshake",
  "Sparkles", "Wine", "TreePine", "Sun", "Moon", "Camera",
  "Palette", "Flower2", "Crown", "Gem", "Ribbon", "Flag",
  "Mic", "GraduationCap", "Plane", "Tent", "Drama", "Glasses",
];

interface EventType {
  id: string;
  name: string;
  icon: LucideIconName;
  sort_order: number;
  isCatering: boolean;
}

interface ExtraCategory {
  id: string;
  name: string;
  icon: LucideIconName;
  sort_order: number;
}

const IconPicker = ({ value, onChange }: { value: LucideIconName; onChange: (icon: LucideIconName) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const CurrentIcon = icons[value];

  const allIcons = search.trim()
    ? (Object.keys(icons) as LucideIconName[]).filter((name) =>
        name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 40)
    : popularIcons;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors",
          open && "bg-muted ring-1 ring-primary"
        )}
      >
        <CurrentIcon className="w-4 h-4 text-foreground" />
      </button>

      {open && (
        <div className="absolute top-11 left-0 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg p-3 space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj ikony..."
            className="h-8 text-xs"
            autoFocus
          />
          <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
            {allIcons.map((name) => {
              const Icon = icons[name];
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors",
                    value === name && "bg-primary text-primary-foreground"
                  )}
                  title={name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          {allIcons.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Brak wyników</p>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsEventsView = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>([]);
  const [newEventName, setNewEventName] = useState("");
  const [newEventIcon, setNewEventIcon] = useState<LucideIconName>("CalendarDays");
  const [loading, setLoading] = useState(true);
  const [newExtraCategoryName, setNewExtraCategoryName] = useState("");
  const [newExtraCategoryIcon, setNewExtraCategoryIcon] = useState<LucideIconName>("Sparkles");
  useEffect(() => {
    api.getAdminEventTypes()
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? data : [];
        setEvents(arr.map((e: Record<string, unknown>) => ({
          id: String(e.id),
          name: String(e.name ?? ""),
          icon: (e.icon as LucideIconName) || "CalendarDays",
          sort_order: Number(e.sortOrder ?? 0),
          isCatering: Boolean(e.isCatering ?? true),
        })));
      })
      .catch(console.error)
    api.getAdminExtrasCategories()
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? data : [];
        setExtraCategories(arr.map((e: Record<string, unknown>) => ({
          id: String(e.id),
          name: String(e.name ?? ""),
          icon: (e.icon as LucideIconName) || "CalendarDays",
          sort_order: Number(e.sortOrder ?? 0),
        })));
      }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addEvent = async () => {
    if (!newEventName.trim()) return;
    const nextOrder = events.length > 0 ? Math.max(...events.map((e) => e.sort_order)) + 1 : 0;
    try {
      const data = await api.createEventType({
        name: newEventName.trim(),
        icon: newEventIcon,
        sortOrder: nextOrder,
      }) as Record<string, unknown>;
      setEvents([...events, {
        id: String(data.id),
        name: String(data.name ?? ""),
        icon: (data.icon as LucideIconName) || "CalendarDays",
        sort_order: Number(data.sortOrder ?? 0),
        isCatering: Boolean(data.isCatering ?? true),
      }]);
      setNewEventName("");
      setNewEventIcon("CalendarDays");
      toast.success("Dodano typ wydarzenia");
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const removeEvent = async (id: string) => {
    try {
      await api.deleteEventType(id);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setEvents(events.filter((e) => e.id !== id));
    toast.success("Usunięto typ wydarzenia");
  };

  const updateEventName = async (id: string, name: string) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, name } : e)));
    try {
      await api.updateEventType(id, { name });
    } catch {
      // revert on error?
    }
  };

  const updateEventIcon = async (id: string, icon: LucideIconName) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, icon } : e)));
    try {
      await api.updateEventType(id, { icon });
    } catch {
      // revert on error?
    }
  };

  const updateEventIsCatering = async (id: string, isCatering: boolean) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, isCatering } : e)));
    try {
      await api.updateEventType(id, { isCatering });
    } catch {
      // revert on error?
    }
  };

  const updateExtraCategoryName = async (id: string, name: string) => {
    setExtraCategories(extraCategories.map((e) => (e.id === id ? { ...e, name } : e)));
    try {
      await api.updateExtrasCategory(id, { name });
    } catch {
      // revert on error?
    }
  };

  const updateExtraCategoryIcon = async (id: string, icon: LucideIconName) => {
    setExtraCategories(extraCategories.map((e) => (e.id === id ? { ...e, icon } : e)));
    try {
      await api.updateExtrasCategory(id, { icon });
    } catch {
      // revert on error?
    }
  };
  const removeExtraCategory = async (id: string) => {
    setExtraCategories(extraCategories.filter((e) => e.id !== id));
    try {
      await api.deleteExtrasCategory(id);
    } catch {
      // revert on error?
    }
  };
  const addExtraCategory = async () => {
    if (!newExtraCategoryName.trim()) return;
    const nextOrder = extraCategories.length > 0 ? Math.max(...extraCategories.map((e) => e.sort_order)) + 1 : 0;
    try {
      const data = await api.createExtrasCategory({
        name: newExtraCategoryName.trim(),
        icon: newExtraCategoryIcon,
        sortOrder: nextOrder,
      }) as Record<string, unknown>;
      setExtraCategories([...extraCategories, {
        id: String(data.id),
        name: String(data.name ?? ""),
        icon: (data.icon as LucideIconName) || "CalendarDays",
        sort_order: Number(data.sortOrder ?? 0),
      }]);
      setNewExtraCategoryName("");
      setNewExtraCategoryIcon("CalendarDays");
      toast.success("Dodano kategorię dodatków");
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
    }
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
        <h1 className="text-2xl font-bold text-foreground">Rodzaje wydarzeń</h1>
        <p className="text-muted-foreground text-sm">Zarządzaj typami wydarzeń dostępnymi w formularzu zamówienia</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista wydarzeń</CardTitle>
            <CardDescription>Dodawaj, edytuj i usuwaj typy wydarzeń. Kliknij ikonę, aby ją zmienić.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 group">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                <IconPicker value={event.icon} onChange={(icon) => updateEventIcon(event.id, icon)} />
                <Input
                  value={event.name}
                  onChange={(e) => updateEventName(event.id, e.target.value)}
                  className="flex-1"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm">{event.isCatering ? "Catering" : "On-site"}</span>
                  <Checkbox
                    checked={event.isCatering}
                    onCheckedChange={(checked) => updateEventIsCatering(event.id, Boolean(checked))}
                    className="w-4 h-4"
                  />
                </label>
                <button
                  onClick={() => removeEvent(event.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <div className="w-4" />
              <IconPicker value={newEventIcon} onChange={setNewEventIcon} />
              <Input
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Nazwa nowego wydarzenia..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && addEvent()}
              />
              <Button size="sm" variant="outline" onClick={addEvent} disabled={!newEventName.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
      <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista kategorii dodatków</CardTitle>
            <CardDescription>Dodawaj, edytuj i usuwaj kategorie dodatków. Kliknij ikonę, aby ją zmienić.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {extraCategories.map((extraCategory) => (
              
              <div key={extraCategory.id} className="flex items-center gap-3 group">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                <IconPicker value={extraCategory.icon} onChange={(icon) => updateExtraCategoryIcon(extraCategory.id, icon)} />
                <Input
                  value={extraCategory.name}
                  onChange={(e) => updateExtraCategoryName(extraCategory.id, e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => removeExtraCategory(extraCategory.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <div className="w-4" />
              <IconPicker value={newExtraCategoryIcon} onChange={setNewExtraCategoryIcon} />
              <Input
                value={newExtraCategoryName}
                onChange={(e) => setNewExtraCategoryName(e.target.value)}
                placeholder="Nazwa nowej kategorii dodatkow..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && addExtraCategory()}
              />
              <Button size="sm" variant="outline" onClick={addExtraCategory} disabled={!newExtraCategoryName.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsEventsView;