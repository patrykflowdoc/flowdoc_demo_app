import { Document, Page, Text, View } from "@react-pdf/renderer";
import { isFoodCostEligibleLineItem } from "@/lib/orderLineItems";
import type { PdfOrderDocumentData } from "@/types/orders";
import { fmtPdfNum } from "./fmt";
import { PdfDocHeader } from "./components";
import { pdfStyles } from "./styles";
import { calculateKitchenRows } from "./kitchenCalc";
import { KitchenDishTable } from "./KitchenDocument";
import { groupOrdersByDate, parseDateForGrouping, type SummaryDocType } from "./summaryHelpers";
import { OfferDocument } from "./OfferDocument";

export type { SummaryDocType };


export function SummaryDocument({
  orders,
  docType,
  dateRange,
}: {
  orders: PdfOrderDocumentData[];
  docType: SummaryDocType;
  dateRange?: string;
}) {
  const totalAmount = fmtPdfNum(orders.reduce((s, o) => s + o.amountNum, 0));
  const subtitle = `${dateRange || ""} | ${orders.length} zamówień | Łączna kwota: ${totalAmount} zł`;
  const grouped = groupOrdersByDate(orders);

 

  if (docType === "zamowienia") {
    return (
      <Document>
        <Page size="A4" style={pdfStyles.page} wrap>
          <PdfDocHeader title="Lista zamówień" subtitle={subtitle} />
          {Array.from(grouped.entries()).map(([date, dateOrders]) => {
            const dayLabel = parseDateForGrouping(date);
            const dayTotal = fmtPdfNum(dateOrders.reduce((s, o) => s + o.amountNum, 0));
            return (
              <View key={date} style={{ marginBottom: 14 }} wrap={false}>
                <Text style={{ fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>
                  Data: {dayLabel} — {dateOrders.length} zam. / {dayTotal} zł
                </Text>
                <View style={pdfStyles.tableHead}>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 0.7 }]}>Nr</Text>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 1.1, textAlign: "center" }]}>Klient</Text>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 0.9, textAlign: "center" }]}>Wydarzenie</Text>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 0.75, textAlign: "right" }]}>Kwota</Text>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 0.45, textAlign: "center" }]}>Gości</Text>
                  <Text style={[pdfStyles.tableHeadCell, { flex: 1.1, textAlign: "center" }]}>Adres</Text>
                </View>
                {dateOrders.map((o, i) => (
                  <View key={`${o.id}-${i}`} style={pdfStyles.tableRow} wrap={false}>
                    <Text style={{ flex: 0.7, fontSize: 8 }}>{o.id}</Text>
                    <Text style={{ flex: 1.1, fontSize: 8, textAlign: "center" }}>{o.client}</Text>
                    <Text style={{ flex: 0.9, fontSize: 8, textAlign: "center" }}>{o.event || "—"}</Text>
                    <Text style={{ flex: 0.75, fontSize: 8, textAlign: "right" }}>{o.amount}</Text>
                    <Text style={{ flex: 0.45, fontSize: 8, textAlign: "center" }}>
                      {o.guestCount > 0 ? String(o.guestCount) : "—"}
                    </Text>
                    <Text style={{ flex: 1.1, fontSize: 8 }}>{o.deliveryAddress || "—"}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </Page>
        {orders.map((order) => (
          <OfferDocument order={order}/>
        ))}
      </Document>
    );
  }

  if (docType === "lista-dan") {
    return (
      <Document>
        <Page size="A4" style={pdfStyles.page} wrap>
          <PdfDocHeader title="Lista dań — podsumowanie" subtitle={subtitle} />
          {Array.from(grouped.entries()).flatMap(([date, dateOrders]) => {
            const dayLabel = parseDateForGrouping(date);
            const dishes = calculateKitchenRows(dateOrders.flatMap((o) => o.items));
            if (dishes.length === 0) return [];
            const guestSum = dateOrders.reduce((s, o) => s + o.guestCount, 0);
            return [
              <View key={date} style={{ marginBottom: 14 }} wrap={false}>
                <Text style={{ fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>
                  Data: {dayLabel} — {dateOrders.length} zam. / {guestSum} gości
                </Text>
                <KitchenDishTable dishes={dishes} />
              </View>,
            ];
          })}
        </Page>
      </Document>
    );
  }

  // food-cost
  let grandFC = 0;
  let grandRev = 0;
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page} wrap>
        <PdfDocHeader title="Food cost — podsumowanie" subtitle={subtitle} />
        {Array.from(grouped.entries()).flatMap(([date, dateOrders]) => {
          const dayLabel = parseDateForGrouping(date);
          const rows: {
            orderId: string;
            name: string;
            qty: string;
            fcPu: string;
            fcTot: string;
            rev: string;
            margin: string;
          }[] = [];
          let dayFC = 0;
          let dayRev = 0;
          dateOrders.forEach((o) => {
            o.items.forEach((item) => {
              if (!isFoodCostEligibleLineItem(item)) return;
              const fc = item.foodCostPerUnit!;
              const totalFC = fc * item.quantity;
              const margin = item.total > 0 ? ((item.total - totalFC) / item.total) * 100 : 0;
              rows.push({
                orderId: o.id,
                name: item.name,
                qty: `${item.quantity} ${item.unit}`,
                fcPu: `${fmtPdfNum(fc)} zł`,
                fcTot: `${fmtPdfNum(totalFC)} zł`,
                rev: `${fmtPdfNum(item.total)} zł`,
                margin: `${margin.toFixed(1)}%`,
              });
              dayFC += totalFC;
              dayRev += item.total;
            });
          });
          if (rows.length === 0) return [];
          grandFC += dayFC;
          grandRev += dayRev;
          const dayMargin = dayRev > 0 ? ((dayRev - dayFC) / dayRev) * 100 : 0;
          return [
            <View key={date} style={{ marginBottom: 14 }} wrap={false}>
              <Text style={{ fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>
                Data: {dayLabel} — FC: {fmtPdfNum(dayFC)} zł / Marża: {dayMargin.toFixed(1)}%
              </Text>
              <View style={pdfStyles.tableHead}>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.55 }]}>Zam.</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 1 }]}>Produkt</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.75 }]}>Ilość</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.65, textAlign: "right" }]}>FC/j.</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.7, textAlign: "right" }]}>FC ∑</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.65, textAlign: "right" }]}>Prz.</Text>
                <Text style={[pdfStyles.tableHeadCell, { flex: 0.45, textAlign: "right" }]}>Mar.</Text>
              </View>
              {rows.map((r, i) => (
                <View key={i} style={pdfStyles.tableRow} wrap={false}>
                  <Text style={{ flex: 0.55, fontSize: 7 }}>{r.orderId}</Text>
                  <Text style={{ flex: 1, fontSize: 7 }}>{r.name}</Text>
                  <Text style={{ flex: 0.75, fontSize: 7 }}>{r.qty}</Text>
                  <Text style={{ flex: 0.65, fontSize: 7, textAlign: "right" }}>{r.fcPu}</Text>
                  <Text style={{ flex: 0.7, fontSize: 7, textAlign: "right" }}>{r.fcTot}</Text>
                  <Text style={{ flex: 0.65, fontSize: 7, textAlign: "right" }}>{r.rev}</Text>
                  <Text style={{ flex: 0.45, fontSize: 7, textAlign: "right" }}>{r.margin}</Text>
                </View>
              ))}
            </View>,
          ];
        })}
        <Text style={{ fontSize: 11, marginTop: 12, fontWeight: "bold" }}>
          SUMA: Food cost {fmtPdfNum(grandFC)} zł | Przychód {fmtPdfNum(grandRev)} zł | Marża{" "}
          {grandRev > 0 ? (((grandRev - grandFC) / grandRev) * 100).toFixed(1) : "0.0"}%
        </Text>
      </Page>
    </Document>
  );
}
