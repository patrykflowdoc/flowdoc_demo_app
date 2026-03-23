import { Document, Page, Text, View } from "@react-pdf/renderer";
import { isFoodCostEligibleLineItem } from "@/lib/orderLineItems";
import type { PdfFoodCostExtra, PdfOrderDocumentData } from "@/types/orders";
import { fmtPdfNum } from "./fmt";
import { PdfDocHeader } from "./components";
import { pdfStyles } from "./styles";

export function FoodCostDocument({ order, extras }: { order: PdfOrderDocumentData; extras: PdfFoodCostExtra[] }) {
  const items = order.items.filter(isFoodCostEligibleLineItem).map((item) => {
    const fc = item.foodCostPerUnit!;
    const totalFC = fc * item.quantity;
    const margin = item.total > 0 ? ((item.total - totalFC) / item.total) * 100 : 0;
    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      fcPerUnit: fc,
      totalFC,
      revenue: item.total,
      margin,
    };
  });

  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);
  const totalFC = items.reduce((s, i) => s + i.totalFC, 0) + extrasTotal;
  const totalRev = items.reduce((s, i) => s + i.revenue, 0);
  const totalMargin = totalRev > 0 ? ((totalRev - totalFC) / totalRev) * 100 : 0;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfDocHeader title="Food cost" subtitle={`${order.id} | ${order.client} | ${order.date}`} />
        <View>
          <View style={pdfStyles.tableHead}>
            <Text style={[pdfStyles.tableHeadCell, { flex: 1.4 }]}>Produkt</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 0.9 }]}>Ilość</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 0.75, textAlign: "right" }]}>FC/jedn.</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 0.8, textAlign: "right" }]}>FC łącznie</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 0.8, textAlign: "right" }]}>Przychód</Text>
            <Text style={[pdfStyles.tableHeadCell, { flex: 0.55, textAlign: "right" }]}>Marża</Text>
          </View>
          {items.map((row, i) => (
            <View key={i} style={pdfStyles.tableRow} wrap={false}>
              <Text style={{ flex: 1.4, fontSize: 8 }}>{row.name}</Text>
              <Text style={{ flex: 0.9, fontSize: 8 }}>
                {row.quantity} {row.unit}
              </Text>
              <Text style={{ flex: 0.75, fontSize: 8, textAlign: "right" }}>{fmtPdfNum(row.fcPerUnit)} zł</Text>
              <Text style={{ flex: 0.8, fontSize: 8, textAlign: "right" }}>{fmtPdfNum(row.totalFC)} zł</Text>
              <Text style={{ flex: 0.8, fontSize: 8, textAlign: "right" }}>{fmtPdfNum(row.revenue)} zł</Text>
              <Text style={{ flex: 0.55, fontSize: 8, textAlign: "right" }}>{row.margin.toFixed(1)}%</Text>
            </View>
          ))}
          {extras.map((e, i) => (
            <View key={`ex-${i}`} style={pdfStyles.tableRow} wrap={false}>
              <Text style={{ flex: 1.4, fontSize: 8 }}>+ {e.name}</Text>
              <Text style={{ flex: 0.9, fontSize: 8 }}>—</Text>
              <Text style={{ flex: 0.75, fontSize: 8, textAlign: "right" }}>—</Text>
              <Text style={{ flex: 0.8, fontSize: 8, textAlign: "right" }}>{fmtPdfNum(e.amount)} zł</Text>
              <Text style={{ flex: 0.8, fontSize: 8, textAlign: "right" }}>—</Text>
              <Text style={{ flex: 0.55, fontSize: 8, textAlign: "right" }}>—</Text>
            </View>
          ))}
          <View style={pdfStyles.tableFoot} wrap={false}>
            <Text style={[pdfStyles.tableFootCell, { flex: 1.4 }]}>SUMA</Text>
            <Text style={{ flex: 0.9 }} />
            <Text style={{ flex: 0.75 }} />
            <Text style={[pdfStyles.tableFootCell, { flex: 0.8, textAlign: "right" }]}>{fmtPdfNum(totalFC)} zł</Text>
            <Text style={[pdfStyles.tableFootCell, { flex: 0.8, textAlign: "right" }]}>{fmtPdfNum(totalRev)} zł</Text>
            <Text style={[pdfStyles.tableFootCell, { flex: 0.55, textAlign: "right" }]}>{totalMargin.toFixed(1)}%</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
