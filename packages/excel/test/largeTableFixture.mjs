import { Workbook, writeXlsx } from "@lofcz/ts-xlsx";

/** Synthetic version of a customer-shaped workbook; no external data. */
export async function largeTableBytes(rows = 50000, useSharedStrings = false) {
  const wb = new Workbook();
  const sheet = wb.addWorksheet("Data");
  const columns = [
    "ID",
    "Region",
    "Date",
    "Blank",
    "Amount",
    "Owner",
    "City",
    "Status",
    "Code",
    "Note",
  ];
  sheet.addRows([
    columns,
    ...Array.from({ length: rows }, (_, i) => {
      const r = i + 1;
      return [
        `ID-${String(r).padStart(5, "0")}`,
        ["East", "West"][r % 2],
        new Date(Date.UTC(2024, 0, 1 + (r % 365))),
        null,
        r / 100,
        ...Array.from({ length: 5 }, (_, c) => `Value ${c}-${r % 100}`),
      ];
    }),
  ]);
  sheet.addTable({
    name: "Records",
    ref: "A1",
    headerRow: true,
    rowCount: rows,
    style: { name: "TableStyleMedium2", showRowStripes: true },
    columns: columns.map((name) => ({ name })),
  });
  const edge = { style: "thin", color: { argb: "FF305496" } };
  for (let r = 1; r <= rows + 1; r += 1) {
    for (let c = 1; c <= columns.length; c += 1) {
      if (r === 1 || r === rows + 1 || c === 1 || c === columns.length) {
        sheet.getRow(r).getCell(c).border = {
          ...(r === 1 ? { top: edge } : {}),
          ...(r === rows + 1 ? { bottom: edge } : {}),
          ...(c === 1 ? { left: edge } : {}),
          ...(c === columns.length ? { right: edge } : {}),
        };
      }
    }
  }
  for (const count of [100, 500]) {
    const lookup = wb.addWorksheet(`Lookup ${count}`);
    for (let r = 0; r < count; r += 1) lookup.addRow([`Lookup ${r}`, r]);
  }
  return new Uint8Array(writeXlsx(wb, { useSharedStrings }));
}
