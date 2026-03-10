import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DocWithTable = jsPDF & { lastAutoTable?: { finalY?: number } };

const fmtNum = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PdfOrder {
  id: string;
  client: string;
  email: string;
  phone: string;
  event: string;
  date: string;
  deliveryAddress: string;
  amount: string;
  amountNum: number;
  notes: string;
  deliveryCost: number;
  guestCount: number;
  discount?: number;
  items: {
    name: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    total: number;
    type?: string;
    foodCostPerUnit?: number;
    subItems?: { name: string; quantity: number; unit: string; foodCostPerUnit?: number }[];
  }[];
}

// ===== Font loading =====
let fontBase64: string | null = null;

async function loadFont(): Promise<string> {
  if (fontBase64) return fontBase64;
  const response = await fetch("/fonts/Roboto-Regular.ttf");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  fontBase64 = btoa(binary);
  return fontBase64;
}

async function setupDoc(_title: string): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const base64 = await loadFont();
  doc.addFileToVFS("Roboto-Regular.ttf", base64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto", "normal");
  return doc;
}

const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  doc.setFontSize(18);
  doc.setFont("Roboto", "normal");
  doc.text(title, 14, 20);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, 14, 28);
    doc.setTextColor(0, 0, 0);
  }
  doc.setDrawColor(200, 200, 200);
  doc.line(14, subtitle ? 32 : 26, 196, subtitle ? 32 : 26);
};

// ===== SINGLE ORDER OFFER PDF =====
export async function generateOfferPdf(order: PdfOrder, _companyName?: string) {
  const doc = await setupDoc("Oferta");
  addHeader(doc, `Oferta ${order.id}`, `${order.client} | ${order.event || "Wydarzenie"} | ${order.date}`);

  let y = 38;
  doc.setFontSize(9);
  doc.text(`Adres dostawy: ${order.deliveryAddress}`, 14, y);
  y += 5;
  if (order.guestCount > 0) {
    doc.text(`Liczba gości: ${order.guestCount}`, 14, y);
    y += 5;
  }
  if (order.notes) {
    doc.text(`Uwagi: ${order.notes}`, 14, y);
    y += 5;
  }
  y += 3;

  const rows = order.items.map(item => [
    item.name,
    `${item.quantity} ${item.unit}`,
    `${fmtNum(item.pricePerUnit)} zł`,
    `${fmtNum(item.total)} zł`,
  ]);

  if (order.deliveryCost > 0) {
    rows.push(["Dostawa", "1", `${fmtNum(order.deliveryCost)} zł`, `${fmtNum(order.deliveryCost)} zł`]);
  }

  if (order.discount && order.discount > 0) {
    rows.push(["Rabat", "", "", `-${fmtNum(order.discount)} zł`]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Pozycja", "Ilość", "Cena jedn.", "Razem"]],
    body: rows,
    foot: [["", "", "DO ZAPŁATY:", order.amount]],
    styles: { fontSize: 9, cellPadding: 3, font: "Roboto" },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 11 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    theme: "grid",
  });

  if (order.guestCount > 0) {
    const pricePerPerson = order.amountNum / order.guestCount;
    const finalY = (doc as DocWithTable).lastAutoTable?.finalY || y + 40;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Cena na osobę: ${fmtNum(pricePerPerson)} zł`, 14, finalY + 8);
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`oferta_${order.id}.pdf`);
}

// ===== SINGLE ORDER SHOPPING LIST PDF =====
export async function generateShoppingListPdf(order: PdfOrder) {
  const doc = await setupDoc("Lista zakupów");
  addHeader(doc, `Lista zakupów`, `${order.id} | ${order.client} | ${order.date}`);

  const ingredientMap: Record<string, { name: string; totalQty: number; unit: string }> = {};
  order.items.forEach(item => {
    if (item.subItems) {
      item.subItems.forEach(sub => {
        const key = `${sub.name}__${sub.unit}`;
        if (!ingredientMap[key]) ingredientMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit };
        ingredientMap[key].totalQty += sub.quantity;
      });
    }
  });
  const ingredients = Object.values(ingredientMap).sort((a, b) => a.name.localeCompare(b.name, "pl"));

  if (ingredients.length === 0) {
    doc.setFontSize(10);
    doc.text("Brak danych o składnikach dla tego zamówienia.", 14, 40);
    doc.save(`lista_zakupow_${order.id}.pdf`);
    return;
  }

  autoTable(doc, {
    startY: 38,
    head: [["Składnik", "Ilość", "Jednostka"]],
    body: ingredients.map(i => [i.name, fmtNum(i.totalQty), i.unit]),
    styles: { fontSize: 9, cellPadding: 3, font: "Roboto" },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    theme: "grid",
  });

  doc.save(`lista_zakupow_${order.id}.pdf`);
}

export interface FoodCostExtra {
  id: string;
  name: string;
  amount: number;
}

// ===== SINGLE ORDER FOOD COST PDF =====
export async function generateFoodCostPdf(order: PdfOrder, extras?: FoodCostExtra[]) {
  const doc = await setupDoc("Food cost");
  addHeader(doc, `Food cost`, `${order.id} | ${order.client} | ${order.date}`);

  const items = order.items
    .filter(i => i.type !== "service" && i.type !== "waiter" && i.foodCostPerUnit)
    .map(item => {
      const totalFC = item.foodCostPerUnit! * item.quantity;
      const margin = item.total > 0 ? ((item.total - totalFC) / item.total) * 100 : 0;
      return {
        name: item.name, quantity: item.quantity, unit: item.unit,
        fcPerUnit: item.foodCostPerUnit!, totalFC, revenue: item.total, margin,
      };
    });

  const rows = items.map(i => [
    i.name, `${i.quantity} ${i.unit}`,
    `${fmtNum(i.fcPerUnit)} zł`, `${fmtNum(i.totalFC)} zł`,
    `${fmtNum(i.revenue)} zł`, `${i.margin.toFixed(1)}%`,
  ]);

  // Add custom extras
  const safeExtras = extras || [];
  safeExtras.forEach(e => {
    rows.push([`⊕ ${e.name}`, "—", "—", `${fmtNum(e.amount)} zł`, "—", "—"]);
  });

  const extrasTotal = safeExtras.reduce((s, e) => s + e.amount, 0);
  const totalFC = items.reduce((s, i) => s + i.totalFC, 0) + extrasTotal;
  const totalRev = items.reduce((s, i) => s + i.revenue, 0);
  const totalMargin = totalRev > 0 ? ((totalRev - totalFC) / totalRev) * 100 : 0;

  autoTable(doc, {
    startY: 38,
    head: [["Produkt", "Ilość", "FC/jedn.", "FC łącznie", "Przychód", "Marża"]],
    body: rows,
    foot: [["SUMA", "", "", `${fmtNum(totalFC)} zł`, `${fmtNum(totalRev)} zł`, `${totalMargin.toFixed(1)}%`]],
    styles: { fontSize: 8, cellPadding: 2.5, font: "Roboto" },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
    columnStyles: {
      2: { halign: "right" }, 3: { halign: "right" },
      4: { halign: "right" }, 5: { halign: "right" },
    },
    theme: "grid",
  });

  doc.save(`food_cost_${order.id}.pdf`);
}

// ===== SINGLE ORDER KITCHEN BREAKDOWN PDF =====
export async function generateKitchenPdf(order: PdfOrder) {
  const doc = await setupDoc("Rozpiska na kuchnię");
  addHeader(doc, `Rozpiska na kuchnię`, `${order.id} | ${order.client} | ${order.date}`);

  type DishEntry = { name: string; totalQty: number; unit: string; source: string };
  const dishMap: Record<string, DishEntry> = {};
  order.items.forEach(item => {
    if (item.type === "service" || item.type === "waiter" || item.type === "extra" || item.type === "packaging") return;
    if ((item.type === "configurable" || item.type === "bundle") && item.subItems) {
      item.subItems.forEach(sub => {
        const key = sub.name;
        if (!dishMap[key]) dishMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit, source: item.name };
        dishMap[key].totalQty += sub.quantity;
      });
    } else {
      const key = item.name;
      if (!dishMap[key]) dishMap[key] = { name: item.name, totalQty: 0, unit: item.unit, source: "" };
      dishMap[key].totalQty += item.quantity;
    }
  });
  const dishes = Object.values(dishMap).sort((a, b) => a.name.localeCompare(b.name, "pl"));

  autoTable(doc, {
    startY: 38,
    head: [["Danie", "Ilość", "Źródło"]],
    body: dishes.map(d => [d.name, `${d.totalQty} ${d.unit}`, d.source || "-"]),
    styles: { fontSize: 9, cellPadding: 3, font: "Roboto" },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    theme: "grid",
  });

  doc.save(`kuchnia_${order.id}.pdf`);
}

// ===== HELPERS FOR GROUPING BY DATE =====
const parseDateForGrouping = (dateStr: string): string => {
  // dateStr format: "28 sty 2026" or similar
  const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const months: Record<string, number> = {
    "sty": 0, "lut": 1, "mar": 2, "kwi": 3, "maj": 4, "cze": 5,
    "lip": 6, "sie": 7, "wrz": 8, "paź": 9, "lis": 10, "gru": 11,
  };
  const parts = dateStr.trim().split(" ");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[0]);
  const month = months[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || month === undefined || isNaN(year)) return dateStr;
  const d = new Date(year, month, day);
  return `${dayNames[d.getDay()]}, ${dateStr}`;
};

const groupOrdersByDate = (orders: PdfOrder[]): Map<string, PdfOrder[]> => {
  const map = new Map<string, PdfOrder[]>();
  orders.forEach(o => {
    const key = o.date || "Brak daty";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  });
  // Sort by date
  const sorted = new Map([...map.entries()].sort((a, b) => {
    const da = a[1][0]?.date || "";
    const db = b[1][0]?.date || "";
    return da.localeCompare(db);
  }));
  return sorted;
};

// ===== SUMMARY PDF (multiple orders) =====
export type SummaryDocType = "zamowienia" | "lista-zakupow" | "lista-dan" | "food-cost";

export async function generateSummaryPdf(orders: PdfOrder[], docType: SummaryDocType, dateRange?: string) {
  const doc = await setupDoc("Podsumowanie");
  const totalAmount = fmtNum(orders.reduce((s, o) => s + o.amountNum, 0));
  const subtitle = `${dateRange || ""} | ${orders.length} zamówień | Łączna kwota: ${totalAmount} zł`;
  const grouped = groupOrdersByDate(orders);

  if (docType === "zamowienia") {
    addHeader(doc, "Lista zamówień", subtitle);

    let y = 38;
    for (const [date, dateOrders] of grouped) {
      const dayLabel = parseDateForGrouping(date);
      const dayTotal = fmtNum(dateOrders.reduce((s, o) => s + o.amountNum, 0));

      // Day header
      doc.setFontSize(12);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(`📅 ${dayLabel}  —  ${dateOrders.length} zam. / ${dayTotal} zł`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Nr", "Klient", "Wydarzenie", "Kwota", "Gości", "Adres"]],
        body: dateOrders.map(o => [
          o.id, o.client, o.event || "-", o.amount,
          o.guestCount > 0 ? String(o.guestCount) : "-",
          o.deliveryAddress || "-",
        ]),
        styles: { fontSize: 8, cellPadding: 2.5, font: "Roboto" },
        headStyles: { fillColor: [40, 40, 40], textColor: 255 },
        theme: "grid",
      });
      const fy = (doc as DocWithTable).lastAutoTable?.finalY;
      y = (fy != null ? fy + 8 : y + 30);

      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    }

    // Detail pages per order
    orders.forEach(order => {
      doc.addPage();
      addHeader(doc, `${order.id}`, `${order.client} | ${order.event || "Wydarzenie"} | ${order.date}`);

      let y2 = 38;
      doc.setFontSize(9);
      doc.text(`Adres: ${order.deliveryAddress}`, 14, y2); y2 += 5;
      if (order.guestCount > 0) { doc.text(`Gości: ${order.guestCount}`, 14, y2); y2 += 5; }
      if (order.notes) { doc.text(`Uwagi: ${order.notes}`, 14, y2); y2 += 5; }
      y2 += 3;

      const rows = order.items.map(item => [
        item.name, `${item.quantity} ${item.unit}`,
        `${fmtNum(item.pricePerUnit)} zł`, `${fmtNum(item.total)} zł`,
      ]);
      if (order.deliveryCost > 0) {
        rows.push(["Dostawa", "1", `${fmtNum(order.deliveryCost)} zł`, `${fmtNum(order.deliveryCost)} zł`]);
      }

      autoTable(doc, {
        startY: y2,
        head: [["Pozycja", "Ilość", "Cena jedn.", "Razem"]],
        body: rows,
        foot: [["", "", "SUMA:", order.amount]],
        styles: { fontSize: 8, cellPadding: 2.5, font: "Roboto" },
        headStyles: { fillColor: [40, 40, 40], textColor: 255 },
        footStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
        theme: "grid",
      });
    });

  } else if (docType === "lista-zakupow") {
    addHeader(doc, "Lista zakupów — podsumowanie", subtitle);

    let y = 38;
    for (const [date, dateOrders] of grouped) {
      const dayLabel = parseDateForGrouping(date);

      // Aggregate ingredients for this day
      const ingredientMap: Record<string, { name: string; totalQty: number; unit: string }> = {};
      dateOrders.forEach(o => {
        o.items.forEach(item => {
          if (item.subItems) {
            item.subItems.forEach(sub => {
              const key = `${sub.name}__${sub.unit}`;
              if (!ingredientMap[key]) ingredientMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit };
              ingredientMap[key].totalQty += sub.quantity;
            });
          }
        });
      });
      const ingredients = Object.values(ingredientMap).sort((a, b) => a.name.localeCompare(b.name, "pl"));
      if (ingredients.length === 0) continue;

      doc.setFontSize(12);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(`📅 ${dayLabel}  —  ${dateOrders.length} zam.`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Składnik", "Ilość", "Jednostka"]],
        body: ingredients.map(i => [i.name, fmtNum(i.totalQty), i.unit]),
        styles: { fontSize: 9, cellPadding: 3, font: "Roboto" },
        headStyles: { fillColor: [40, 40, 40], textColor: 255 },
        theme: "grid",
      });
      const fy = (doc as DocWithTable).lastAutoTable?.finalY;
      y = (fy != null ? fy + 8 : y + 30);

      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    }

  } else if (docType === "lista-dan") {
    addHeader(doc, "Lista dań — podsumowanie", subtitle);

    let y = 38;
    for (const [date, dateOrders] of grouped) {
      const dayLabel = parseDateForGrouping(date);

      type DishEntry = { name: string; totalQty: number; unit: string; source: string };
      const dishMap: Record<string, DishEntry> = {};
      dateOrders.forEach(o => {
        o.items.forEach(item => {
          if (item.type === "service" || item.type === "waiter" || item.type === "extra" || item.type === "packaging") return;
          if ((item.type === "configurable" || item.type === "bundle") && item.subItems) {
            item.subItems.forEach(sub => {
              const key = `${sub.name}__dish`;
              if (!dishMap[key]) dishMap[key] = { name: sub.name, totalQty: 0, unit: sub.unit, source: item.name };
              dishMap[key].totalQty += sub.quantity;
            });
          } else {
            const key = `${item.name}__dish`;
            if (!dishMap[key]) dishMap[key] = { name: item.name, totalQty: 0, unit: item.unit, source: "" };
            dishMap[key].totalQty += item.quantity;
          }
        });
      });
      const dishes = Object.values(dishMap).sort((a, b) => a.name.localeCompare(b.name, "pl"));
      if (dishes.length === 0) continue;

      doc.setFontSize(12);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(`📅 ${dayLabel}  —  ${dateOrders.length} zam. / ${dateOrders.reduce((s, o) => s + o.guestCount, 0)} gości`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Danie", "Ilość", "Jednostka", "Źródło"]],
        body: dishes.map(d => [d.name, String(d.totalQty), d.unit, d.source || "-"]),
        styles: { fontSize: 9, cellPadding: 3, font: "Roboto" },
        headStyles: { fillColor: [40, 40, 40], textColor: 255 },
        theme: "grid",
      });
      const fy = (doc as DocWithTable).lastAutoTable?.finalY;
      y = (fy != null ? fy + 8 : y + 30);

      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    }

  } else if (docType === "food-cost") {
    addHeader(doc, "Food cost — podsumowanie", subtitle);

    let y = 38;
    let grandFC = 0, grandRev = 0;

    for (const [date, dateOrders] of grouped) {
      const dayLabel = parseDateForGrouping(date);
      const rows: string[][] = [];
      let dayFC = 0, dayRev = 0;

      dateOrders.forEach(o => {
        o.items.forEach(item => {
          if (item.type === "service" || item.type === "waiter" || !item.foodCostPerUnit) return;
          const totalFC = item.foodCostPerUnit * item.quantity;
          const margin = item.total > 0 ? ((item.total - totalFC) / item.total) * 100 : 0;
          rows.push([
            o.id, item.name, `${item.quantity} ${item.unit}`,
            `${fmtNum(item.foodCostPerUnit)} zł`, `${fmtNum(totalFC)} zł`,
            `${fmtNum(item.total)} zł`, `${margin.toFixed(1)}%`,
          ]);
          dayFC += totalFC;
          dayRev += item.total;
        });
      });

      if (rows.length === 0) continue;
      grandFC += dayFC;
      grandRev += dayRev;
      const dayMargin = dayRev > 0 ? ((dayRev - dayFC) / dayRev) * 100 : 0;

      doc.setFontSize(12);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(`📅 ${dayLabel}  —  FC: ${fmtNum(dayFC)} zł / Marża: ${dayMargin.toFixed(1)}%`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Zamówienie", "Produkt", "Ilość", "FC/jedn.", "FC łącznie", "Przychód", "Marża"]],
        body: rows,
        styles: { fontSize: 7, cellPadding: 2, font: "Roboto" },
        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 7 },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
        theme: "grid",
      });
      const fy = (doc as DocWithTable).lastAutoTable?.finalY;
      y = (fy != null ? fy + 8 : y + 30);

      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    }

    // Grand total footer
    const grandMargin = grandRev > 0 ? ((grandRev - grandFC) / grandRev) * 100 : 0;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("Roboto", "normal");
    doc.text(`SUMA: Food cost ${fmtNum(grandFC)} zł | Przychód ${fmtNum(grandRev)} zł | Marża ${grandMargin.toFixed(1)}%`, 14, y);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`podsumowanie_${docType}_${dateStr}.pdf`);
}
