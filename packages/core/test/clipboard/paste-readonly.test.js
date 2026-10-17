import { makeContext, input, value, values } from "../formula/helpers";
import { handlePasteByClick } from "../../src/events/paste";
import { clipboardState } from "../../src/modules/clipboard";
import { isAllowEdit } from "../../src/utils";
import { mockClipboard, select, activate } from "./helpers";

beforeEach(mockClipboard);

describe("read-only cells", () => {
  test("cellReadOnly blocks a selection that contains the cell", () => {
    const ctx = makeContext();
    ctx.config.cellReadOnly = { "1_1": 1 };
    expect(isAllowEdit(ctx, [{ row: [0, 2], column: [0, 2] }])).toBe(false);
    expect(isAllowEdit(ctx, [{ row: [0, 0], column: [0, 2] }])).toBe(true);
  });

  test("a pasted block never reaches a read-only cell beyond the selection", () => {
    const ctx = makeContext();
    clipboardState.token = "";
    activate(ctx, "id_1");
    input(ctx, "B2", "7");
    ctx.config.cellReadOnly = { "1_1": 1 };
    select(ctx, "A1");
    handlePasteByClick(ctx, "1\t2\n3\t4");
    expect(value(ctx, "B2")).toBe(7);
    expect(value(ctx, "A1")).toBeFalsy();
  });

  test("a pasted block never reaches a read-only column", () => {
    const ctx = makeContext();
    clipboardState.token = "";
    activate(ctx, "id_1");
    ctx.config.colReadOnly = { 1: 1 };
    select(ctx, "A1");
    handlePasteByClick(ctx, "1\t2");
    expect(value(ctx, "A1")).toBeFalsy();
    expect(value(ctx, "B1")).toBeFalsy();
    select(ctx, "C1");
    handlePasteByClick(ctx, "1\t2");
    expect(values(ctx, "C1", "D1")).toEqual([[1, 2]]);
  });
});
