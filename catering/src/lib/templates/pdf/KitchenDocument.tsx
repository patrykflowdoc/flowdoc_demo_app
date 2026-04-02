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
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 9 }}>{d.name}</Text>
            {(d.dish?.contents ?? []).length > 0 ? (
              <View style={{ marginTop: 2, paddingLeft: 6 }}>
                {(d.dish?.contents ?? []).map((c, ci) => (
                  <Text key={ci} style={{ fontSize: 7, color: "#666" }}>
                    - {String(c)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
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
