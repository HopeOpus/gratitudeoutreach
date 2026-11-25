import "server-only";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { registerFonts, QR, C, mm, asset } from "./common";

const ACCENT: Record<string, string> = {
  registration: C.forest, prayer: "#07999B", counselling: "#4B3F72", medical: C.danger, medical_assistant: C.danger, optician: C.danger, laboratory: C.danger, pharmacy: C.danger, food: C.leaf, clothing: "#42A93D", checkout: C.n700, custom: C.n700,
};

export type PosterStation = { name: string; kind: string; pin: string | null; joinUrl: string; confidential: boolean };

export function PostersDocument({ edition, stations, training }: { edition: string; stations: PosterStation[]; training: boolean }) {
  registerFonts();
  return (
    <Document title={`${edition} station posters`} author="Gratitude Connect">
      {stations.map((st) => (
        <Page key={st.name} size="A4" style={{ fontFamily: "Sora", color: C.ink, padding: mm(16) }}>
          <View style={{ height: mm(6), backgroundColor: ACCENT[st.kind] ?? C.leaf, position: "absolute", top: 0, left: 0, right: 0 }} />
          {training && <Text style={{ position: "absolute", top: mm(9), right: mm(16), fontSize: 11, color: C.warning, fontWeight: 500 }}>TRAINING</Text>}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={asset("icons/logo-1200.png")} style={{ width: mm(70), height: mm(15), objectFit: "contain" }} />
          <Text style={{ fontSize: 14, color: C.n700, marginTop: mm(4) }}>{edition}</Text>
          <Text style={{ fontSize: 54, fontWeight: 500, color: C.forest, marginTop: mm(10) }}>{st.name}</Text>
          <Text style={{ fontSize: 16, color: C.n700, marginTop: mm(2) }}>Volunteers: sign in to this station</Text>

          <View style={{ flexDirection: "row", marginTop: mm(14), gap: mm(12), alignItems: "center" }}>
            <View style={{ padding: mm(4), borderWidth: 1, borderColor: C.n100, borderRadius: 8 }}>
              <QR value={st.joinUrl} size={mm(80)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: C.n500 }}>Station PIN</Text>
              <Text style={{ fontSize: 46, fontWeight: 300, color: C.forest, letterSpacing: 4 }}>{st.pin ?? "— — —"}</Text>
              {!st.pin && <Text style={{ fontSize: 10, color: C.warning }}>Rotate the PIN in Setup to print it here.</Text>}
              {st.confidential && <Text style={{ fontSize: 11, color: "#4B3F72", marginTop: mm(4) }}>Confidential station: you also need the role PIN from your Station Lead.</Text>}
            </View>
          </View>

          <View style={{ marginTop: mm(16), gap: mm(5) }}>
            {["Scan this QR with your phone camera (or open the app and type the PIN).", "Enter your first name.", "Tap “Scan card” for each person you serve."].map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: mm(4), alignItems: "center" }}>
                <Text style={{ width: mm(10), height: mm(10), borderRadius: mm(5), backgroundColor: C.leaf, color: "#FFFFFF", textAlign: "center", fontSize: 16, fontWeight: 500, paddingTop: mm(1.6) }}>{i + 1}</Text>
                <Text style={{ fontSize: 16, flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={{ position: "absolute", bottom: mm(12), left: mm(16), right: mm(16), fontSize: 9, color: C.n500 }}>
            Works offline after you join. Keep personal information private. Never share screenshots of people&apos;s details.
          </Text>
        </Page>
      ))}
    </Document>
  );
}
