import type { PdfOrderDocumentData } from "@/types/orders";

export type SummaryDocType = "zamowienia" | "lista-dan" | "food-cost" | "full";

export function parseDateForGrouping(dateStr: string): string {
  const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const months: Record<string, number> = {
    sty: 0,
    lut: 1,
    mar: 2,
    kwi: 3,
    maj: 4,
    cze: 5,
    lip: 6,
    sie: 7,
    wrz: 8,
    "paź": 9,
    lis: 10,
    gru: 11,
  };
  const parts = dateStr.trim().split(" ");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[0], 10);
  const month = months[parts[1]];
  const year = parseInt(parts[2], 10);
  if (Number.isNaN(day) || month === undefined || Number.isNaN(year)) return dateStr;
  const d = new Date(year, month, day);
  return `${dayNames[d.getDay()]}, ${dateStr}`;
}

export function groupOrdersByDate(orders: PdfOrderDocumentData[]): Map<string, PdfOrderDocumentData[]> {
  const map = new Map<string, PdfOrderDocumentData[]>();
  orders.forEach((o) => {
    const key = o.date || "Brak daty";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  });
  return new Map(
    [...map.entries()].sort((a, b) => {
      const da = a[1][0]?.date || "";
      const db = b[1][0]?.date || "";
      return da.localeCompare(db);
    })
  );
}
