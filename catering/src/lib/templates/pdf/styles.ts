import { StyleSheet } from "@react-pdf/renderer";

export const pdfColors = {
  text: "#27352f",
  mutedText: "#63746e",
  grid: "#d2dbd7",
  primary: "#2d9c6d",
  headBg: "#eef6f2",
  footBg: "#f5f8f6",
};

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "NotoSans",
    color: pdfColors.text,
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
    color: pdfColors.text,
  },
  subtitle: {
    fontSize: 10,
    color: pdfColors.mutedText,
    marginBottom: 8,
  },
  rule: {
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.grid,
    marginBottom: 12,
  },
  metaLine: {
    fontSize: 9,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: pdfColors.primary,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionGap: {
    marginTop: 4,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: pdfColors.headBg,
    borderWidth: 0.5,
    borderColor: pdfColors.grid,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeadCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: pdfColors.primary,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: pdfColors.grid,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowSub: {
    flexDirection: "row",
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: pdfColors.grid,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#fafcfb",
  },
  tableFoot: {
    flexDirection: "row",
    backgroundColor: pdfColors.footBg,
    borderWidth: 0.5,
    borderColor: pdfColors.grid,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableFootCell: {
    fontSize: 11,
    fontWeight: "bold",
  },
  cellMuted: {
    fontSize: 8,
    color: pdfColors.mutedText,
  },
  mutedNote: {
    fontSize: 9,
    color: pdfColors.mutedText,
    marginTop: 8,
  },
});
