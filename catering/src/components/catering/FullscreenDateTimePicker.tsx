import { useState, useEffect } from "react";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

type FullscreenDateTimePickerProps = {
  isOpen: boolean;
  selectedDate: Date | undefined;
  selectedTime: string;
  onConfirm: (date: Date, time: string) => void;
  onClose: () => void;
  busyDates?: Date[];
  minLeadDays?: number;
};

const TIME_SLOTS = [
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

export function FullscreenDateTimePicker({
  isOpen,
  selectedDate,
  selectedTime,
  onConfirm,
  onClose,
  busyDates = [],
  minLeadDays = 0,
}: FullscreenDateTimePickerProps) {
  const [tempDate, setTempDate] = useState<Date | undefined>(selectedDate);
  const [tempTime, setTempTime] = useState<string>(selectedTime || "");
  const today = startOfDay(new Date());
  const earliestDate = minLeadDays > 0 ? addDays(today, minLeadDays) : today;

  // Sync local state when dialog opens or props change
  useEffect(() => {
    if (isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect -- sync from props when modal opens */
      setTempDate(selectedDate);
      setTempTime(selectedTime || "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen, selectedDate, selectedTime]);

  const isBusy = (date: Date) => {
    return busyDates.some(
      (busyDate) =>
        startOfDay(busyDate).getTime() === startOfDay(date).getTime()
    );
  };

  const isDisabled = (date: Date) => {
    return isBefore(startOfDay(date), earliestDate);
  };

  const handleConfirm = () => {
    if (tempDate && tempTime) {
      onConfirm(tempDate, tempTime);
      onClose();
    }
  };

  const canConfirm = tempDate && tempTime;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center md:p-4">
      <div className="bg-background flex flex-col w-full h-full md:w-auto md:h-auto md:max-h-[90vh] md:min-w-[480px] md:max-w-xl md:rounded-2xl md:shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button onClick={onClose} className="p-2 -m-2">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-semibold text-lg">Wybierz termin</h2>
        <div className="w-10" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 py-3 bg-muted/30 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs">Dostępny</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-xs">Zajęty</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="px-4 py-2">
          <Calendar
            mode="single"
            selected={tempDate}
            onSelect={setTempDate}
            locale={pl}
            disabled={isDisabled}
            modifiers={{
              busy: (date) => isBusy(date) && !isDisabled(date),
              available: (date) => !isBusy(date) && !isDisabled(date),
            }}
            modifiersClassNames={{
              busy: "bg-destructive/20 text-destructive hover:bg-destructive/30",
              available: "bg-primary/10 text-primary hover:bg-primary/20",
            }}
            className="w-full pointer-events-auto"
            classNames={{
              months: "flex flex-col",
              month: "space-y-3",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-base font-semibold",
              nav: "space-x-1 flex items-center",
              nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center",
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
              table: "w-full border-collapse",
              head_row: "flex justify-between",
              head_cell: "text-muted-foreground flex-1 text-center font-normal text-xs",
              row: "flex w-full mt-1 justify-between",
              cell: "h-12 flex-1 text-center text-sm p-0 relative flex items-center justify-center",
              day: "h-12 w-full p-0 font-normal rounded-full transition-colors flex items-center justify-center",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary",
              day_today: "ring-2 ring-primary",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-30",
              day_hidden: "invisible",
            }}
          />
        </div>

        {/* Time Selection */}
        <div className="px-4 pb-4">
          <h3 className="font-medium text-sm text-muted-foreground mb-3">
            Wybierz godzinę
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((time) => (
              <Button
                key={time}
                variant={tempTime === time ? "default" : "outline"}
                size="sm"
                onClick={() => setTempTime(time)}
                className="h-10"
              >
                {time}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected summary */}
      {(tempDate || tempTime) && (
        <div className="px-4 py-3 bg-accent/50 text-center border-t border-border shrink-0">
          <span className="text-base font-medium">
            {tempDate ? format(tempDate, "d MMMM yyyy", { locale: pl }) : "Wybierz datę"}
            {tempTime && ` o ${tempTime}`}
          </span>
          {tempDate && isBusy(tempDate) && (
            <p className="text-xs text-destructive mt-1">
              ⚠️ Ten termin może być niedostępny
            </p>
          )}
        </div>
      )}

      {/* Confirm button */}
      <div className="p-4 border-t border-border shrink-0 safe-area-bottom">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          <Check className="w-5 h-5 mr-2" />
          Potwierdź termin
        </Button>
      </div>
      </div>
    </div>
  );
}
