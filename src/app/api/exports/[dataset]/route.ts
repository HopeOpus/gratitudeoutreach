import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { requireAdmin, loadEdition, bad } from "@/lib/server/api-auth";
import { buildDataset, DATASETS, type DatasetName } from "@/lib/server/exports";

export const runtime = "nodejs";

/** XLSX/CSV exports (FR-11.2). Confidential payloads are never exported; every export is audit-logged. */
export async function GET(req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const { dataset: raw } = await params;
  const url = new URL(req.url);
  const [name, extFromPath] = raw.split(".");
  const format = (url.searchParams.get("format") ?? extFromPath ?? "xlsx") as "xlsx" | "csv";
  if (!DATASETS.includes(name as DatasetName)) return bad("Unknown dataset", 404);
  const edition = await loadEdition(g, url.searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);

  const ds = await buildDataset(g.sb, edition.id, name as DatasetName);
  await g.sb.rpc("log_export", { p_edition: edition.id, p_dataset: name, p_rows: ds.rows.length, p_format: format });
  const filename = `${edition.code_prefix}-${name}-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "csv") {
    const csv = Papa.unparse({ fields: ds.columns.map((c) => c.header), data: ds.rows.map((r) => ds.columns.map((c) => r[c.key] ?? "")) });
    return new NextResponse("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gratitude Connect";
  wb.created = new Date();
  const ws = wb.addWorksheet(ds.title, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = ds.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  ws.getRow(1).font = { bold: false, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07210D" } };
  ws.getRow(1).height = 22;
  ds.rows.forEach((r) => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ds.columns.length } };
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
