// Import benchmark: builds an xlsx with ExcelJS (cached in the OS temp dir)
// and times parseExcel on it.
//
//   node packages/excel/scripts/bench-import.mjs [rows] [cols]
//
// Run `bun run build` first; it measures ../dist.
import ExcelJS from "@protobi/exceljs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// BENCH_ENTRY: another build or source entry to compare (e.g. with bun).
const { parseExcel } = await import(
  process.env.BENCH_ENTRY
    ? path.resolve(process.env.BENCH_ENTRY)
    : "../dist/index.js"
);

const rows = Number(process.argv[2] || 10000);
const cols = Number(process.argv[3] || 10);
const cache = path.join(os.tmpdir(), `tinysheet-bench-${rows}x${cols}.xlsx`);

async function build() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  for (let r = 1; r <= rows; r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c += 1) {
      const cell = row.getCell(c);
      if (c % 4 === 0) cell.value = `text ${r % 500}`;
      else if (c % 4 === 1) cell.value = r * c;
      else if (c % 4 === 2) {
        cell.value = r + c / 10;
        cell.numFmt = "0.00";
        cell.font = { bold: true, color: { argb: "FFFF0000" } };
      } else cell.value = { formula: `A${r}*2`, result: r * 2 };
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

let bytes;
if (fs.existsSync(cache)) bytes = fs.readFileSync(cache);
else {
  bytes = await build();
  fs.writeFileSync(cache, bytes);
}

const runs = Number(process.argv[4] || 3);
const times = [];
let result;
let retained = 0;
for (let i = 0; i < runs; i += 1) {
  result = null;
  globalThis.gc?.();
  const before = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  // eslint-disable-next-line no-await-in-loop
  result = await parseExcel(bytes, "bench.xlsx");
  times.push(performance.now() - t0);
  globalThis.gc?.();
  if (i === 0) retained = process.memoryUsage().heapUsed - before;
}
console.log(
  `${rows}x${cols} = ${rows * cols} cells (${(bytes.length / 1e6).toFixed(
    1
  )} MB): best ${Math.min(...times).toFixed(0)} ms of ${runs} (${times
    .map((t) => t.toFixed(0))
    .join(", ")}), ${result.sheets[0].celldata.length} cells, result ${(
    retained / 1e6
  ).toFixed(0)} MB, peak RSS ${(process.resourceUsage().maxRSS / 1e3).toFixed(
    0
  )} MB`
);
