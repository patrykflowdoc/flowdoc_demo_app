import { useState, useEffect } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import * as api from "@/api/client";
import { toast } from "@/components/ui/sonner";

const blockedDateItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  blocked_date: z.string(),
  reason: z.union([z.string(), z.null(), z.undefined()]).transform((v) => (v == null ? "" : String(v))),
});

const blockedDatesResponseSchema = z.array(blockedDateItemSchema);

interface BlockedDate {
  id: string;
  date: Date;
  reason: string;
}

const SettingsCalendarView = () => {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminBlockedDates()
      .then((data) => {
        const parsed = blockedDatesResponseSchema.safeParse(data);
        if (!parsed.success) {
          console.error("Invalid blocked dates response:", parsed.error.flatten());
          setBlockedDates([]);
          return;
        }
        const mapped: BlockedDate[] = parsed.data
          .map((d) => {
            const date = new Date(d.blocked_date);
            return { id: d.id, date, reason: d.reason };
          })
          .filter((bd) => isValid(bd.date));
        setBlockedDates(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addDate = async () => {
    if (!newDate) return;
    const parsed = parse(newDate, "yyyy-MM-dd", new Date());
    if (!isValid(parsed)) return;
    const alreadyExists = blockedDates.some((d) => d.date.toDateString() === parsed.toDateString());
    if (alreadyExists) {
      toast.error("Ta data jest już zablokowana");
      return;
    }

    try {
      const data = await api.createBlockedDate({ blocked_date: newDate, reason: newReason || undefined }) as Record<string, unknown>;
      setBlockedDates(
        [...blockedDates, { id: String(data.id), date: parsed, reason: newReason }].sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        )
      );
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setNewDate("");
    setNewReason("");
    toast.success("Data zablokowana");
  };

  const removeDate = async (bd: BlockedDate) => {
    try {
      await api.deleteBlockedDate(bd.id);
    } catch (err: unknown) {
      toast.error("Błąd: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setBlockedDates(blockedDates.filter((d) => d.id !== bd.id));
    toast.success("Data odblokowana");
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
        <h1 className="text-2xl font-bold text-foreground">Kalendarz</h1>
        <p className="text-muted-foreground text-sm">Zarządzaj datami, w których nie przyjmujesz zamówień</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zablokowane daty</CardTitle>
            <CardDescription>
              Dodaj daty, w których kalendarz będzie wyłączony ({blockedDates.length})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="max-w-[200px]"
                onKeyDown={(e) => e.key === "Enter" && addDate()}
              />
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Powód (opcjonalnie)"
                className="max-w-[250px]"
              />
              <Button size="sm" onClick={addDate} disabled={!newDate}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj datę
              </Button>
            </div>

            {blockedDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Brak zablokowanych dat</p>
            ) : (
              <div className="space-y-1.5">
                {blockedDates.map((bd) => (
                  <div
                    key={bd.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarOff className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">
                        {isValid(bd.date)
                          ? format(bd.date, "EEEE, d MMMM yyyy", { locale: pl })
                          : String(bd.date)}
                      </span>
                      {bd.reason && (
                        <span className="text-xs text-muted-foreground">— {bd.reason}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeDate(bd)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsCalendarView;
