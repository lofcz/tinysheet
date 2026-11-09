import test from "node:test";
import assert from "node:assert/strict";
import {
  parseExcelInWorker,
  parseExcel,
  encodeExcelImportResult,
  decodeExcelImportResult,
} from "../dist/index.js";
import { Workbook, writeXlsx } from "@lofcz/ts-xlsx";

test("explicit sparse materialization retains caller edits across encoding", async () => {
  const workbook = new Workbook();
  workbook.addWorksheet("S").getCell("A1").value = "original";
  const result = await parseExcel(writeXlsx(workbook));
  result.sheets[0].celldata[0].v.v = "edited";
  const restored = decodeExcelImportResult(encodeExcelImportResult(result));
  assert.equal(restored.sheets[0].celldata[0].v.v, "edited");
});

// Only the transport is simulated: exercise the public worker API's settlement
// and listener ownership when a browser fails before/after a worker replies.
class Transport extends EventTarget {
  listeners = new Map();
  addEventListener(type, fn) {
    super.addEventListener(type, fn);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    super.removeEventListener(type, fn);
    this.listeners.get(type)?.delete(fn);
  }
  postMessage(request) {
    this.request = request;
  }
  get listenerCount() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
}

for (const type of ["error", "messageerror"]) {
  test(`worker ${type} rejects concurrent imports and releases listeners`, async () => {
    const worker = new Transport();
    const promises = [
      parseExcelInWorker(worker, new ArrayBuffer(1)),
      parseExcelInWorker(worker, new ArrayBuffer(1)),
    ];
    worker.dispatchEvent(new Event(type));
    await Promise.all(promises.map((p) => assert.rejects(p, /worker failed/)));
    assert.equal(worker.listenerCount, 0);
  });
}

test("postMessage failure and malformed JSON reject instead of hanging", async () => {
  const worker = new Transport();
  worker.postMessage = () => {
    throw new Error("transport closed");
  };
  await assert.rejects(
    parseExcelInWorker(worker, new ArrayBuffer(1)),
    /transport closed/
  );
  assert.equal(worker.listenerCount, 0);
  delete worker.postMessage;
  const pending = parseExcelInWorker(worker, new ArrayBuffer(1));
  worker.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "tinysheet:parseExcel:result",
        id: worker.request.id,
        json: new TextEncoder().encode("not json").buffer,
      },
    })
  );
  await assert.rejects(pending, SyntaxError);
  assert.equal(worker.listenerCount, 0);
});
