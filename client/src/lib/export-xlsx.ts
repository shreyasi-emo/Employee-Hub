// Real .xlsx export (SheetJS) so files open directly in Excel without the
// "Problems During Load" warning that HTML-as-.xls files trigger.

export interface XlsxExport {
  filename: string;            // e.g. "holidays-2026.xlsx"
  sheet?: string;              // worksheet/tab name
  title?: string;              // optional title row above the headers
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export async function exportXlsx({ filename, sheet = "Sheet1", title, headers, rows }: XlsxExport) {
  const mod: any = await import("xlsx");
  const XLSX = mod.utils ? mod : mod.default; // handle CJS/ESM interop
  const aoa: any[][] = [];
  if (title) { aoa.push([title]); aoa.push([]); }
  aoa.push(headers);
  rows.forEach((r) => aoa.push(r.map((c) => (c == null ? "" : c))));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-size columns from header + cell lengths
  ws["!cols"] = headers.map((h, i) => {
    let max = String(h).length;
    for (const r of rows) max = Math.max(max, String(r[i] ?? "").length);
    return { wch: Math.min(60, Math.max(10, max + 2)) };
  });

  // Merge the title across all columns
  if (title) ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, headers.length - 1) } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
