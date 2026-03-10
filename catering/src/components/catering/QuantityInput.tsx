import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantityInputProps = {
  value: number;
  onChange: (qty: number) => void;
  min?: number;
  size?: "sm" | "md";
};

export function QuantityInput({ value, onChange, min = 0, size = "md" }: QuantityInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input display when value changes and not editing
  useEffect(() => {
    if (!isEditing) {
      /* eslint-disable react-hooks/set-state-in-effect -- sync from prop when not editing */
      setInputValue(String(value));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitValue = () => {
    setIsEditing(false);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    } else if (!isNaN(parsed) && parsed < min && parsed >= 0) {
      onChange(0);
    } else {
      setInputValue(String(value));
    }
  };

  const isSmall = size === "sm";

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className={cn(isSmall ? "h-9 w-9" : "h-10 w-10")}
        onClick={() => onChange(Math.max(min > 0 && value <= min ? 0 : min, value - 1))}
        disabled={value === 0}
      >
        <Minus className="w-4 h-4" />
      </Button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitValue();
            if (e.key === "Escape") { setIsEditing(false); setInputValue(String(value)); }
          }}
          className={cn(
            "text-center font-bold bg-muted/60 border border-primary/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 transition-all",
            isSmall ? "w-14 h-9 text-base" : "w-16 h-10 text-xl"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className={cn(
            "text-center font-bold rounded-lg border border-transparent hover:border-primary/30 hover:bg-muted/50 cursor-text transition-all",
            isSmall ? "w-14 h-9 text-base" : "w-16 h-10 text-xl"
          )}
          title="Kliknij, aby wpisać ilość"
        >
          {value}
        </button>
      )}

      <Button
        variant="outline"
        size="icon"
        className={cn(isSmall ? "h-9 w-9" : "h-10 w-10")}
        onClick={() => {
          if (min > 0 && value === 0) {
            onChange(min);
          } else {
            onChange(value + 1);
          }
        }}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
