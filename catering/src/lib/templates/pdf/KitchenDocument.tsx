import { Document, Page, Text, View } from "@react-pdf/renderer";
import { effectiveLineItemType, isAddonLineItem, isExpandableLineItem } from "@/lib/orderLineItems";
import type { PdfOrderDocumentData } from "@/types/orders";
import { PdfDocHeader } from "./components";
import { pdfColors, pdfStyles } from "./styles";

type DishEntry = { name: string; totalQty: number; unit: string; source: string };

export function KitchenDocument({ order }: { order: PdfOrderDocumentData }) {
  const dishMap: Record<string, DishEntry> = {};
  order.items.forEach((item) => {
    const t = effectiveLineItemType(item);
    if (isAddonLineItem(t)) return;
    if (isExpandableLineItem(t) && item.subItems) {
      item.subItems.forEach((sub) => {
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

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfDocHeader title="Rozpiska na kuchnię" subtitle={`${order.id} | ${order.client} | ${order.date}`} />
        <View>
          <View style={pdfStyles.tableHead}>
            <Text style={[pdfStyles.tableHeadCell, { flex: 2 }]}>Danie</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 1, textAlign: "right" }]}>Ilość</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 1.2 }]}>Źródło</Text>
          </View>
          {dishes.map((d, i) => (
            <View key={i} style={pdfStyles.tableRow} wrap={false}>
              <Text style={{ flex: 2, fontSize: 9 }}>{d.name}</Text>
              <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
                {d.totalQty} {d.unit}
              </Text>
              <Text style={{ flex: 1.2, fontSize: 9, color: pdfColors.mutedText }}>{d.source || "—"}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
