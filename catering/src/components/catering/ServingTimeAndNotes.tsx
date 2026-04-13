import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 15 }, (_, i) => (i + 8).toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const selectClass = (compact: boolean) =>
  cn(
    "rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary",
    compact ? "h-9 flex-1 px-2 py-2 text-xs min-w-0" : "flex-1 px-2 py-2 text-sm"
  );

const selectClassInline = cn(
  "h-8 w-[4.25rem] shrink-0 rounded-md border border-border bg-background px-1.5 text-xs tabular-nums",
  "focus:outline-none focus:ring-2 focus:ring-primary"
);

export type ServingTimePickProps = {
  time: string;
  onTimeChange: (t: string) => void;
  compact?: boolean;
  /** Jedna linia: ikona + etykieta + HH:mm + opcjonalnie wyczyść — bez szarej karty. */
  inline?: boolean;
  className?: string;
  /** Etykieta nad selectami (np. „Godzina podania”). */
  label?: string;
};

/** Tylko wybór HH:mm — jedna godzina na pozycję / posiłek. */
export function ServingTimePick({
  time,
  onTimeChange,
  compact = false,
  inline = false,
  className,
  label = "Godzina podania",
}: ServingTimePickProps) {
  const [selectedHour, selectedMinute] = time ? time.split(":") : ["", ""];

  const handleHourChange = (h: string) => {
    const m = selectedMinute || "00";
    onTimeChange(`${h}:${m}`);
  };

  const handleMinuteChange = (m: string) => {
    const h = selectedHour || "08";
    onTimeChange(`${h}:${m}`);
  };

  if (inline) {
    const hasTime = (time ?? "").trim() !== "";
    return (
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0",
          className
        )}
      >
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{label}</span>
        <select
          value={selectedHour}
          onChange={(e) => handleHourChange(e.target.value)}
          className={selectClassInline}
          aria-label="Godzina"
        >
          <option value="" disabled>
            —
          </option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-sm font-semibold text-muted-foreground leading-none">:</span>
        <select
          value={selectedMinute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className={cn(selectClassInline, "w-[3.25rem]")}
          aria-label="Minuty"
        >
          <option value="" disabled>
            —
          </option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {hasTime ? (
          <button
            type="button"
            onClick={() => onTimeChange("")}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Wyczyść godzinę"
            aria-label="Wyczyść godzinę podania"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg bg-muted/50 p-3 space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Clock className={cn("text-muted-foreground shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        <span className={cn("font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={selectedHour}
          onChange={(e) => handleHourChange(e.target.value)}
          className={selectClass(compact)}
        >
          <option value="" disabled>
            Godz.
          </option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-lg font-bold text-muted-foreground">:</span>
        <select
          value={selectedMinute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className={selectClass(compact)}
        >
          <option value="" disabled>
            Min.
          </option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export type ServingTimeAndNotesProps = {
  time: string;
  onTimeChange: (t: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  /** Mniejszy układ (np. pod każdą grupą menu w ofercie / adminie). */
  compact?: boolean;
  notesPlaceholder?: string;
  className?: string;
};

/**
 * Godzina podania (select HH:MM) + uwagi — ten sam wzorzec co w kroku produktów formularza zamówienia.
 */
export function ServingTimeAndNotes({
  time,
  onTimeChange,
  notes,
  onNotesChange,
  compact = false,
  notesPlaceholder = "Dodatkowe uwagi do tego produktu...",
  className,
}: ServingTimeAndNotesProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/50 space-y-3",
        compact ? "p-3" : "p-4 space-y-4",
        className
      )}
    >
      <ServingTimePick time={time} onTimeChange={onTimeChange} compact={compact} />
      <div>
        <h3 className={cn("font-semibold text-muted-foreground mb-1.5", compact ? "text-xs" : "text-sm")}>
          Uwagi
        </h3>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={notesPlaceholder}
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground",
            compact ? "min-h-[64px] text-xs" : "min-h-[80px]"
          )}
        />
      </div>
    </div>
  );
}
