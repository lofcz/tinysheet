import assert from "node:assert/strict";
import test from "node:test";
import { exportToXlsx } from "../dist/index.js";
import { importXlsx, readWithExcelJS, zipText } from "./helpers.mjs";

for (const [label, frozen, rows, columns] of [
  ["unfrozen", undefined, 0, 0],
  ["one header row", { type: "row" }, 1, 0],
  [
    "explicit large freeze",
    { type: "rangeBoth", range: { row_focus: 6, column_focus: 2 } },
    7,
    3,
  ],
]) {
  test(`${label} exports the same panes and survives preserved round trips`, async () => {
    const sheets = [
      {
        id: "report",
        name: "Report",
        order: 0,
        status: 1,
        celldata: [{ r: 0, c: 0, v: { v: "Name" } }],
        frozen,
      },
    ];
    const bytes = await exportToXlsx(sheets);
    const imported = await importXlsx(bytes);
    const preserved = await exportToXlsx(imported.sheets, {
      preservation: imported.preservation,
    });
    for (const output of [bytes, preserved]) {
      const view = (await readWithExcelJS(output)).worksheets[0].views[0];
      assert.equal(view.state, rows || columns ? "frozen" : "normal");
      assert.equal(view.ySplit ?? 0, rows);
      assert.equal(view.xSplit ?? 0, columns);
      const xml = await zipText(output, "xl/worksheets/sheet1.xml");
      if (!rows && !columns) assert.doesNotMatch(xml, /<pane\b/);
    }
    // Unfreezing an imported workbook must also remove the original package's pane.
    delete imported.sheets[0].frozen;
    const unfrozen = await exportToXlsx(imported.sheets, {
      preservation: imported.preservation,
    });
    assert.doesNotMatch(
      await zipText(unfrozen, "xl/worksheets/sheet1.xml"),
      /<pane\b/
    );
    assert.equal((await importXlsx(unfrozen)).sheets[0].frozen, undefined);
  });
}
