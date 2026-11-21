import "server-only";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { registerFonts, QR, C, mm, assetUri } from "./common";
import { qrPayload } from "@/lib/cards";

export type CardLayout = "a4-10" | "a4-8" | "label58";
const CARD_W = mm(85);
const CARD_H = mm(55);

const s = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, padding: mm(4), fontFamily: "Sora", color: C.ink, position: "relative", backgroundColor: "#FFFFFF" },
  logo: { width: mm(38), height: mm(8), objectFit: "contain" },
  edition: { fontSize: 7.5, color: C.n700, marginTop: mm(2), fontWeight: 400, maxWidth: mm(44) },
  code: { position: "absolute", left: mm(4), bottom: mm(9), fontSize: 19, fontWeight: 500, letterSpacing: 1.6, color: C.forest },
  keep: { position: "absolute", left: mm(4), bottom: mm(4), fontSize: 7, color: C.n700 },
  qr: { position: "absolute", right: mm(3.5), top: mm(3.5) },
  band: { position: "absolute", left: 0, top: 0, bottom: 0, width: mm(1.6), backgroundColor: C.leaf },
});

function Card({ code, edition }: { code: string; edition: string }) {
  return (
    <View style={s.card}>
      <View style={s.band} />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={assetUri("icons/logo-480.png")} style={s.logo} />
      <Text style={s.edition}>{edition}</Text>
      <View style={s.qr}><QR value={qrPayload(code)} size={mm(30)} /></View>
      <Text style={s.code}>{code}</Text>
      <Text style={s.keep}>Keep this card with you today.</Text>
    </View>
  );
}

function CropMarks({ cols, rows, gapX, gapY, ox, oy }: { cols: number; rows: number; gapX: number; gapY: number; ox: number; oy: number }) {
  const len = mm(4);
  const marks: React.ReactNode[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 0; c < cols; c++) { xs.push(ox + c * (CARD_W + gapX)); xs.push(ox + c * (CARD_W + gapX) + CARD_W); }
  for (let r = 0; r < rows; r++) { ys.push(oy + r * (CARD_H + gapY)); ys.push(oy + r * (CARD_H + gapY) + CARD_H); }
  const top = oy, bottom = oy + rows * CARD_H + (rows - 1) * gapY, left = ox, right = ox + cols * CARD_W + (cols - 1) * gapX;
  xs.forEach((x, i) => {
    marks.push(<View key={`t${i}`} style={{ position: "absolute", left: x, top: top - len - mm(1), width: 0.4, height: len, backgroundColor: C.ink }} />);
    marks.push(<View key={`b${i}`} style={{ position: "absolute", left: x, top: bottom + mm(1), width: 0.4, height: len, backgroundColor: C.ink }} />);
  });
  ys.forEach((y, i) => {
    marks.push(<View key={`l${i}`} style={{ position: "absolute", top: y, left: left - len - mm(1), height: 0.4, width: len, backgroundColor: C.ink }} />);
    marks.push(<View key={`r${i}`} style={{ position: "absolute", top: y, left: right + mm(1), height: 0.4, width: len, backgroundColor: C.ink }} />);
  });
  return <>{marks}</>;
}

export function CardsDocument({ codes, edition, layout }: { codes: string[]; edition: string; layout: CardLayout }) {
  registerFonts();
  if (layout === "label58") {
    // 58 mm thermal sticker: one compact card per label.
    return (
      <Document title={`${edition} cards`} author="Gratitude Connect">
        {codes.map((code) => (
          <Page key={code} size={[mm(58), mm(40)]} style={{ fontFamily: "Sora", padding: mm(3), flexDirection: "row", gap: mm(2) }}>
            <QR value={qrPayload(code)} size={mm(24)} />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: C.forest, letterSpacing: 1 }}>{code}</Text>
              <Text style={{ fontSize: 6, color: C.n700, marginTop: 2 }}>{edition}</Text>
              <Text style={{ fontSize: 6, color: C.n700, marginTop: 2 }}>Keep this card with you today.</Text>
            </View>
          </Page>
        ))}
      </Document>
    );
  }
  const cols = 2;
  const rows = layout === "a4-10" ? 5 : 4;
  const perPage = cols * rows;
  const gapX = layout === "a4-10" ? 0 : mm(6);
  const gapY = layout === "a4-10" ? 0 : mm(8);
  const pageW = mm(210), pageH = mm(297);
  const ox = (pageW - (cols * CARD_W + (cols - 1) * gapX)) / 2;
  const oy = (pageH - (rows * CARD_H + (rows - 1) * gapY)) / 2;
  const pages: string[][] = [];
  for (let i = 0; i < codes.length; i += perPage) pages.push(codes.slice(i, i + perPage));

  return (
    <Document title={`${edition} cards`} author="Gratitude Connect">
      {pages.map((page, pi) => (
        <Page key={pi} size="A4" style={{ position: "relative" }}>
          <CropMarks cols={cols} rows={rows} gapX={gapX} gapY={gapY} ox={ox} oy={oy} />
          {page.map((code, i) => {
            const c = i % cols, r = Math.floor(i / cols);
            return (
              <View key={code} style={{ position: "absolute", left: ox + c * (CARD_W + gapX), top: oy + r * (CARD_H + gapY), borderWidth: layout === "a4-10" ? 0.25 : 0, borderColor: C.n100 }}>
                <Card code={code} edition={edition} />
              </View>
            );
          })}
          <Text style={{ position: "absolute", bottom: mm(3), left: 0, right: 0, textAlign: "center", fontSize: 6, color: C.n500, fontFamily: "Sora" }}>
            {edition} · page {pi + 1} of {pages.length} · print at 100% (no scaling)
          </Text>
        </Page>
      ))}
    </Document>
  );
}
