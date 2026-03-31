import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { PdfOrderDocumentData } from "@/types/orders";
import { PdfDocHeader } from "./components";
import { pdfStyles } from "./styles";
import { calculateKitchenRows, type KitchenDishRow } from "./kitchenCalc";

export function KitchenDishTable({ dishes }: { dishes: KitchenDishRow[] }) {
  return (
    <View>
      <View style={pdfStyles.tableHead}>
        <Text style={[pdfStyles.tableHeadCell, { flex: 2 }]}>Danie</Text>
        <Text style={[pdfStyles.tableHeadCell, { flex: 1 }]}>Ilość</Text>
      </View>
      {dishes.map((d, i) => (
        <View key={i} style={pdfStyles.tableRow} wrap={false}>
          <Text style={{ flex: 2, fontSize: 9 }}>{d.name}</Text>
          <Text style={{ flex: 1, fontSize: 9 }}>
            {d.totalQty} {d.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function KitchenDocument({ order }: { order: PdfOrderDocumentData }) {
  const dishes = calculateKitchenRows(order.items);
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfDocHeader title="Rozpiska na kuchnię" subtitle={`${order.id} | ${order.client} | ${order.date}`} />
        <KitchenDishTable dishes={dishes} />
      </Page>
    </Document>
  );
}
