// Run after bun run build. The generated xlsx is cached outside the repo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { largeTableBytes } from "../test/largeTableFixture.mjs";
import { parseExcel } from "../dist/index.js";
import { getSourceMatrixStats, peekCell } from "@lofcz/tinysheet-core";

const rows = Number(process.argv[2] || 50000);
const file = path.join(
  os.tmpdir(),
  `tinysheet-ts-xlsx-large-table-${rows}.xlsx`
);
if (!fs.existsSync(file)) fs.writeFileSync(file, await largeTableBytes(rows));
const bytes = fs.readFileSync(file);
for (const preserve of [false, true]) {
  const start = performance.now();
  const result = await parseExcel(bytes, "table.xlsx", { preserve });
  const parsed = performance.now();
  const data = result.sheets[0].data;
  for (let r = 0; r < Math.min(40, data.length); r++) {
    for (let c = 0; c < Math.min(12, data[0].length); c++) peekCell(data, r, c);
  }
  console.log(
    JSON.stringify({
      rows,
      preserve,
      parseMs: Math.round(parsed - start),
      firstViewportMs: Math.round(performance.now() - start),
      cells: result.source.worksheets[0].cellCount,
      sheets: result.sheets.length,
      source: getSourceMatrixStats(data),
    })
  );
}
