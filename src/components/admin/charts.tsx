"use client";
// Lazy-loaded (next/dynamic) — recharts never ships to the volunteer app.
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import type { DashboardStats } from "@/lib/dashboard";

const COLORS: Record<string, string> = { prayer: "#07999B", counselling: "#4B3F72", medical_assistant: "#E06A5F", medical: "#B42318", optician: "#8A5A00", laboratory: "#1F5FA8", pharmacy: "#7A271A", food: "#188B12", clothing: "#42A93D", checkout: "#3F4741", custom: "#3F4741" };
const hourLabel = (h: string) => h.slice(11, 16);

export function HourlyChart({ hourly }: { hourly: DashboardStats["hourly"] }) {
  const data = hourly.map((h) => ({ hour: hourLabel(h.hour), arrivals: h.arrivals, ...h.services }));
  const kinds = [...new Set(hourly.flatMap((h) => Object.keys(h.services)))];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure>
        <figcaption className="mb-2 text-label font-medium text-forest">Arrivals per hour</figcaption>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke="#EFF2EF" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 12, fill: "#6B756D" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6B756D" }} />
              <Tooltip />
              <Line type="monotone" dataKey="arrivals" name="Arrivals" stroke="#188B12" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-label font-medium text-forest">Services per hour by station</figcaption>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke="#EFF2EF" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 12, fill: "#6B756D" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6B756D" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {kinds.map((k) => <Bar key={k} dataKey={k} name={k[0]!.toUpperCase() + k.slice(1)} stackId="s" fill={COLORS[k] ?? "#3F4741"} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
