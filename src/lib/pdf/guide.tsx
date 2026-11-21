import "server-only";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { registerFonts, C, mm, assetUri } from "./common";

const STEPS: Record<string, string[]> = {
  registration: [
    "Tap “New person”, then scan a blank Gratitude Card (or type its code).",
    "Enter full name, gender and age range. Phone and community if they want.",
    "If “Possible match” appears, check age range and community. Tap “Same person” if it is them.",
    "Children and teens: write the guardian's name.",
    "Tick the services they need.",
    "Read the consent script aloud. Tick the boxes only if they agree.",
    "Save. Show the big code and hand them the card.",
  ],
  prayer: [
    "Tap “Scan card” and point the camera at the person's card.",
    "Check the name. Tap “Record Prayer service”.",
    "Tap the prayer focus. Choose a decision if they made one.",
    "Tick “Wants follow-up” or “Join a fellowship” if they ask.",
    "Save. A salvation or rededication creates a follow-up automatically.",
  ],
  counselling: [
    "Scan the card and check the name.",
    "Tap “Record Counselling service”. Choose a category.",
    "Write your notes. Only counsellors can read them.",
    "Set the risk. “Urgent” alerts the Station Lead straight away.",
    "Turn on follow-up or refer to Medical if needed, then Save.",
  ],
  medical: [
    "Scan the card and check the name, age range and any alerts.",
    "Tap “Record Medical service”. Enter vitals: red boxes mean high.",
    "Tick the complaint and tests. Write your impression.",
    "Dispense from stock: choose the medicine, quantity and dosage.",
    "Refer to hospital if needed (facility, reason, urgency), then Save.",
  ],
  food: [
    "Scan the card. Tap “Record Food service”.",
    "Tap the pack type. Change the quantity only if needed.",
    "Tap Save. That's it.",
    "“Already served” means they collected food today. A second pack needs the Station Lead.",
    "Out of stock? Tap “Not available” on the profile.",
  ],
  clothing: [
    "Scan the card. Tap “Record Clothing service”.",
    "Tap a category, choose the size and quantity.",
    "Tap “Add another” for more items.",
    "Choose who it is for (Self, Child, Other), then Save.",
  ],
};
const DEFAULT = ["Scan the card and check the name.", "Tap “Record service”.", "Add notes if needed, then Save."];

export function GuidesDocument({ edition, stations, training }: { edition: string; stations: { name: string; kind: string }[]; training: boolean }) {
  registerFonts();
  return (
    <Document title={`${edition} station quick guides`} author="Gratitude Connect">
      {stations.map((s) => (
        <Page key={s.name} size="A4" style={{ fontFamily: "Sora", color: C.ink, padding: mm(16) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={assetUri("icons/logo-480.png")} style={{ width: mm(50), height: mm(11), objectFit: "contain" }} />
            {training && <Text style={{ fontSize: 11, color: C.warning, fontWeight: 500 }}>TRAINING</Text>}
          </View>
          <Text style={{ fontSize: 34, fontWeight: 500, color: C.forest, marginTop: mm(8) }}>{s.name}: quick guide</Text>
          <Text style={{ fontSize: 12, color: C.n700, marginTop: mm(1) }}>{edition}</Text>
          <View style={{ marginTop: mm(10), gap: mm(5) }}>
            {(STEPS[s.kind] ?? DEFAULT).map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: mm(4) }} wrap={false}>
                <Text style={{ width: mm(9), height: mm(9), borderRadius: mm(4.5), backgroundColor: C.leaf600, color: "#FFFFFF", textAlign: "center", fontSize: 14, fontWeight: 500, paddingTop: mm(1.4) }}>{i + 1}</Text>
                <Text style={{ fontSize: 15, flex: 1, lineHeight: 1.45 }}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: mm(12), backgroundColor: C.n50, borderRadius: 8, padding: mm(5), gap: mm(2.5) }}>
            <Text style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>Good to know</Text>
            <Text style={{ fontSize: 11.5 }}>• No card? Tap Search and type the name or the last 4 digits of their phone. Check age range and community.</Text>
            <Text style={{ fontSize: 11.5 }}>• No network? Keep going. Everything saves on your phone and syncs later. The top-right pill shows how many are waiting.</Text>
            <Text style={{ fontSize: 11.5 }}>• Made a mistake? Tap “Undo” on the green message within 10 seconds.</Text>
            <Text style={{ fontSize: 11.5 }}>• Person needs another station? Tap “Refer” on their profile.</Text>
            <Text style={{ fontSize: 11.5 }}>• Never take screenshots of people&apos;s details. Don&apos;t leave the station without syncing (Me → Sync now).</Text>
          </View>
          <Text style={{ position: "absolute", bottom: mm(12), left: mm(16), right: mm(16), fontSize: 9, color: C.n500 }}>
            Problems? Find your Station Lead or the coordinator. Say “person”, never “case”, and use people’s names.
          </Text>
        </Page>
      ))}
    </Document>
  );
}
