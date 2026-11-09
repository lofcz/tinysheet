// T119: import performance of a 100k-cell workbook (built in the test) and
// the off-main-thread path. Timings are reported as diagnostics; the limits
// are generous so a loaded CI machine does not fail them. For numbers, run
// scripts/bench-import.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { Workbook, writeXlsx } from "@lofcz/ts-xlsx";
import { getSourceMatrixStats, peekCell } from "@lofcz/tinysheet-core";
import { parseExcel, parseExcelInWorker } from "../dist/index.js";
import { cellMap, xlsxBytes } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("source borders share immutable styles while explicit cell snapshots own their edges", async () => {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Borders");
  for (const address of ["A1", "A2"]) {
    sheet.getCell(address).value = address;
    sheet.getCell(address).border = {
      left: { style: "thin", color: { argb: "FFFF0000" } },
    };
  }
  const imported = (await parseExcel(writeXlsx(workbook))).sheets[0];
  const first = peekCell(imported.data, 0, 0).sourceBorder;
  const second = peekCell(imported.data, 1, 0).sourceBorder;
  assert.equal(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.l));
  assert.equal(first.l.color, "#FF0000");
  void imported.celldata;
  const borders = imported.config.borderInfo;
  borders[0].value.l.color = "#0000FF";
  assert.equal(borders[1].value.l.color, "#FF0000");
  assert.equal(first.l.color, "#FF0000");
});

test("inline and shared-string imports decode only requested cells, including after worker transfer", async () => {
  const wb = new Workbook();
  const ws = wb.addWorksheet("Strings");
  for (let r = 1; r <= 2000; r++)
    ws.getCell(`A${r}`).value = `Unique ${r} & <text>`;
  ws.getCell("B2000").value = {
    richText: [{ text: "bold", font: { bold: true } }, { text: " plain" }],
  };
  const w = nodeWorker(path.resolve(__dirname, "fixtures/parseWorker.mjs"));
  try {
    for (const useSharedStrings of [false, true]) {
      const bytes = writeXlsx(wb, { useSharedStrings });
      for (const result of [
        await parseExcel(bytes),
        await parseExcelInWorker(w, bytes),
      ]) {
        const data = result.sheets[0].data;
        assert.equal(getSourceMatrixStats(data).decodedCells, 0);
        assert.equal(result.source.stringOffsets.length > 0, useSharedStrings);
        assert.equal(peekCell(data, 1999, 0).v, "Unique 2000 & <text>");
        assert.equal(peekCell(data, 0, 0).v, "Unique 1 & <text>");
        assert.equal(peekCell(data, 1999, 1).ct.s[0].bl, 1);
        assert.equal(
          peekCell(data, 1999, 1)
            .ct.s.map((run) => run.v)
            .join(""),
          "bold plain"
        );
        assert.equal(getSourceMatrixStats(data).decodedCells, 3);
        assert.equal(getSourceMatrixStats(data).materializedRows, 0);
      }
    }
  } finally {
    await w.worker.terminate();
  }
});

async function bigWorkbook(rows, cols) {
  const wb = new Workbook();
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
  return xlsxBytes(wb);
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
  // Coarse CI guard; the browser benchmark reports interactive timings too.
  assert.ok(ms < 20000, `${ms} ms`);
});

function nodeWorker(file) {
  // node's Worker is an EventEmitter: give it the DOM Worker surface
  const worker = new Worker(file);
  const listeners = new Map();
  return {
    worker,
    addEventListener(type, fn) {
      const wrapped = type === "message" ? (data) => fn({ data }) : fn;
      if (!listeners.has(type)) listeners.set(type, new Map());
      listeners.get(type).set(fn, wrapped);
      worker.on(type, wrapped);
    },
    removeEventListener(type, fn) {
      const wrapped = listeners.get(type)?.get(fn);
      if (wrapped) worker.off(type, wrapped);
      listeners.get(type)?.delete(fn);
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
    assert.deepEqual(viaWorker.sizing, direct.sizing);
    assert.deepEqual(viaWorker.preservation, direct.preservation);
    assert.deepEqual(viaWorker.sheets[0].calcChain, direct.sheets[0].calcChain);
    assert.equal(viaWorker.sheets[0].data.length, 25000);
    for (const r of [0, 12499, 24999]) {
      for (let c = 0; c < 4; c++) {
        assert.deepEqual(
          viaWorker.sheets[0].data[r][c],
          direct.sheets[0].data[r][c]
        );
        assert.deepEqual(
          viaClone.sheets[0].data[r][c],
          direct.sheets[0].data[r][c]
        );
      }
    }
    assert.equal(viaClone.sheets[0].celldata.length, 100000);
    await assert.rejects(
      parseExcelInWorker(w, new Uint8Array([1, 2, 3]), "bad.xlsx"),
      /Not an .xlsx file/
    );
  } finally {
    await w.worker.terminate();
  }
});
