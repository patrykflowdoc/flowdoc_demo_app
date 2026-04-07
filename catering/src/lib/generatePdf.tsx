import { type ReactElement } from "react";
import { pdf, Font } from "@react-pdf/renderer";
import { FoodCostDocument } from "@/lib/templates/pdf/FoodCostDocument";
import { KitchenDocument } from "@/lib/templates/pdf/KitchenDocument";
import { OfferDocument } from "@/lib/templates/pdf/OfferDocument";
import { SummaryDocument, type SummaryDocType } from "@/lib/templates/pdf/SummaryDocument";
import { getCompanySettings } from "@/api/client";
import type { FoodCostExtra, PdfOrderDocumentData } from "@/types/orders";
export type { FoodCostExtra, Order, OrderDocumentType, OrderStatus, OrderItem, OrderSubItem, PdfOrderDocumentData } from "@/types/orders";
export type { SummaryDocType };


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

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Logo path or URL suitable for fetch / react-pdf Image (absolute http(s), data URI, or site-relative). */
function resolveAbsoluteLogoUrl(raw: string): string | null {
  let u = raw.trim();
  if (!u) return null;
  // Stored as "/data:image/..." — treat as data URI, not site path
  if (/^\/data:/i.test(u)) u = u.slice(1);
  if (/^data:/i.test(u) || /^https?:\/\//i.test(u)) return u;
  if (typeof window === "undefined") return null;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${window.location.origin}${path}`;
}

async function logoSrcToPngDataUrl(absoluteUrl: string): Promise<string | null> {
  let src = absoluteUrl.trim();
  if (!src) return null;
  try {
    const res = await fetch(src, { credentials: "include" }); // if /uploads needs cookies
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    // react-pdf accepts png/jpeg from data URIs
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function generateOfferPdf(order: PdfOrderDocumentData): Promise<void> {
  let companySettings: { [key: string]: unknown } = {};
  try {
    companySettings = await getCompanySettings();
  } catch {
    companySettings = {};
  }
  const rawLogo = asText(companySettings.logoUrl);
  const logoAbsolute = resolveAbsoluteLogoUrl(rawLogo);
  const logoForPdf =
    logoAbsolute != null ? ((await logoSrcToPngDataUrl(logoAbsolute)) ?? "") : "";
  const contact = {
    logoUrl: logoForPdf,
    phone: asText(companySettings.phone),
    email: asText(companySettings.email),
    address: asText(companySettings.address),
  };
  await renderToFile(<OfferDocument order={order} contact={contact} />, `oferta_${order.id}.pdf`);
}

export async function generateFoodCostPdf(order: PdfOrderDocumentData, extras?: FoodCostExtra[]): Promise<void> {
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
