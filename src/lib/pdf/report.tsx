import "server-only";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { registerFonts, C, mm, asset } from "./common";
import type { DashboardStats } from "@/lib/dashboard";
import { FOLLOWUP_TYPE_LABEL, FOLLOWUP_STATUS_LABEL } from "@/lib/dashboard";

const s = StyleSheet.create({
  page: { fontFamily: "Sora", fontSize: 9.5, color: C.ink, paddingHorizontal: mm(16), paddingTop: mm(16), paddingBottom: mm(18) },
  h2: { fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: mm(3), marginTop: mm(6) },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.n100, paddingVertical: 3.5 },
  th: { fontWeight: 500, color: C.n700 },
  footer: { position: "absolute", bottom: mm(8), left: mm(16), right: mm(16), fontSize: 7.5, color: C.n500, flexDirection: "row", justifyContent: "space-between" },
});
const n = (v: number | null | undefined) => new Intl.NumberFormat("en-NG").format(v ?? 0);
const pctOf = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Table({ head, rows, widths }: { head: string[]; rows: (string | number)[][]; widths: number[] }) {
  return (
    <View>
      <View style={[s.row, { borderBottomColor: C.forest }]}>{head.map((h, i) => <Text key={i} style={[s.th, { width: `${widths[i]}%`, textAlign: i ? "right" : "left" }]}>{h}</Text>)}</View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.row, ri % 2 ? { backgroundColor: C.n25 } : {}]} wrap={false}>
          {r.map((c, i) => <Text key={i} style={{ width: `${widths[i]}%`, textAlign: i ? "right" : "left" }}>{typeof c === "number" ? n(c) : c}</Text>)}
        </View>
      ))}
    </View>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 3 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }} wrap={false}>
          <Text style={{ width: mm(30), color: C.n700 }}>{d.label}</Text>
          <View style={{ flex: 1, height: 9, backgroundColor: C.n50 }}><View style={{ width: `${(d.value / max) * 100}%`, height: 9, backgroundColor: C.leaf }} /></View>
          <Text style={{ width: mm(14), textAlign: "right" }}>{n(d.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ edition, stats, org }: { edition: { name: string; starts_on: string; venue: string | null; status: string; closed_at: string | null }; stats: DashboardStats; org: string }) {
  registerFonts();
  const k = stats.kpis;
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(new Date(edition.starts_on));
  const generated = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(stats.generated_at));
  const footer = (
    <View style={s.footer} fixed>
      <Text>{edition.name} · Summary report</Text>
      <Text render={({ pageNumber, totalPages }) => `Generated ${generated} · ${pageNumber}/${totalPages}`} />
    </View>
  );
  const kpis: [string, number][] = [
    ["People registered", k.registered], ["People served", k.served_unique], ["Services delivered", k.services],
    ["Salvations", k.salvations], ["Rededications", k.rededications], ["Medical referrals", k.referrals],
    ["Follow-ups created", k.followups], ["Volunteers", k.volunteers], ["Urgent counselling", k.urgent_counselling],
  ];
  const services = stats.stations.filter((st) => st.kind !== "registration");

  return (
    <Document title={`${edition.name} summary`} author="Gratitude Connect">
      <Page size="A4" style={[s.page, { paddingTop: 0, paddingHorizontal: 0 }]}>
        <View style={{ backgroundColor: C.forest, paddingHorizontal: mm(16), paddingTop: mm(26), paddingBottom: mm(18) }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={asset("icons/logo-white-1200.png")} style={{ width: mm(80), height: mm(17), objectFit: "contain" }} />
          <Text style={{ color: C.fresh, fontSize: 26, fontWeight: 500, marginTop: mm(12) }}>{edition.name}</Text>
          <Text style={{ color: "#CDD3CF", fontSize: 12, marginTop: mm(2) }}>{date}{edition.venue ? ` · ${edition.venue}` : ""}</Text>
          <Text style={{ color: "#CDD3CF", fontSize: 10, marginTop: mm(1) }}>{org} · {edition.status === "closed" ? "Final report" : "Live snapshot (edition not yet closed)"}</Text>
        </View>
        <View style={{ paddingHorizontal: mm(16) }}>
          <Text style={s.h2}>At a glance</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mm(3) }}>
            {kpis.map(([label, value]) => (
              <View key={label} style={{ width: "31.8%", borderWidth: 0.5, borderColor: C.n100, borderRadius: 6, padding: mm(3.5) }}>
                <Text style={{ fontSize: 8.5, color: C.n500 }}>{label}</Text>
                <Text style={{ fontSize: 24, fontWeight: 300, color: C.forest, marginTop: 2 }}>{n(value)}</Text>
              </View>
            ))}
          </View>
          <Text style={s.h2}>Per station</Text>
          <Table head={["Station", "Served", "Still pending", "Avg time", "Stock used"]} widths={[32, 17, 17, 17, 17]}
            rows={services.map((st) => [st.name, st.served, st.pending, st.avg_service_seconds ? `${Math.max(1, Math.round(st.avg_service_seconds / 60))} min` : "—",
              st.stock_items ? pctOf(st.stock_opening - st.stock_remaining, st.stock_opening) : "—"])} />
        </View>
        {footer}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={[s.h2, { marginTop: 0 }]}>Who we served</Text>
        <View style={{ flexDirection: "row", gap: mm(8) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 500, marginBottom: 4 }}>Age range</Text>
            <Bars data={["0-12", "13-17", "18-35", "36-59", "60+"].map((a) => ({ label: a.replace("-", "–"), value: stats.demographics.age_range[a] ?? 0 }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 500, marginBottom: 4 }}>Gender</Text>
            <Bars data={Object.entries(stats.demographics.gender).map(([g, v]) => ({ label: g === "female" ? "Female" : g === "male" ? "Male" : "Not given", value: v }))} />
          </View>
        </View>
        <Text style={[s.h2]}>Top communities</Text>
        <Bars data={stats.demographics.communities.map((c) => ({ label: c.community, value: c.count }))} />
        <Text style={s.h2}>Arrivals per hour</Text>
        <Bars data={stats.hourly.map((h) => ({ label: new Date(h.hour + "Z").toISOString().slice(11, 16), value: h.arrivals }))} />
        <Text style={s.h2}>Follow-up pipeline</Text>
        <View style={{ flexDirection: "row", gap: mm(8) }}>
          <View style={{ flex: 1 }}><Table head={["Type", "Count"]} widths={[70, 30]} rows={Object.entries(stats.followups_by_type).map(([t, c]) => [FOLLOWUP_TYPE_LABEL[t] ?? t, c])} /></View>
          <View style={{ flex: 1 }}><Table head={["Status", "Count"]} widths={[70, 30]} rows={Object.entries(stats.followups_by_status).map(([t, c]) => [FOLLOWUP_STATUS_LABEL[t] ?? t, c])} /></View>
        </View>
        {footer}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={[s.h2, { marginTop: 0 }]}>Stock used</Text>
        <Table head={["Item", "Station", "Opening", "Used", "Remaining"]} widths={[40, 18, 14, 14, 14]}
          rows={stats.stock.map((i) => [i.name, i.station, i.opening, i.used, i.remaining])} />
        <Text style={{ marginTop: mm(6), fontSize: 8, color: C.n500 }}>
          Counts exclude training data and voided records. Confidential medical and counselling details are never included in this report.
        </Text>
        {footer}
      </Page>
    </Document>
  );
}
