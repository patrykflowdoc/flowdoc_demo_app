import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EventType } from "@/data/products";
import type { CateringType } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { 
  Users, 
  CalendarDays, 
  ChevronRight, 
  Clock,
  Truck,
  Building2,
} from "lucide-react";
import { FullscreenDateTimePicker } from "./FullscreenDateTimePicker";

type EventDetailsProps = {
  cateringType: CateringType;
  guestCount: number;
  eventType: string;
  eventDate: string;
  eventTime: string;
  onCateringTypeChange: (type: CateringType) => void;
  onGuestCountChange: (count: number) => void;
  onEventTypeChange: (type: string) => void;
  onEventDateChange: (date: string) => void;
  onEventTimeChange: (time: string) => void;
  eventTypes: EventType[];
  blockedDates: Date[];
  minLeadDays?: number;
};

export function EventDetails({
  cateringType,
  guestCount,
  eventType,
  eventDate,
  eventTime,
  onCateringTypeChange,
  onGuestCountChange,
  onEventTypeChange,
  onEventDateChange,
  onEventTimeChange,
  eventTypes,
  blockedDates,
  minLeadDays = 0,
}: EventDetailsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selectedDate = eventDate ? new Date(eventDate) : undefined;

  const handleConfirm = (date: Date, time: string) => {
    onEventDateChange(format(date, "yyyy-MM-dd"));
    onEventTimeChange(time);
  };

  return (
    <div className="px-4 py-6 pb-24 space-y-6 md:max-w-2xl md:mx-auto">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Zaplanuj Wydarzenie
        </h1>
        <p className="text-muted-foreground">
          Powiedz nam więcej o swoim wydarzeniu
        </p>
      </div>

      {/* Catering Type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Rodzaj cateringu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: "wyjazdowy" as CateringType, label: "Catering", icon: Truck, desc: "Dowozimy na wskazany adres" },
              { id: "na_sali" as CateringType, label: "Uroczystość na sali", icon: Building2, desc: "Obsługa w naszej sali" },
            ]).map((option) => {
              const isSelected = cateringType === option.id;
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => onCateringTypeChange(option.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    "hover:border-primary hover:bg-accent/50 focus:outline-none",
                    isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className={cn("text-xs font-medium text-center leading-tight", isSelected ? "text-primary" : "text-foreground")}>{option.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center">{option.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Guest Count */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Liczba Gości
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input
              type="number"
              min={1}
              max={1000}
              value={guestCount}
              onChange={(e) => onGuestCountChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="text-2xl font-bold h-14 text-center"
            />
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 200].map((count) => (
                <Button
                  key={count}
                  variant={guestCount === count ? "default" : "outline"}
                  size="sm"
                  onClick={() => onGuestCountChange(count)}
                  className="w-full"
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Typ Wydarzenia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {eventTypes.map((type) => {
              const isSelected = eventType === type.id;
              
              return (
                <button
                  key={type.id}
                  onClick={() => onEventTypeChange(type.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    "hover:border-primary hover:bg-accent/50 focus:outline-none",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span 
                    className={cn(
                      "text-xs font-medium text-center leading-tight",
                      isSelected ? "text-primary" : "text-foreground"
                    )}
                  >
                    {type.name}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Date & Time Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Data i Godzina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => setIsPickerOpen(true)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
              "hover:border-primary focus:outline-none",
              eventDate && eventTime ? "border-primary bg-accent" : "border-border"
            )}
          >
            <div className="text-left">
              {selectedDate && eventTime ? (
                <>
                  <p className="font-semibold text-foreground">
                    {format(selectedDate, "d MMMM yyyy", { locale: pl })}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {eventTime} • {format(selectedDate, "EEEE", { locale: pl })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-muted-foreground">Wybierz datę i godzinę</p>
                  <p className="text-sm text-muted-foreground">Kliknij aby wybrać termin</p>
                </>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Fullscreen Date & Time Picker */}
      <FullscreenDateTimePicker
        isOpen={isPickerOpen}
        selectedDate={selectedDate}
        selectedTime={eventTime}
        onConfirm={handleConfirm}
        onClose={() => setIsPickerOpen(false)}
        busyDates={blockedDates}
        minLeadDays={minLeadDays}
      />
    </div>
  );
}
