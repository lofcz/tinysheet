import {
  makeContext,
  input,
  cell,
  value,
  pressDelete,
} from "../formula/helpers";
import {
  insertCheckboxes,
  removeCheckboxes,
  toggleCheckboxes,
  toggleCheckboxFormat,
  isCheckboxCell,
  checkboxRect,
  drawCheckbox,
  selectionHasCheckboxes,
} from "../../src/modules/checkbox";
import {
  drawCellContentDecorators,
  runCellPointerHandlers,
  runShortcut,
} from "../../src/modules/extensions";
import { handleClearFormat } from "../../src/modules/toolbar";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  makeHost,
  type,
  val,
  cellAt,
  expectUndoRedo,
} from "../editing/historyHarness";
import { dropCellCache, updateDropCell } from "../../src/modules/dropCell";
import { mockClipboard, copy, paste } from "../clipboard/helpers";

const range = (r1, c1, r2 = r1, c2 = c1) => [
  { row: [r1, r2], column: [c1, c2] },
];

function select(ctx, r1, c1, r2 = r1, c2 = c1) {
  ctx.luckysheet_select_save = [
    { row: [r1, r2], column: [c1, c2], row_focus: r1, column_focus: c1 },
  ];
}

// Excel: "Use checkboxes in cells" (Insert > Checkbox, Microsoft 365).
describe("checkbox format", () => {
  test("inserting turns empty cells into FALSE and keeps other values", () => {
    const ctx = makeContext();
    input(ctx, "A2", "TRUE");
    input(ctx, "A3", "hello");
    insertCheckboxes(ctx, range(0, 0, 2, 0));
    expect(value(ctx, "A1")).toBe(false);
    expect(cell(ctx, "A1").cb).toBe(1);
    expect(value(ctx, "A2")).toBe(true);
    expect(value(ctx, "A3")).toBe("hello");
    expect(isCheckboxCell(cell(ctx, "A1"))).toBe(true);
    expect(isCheckboxCell(cell(ctx, "A2"))).toBe(true);
    // non-boolean values render as text
    expect(isCheckboxCell(cell(ctx, "A3"))).toBe(false);
  });

  test("removing the format leaves TRUE/FALSE values", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0, 1, 0));
    toggleCheckboxes(ctx, range(0, 0));
    expect(removeCheckboxes(ctx, range(0, 0, 1, 0))).toBe(2);
    expect(cell(ctx, "A1").cb).toBeUndefined();
    expect(value(ctx, "A1")).toBe(true);
    expect(cell(ctx, "A1").m).toBe("TRUE");
    expect(value(ctx, "A2")).toBe(false);
  });

  test("the toolbar button inserts, then removes", () => {
    const ctx = makeContext();
    select(ctx, 0, 0, 1, 1);
    expect(toggleCheckboxFormat(ctx)).toBe("inserted");
    expect(
      selectionHasCheckboxes(
        ctx.luckysheetfile[0].data,
        ctx.luckysheet_select_save
      )
    ).toBe(true);
    expect(toggleCheckboxFormat(ctx)).toBe("removed");
    expect(cell(ctx, "B2").cb).toBeUndefined();
  });

  test("Clear Formats removes the checkbox, the value stays", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0));
    select(ctx, 0, 0);
    handleClearFormat(ctx);
    expect(cell(ctx, "A1").cb).toBeUndefined();
    expect(value(ctx, "A1")).toBe(false);
  });
});

describe("toggling", () => {
  test("one checkbox flips", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0));
    expect(toggleCheckboxes(ctx, range(0, 0))).toBe(1);
    expect(value(ctx, "A1")).toBe(true);
    expect(cell(ctx, "A1").m).toBe("TRUE");
    toggleCheckboxes(ctx, range(0, 0));
    expect(value(ctx, "A1")).toBe(false);
  });

  test("a mixed selection becomes checked, an all-checked one unchecked", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0, 2, 0));
    toggleCheckboxes(ctx, range(1, 0));
    toggleCheckboxes(ctx, range(0, 0, 2, 0));
    expect([value(ctx, "A1"), value(ctx, "A2"), value(ctx, "A3")]).toEqual([
      true,
      true,
      true,
    ]);
    toggleCheckboxes(ctx, range(0, 0, 2, 0));
    expect([value(ctx, "A1"), value(ctx, "A2"), value(ctx, "A3")]).toEqual([
      false,
      false,
      false,
    ]);
  });

  test("formula checkboxes are read-only, dependents recalculate", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0));
    input(ctx, "B1", "=A1");
    insertCheckboxes(ctx, range(0, 1));
    input(ctx, "C1", "=COUNTIF(A1:A1,TRUE)");
    expect(isCheckboxCell(cell(ctx, "B1"))).toBe(true);
    expect(toggleCheckboxes(ctx, range(0, 1))).toBe(-1);
    toggleCheckboxes(ctx, range(0, 0));
    groupValuesRefresh(ctx);
    expect(value(ctx, "B1")).toBe(true);
    expect(value(ctx, "C1")).toBe(1);
  });

  test("Space toggles the selected checkboxes, otherwise falls through", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0));
    select(ctx, 0, 0);
    const space = {
      key: " ",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(runShortcut(ctx, space, false)).toBe(true);
    expect(value(ctx, "A1")).toBe(true);
    select(ctx, 3, 3);
    expect(runShortcut(ctx, space, false)).toBe(false);
    // not while editing
    select(ctx, 0, 0);
    expect(runShortcut(ctx, space, true)).toBe(false);
  });

  test("clicking the box toggles, clicking the cell margin does not", () => {
    const ctx = makeContext();
    ctx.zoomRatio = 1;
    ctx.defaultFontSize = 10;
    insertCheckboxes(ctx, range(0, 0));
    const box = { x: 0, y: 0, w: 74, h: 20 };
    const rect = checkboxRect(cell(ctx, "A1"), box.x, box.y, box.w, box.h, 1);
    const click = (offsetX, offsetY) =>
      runCellPointerHandlers({
        ctx,
        r: 0,
        c: 0,
        cell: cell(ctx, "A1"),
        ...box,
        offsetX,
        offsetY,
        zoom: 1,
        event: {},
      });
    click(2, 2);
    expect(value(ctx, "A1")).toBe(false);
    click(rect.x + rect.size / 2, rect.y + rect.size / 2);
    expect(value(ctx, "A1")).toBe(true);
  });

  test("the box is centred, follows alignment and scales with font and zoom", () => {
    const a = checkboxRect({ cb: 1, v: true }, 0, 0, 100, 20, 1, 10);
    expect(a.x + a.size / 2).toBeCloseTo(50, 0);
    expect(a.y + a.size / 2).toBeCloseTo(10, 0);
    const left = checkboxRect({ cb: 1, v: true, ht: 1 }, 0, 0, 100, 20, 1, 10);
    expect(left.x).toBeLessThan(10);
    const right = checkboxRect({ cb: 1, v: true, ht: 2 }, 0, 0, 100, 20, 1, 10);
    expect(right.x + right.size).toBeGreaterThan(90);
    const big = checkboxRect({ cb: 1, v: true, fs: 20 }, 0, 0, 100, 60, 1, 10);
    expect(big.size).toBeGreaterThan(a.size * 1.8);
    const zoomed = checkboxRect({ cb: 1, v: true }, 0, 0, 200, 40, 2, 10);
    expect(zoomed.size).toBeCloseTo(a.size * 2, 5);
  });
});

describe("drawing", () => {
  const g = () => {
    const calls = [];
    const handler = {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return (...args) => calls.push([prop, ...args]);
      },
      set: (target, prop, v) => {
        calls.push([`set:${String(prop)}`, v]);
        return true;
      },
    };
    return { g: new Proxy({ calls }, handler), calls };
  };

  test("boolean checkbox cells draw a box instead of text", () => {
    const ctx = makeContext();
    const { g: renderCtx } = g();
    const args = (c) => ({
      ctx,
      renderCtx,
      r: 0,
      c: 0,
      cell: c,
      x: 0,
      y: 0,
      w: 74,
      h: 20,
      zoom: 1,
    });
    expect(
      drawCellContentDecorators(args({ cb: 1, v: true, ct: { t: "b" } }))
    ).toBe(true);
    expect(drawCellContentDecorators(args({ cb: 1, v: "text" }))).toBe(false);
    expect(drawCellContentDecorators(args({ v: true, ct: { t: "b" } }))).toBe(
      false
    );
  });

  test("dark theme: the unchecked box is filled with the dark cell colour", () => {
    const ctx = makeContext();
    ctx.theme = "dark";
    const { g: renderCtx, calls } = g();
    drawCheckbox(
      renderCtx,
      ctx,
      { cb: 1, v: false },
      { x: 0, y: 0, w: 74, h: 20 },
      1
    );
    expect(calls).toContainEqual(["set:fillStyle", "#1c1c1f"]);
    expect(calls).toContainEqual(["set:strokeStyle", "#e4e4e7"]);
  });
});

describe("Delete", () => {
  test("unchecks, then removes the checkboxes", () => {
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0, 1, 0));
    toggleCheckboxes(ctx, range(0, 0));
    pressDelete(ctx, "A1", "A2");
    expect(value(ctx, "A1")).toBe(false);
    expect(cell(ctx, "A1").cb).toBe(1);
    pressDelete(ctx, "A1", "A2");
    expect(cell(ctx, "A1").cb).toBeUndefined();
    expect(value(ctx, "A1")).toBeUndefined();
  });
});

describe("undo, copy/paste and fill", () => {
  test("insert and toggle are single undo steps", () => {
    const host = makeHost();
    host.select("A1", "A2");
    expectUndoRedo(host, (h) => h.act((d) => insertCheckboxes(d)));
    expect(val(host.ctx, "A1")).toBe(false);
    expectUndoRedo(host, (h) => h.act((d) => toggleCheckboxes(d)));
    expect(val(host.ctx, "A2")).toBe(true);
    host.undo();
    expect(val(host.ctx, "A2")).toBe(false);
    expect(cellAt(host.ctx, "A2").cb).toBe(1);
  });

  test("typing TRUE keeps the checkbox", () => {
    const host = makeHost();
    host.select("B2");
    host.act((d) => insertCheckboxes(d));
    type(host, "B2", "TRUE");
    expect(val(host.ctx, "B2")).toBe(true);
    expect(cellAt(host.ctx, "B2").cb).toBe(1);
  });

  test("copy/paste carries the format", () => {
    mockClipboard();
    const ctx = makeContext();
    insertCheckboxes(ctx, range(0, 0));
    toggleCheckboxes(ctx, range(0, 0));
    copy(ctx, "A1");
    paste(ctx, "C3");
    expect(cell(ctx, "C3").cb).toBe(1);
    expect(value(ctx, "C3")).toBe(true);
  });

  test("the fill handle carries the format", () => {
    const ctx = makeContext();
    ctx.luckysheetCellUpdate = [];
    insertCheckboxes(ctx, range(0, 0));
    dropCellCache.copyRange = { row: [0, 0], column: [0, 0] };
    dropCellCache.applyRange = { row: [1, 3], column: [0, 0] };
    dropCellCache.direction = "down";
    dropCellCache.applyType = "1";
    dropCellCache.ctrlKey = false;
    updateDropCell(ctx);
    expect(cell(ctx, "A4").cb).toBe(1);
    expect(value(ctx, "A4")).toBe(false);
  });
});
