import { type ReactElement } from "react";
import { pdf, Font } from "@react-pdf/renderer";
import type { PdfFoodCostExtra, PdfOrderDocumentData } from "@/types/orders";
import { FoodCostDocument } from "@/lib/templates/pdf/FoodCostDocument";
import { KitchenDocument } from "@/lib/templates/pdf/KitchenDocument";
import { OfferDocument } from "@/lib/templates/pdf/OfferDocument";
import { SummaryDocument, type SummaryDocType } from "@/lib/templates/pdf/SummaryDocument";

export type { PdfFoodCostExtra, PdfOrder, PdfOrderDocumentData } from "@/types/orders";
export type { SummaryDocType };

/** @deprecated Use PdfFoodCostExtra */
export type FoodCostExtra = PdfFoodCostExtra;

let fontRegistrationAttempted = false;

async function ensurePdfFonts(): Promise<void> {
  if (fontRegistrationAttempted) return;
  fontRegistrationAttempted = true;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const candidates = [`${origin}/fonts/NotoSans-Regular.ttf`, `${origin}/fonts/Roboto-Regular.ttf`];
  for (const src of candidates) {
    try {
      Font.register({ family: "NotoSans", src, fontStyle: "normal", fontWeight: "normal" });
      return;
    } catch {
      // try next
    }
  }
  try {
    Font.register({
      family: "NotoSans",
      src: "https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.woff",
      fontStyle: "normal",
      fontWeight: "normal",
    });
  } catch {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.warn("PDF font registration failed; react-pdf may fall back to Helvetica.");
    }
  }
}

async function renderToFile(element: ReactElement, filename: string): Promise<void> {
  await ensurePdfFonts();
  const blob = await pdf(element as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function generateOfferPdf(order: PdfOrderDocumentData, _companyName?: string): Promise<void> {
  await renderToFile(<OfferDocument order={order} />, `oferta_${order.id}.pdf`);
}

export async function generateFoodCostPdf(order: PdfOrderDocumentData, extras?: PdfFoodCostExtra[]): Promise<void> {
  await renderToFile(<FoodCostDocument order={order} extras={extras ?? []} />, `food_cost_${order.id}.pdf`);
}

export async function generateKitchenPdf(order: PdfOrderDocumentData): Promise<void> {
  await renderToFile(<KitchenDocument order={order} />, `kuchnia_${order.id}.pdf`);
}

export async function generateSummaryPdf(
  orders: PdfOrderDocumentData[],
  docType: SummaryDocType,
  dateRange?: string
): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);
  await renderToFile(
    <SummaryDocument orders={orders} docType={docType} dateRange={dateRange} />,
    `podsumowanie_${docType}_${dateStr}.pdf`
  );
}
