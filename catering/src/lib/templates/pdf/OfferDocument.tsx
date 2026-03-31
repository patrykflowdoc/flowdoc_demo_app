import { Document, Page, Text, View } from "@react-pdf/renderer";
import { splitPrimaryAndAddonItems } from "@/lib/orderLineItems";
import type { Order, PdfOrderDocumentData } from "@/types/orders";
import { fmtPdfNum } from "./fmt";
import { OfferContactTableBlock, OfferItemsTableBlock, OfferOrderDataTableBlock, OfferPayRow } from "./components";
import type { OfferContactData } from "./components";
import { pdfStyles } from "./styles";

export function OfferDocument({ order, contact }: { order: PdfOrderDocumentData; contact: OfferContactData }) {
  const { primary, addons } = splitPrimaryAndAddonItems(order.items);
  const meta: string[] = [`Adres dostawy: ${order.deliveryAddress || "—"}`];
  if (order.guestCount > 0) meta.push(`Liczba gości: ${order.guestCount}`);
  if (order.notes) meta.push(`Uwagi: ${order.notes}`);
  const calculatedAmount = (Number(order.amountNum) + Number(order.discount ?? 0) - Number(order.deposit ?? 0)).toFixed(2);
  const tailRows: { kind: "delivery" | "discount"; label: string; qty: string; ppu: string; total: string }[] = [];
  if (order.deliveryCost > 0) {
    tailRows.push({
      kind: "delivery",
      label: "Dostawa",
      qty: "1",
      ppu: `${fmtPdfNum(order.deliveryCost)} zł`,
      total: `${fmtPdfNum(order.deliveryCost)} zł`,
    });
  }
  if (order.discount != null && order.discount > 0) {
    tailRows.push({
      kind: "discount",
      label: "Rabat",
      qty: "",
      ppu: "",
      total: `-${fmtPdfNum(order.discount)} zł`,
    });
  }
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <OfferContactTableBlock sectionTitle="Kontakt" contact={contact} />
        <OfferOrderDataTableBlock order={order as Order} />
        <OfferItemsTableBlock sectionTitle="Produkty" items={primary} />

        {addons.length > 0 ? (
          <View style={pdfStyles.sectionGap}>
            <OfferItemsTableBlock sectionTitle="Dodatki i usługi" items={addons} />
          </View>
        ) : null}

        {tailRows.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            {tailRows.map((r, i) => (
              <View key={i} style={pdfStyles.tableRow} wrap={false}>
                <Text style={{ flex: 2.2, fontSize: 9 }}>{r.label}</Text>
                <Text style={{ flex: 0.95, fontSize: 9, textAlign: "center" }}>{r.qty}</Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{r.ppu}</Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{r.total}</Text>
              </View>
            ))}
          </View>
        ) : null}
        
        <OfferPayRow amountLabel="DO ZAPŁATY:" amount={calculatedAmount} />

        {order.guestCount > 0 ? (
          <Text style={pdfStyles.mutedNote}>
            Cena na osobę: {fmtPdfNum(order.amountNum / order.guestCount)} zł
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}
