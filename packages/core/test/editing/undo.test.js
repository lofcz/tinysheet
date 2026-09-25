/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect", "expectUndoRedo"] }] */
import {
  makeHost,
  type,
  val,
  cellAt,
  sheetOf,
  expectUndoRedo,
  snapshot,
} from "./historyHarness";
import {
  withUndoGroup,
  beginUndoGroup,
  currentUndoGroup,
} from "../../src/modules/history";
import { handleGlobalEnter } from "../../src/events/keyboard";
import { handlePaste } from "../../src/events/paste";
import { selectionCache } from "../../src/modules/selection";
import { fillSelectionFromEdge } from "../../src/modules/dropCell";
import {
  insertRowCol,
  deleteRowCol,
  hideSelected,
  showSelected,
} from "../../src/modules/rowcol";
import { sortSelection } from "../../src/modules/sort";
import { createFilter, saveFilter } from "../../src/modules/filter";
import {
  handleMerge,
  handleBold,
  handleFreeze,
  updateFormat,
  handleTextBackground,
} from "../../src/modules/toolbar";
import { setConditionRules } from "../../src/modules/ConditionFormat";
import { addSheet, deleteSheet } from "../../src/modules/sheet";
import { replaceAll } from "../../src/modules/searchReplace";
import { getFlowdata } from "../../src/context";

function seedNumbers(host) {
  type(host, "A1", "3");
  type(host, "A2", "1");
  type(host, "A3", "2");
  host.cache.undoList = [];
}

const noInput = () => document.createElement("div");

describe("undo/redo matrix", () => {
  test("typing a value", () => {
    const host = makeHost();
    expectUndoRedo(host, (h) => type(h, "B2", "hello"));
    expect(val(host.ctx, "B2")).toBe("hello");
  });

  test("overwriting and clearing a value", () => {
    const host = makeHost();
    type(host, "A1", "1");
    expectUndoRedo(host, (h) => type(h, "A1", "2"));
    expectUndoRedo(host, (h) => type(h, "A1", ""));
  });

  test("formulas recalculate after undo and redo", () => {
    const host = makeHost();
    type(host, "A1", "1");
    type(host, "B1", "=A1*10");
    expect(val(host.ctx, "B1")).toBe(10);
    expectUndoRedo(host, (h) => type(h, "A1", "5"));
    expect(val(host.ctx, "B1")).toBe(50);
    host.undo();
    expect(val(host.ctx, "B1")).toBe(10);
    // the dependency graph still links B1 to A1 after undo
    type(host, "A1", "7");
    expect(val(host.ctx, "B1")).toBe(70);
  });

  test("changing a formula, undo restores the old dependencies", () => {
    const host = makeHost();
    type(host, "A1", "1");
    type(host, "A2", "100");
    type(host, "B1", "=A1+1");
    expectUndoRedo(host, (h) => type(h, "B1", "=A2+1"));
    expect(val(host.ctx, "B1")).toBe(101);
    host.undo();
    expect(val(host.ctx, "B1")).toBe(2);
    type(host, "A2", "5");
    expect(val(host.ctx, "B1")).toBe(2);
    type(host, "A1", "9");
    expect(val(host.ctx, "B1")).toBe(10);
  });

  test("spill: entering, undoing and redoing a spilling formula", () => {
    const host = makeHost();
    seedNumbers(host);
    expectUndoRedo(host, (h) => type(h, "C1", "=A1:A3"));
    expect(val(host.ctx, "C3")).toBe(2);
    host.undo();
    expect(cellAt(host.ctx, "C2")).toBeNull();
    // after undo the cell under the old spill is free
    type(host, "C2", "x");
    expect(val(host.ctx, "C2")).toBe("x");
    host.undo();
    host.redo();
    expect(val(host.ctx, "C2")).toBe("x");
    // redo of the spill formula is gone (a new edit cleared the redo list)
    expect(host.cache.redoList).toHaveLength(0);
  });

  test("spill: sources changed after undo still flow into the spill", () => {
    const host = makeHost();
    seedNumbers(host);
    type(host, "C1", "=A1:A3");
    type(host, "A2", "10");
    expect(val(host.ctx, "C2")).toBe(10);
    host.undo();
    expect(val(host.ctx, "C2")).toBe(1);
    type(host, "A3", "30");
    expect(val(host.ctx, "C3")).toBe(30);
  });

  test("Ctrl+Enter fills the selection as one step", () => {
    const host = makeHost();
    host.select("A1", "B3");
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        d.luckysheetCellUpdate = [0, 0];
        const input = document.createElement("div");
        input.innerText = "x";
        handleGlobalEnter(
          d,
          input,
          new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true })
        );
      })
    );
    expect(val(host.ctx, "B3")).toBe("x");
  });

  test("Ctrl+D and Ctrl+R", () => {
    const host = makeHost();
    type(host, "A1", "5");
    type(host, "B1", "=A1*2");
    host.select("A1", "B4");
    expectUndoRedo(host, (h) => h.act((d) => fillSelectionFromEdge(d, "down")));
    expect(cellAt(host.ctx, "B4").f).toBe("=A4*2");
    host.select("A1", "D1");
    expectUndoRedo(host, (h) =>
      h.act((d) => fillSelectionFromEdge(d, "right"))
    );
  });

  test("paste (plain text into many cells)", () => {
    const host = makeHost();
    host.select("A1");
    const e = new Event("paste");
    e.clipboardData = {
      getData: (t) => (t === "text/plain" ? "1\t2\n3\t4" : ""),
      files: [],
    };
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        d.luckysheet_copy_save = { copyRange: [] };
        selectionCache.isPasteAction = true;
        handlePaste(d, e);
      })
    );
    expect(val(host.ctx, "B2")).toBe(4);
  });

  test("insert and delete rows/columns keep formulas in sync", () => {
    const host = makeHost();
    type(host, "A1", "1");
    type(host, "A2", "=A1+1");
    const op = {
      type: "row",
      index: 0,
      count: 2,
      direction: "rightbottom",
      id: "id_1",
    };
    expectUndoRedo(host, (h) =>
      h.act((d) => insertRowCol(d, op), { insertRowColOp: op })
    );
    expect(cellAt(host.ctx, "A4").f).toBe("=A1+1");
    host.undo();
    expect(cellAt(host.ctx, "A2").f).toBe("=A1+1");
    type(host, "A1", "10");
    expect(val(host.ctx, "A2")).toBe(11);

    const del = { type: "column", start: 1, end: 1, id: "id_1" };
    type(host, "C1", "=A1*3");
    expectUndoRedo(host, (h) =>
      h.act((d) => deleteRowCol(d, del), { deleteRowColOp: del })
    );
    expect(cellAt(host.ctx, "B1").f).toBe("=A1*3");
    host.undo();
    expect(cellAt(host.ctx, "C1").f).toBe("=A1*3");
    type(host, "A1", "2");
    expect(val(host.ctx, "C1")).toBe(6);
  });

  test("sort", () => {
    const host = makeHost();
    seedNumbers(host);
    host.select("A1", "A3");
    expectUndoRedo(host, (h) => h.act((d) => sortSelection(d, true)));
    expect([val(host.ctx, "A1"), val(host.ctx, "A3")]).toEqual([1, 3]);
  });

  test("filter: create and filter rows", () => {
    const host = makeHost();
    type(host, "A1", "head");
    type(host, "A2", "1");
    type(host, "A3", "2");
    host.select("A1", "A3");
    expectUndoRedo(host, (h) => h.act((d) => createFilter(d)));
    expect(host.ctx.luckysheet_filter_save).toBeTruthy();
    expectUndoRedo(host, (h) =>
      h.act((d) => saveFilter(d, true, { 2: 0 }, {}, 1, 2, 0, 0, 0))
    );
    expect(host.ctx.config.rowhidden).toEqual({ 2: 0 });
    host.undo();
    // the context mirror of the sheet config follows the undo
    expect(host.ctx.config.rowhidden ?? {}).toEqual({});
    host.undo();
    expect(host.ctx.luckysheet_filter_save).toBeUndefined();
  });

  test("merge and unmerge", () => {
    const host = makeHost();
    type(host, "A1", "m");
    host.select("A1", "B2");
    expectUndoRedo(host, (h) => h.act((d) => handleMerge(d, "merge-all")));
    expect(host.ctx.config.merge?.["0_0"]).toBeTruthy();
    host.undo();
    expect(host.ctx.config.merge?.["0_0"]).toBeUndefined();
    host.redo();
    expectUndoRedo(host, (h) => h.act((d) => handleMerge(d, "merge-cancel")));
  });

  test("config changes are recorded whatever the context key order", () => {
    const host = makeHost();
    // config before luckysheetfile: immer finalizes the shared draft under
    // ctx.config first
    const { config, ...rest } = host.ctx;
    host.ctx = { config, ...rest };
    type(host, "A1", "m");
    host.select("A1", "B2");
    expectUndoRedo(host, (h) => h.act((d) => handleMerge(d, "merge-all")));
    host.select("C1", "C2");
    expectUndoRedo(host, (h) => h.act((d) => hideSelected(d, "row")));
  });

  test("formats: bold, number format, background", () => {
    const host = makeHost();
    type(host, "A1", "12.5");
    host.select("A1", "B2");
    expectUndoRedo(host, (h) => h.act((d) => handleBold(d, noInput())));
    expect(cellAt(host.ctx, "A1").bl).toBe(1);
    expectUndoRedo(host, (h) =>
      h.act((d) => updateFormat(d, noInput(), getFlowdata(d), "ct", "0.00%"))
    );
    expectUndoRedo(host, (h) =>
      h.act((d) => handleTextBackground(d, noInput(), "#ff0000"))
    );
  });

  test("conditional formatting rules", () => {
    const host = makeHost();
    seedNumbers(host);
    host.select("A1", "A3");
    expectUndoRedo(host, (h) =>
      h.act((d) =>
        setConditionRules(
          d,
          { protection: "" },
          { generalDialog: "" },
          { conditionformat: "" },
          {
            rulesType: "greaterThan",
            rulesValue: "1",
            textColor: { check: true, color: "#ff0000" },
            cellColor: { check: false, color: "#000000" },
          }
        )
      )
    );
    expect(sheetOf(host.ctx).luckysheet_conditionformat_save).toHaveLength(1);
  });

  test("data validation", () => {
    const host = makeHost();
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        const sheet = d.luckysheetfile[0];
        sheet.dataVerification = {
          ...(sheet.dataVerification || {}),
          "0_0": { type: "dropdown", value1: "a,b", checked: false },
        };
      })
    );
  });

  test("hide and unhide rows and columns", () => {
    const host = makeHost();
    host.select("A2", "A3");
    expectUndoRedo(host, (h) => h.act((d) => hideSelected(d, "row")));
    expect(Object.keys(host.ctx.config.rowhidden)).toEqual(["1", "2"]);
    host.undo();
    expect(host.ctx.config.rowhidden ?? {}).toEqual({});
    host.redo();
    host.select("A1", "A4");
    expectUndoRedo(host, (h) => h.act((d) => showSelected(d, "row")));
    host.select("B1", "C1");
    expectUndoRedo(host, (h) => h.act((d) => hideSelected(d, "column")));
  });

  test("freeze panes", () => {
    const host = makeHost();
    host.select("B2");
    expectUndoRedo(host, (h) => h.act((d) => handleFreeze(d, "freeze-row")));
    expect(sheetOf(host.ctx).frozen?.type).toBe("rangeRow");
    expectUndoRedo(host, (h) => h.act((d) => handleFreeze(d, "freeze-cancel")));
  });

  test("add, rename and delete sheets", () => {
    const host = makeHost();
    const before = snapshot(host.ctx);
    host.act(
      (d) =>
        addSheet(d, { generateSheetId: () => "id_3" }, undefined, false, "New"),
      { addSheetOp: true }
    );
    expect(host.ctx.luckysheetfile).toHaveLength(3);
    expect(host.ctx.currentSheetId).toBe("id_3");
    host.undo();
    expect(snapshot(host.ctx)).toEqual(before);
    // the current sheet falls back to an existing one
    expect(host.ctx.currentSheetId).toBe("id_1");
    host.redo();
    expect(host.ctx.luckysheetfile).toHaveLength(3);

    expectUndoRedo(host, (h) =>
      h.act((d) => {
        d.luckysheetfile[1].name = "Renamed";
      })
    );

    type(host, "A1", "keep", "id_2");
    const beforeDelete = snapshot(host.ctx);
    host.act((d) => deleteSheet(d, "id_2"), { deleteSheetOp: { id: "id_2" } });
    expect(host.ctx.luckysheetfile.map((s) => s.id)).toEqual(["id_1", "id_3"]);
    host.undo();
    expect(host.ctx.luckysheetfile.map((s) => s.id).sort()).toEqual([
      "id_1",
      "id_2",
      "id_3",
    ]);
    expect(sheetOf(host.ctx, "id_2").order).toBe(1);
    expect(sheetOf(host.ctx, "id_3").order).toBe(2);
    // the deleted sheet comes back as celldata (the Workbook expands it)
    expect(sheetOf(host.ctx, "id_2").celldata).toEqual([
      expect.objectContaining({ r: 0, c: 0 }),
    ]);
    expect(beforeDelete.sheets.length).toBe(3);
    // undo/redo cycles do not accumulate patches
    host.redo();
    host.undo();
    expect(sheetOf(host.ctx, "id_3").order).toBe(2);
  });

  test("Replace All is one step", () => {
    const host = makeHost();
    type(host, "A1", "cat");
    type(host, "A2", "cat");
    type(host, "B3", "a cat");
    expectUndoRedo(host, (h) =>
      h.act((d) =>
        replaceAll(d, "cat", "dog", {
          regCheck: false,
          wordCheck: false,
          caseCheck: false,
        })
      )
    );
    expect(val(host.ctx, "B3")).toBe("a dog");
  });

  test("view-only changes are not undo steps", () => {
    const host = makeHost();
    host.act((d) => {
      d.luckysheet_select_save = [{ row: [3, 3], column: [3, 3] }];
      d.scrollTop = 100;
    });
    expect(host.cache.undoList).toHaveLength(0);
  });
});

describe("undo groups", () => {
  test("steps recorded inside withUndoGroup undo and redo together", () => {
    const host = makeHost();
    type(host, "A1", "0");
    withUndoGroup(host.cache, () => {
      type(host, "A1", "1");
      type(host, "A2", "2");
      withUndoGroup(host.ctx, () => type(host, "A3", "3"));
    });
    type(host, "A4", "4");
    expect(host.cache.undoList).toHaveLength(5);
    host.undo();
    expect(val(host.ctx, "A4")).toBeUndefined();
    expect(val(host.ctx, "A3")).toBe(3);
    host.undo();
    expect([
      val(host.ctx, "A1"),
      val(host.ctx, "A2"),
      val(host.ctx, "A3"),
    ]).toEqual([0, undefined, undefined]);
    host.redo();
    expect([
      val(host.ctx, "A1"),
      val(host.ctx, "A2"),
      val(host.ctx, "A3"),
    ]).toEqual([1, 2, 3]);
    expect(val(host.ctx, "A4")).toBeUndefined();
    host.redo();
    expect(val(host.ctx, "A4")).toBe(4);
  });

  test("beginUndoGroup / end, and the group id is visible while open", () => {
    const host = makeHost();
    expect(currentUndoGroup(host.cache)).toBeUndefined();
    const end = beginUndoGroup(host.ctx);
    const id = currentUndoGroup(host.cache);
    expect(id).toBeDefined();
    type(host, "A1", "1");
    type(host, "A2", "2");
    end();
    end(); // idempotent
    expect(currentUndoGroup(host.cache)).toBeUndefined();
    type(host, "A3", "3");
    host.undo();
    host.undo();
    expect(val(host.ctx, "A1")).toBeUndefined();
    expect(host.cache.undoList).toHaveLength(0);
  });

  test("a throwing group still closes", () => {
    const host = makeHost();
    expect(() =>
      withUndoGroup(host.cache, () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(host.cache.undoGroup).toBeUndefined();
  });
});
