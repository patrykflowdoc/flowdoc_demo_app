import { useEffect, useState } from "react";
import * as api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { OrderItem, OrderSubItem } from "@/types/orders";
import { getAdminEventTypes } from "@/api/client";
import type { EventType } from "@/data/products";

const fmtNum = (n: number) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number;
  type: string;
  converter?: number;
  variants?: { id: string; name: string; price: number; dishId?: string | null }[];
  optionGroups?: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    converter?: number;
    options: { id: string; name: string; converter?: number; dishId?: string | null }[];
  }[];
};

export function useCatalogProducts() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    api
      .getAdminCatalog()
      .then((data) => {
        const items: CatalogProduct[] = [];
        for (const d of data.dishes ?? []) {
          items.push({
            id: d.id,
            name: d.name,
            unit: d.unit_label || "szt.",
            defaultPrice: Number(d.price_per_unit ?? d.price_brutto),
            type: "simple",
          });
        }
        for (const b of data.bundles ?? []) {
          const variants = (b.bundle_variants ?? [])
            .sort((a, c) => a.sort_order - c.sort_order)
            .map((v) => ({
              id: v.id,
              name: v.name,
              price: v.price,
              dishId: v.dish_id ?? null,
            }));
          items.push({
            id: b.id,
            name: b.name,
            unit: "szt.",
            defaultPrice: Number(b.base_price),
            type: "bundle",
            converter: Number(b.converter ?? 1),
            variants,
          });
        }
        for (const s of data.configurable_sets ?? []) {
          const optionGroups = (s.config_groups ?? [])
            .sort((a, c) => a.sort_order - c.sort_order)
            .map((g) => ({
              id: g.id,
              name: g.name,
              minSelections: g.min_selections,
              maxSelections: g.max_selections,
              converter: Number(g.converter ?? 1),
              options: (g.config_group_options ?? [])
                .sort((a, c) => a.sort_order - c.sort_order)
                .map((o) => ({
                  id: o.id,
                  name: o.name,
                  converter: Number(o.converter ?? 1),
                  dishId: o.dish_id ?? null,
                })),
            }));
          items.push({
            id: s.id,
            name: s.name,
            unit: "os.",
            defaultPrice: Number(s.price_per_person),
            type: "configurable",
            optionGroups,
          });
        }
        for (const e of data.extras ?? []) {
          const t = e.category === "obsluga" ? ("service" as const) : ("extra" as const);
          items.push({
            id: e.id,
            name: e.name,
            unit: e.unit_label || "szt.",
            defaultPrice: Number(e.price),
            type: t,
          });
        }
        setCatalog(items);
      })
      .catch(console.error);
  }, []);
  return catalog;
}


export const useAdminEventTypes = () => {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  useEffect(() => {
    getAdminEventTypes().then((data) => {
      setEventTypes(data);
    });
  }, []);
  return eventTypes;
};

export const SubItemSelector = ({
  product,
  onConfirm,
  onCancel,
}: {
  product: CatalogProduct;
  onConfirm: (subItems: OrderSubItem[]) => void;
  onCancel: () => void;
}) => {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

  if (product.type === "bundle" && product.variants) {
    const handleConfirm = () => {
      const subs = Object.entries(selectedVariants)
        .filter(([, qty]) => qty > 0)
        .map(([vId, qty]) => {
          const v = product.variants!.find((x) => x.id === vId)!;
          return {
            id: vId,
            dishId: v.dishId ?? undefined,
            name: v.name,
            quantity: qty,
            unit: "szt.",
            converter: Number(product.converter ?? 1),
          };
        });
      onConfirm(subs);
    };
    return (
      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 mt-2">
        <p className="text-sm font-semibold text-foreground">Wybierz warianty: {product.name}</p>
        {product.variants.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2">
            <span className="text-sm flex-1">
              {v.name} <span className="text-muted-foreground text-xs">({fmtNum(v.price)} zł)</span>
            </span>
            <Input
              type="number"
              min={0}
              value={selectedVariants[v.id] || 0}
              onChange={(e) =>
                setSelectedVariants((prev) => ({
                  ...prev,
                  [v.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="w-16 h-7 text-xs text-center"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleConfirm} disabled={Object.values(selectedVariants).every((q) => q === 0)}>
            <Check className="w-3 h-3 mr-1" />
            Dodaj
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
      </div>
    );
  }

  if (product.type === "configurable" && product.optionGroups) {
    const toggleOption = (groupId: string, optionId: string, maxSel: number) => {
      setSelectedOptions((prev) => {
        const current = prev[groupId] || [];
        if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
        if (current.length >= maxSel) return prev;
        return { ...prev, [groupId]: [...current, optionId] };
      });
    };
    const handleConfirm = () => {
      const subs: OrderItem["subItems"] = [];
      for (const g of product.optionGroups!) {
        const ids = selectedOptions[g.id] || [];
        for (const id of ids) {
          const opt = g.options.find((o) => o.id === id);
          if (opt) {
            const optionConverter = Number(opt.converter ?? 1);
            const groupConverter = Number(g.converter ?? 1);
            subs!.push({
              id,
              dishId: opt.dishId ?? undefined,
              name: `${g.name}: ${opt.name}`,
              quantity: 1,
              unit: "szt.",
              converter: optionConverter !== 1 ? optionConverter : groupConverter,
              optionConverter,
              groupConverter,
            });
          }
        }
      }
      onConfirm(subs);
    };
    const allGroupsSatisfied = product.optionGroups.every(
      (g) => (selectedOptions[g.id] || []).length >= g.minSelections
    );
    return (
      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3 mt-2">
        <p className="text-sm font-semibold text-foreground">Konfiguruj: {product.name}</p>
        {product.optionGroups.map((g) => (
          <div key={g.id}>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {g.name} (min {g.minSelections}, max {g.maxSelections})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.options.map((o) => {
                const isSelected = (selectedOptions[g.id] || []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleOption(g.id, o.id, g.maxSelections)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50"
                    )}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleConfirm} disabled={!allGroupsSatisfied}>
            <Check className="w-3 h-3 mr-1" />
            Dodaj
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
