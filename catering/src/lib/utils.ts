import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** UUID v4. Uses crypto.randomUUID when available (modern browsers), otherwise fallback for older envs. */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = "0123456789abcdef";
  const randomBytes = (n: number) => {
    const arr = new Uint8Array(n);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  };
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return [...b].map((x) => hex[x! >> 4] + hex[x! & 15]).join("").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}
