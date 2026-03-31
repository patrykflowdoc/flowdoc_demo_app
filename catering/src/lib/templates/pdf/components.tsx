import { View, Text, Image, Svg, Path, Circle, Line } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@/types/orders";
import { effectiveLineItemType, isExpandableLineItem } from "@/lib/orderLineItems";
import { fmtPdfNum } from "./fmt";
import { pdfStyles } from "./styles";
import logoImage from "@/assets/logo.png";

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

export type OfferContactData = {
  phone: string;
  email: string;
  address: string;
};

export function OfferContactTableBlock({
  sectionTitle,
  contact,
}: {
  sectionTitle: string;
  contact: OfferContactData;
}) {
  const phoneValue = contact.phone || "—";
  const emailValue = contact.email || "—";
  const addressValue = contact.address || "—";
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", borderWidth: 0.5, borderColor: "#d2dbd7" }}>
        <View style={{ width: "70%", padding: 10 }}>
          <Text style={{ fontSize: 22, color: "#2d9c6d", fontWeight: "bold", marginBottom: 8 }}>{sectionTitle}</Text>
          <ContactLine icon="phone" value={phoneValue} />
          <ContactLine icon="globe" value="www.szczypta.smaku.com" />
          <ContactLine icon="mapPin" value={addressValue} />
          <ContactLine icon="mail" value={emailValue} />
        </View>
        <View
          style={{
            width: "30%",
            borderLeftWidth: 0.5,
            borderLeftColor: "#d2dbd7",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
            paddingVertical: 12,
          }}
        >
          <Image src={logoImage} style={{ width: 120, objectFit: "contain" }} />
        </View>
      </View>
    </View>
  );
}

function ContactLine({ icon, value }: { icon: "phone" | "globe" | "mapPin" | "mail"; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4, alignItems: "center" }}>
      <View style={{ width: 18, marginRight: 8 }}>
        <LucideIcon name={icon} />
      </View>
      <Text style={{ fontSize: 9 }}>{value}</Text>
    </View>
  );
}

function LucideIcon({ name }: { name: "phone" | "globe" | "mapPin" | "mail" }) {
  const common = { stroke: "#63746e", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "phone") {
    return (
      <Svg viewBox="0 0 24 24" width={14} height={14}>
        <Path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.09 5.18 2 2 0 0 1 5.05 3h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.62a2 2 0 0 1-.45 2.11L9 10.91a16 16 0 0 0 4.09 4.09l1.46-1.22a2 2 0 0 1 2.11-.45c.84.29 1.72.5 2.62.62A2 2 0 0 1 22 16.92z" {...common} fill="none" />
      </Svg>
    );
  }
  if (name === "globe") {
    return (
      <Svg viewBox="0 0 24 24" width={14} height={14}>
        <Circle cx="12" cy="12" r="10" {...common} fill="none" />
        <Line x1="2" y1="12" x2="22" y2="12" {...common} />
        <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...common} fill="none" />
      </Svg>
    );
  }
  if (name === "mapPin") {
    return (
      <Svg viewBox="0 0 24 24" width={14} height={14}>
        <Path d="M12 22s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12z" {...common} fill="none" />
        <Circle cx="12" cy="10" r="2.5" {...common} fill="none" />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14}>
      <Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" {...common} fill="none" />
      <Path d="m22 7-10 7L2 7" {...common} fill="none" />
    </Svg>
  );
}

export function OfferItemsTableBlock({ sectionTitle, items }: { sectionTitle: string; items: OrderItem[] }) {
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

export function OfferOrderDataTableBlock({ order }: { order: Order }) {
  const eventDate = order.date?.trim() ? order.date : "—";
  const eventTime = "—";
  const clientName = order.client?.trim() ? order.client : "—";
  const phone = order.phone?.trim() ? order.phone : "—";
  const deliveryAddress = order.deliveryAddress?.trim() ? order.deliveryAddress : "";

  const rows = [
    { label: "Data wydarzenia", value: eventDate },
    { label: "Godzina wydarzenia", value: eventTime },
    { label: "Klient", value: clientName },
    ...(deliveryAddress ? [{ label: "Adres dostawy", value: deliveryAddress }] : []),
    { label: "Telefon", value: phone },
  ];

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={pdfStyles.sectionTitle}>Dane zamówienia</Text>
      <View style={{ borderWidth: 0.5, borderColor: "#d2dbd7" }}>
        {rows.map((row, idx) => (
          <View
            key={`${row.label}-${idx}`}
            style={{
              flexDirection: "row",
              borderBottomWidth: idx === rows.length - 1 ? 0 : 0.5,
              borderBottomColor: "#d2dbd7",
            }}
          >
            <Text style={{ width: "35%", paddingHorizontal: 8, paddingVertical: 6, color: "#63746e", fontSize: 9 }}>
              {row.label}
            </Text>
            <Text style={{ width: "65%", paddingHorizontal: 8, paddingVertical: 6, fontSize: 9 }}>{row.value}</Text>
          </View>
        ))}
      </View>
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
