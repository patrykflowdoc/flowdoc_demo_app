import { View, Text } from "@react-pdf/renderer";
import { effectiveLineItemType, isExpandableLineItem } from "@/lib/orderLineItems";
import type { PdfOrderLineItem } from "@/types/orders";
import { fmtPdfNum } from "./fmt";
import { pdfStyles } from "./styles";

const SUBROW_NO_DETAILS = "Brak wybranych opcji/wariantów";

export function PdfDocHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={pdfStyles.title}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.subtitle}>{subtitle}</Text> : null}
      <View style={pdfStyles.rule} />
    </View>
  );
}

function Head4() {
  return (
    <View style={pdfStyles.tableHead}>
      <Text style={[pdfStyles.tableHeadCell, { flex: 2.2 }]}>Pozycja</Text>
      <Text style={[pdfStyles.tableHeadCell, { flex: 0.95, textAlign: "center" }]}>Ilość</Text>
      <Text style={[pdfStyles.tableHeadCell, { flex: 1, textAlign: "right" }]}>Cena jedn.</Text>
      <Text style={[pdfStyles.tableHeadCell, { flex: 1, textAlign: "right" }]}>Razem</Text>
    </View>
  );
}

function MainRow({
  name,
  qty,
  unit,
  ppu,
  total,
}: {
  name: string;
  qty: number;
  unit: string;
  ppu: number;
  total: number;
}) {
  return (
    <View style={pdfStyles.tableRow} wrap={false}>
      <Text style={{ flex: 2.2, fontSize: 9 }}>{name}</Text>
      <Text style={{ flex: 0.95, fontSize: 9, textAlign: "center" }}>
        {qty} {unit}
      </Text>
      <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{fmtPdfNum(ppu)} zł</Text>
      <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{fmtPdfNum(total)} zł</Text>
    </View>
  );
}

function SubRow({ label, qtyText }: { label: string; qtyText: string }) {
  return (
    <View style={pdfStyles.tableRowSub} wrap={false}>
      <Text style={[{ flex: 2.2 }, pdfStyles.cellMuted]}>{label}</Text>
      <Text style={[{ flex: 0.95, textAlign: "center" }, pdfStyles.cellMuted]}>{qtyText}</Text>
      <Text style={{ flex: 1 }} />
      <Text style={{ flex: 1 }} />
    </View>
  );
}

export function OfferItemsTableBlock({ sectionTitle, items }: { sectionTitle: string; items: PdfOrderLineItem[] }) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>{sectionTitle}</Text>
      <Head4 />
      {items.map((item, idx) => {
        const t = effectiveLineItemType(item);
        const expandable = isExpandableLineItem(t);
        const subs = item.subItems ?? [];
        const subQty = (q: unknown) => {
          const n = typeof q === "number" ? q : Number(q);
          return Number.isFinite(n) ? n : 0;
        };
        return (
          <View key={idx}>
            <MainRow
              name={item.name}
              qty={item.quantity}
              unit={item.unit}
              ppu={item.pricePerUnit}
              total={item.total}
            />
            {subs.length > 0
              ? subs.map((sub, si) => (
                  <SubRow
                    key={si}
                    label={`  - ${sub.name}`}
                    qtyText={`${fmtPdfNum(subQty(sub.quantity))} ${(sub.unit || "szt.").trim()}`}
                  />
                ))
              : expandable
                ? <SubRow label={`  - ${SUBROW_NO_DETAILS}`} qtyText="" />
                : null}
          </View>
        );
      })}
    </View>
  );
}

/** Full-width footer when first columns are merged in label. */
export function OfferPayRow({ amountLabel, amount }: { amountLabel: string; amount: string }) {
  return (
    <View style={pdfStyles.tableFoot} wrap={false}>
      <Text style={[pdfStyles.tableFootCell, { flex: 3.15, textAlign: "right" }]}>{amountLabel}</Text>
      <Text style={[pdfStyles.tableFootCell, { flex: 1, textAlign: "right" }]}>{amount}</Text>
    </View>
  );
}

export function SimpleMetaLines({ lines }: { lines: string[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {lines.map((line, i) => (
        <Text key={i} style={pdfStyles.metaLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}
