import test from "node:test";
import assert from "node:assert/strict";
import { readXlsx } from "@lofcz/ts-xlsx";
import { buildExcelWorkbook, exportToXlsx } from "../dist/index.js";

test("dynamic arrays and conversations belong to the workbook before serialization", async () => {
  const sheets = [
    {
      id: "sheet",
      name: "Data",
      order: 0,
      celldata: [
        { r: 0, c: 0, v: { f: "=SEQUENCE(2)", v: 1, spill: { rs: 2, cs: 1 } } },
      ],
      threadedComments: [
        {
          id: "thread",
          r: 0,
          c: 0,
          author: { id: "ann", name: "Ann" },
          created: "2026-01-01T12:00:00.000Z",
          text: "Check @[Bob](bob)",
          resolved: true,
          replies: [],
        },
      ],
    },
  ];
  const workbook = buildExcelWorkbook(sheets);
  assert.equal(workbook.worksheets[0].getCell("A1").value.dynamic, true);
  assert.equal(workbook.worksheets[0].commentThreads.length, 1);
  assert.equal(workbook.persons.length, 2);
  const loaded = readXlsx(await exportToXlsx(sheets));
  assert.equal(loaded.worksheets[0].getCell("A1").value.dynamic, true);
  assert.equal(
    loaded.worksheets[0].commentThreads[0].comments[0].mentions[0].person
      .displayName,
    "Bob"
  );
});
