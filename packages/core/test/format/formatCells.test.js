import { contextFactory } from "../factories/context";
import { getFlowdata } from "../../src/context";
import {
  applyCellStyle,
  applyFormatCells,
  cellRotation,
  closeFormatCells,
  getCellStyles,
  getFormatCellsState,
  openFormatCells,
} from "../../src/modules/formatCells";
import { getBorderInfoComputeRange } from "../../src/modules/border";
import {
  handleFormatPainter,
  handleNumberDecrease,
  handleNumberIncrease,
  startFormatPainter,
} from "../../src/modules/toolbar";
import { pasteHandlerOfPaintModel } from "../../src/modules/selection";

const grid = () => [
  [
    { v: 1234.5, m: "1234.5", ct: { fa: "General", t: "n" } },
    { v: "text", m: "text", ct: { fa: "General", t: "g" } },
    null,
  ],
  [null, null, null],
  [null, null, null],
];

const makeCtx = (select = { row: [0, 1], column: [0, 1] }, data = grid()) =>
  contextFactory({
    luckysheet_select_save: [{ ...select, row_focus: 0, column_focus: 0 }],
    config: {},
    defaultFontSize: 10,
    luckysheetfile: [{ id: "id_1", name: "Sheet1", data, config: {} }],
  });

describe("open / close", () => {
  test("openFormatCells sets the dialog tab, close clears it", () => {
    const ctx = makeCtx();
    openFormatCells(ctx);
    expect(ctx.formatCellsDialog).toEqual({ tab: "number" });
    openFormatCells(ctx, "border");
    expect(ctx.formatCellsDialog).toEqual({ tab: "border" });
    closeFormatCells(ctx);
    expect(ctx.formatCellsDialog).toBeUndefined();
  });
});

describe("getFormatCellsState", () => {
  test("reads the active cell", () => {
    const data = grid();
    data[0][0] = {
      ...data[0][0],
      ct: { fa: "0.00%", t: "n" },
      bl: 1,
      fc: "#ff0000",
      bg: "#00ff00",
      ht: 2,
      tb: "2",
      rt: 135,
      lo: 0,
      hi: 1,
    };
    const ctx = makeCtx(undefined, data);
    ctx.config.borderInfo = [
      {
        rangeType: "range",
        borderType: "border-bottom",
        color: "#123456",
        style: "8",
        range: [{ row: [0, 0], column: [0, 0] }],
      },
    ];
    const s = getFormatCellsState(ctx);
    expect(s).toMatchObject({
      value: 1234.5,
      fa: "0.00%",
      ht: "2",
      wrap: true,
      rotation: -45,
      bl: true,
      it: false,
      fc: "#ff0000",
      bg: "#00ff00",
      locked: false,
      hidden: true,
      multiRow: true,
      multiCol: true,
    });
    expect(s.borders.bottom).toEqual({ style: "8", color: "#123456" });
    expect(s.borders.top).toBeNull();
    expect(s.usedFormats).toContain("0.00%");
  });

  test("defaults for an empty cell", () => {
    const ctx = makeCtx({ row: [2, 2], column: [2, 2] });
    ctx.luckysheet_select_save[0].row_focus = 2;
    ctx.luckysheet_select_save[0].column_focus = 2;
    expect(getFormatCellsState(ctx)).toMatchObject({
      fa: "General",
      ht: "general",
      rotation: 0,
      locked: true,
      hidden: false,
      fs: 10,
    });
  });
});

describe("applyFormatCells", () => {
  test("number format for the whole selection, text stays text", () => {
    const ctx = makeCtx();
    applyFormatCells(ctx, { fa: '"$"#,##0.00' });
    const d = getFlowdata(ctx);
    expect(d[0][0]).toMatchObject({
      m: "$1,234.50",
      ct: { fa: '"$"#,##0.00', t: "n" },
    });
    expect(d[0][1].ct).toEqual({ fa: '"$"#,##0.00', t: "g" });
    expect(d[1][0].ct.fa).toBe('"$"#,##0.00');
  });

  test("alignment, font, fill and protection", () => {
    const ctx = makeCtx();
    applyFormatCells(ctx, {
      ht: "0",
      vt: "1",
      wrap: true,
      shrink: true,
      indent: 2,
      rotation: 30,
      ff: "Arial",
      fs: 14,
      bl: true,
      it: true,
      un: 1,
      cl: true,
      fc: "#112233",
      bg: "#ffeeaa",
      locked: false,
      hidden: true,
    });
    const cell = getFlowdata(ctx)[1][1];
    expect(cell).toMatchObject({
      ht: "0",
      vt: "1",
      tb: "2",
      sk: 1,
      ind: 2,
      rt: 30,
      ff: "Arial",
      fs: 14,
      bl: 1,
      it: 1,
      un: 1,
      cl: 1,
      fc: "#112233",
      bg: "#ffeeaa",
      lo: 0,
      hi: 1,
    });
    applyFormatCells(ctx, {
      ht: "general",
      wrap: false,
      shrink: false,
      indent: 0,
      rotation: -90,
      fc: null,
      bg: null,
    });
    const after = getFlowdata(ctx)[1][1];
    expect(after.ht).toBeUndefined();
    expect(after.tb).toBeUndefined();
    expect(after.sk).toBeUndefined();
    expect(after.ind).toBeUndefined();
    expect(after.rt).toBeUndefined();
    expect(after.tr).toBe("5");
    expect(after.fc).toBeUndefined();
    expect(after.bg).toBeUndefined();
    expect(cellRotation(after)).toBe(-90);
  });

  test("rotation round-trips through rt/tr", () => {
    [-90, -45, -30, 0, 15, 45, 90, "vertical"].forEach((deg) => {
      const ctx = makeCtx();
      applyFormatCells(ctx, { rotation: deg });
      expect(cellRotation(getFlowdata(ctx)[0][0])).toBe(deg);
    });
  });

  test("borders: outline, inside, removing one edge", () => {
    const ctx = makeCtx();
    const thin = { style: "1", color: "#000000" };
    applyFormatCells(ctx, {
      borders: {
        top: thin,
        bottom: thin,
        left: thin,
        right: thin,
        insideH: thin,
        insideV: thin,
      },
    });
    let b = getBorderInfoComputeRange(ctx, 0, 1, 0, 1);
    expect(b["0_0"]).toMatchObject({ t: thin, l: thin, r: thin, b: thin });
    expect(b["1_1"]).toMatchObject({ b: thin, r: thin });

    applyFormatCells(ctx, { borders: { top: null } });
    b = getBorderInfoComputeRange(ctx, 0, 1, 0, 1);
    expect(b["0_0"].t).toBeFalsy();
    expect(b["0_1"].t).toBeFalsy();
    expect(b["0_0"].l).toEqual(thin);
    expect(b["1_0"].b).toEqual(thin);

    applyFormatCells(ctx, { borders: { none: true } });
    b = getBorderInfoComputeRange(ctx, 0, 1, 0, 1);
    expect(b["0_0"]).toBeUndefined();
    expect(ctx.luckysheetfile[0].config).toBe(ctx.config);
  });

  test("merge and unmerge", () => {
    const ctx = makeCtx({ row: [1, 2], column: [1, 2] });
    applyFormatCells(ctx, { merge: true });
    expect(ctx.luckysheetfile[0].config.merge["1_1"]).toMatchObject({
      rs: 2,
      cs: 2,
    });
    applyFormatCells(ctx, { merge: false });
    expect(ctx.luckysheetfile[0].config.merge["1_1"]).toBeUndefined();
  });

  test("a larger font grows the rows, with borders applied too", () => {
    const ctx = makeCtx({ row: [0, 0], column: [0, 0] });
    ctx.luckysheetfile[0].defaultRowHeight = 19;
    // text metrics proportional to the font size
    const canvas = {
      font: "",
      textAlign: "",
      textBaseline: "",
      measureText(t) {
        const pt = parseFloat(/(\d+)pt/.exec(this.font)?.[1] ?? "10");
        return {
          width: t.length * pt,
          actualBoundingBoxAscent: pt,
          actualBoundingBoxDescent: pt / 4,
        };
      },
    };
    applyFormatCells(
      ctx,
      { fs: 40, borders: { bottom: { style: "13", color: "#000" } } },
      canvas
    );
    const cfg = ctx.luckysheetfile[0].config;
    expect(cfg.rowlen?.[0]).toBeGreaterThan(19);
    expect(ctx.config).toBe(cfg);
    expect(cfg.borderInfo).toHaveLength(1);
  });

  test("read-only selections are not changed", () => {
    const ctx = makeCtx();
    ctx.config.rowReadOnly = { 0: 1 };
    applyFormatCells(ctx, { bl: true });
    expect(getFlowdata(ctx)[0][0].bl).toBeUndefined();
  });
});

// Excel: Home > Cell Styles.
describe("cell styles", () => {
  test("the gallery lists Excel's built-in styles", () => {
    const ids = getCellStyles().map((s) => s.id);
    [
      "normal",
      "good",
      "bad",
      "neutral",
      "heading1",
      "heading2",
      "heading3",
      "heading4",
      "title",
      "total",
      "input",
      "output",
      "calculation",
      "checkCell",
      "note",
      "currency",
      "percent",
      "comma",
    ].forEach((id) => expect(ids).toContain(id));
  });

  test("Good: green text on green fill, resets bold", () => {
    const ctx = makeCtx();
    getFlowdata(ctx)[0][0].bl = 1;
    applyCellStyle(ctx, "good");
    expect(getFlowdata(ctx)[0][0]).toMatchObject({
      fc: "#006100",
      bg: "#C6EFCE",
      bl: 0,
    });
  });

  test("Input: fill, font and a thin grey box", () => {
    const ctx = makeCtx();
    applyCellStyle(ctx, "input");
    const b = getBorderInfoComputeRange(ctx, 0, 1, 0, 1);
    expect(b["0_0"].l).toEqual({ style: "1", color: "#7F7F7F" });
    expect(getFlowdata(ctx)[0][0]).toMatchObject({
      bg: "#FFCC99",
      fc: "#3F3F76",
    });
  });

  test("Heading 1: bold 15pt with a thick bottom border", () => {
    const ctx = makeCtx({ row: [0, 0], column: [0, 0] });
    applyCellStyle(ctx, "heading1");
    expect(getFlowdata(ctx)[0][0]).toMatchObject({ bl: 1, fs: 15 });
    const b = getBorderInfoComputeRange(ctx, 0, 0, 0, 0);
    expect(b["0_0"].b).toEqual({ style: "13", color: "#4472C4" });
  });

  test("Currency and Percent set only the number format", () => {
    const ctx = makeCtx({ row: [0, 0], column: [0, 0] });
    getFlowdata(ctx)[0][0].bl = 1;
    applyCellStyle(ctx, "currency", "$");
    expect(getFlowdata(ctx)[0][0]).toMatchObject({
      m: " $1,234.50 ",
      bl: 1,
    });
    applyCellStyle(ctx, "percent");
    expect(getFlowdata(ctx)[0][0].m).toBe("123450%");
  });

  test("Normal removes formatting and borders", () => {
    const ctx = makeCtx();
    applyCellStyle(ctx, "checkCell");
    applyCellStyle(ctx, "normal");
    const cell = getFlowdata(ctx)[0][0];
    expect(cell).toMatchObject({ v: 1234.5, m: "1234.5" });
    expect(cell.bg).toBeUndefined();
    expect(cell.fc).toBeUndefined();
    expect(cell.ct.fa).toBe("General");
    expect(getBorderInfoComputeRange(ctx, 0, 1, 0, 1)["0_0"]).toBeUndefined();
  });
});

describe("increase / decrease decimal on the selection", () => {
  test("General derives from the shown value and applies to all", () => {
    const ctx = makeCtx({ row: [0, 1], column: [0, 0] });
    getFlowdata(ctx)[1][0] = { v: 2, m: "2", ct: { fa: "General", t: "n" } };
    handleNumberIncrease(ctx, document.createElement("div"));
    expect(getFlowdata(ctx)[0][0]).toMatchObject({
      m: "1234.50",
      ct: { fa: "0.00" },
    });
    expect(getFlowdata(ctx)[1][0].m).toBe("2.00");
    handleNumberDecrease(ctx, document.createElement("div"));
    handleNumberDecrease(ctx, document.createElement("div"));
    expect(getFlowdata(ctx)[0][0].m).toBe("1235");
  });

  test("currency code with sections", () => {
    const data = grid();
    data[0][0].ct = { fa: '"$"#,##0.00_);[Red]("$"#,##0.00)', t: "n" };
    const ctx = makeCtx({ row: [0, 0], column: [0, 0] }, data);
    handleNumberDecrease(ctx, document.createElement("div"));
    expect(getFlowdata(ctx)[0][0].ct.fa).toBe('"$"#,##0.0_);[Red]("$"#,##0.0)');
  });

  test("text cells are ignored", () => {
    const ctx = makeCtx({ row: [0, 0], column: [1, 1] });
    ctx.luckysheet_select_save[0].column_focus = 1;
    handleNumberIncrease(ctx, document.createElement("div"));
    expect(getFlowdata(ctx)[0][1].ct.fa).toBe("General");
  });
});

describe("format painter", () => {
  const painterCtx = () => {
    const data = [
      [
        { v: 1, m: "1", ct: { fa: "0.00%", t: "n" }, bg: "#ff0000" },
        { v: "x", m: "x", ct: { fa: "General", t: "g" } },
        { v: 3, m: "3", ct: { fa: "General", t: "n" } },
      ],
      [null, null, null],
      [null, null, null],
    ];
    const ctx = makeCtx({ row: [0, 0], column: [0, 0] }, data);
    ctx.config.borderInfo = [
      {
        rangeType: "range",
        borderType: "border-all",
        color: "#000",
        style: "1",
        range: [{ row: [0, 0], column: [0, 0] }],
      },
    ];
    ctx.luckysheetfile[0].config = ctx.config;
    ctx.luckysheetfile[0].luckysheet_conditionformat_save = [
      {
        type: "default",
        cellrange: [{ row: [0, 0], column: [0, 0] }],
        format: { textColor: "#000", cellColor: "#ff0" },
        conditionName: "greaterThan",
        conditionRange: [],
        conditionValue: [0],
      },
    ];
    return ctx;
  };
  const paintTo = (ctx, r, c) => {
    ctx.luckysheet_select_save = [
      { row: [r, r], column: [c, c], row_focus: r, column_focus: c },
    ];
    pasteHandlerOfPaintModel(ctx, ctx.luckysheet_copy_save);
  };

  test("single click: one-shot; clicking again turns it off", () => {
    const ctx = painterCtx();
    handleFormatPainter(ctx);
    expect(ctx.luckysheetPaintModelOn).toBe(true);
    expect(ctx.luckysheetPaintSingle).toBe(true);
    handleFormatPainter(ctx);
    expect(ctx.luckysheetPaintModelOn).toBe(false);
  });

  test("double click: sticky", () => {
    const ctx = painterCtx();
    startFormatPainter(ctx, true);
    expect(ctx.luckysheetPaintModelOn).toBe(true);
    expect(ctx.luckysheetPaintSingle).toBe(false);
  });

  test("copies number format, fill, borders and conditional formats", () => {
    const ctx = painterCtx();
    startFormatPainter(ctx, true);
    paintTo(ctx, 0, 2);
    const d = getFlowdata(ctx);
    expect(d[0][2]).toMatchObject({
      v: 3,
      m: "300.00%",
      bg: "#ff0000",
      ct: { fa: "0.00%", t: "n" },
    });
    const b = getBorderInfoComputeRange(ctx, 0, 0, 2, 2);
    expect(b["0_2"].l).toMatchObject({ style: "1" });
    const cf = ctx.luckysheetfile[0].luckysheet_conditionformat_save;
    expect(cf).toHaveLength(2);
    expect(cf[1].cellrange).toEqual([{ row: [0, 0], column: [2, 2] }]);
  });

  test("a text cell painted with a number format stays text", () => {
    const ctx = painterCtx();
    startFormatPainter(ctx, true);
    paintTo(ctx, 0, 1);
    expect(getFlowdata(ctx)[0][1]).toMatchObject({ v: "x", m: "x" });
  });
});
