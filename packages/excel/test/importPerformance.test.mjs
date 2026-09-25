// T119: import performance of a 100k-cell workbook (built in the test) and
// the off-main-thread path. Timings are reported as diagnostics; the limits
// are generous so a loaded CI machine does not fail them. For numbers, run
// scripts/bench-import.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import ExcelJS from "@protobi/exceljs";
import { parseExcel, parseExcelInWorker } from "../dist/index.js";
import { cellMap, excelJsBytes } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bigWorkbook(rows, cols) {
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
  return excelJsBytes(wb);
}

let bytes;
async function bytes100k() {
  bytes ??= await bigWorkbook(25000, 4);
  return bytes;
}

test("100k cells import quickly and completely", async (t) => {
  const input = await bytes100k();
  const t0 = performance.now();
  const result = await parseExcel(input, "big.xlsx");
  const ms = performance.now() - t0;
  t.diagnostic(`100k cells: ${ms.toFixed(0)} ms`);
  const sheet = result.sheets[0];
  assert.equal(sheet.celldata.length, 100000);
  const cells = cellMap(sheet);
  assert.equal(cells.get("24999_0").v, 25000);
  assert.equal(cells.get("24999_1").m, "25000.20");
  assert.equal(cells.get("24999_1").bl, 1);
  assert.equal(cells.get("24999_1").fc, "#FF0000");
  assert.equal(cells.get("24999_2").f, "=A25000*2");
  assert.equal(cells.get("24999_3").v, "text 0");
  // before the T119 work this took ~3 s on a quiet machine; now ~0.5 s
  assert.ok(ms < 20000, `${ms} ms`);
});

function nodeWorker(file) {
  // node's Worker is an EventEmitter: give it the DOM Worker surface
  const worker = new Worker(file);
  const listeners = new Map();
  return {
    worker,
    addEventListener(type, fn) {
      const wrapped = (data) => fn({ data });
      listeners.set(fn, wrapped);
      worker.on(type, wrapped);
    },
    removeEventListener(type, fn) {
      worker.off(type, listeners.get(fn));
    },
    postMessage(message, transfer) {
      worker.postMessage(message, transfer);
    },
  };
}

test("parseExcelInWorker returns what parseExcel returns", async (t) => {
  const input = await bytes100k();
  const w = nodeWorker(path.resolve(__dirname, "fixtures/parseWorker.mjs"));
  try {
    const t0 = performance.now();
    const [viaWorker, viaClone] = await Promise.all([
      parseExcelInWorker(w, input, "big.xlsx"),
      parseExcelInWorker(w, input, "big.xlsx", { transfer: "clone" }),
    ]);
    t.diagnostic(
      `worker (2 concurrent requests): ${(performance.now() - t0).toFixed(
        0
      )} ms`
    );
    // the caller's buffer is not detached
    assert.ok(input.byteLength > 0);
    const direct = await parseExcel(input, "big.xlsx");
    assert.deepEqual(viaWorker, JSON.parse(JSON.stringify(direct)));
    assert.equal(viaClone.sheets[0].celldata.length, 100000);
    await assert.rejects(
      parseExcelInWorker(w, new Uint8Array([1, 2, 3]), "bad.xlsx"),
      /Not an .xlsx file/
    );
  } finally {
    await w.worker.terminate();
  }
});
