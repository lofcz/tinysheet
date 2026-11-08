// Run after bun run build. The generated xlsx is cached outside the repo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { largeTableBytes } from "../test/largeTableFixture.mjs";
import { parseExcel } from "../dist/index.js";

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
  console.log(
    JSON.stringify({
      rows,
      preserve,
      ms: Math.round(performance.now() - start),
      cells: result.sheets[0].celldata.length,
      sheets: result.sheets.length,
      borders: result.sheets[0].config.borderInfo.length,
    })
  );
}
