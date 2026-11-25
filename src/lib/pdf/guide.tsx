import "server-only";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { registerFonts, C, mm, assetUri } from "./common";

const STEPS: Record<string, string[]> = {
  registration: [
    "Tap “New person”, then scan a blank Gratitude Card (or type its code).",
    "Enter full name, gender and age range. Phone and community if they want.",
    "If “Possible match” appears, check age range and community. Tap “Same person” if it is them.",
    "Children and teens: write the guardian's name.",
    "Tick Doctor, Clothing or Food if they need them. Everyone also goes to Medical Assistant, Counselling and Pharmacy.",
    "Read the consent script aloud. Tick the boxes only if they agree.",
    "Save. Show the big code and hand them the card.",
  ],
  medical_assistant: [
    "Scan the QR or type the number. Check the name and age range.",
    "Tap “Record vital signs”. Enter what you measured: red boxes mean high.",
    "“Send to General Doctor” turns on when a reading is out of range. Turn it on yourself if they need the doctor.",
    "Tap “Save vital signs”. The doctor sees them straight away. No one writes them again.",
    "Send the person to the doctor, or to Counselling if they do not need one.",
  ],
  optician: [
    "Scan the QR and check the name. People the doctor referred are in your list.",
    "Tap “Record eye check”. Read the vital signs and doctor's comments at the top.",
    "Enter visual acuity, findings and the outcome.",
    "Prescribe eye drops or medicine if needed. Pharmacy gets it after Counselling.",
    "Tap “Save eye check”.",
  ],
  laboratory: [
    "Scan the QR and check the name. People the doctor sent are in your list.",
    "Tap “Record test results”. The tests the doctor asked for are listed.",
    "Type each result. Tick “Abnormal” where needed.",
    "Tap Save. The person goes back to the doctor's list and the doctor sees the results.",
  ],
  prayer: [
    "Scan the QR and check the name. Everyone must come here before Pharmacy.",
    "Tap “Start Counselling”. Choose New Convert, Already Born Again or Neither.",
    "Choose Holy Ghost baptism: Not yet, Already, or New today. Tick tongues if they already speak.",
    "Tick healing, follow-up or fellowship if they apply.",
    "Tap “Complete Counselling”. Pharmacy opens for them. A New Convert gets a follow-up automatically.",
  ],
  pharmacy: [
    "Scan the QR. If you see “Counselling not completed”, tap “Send to Counselling”. You cannot attend to them yet.",
    "Read the prescription. Untick anything you cannot give, then tap “Give medicine”.",
    "No prescription? Tap “No medicine needed”. Everyone still passes through Pharmacy.",
    "Phones offline and the person says they finished Counselling? Ask your Station Lead to override. It is reviewed later.",
  ],
  counselling: [
    "Scan the card and check the name.",
    "Tap “Record Counselling service”. Choose a category.",
    "Write your notes. Only counsellors can read them.",
    "Set the risk. “Urgent” alerts the Station Lead straight away.",
    "Turn on follow-up or refer to Medical if needed, then Save.",
  ],
  medical: [
    "Scan the QR and check the name, age range and any alerts.",
    "Tap “See patient”. Vital signs and earlier notes are at the top: you do not enter vitals.",
    "Write comments and observations. Add a prescription from the list.",
    "Request tests: they go to the Laboratory, and the results come back to your list.",
    "Refer to the Optician, minor surgery or a hospital if needed, then tap “Save medical check”.",
  ],
  food: [
    "Scan the QR. A warning shows if Pharmacy is not done: you can still serve them.",
    "Tick that they received food. Choose the pack if you want it counted in stock.",
    "Tap Save. That's it.",
    "“Already served” means they collected food today. A second pack needs the Station Lead.",
    "Out of stock? Tap “Not available” on the profile.",
  ],
  clothing: [
    "Scan the QR. A warning shows if Pharmacy is not done: you can still serve them.",
    "Tick that they received clothes. Choose the items if you want them counted in stock.",
    "Use “More details” for sizes, or for clothes for a child or someone else.",
    "Tap Save.",
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
