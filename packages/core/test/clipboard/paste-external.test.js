import { makeContext, input, cell, value, values } from "../formula/helpers";
import { handlePasteByClick, handlePaste } from "../../src/events/paste";
import { selectionCache } from "../../src/modules/selection";
import { groupValuesRefresh } from "../../src/modules/formula";
import { clipboardState } from "../../src/modules/clipboard";
import {
  mockClipboard,
  copy,
  paste,
  select,
  activate,
  written,
} from "./helpers";

beforeEach(mockClipboard);

const EXCEL = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
<meta name=ProgId content=Excel.Sheet><style><!--
td {font-size:11.0pt; font-family:Calibri; mso-number-format:General; vertical-align:bottom;}
.xl65 {mso-number-format:"0\\.00"; font-weight:700; border-bottom:1.0pt solid windowtext;}
.xl66 {text-align:center;}
--></style></head><body><table>
<tr><td class=xl65 align=right>3.50</td><td>text</td></tr>
<tr><td colspan=2 class=xl66>merged</td></tr>
</table></body></html>`;

describe("pasting Excel HTML", () => {
  test("values, formats, merges and borders land at the selection", () => {
    const ctx = makeContext();
    input(ctx, "B2", "=1+1");
    paste(ctx, "B2", "id_1", { html: EXCEL, text: "3.50\ttext\nmerged" });
    expect(cell(ctx, "B2")).toMatchObject({
      v: 3.5,
      m: "3.50",
      bl: 1,
      ct: { fa: "0.00" },
    });
    expect(cell(ctx, "B2").f).toBeUndefined();
    expect(value(ctx, "C2")).toBe("text");
    expect(cell(ctx, "B3")).toMatchObject({
      v: "merged",
      ht: 0,
      mc: { r: 2, c: 1, rs: 1, cs: 2 },
    });
    expect(cell(ctx, "C3")).toEqual({ mc: { r: 2, c: 1 } });
    expect(ctx.config.merge["2_1"]).toEqual({ r: 2, c: 1, rs: 1, cs: 2 });
    const border = ctx.config.borderInfo.find(
      (b) => b.value.row_index === 1 && b.value.col_index === 1
    );
    expect(border.value.b).toEqual({ style: 8, color: "#000000" });
    expect(ctx.luckysheet_select_save[0]).toMatchObject({
      row: [1, 2],
      column: [1, 2],
    });
  });

  test("dependents of the pasted cells are recalculated", () => {
    const ctx = makeContext();
    input(ctx, "E1", "=B2*2");
    paste(ctx, "B2", "id_1", { html: EXCEL, text: "" });
    expect(value(ctx, "E1")).toBe(7);
  });

  test("the grid grows when the paste does not fit", () => {
    const ctx = makeContext({ rows: 3, cols: 3 });
    paste(ctx, "C3", "id_1", { html: EXCEL, text: "" });
    expect(value(ctx, "C3")).toBe(3.5);
    expect(value(ctx, "D3")).toBe("text");
  });
});

describe("pasting plain text (TSV)", () => {
  test("fields are typed like keyboard input", () => {
    const ctx = makeContext();
    paste(ctx, "A1", "id_1", {
      html: "",
      text: "1\t2.5%\tTRUE\r\n$1,234\t1/15/2024\thello",
    });
    expect(values(ctx, "A1", "C1")).toEqual([[1, 0.025, true]]);
    expect(cell(ctx, "B1").ct.fa).toContain("%");
    expect(value(ctx, "A2")).toBe(1234);
    expect(value(ctx, "B2")).toBe(45306);
    expect(cell(ctx, "B2").ct.t).toBe("d");
    expect(value(ctx, "C2")).toBe("hello");
  });

  test("a leading = makes a formula", () => {
    const ctx = makeContext();
    input(ctx, "A1", "20");
    paste(ctx, "B1", "id_1", { html: "", text: "=A1*2\t=SUM(A1:B1)" });
    expect(cell(ctx, "B1").f).toBe("=A1*2");
    expect(value(ctx, "B1")).toBe(40);
    expect(value(ctx, "C1")).toBe(60);
  });

  test("quoted multi-line cells stay in one cell and wrap", () => {
    const ctx = makeContext();
    paste(ctx, "A1", "id_1", { html: "", text: '"line 1\nline 2"\tx\r\n' });
    expect(cell(ctx, "A1")).toMatchObject({ v: "line 1\nline 2", tb: "2" });
    expect(value(ctx, "B1")).toBe("x");
    expect(cell(ctx, "A2")).toBeNull();
  });

  test("the target keeps its formatting; Text cells keep text", () => {
    const ctx = makeContext();
    input(ctx, "A1", "0");
    input(ctx, "B1", "0");
    const d = ctx.luckysheetfile[0].data;
    d[0][0].bl = 1;
    d[0][0].ct = { fa: "0.00", t: "n" };
    d[0][1].ct = { fa: "@", t: "s" };
    paste(ctx, "A1", "id_1", { html: "", text: "3\t00123" });
    expect(cell(ctx, "A1")).toMatchObject({ v: 3, m: "3.00", bl: 1 });
    expect(cell(ctx, "B1")).toMatchObject({ v: "00123", ct: { fa: "@" } });
  });

  test("an empty field clears the target value", () => {
    const ctx = makeContext();
    input(ctx, "B1", "old");
    paste(ctx, "A1", "id_1", { html: "", text: "a\t\tc" });
    expect(value(ctx, "B1")).toBeUndefined();
    expect(value(ctx, "C1")).toBe("c");
  });
});

describe("recognising our own copy", () => {
  test("HTML from another workbook (other token) pastes values", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "B1", "=A1+1");
    copy(ctx, "A1", "B1");
    const foreign = {
      html: written.html.replace(
        /data-fortune-copy="[^"]+"/,
        'data-fortune-copy="other"'
      ),
      text: written.text,
    };
    paste(ctx, "A3", "id_1", foreign);
    expect(cell(ctx, "B3").f).toBeUndefined();
    expect(value(ctx, "B3")).toBe(2);
  });

  test("context-menu paste (plain text only) still pastes formulas", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "B1", "=A1+1");
    copy(ctx, "A1", "B1");
    activate(ctx, "id_1");
    select(ctx, "A4");
    handlePasteByClick(ctx, written.text);
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B4").f).toBe("=A4+1");
    expect(value(ctx, "B4")).toBe(2);
  });

  test("context-menu paste of other text types it in", () => {
    const ctx = makeContext();
    clipboardState.token = "";
    activate(ctx, "id_1");
    select(ctx, "A1");
    handlePasteByClick(ctx, "5\t6");
    expect(values(ctx, "A1", "B1")).toEqual([[5, 6]]);
  });

  test("the paste event reads text/html first", () => {
    const ctx = makeContext();
    input(ctx, "A1", "9");
    copy(ctx, "A1");
    select(ctx, "C1");
    selectionCache.isPasteAction = true;
    const e = new Event("paste");
    e.clipboardData = {
      getData: (type) => (type === "text/html" ? written.html : written.text),
      files: [],
    };
    handlePaste(ctx, e);
    groupValuesRefresh(ctx);
    expect(value(ctx, "C1")).toBe(9);
  });

  test("beforePaste can cancel", () => {
    const ctx = makeContext();
    ctx.hooks = { beforePaste: () => false };
    select(ctx, "A1");
    selectionCache.isPasteAction = true;
    const e = new Event("paste");
    e.clipboardData = { getData: () => "x", files: [] };
    handlePaste(ctx, e);
    expect(cell(ctx, "A1")).toBeNull();
  });
});
