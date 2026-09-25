/**
 * Format Cells (Ctrl+1) and Cell Styles: reading the active cell's
 * formatting into a snapshot, applying a set of changes to every selected
 * cell, and Excel's built-in cell styles.
 *
 * All functions mutate the context they are given, so a UI applies them
 * inside one `setContext` call and the whole change is one undo step.
 */
import _ from "lodash";
import { checkProtection } from "./protection";
import { Context, getFlowdata } from "../context";
import { Cell, CellMatrix } from "../types";
import { getSheetIndex, isAllowEdit } from "../utils";
import { getBorderInfoComputeRange } from "./border";
import { normalizedCellAttr } from "./cell";
import { updateInlineStringFormatOutside } from "./inline-string";
import { handleMerge, updateFormatCell } from "./toolbar";

export type FormatCellsTab =
  | "number"
  | "alignment"
  | "font"
  | "border"
  | "fill"
  | "protection";

/** Open the Format Cells dialog (Ctrl+1, context menu, "More formats"). */
export function openFormatCells(ctx: Context, tab: FormatCellsTab = "number") {
  if (!ctx.luckysheet_select_save?.length) return;
  if (!checkProtection(ctx, "formatCells")) return;
  ctx.formatCellsDialog = { tab };
}

export function closeFormatCells(ctx: Context) {
  ctx.formatCellsDialog = undefined;
}

/** A border line: canvas style id ("1" thin ... "13" thick) and colour. */
export type BorderLine = { style: string; color: string };

/**
 * Border edits: undefined leaves an edge alone, null removes it. `none`
 * first clears every border of the selection (the None preset).
 */
export type BorderChanges = {
  none?: boolean;
  top?: BorderLine | null;
  bottom?: BorderLine | null;
  left?: BorderLine | null;
  right?: BorderLine | null;
  insideH?: BorderLine | null;
  insideV?: BorderLine | null;
};

/** Changes to apply; a missing field is left as it is on every cell. */
export type FormatCellsChanges = {
  /** Number format code. */
  fa?: string;
  /** Horizontal alignment: "general" (by value type), "0" center, "1" left, "2" right. */
  ht?: "general" | "0" | "1" | "2";
  /** Vertical alignment: "0" middle, "1" top, "2" bottom. */
  vt?: "0" | "1" | "2";
  wrap?: boolean;
  shrink?: boolean;
  /** Indent level (left/right aligned text), 0-15. */
  indent?: number;
  /** Text rotation in degrees (-90..90, counter-clockwise) or stacked. */
  rotation?: number | "vertical";
  merge?: boolean;
  ff?: string;
  fs?: number;
  bl?: boolean;
  it?: boolean;
  /** Underline: 0 none, 1 single, 2 double. */
  un?: number;
  cl?: boolean;
  /** Font colour; null for automatic. */
  fc?: string | null;
  /** Fill colour; null for no fill. */
  bg?: string | null;
  borders?: BorderChanges;
  locked?: boolean;
  hidden?: boolean;
};

/** Formatting of the active cell as the dialog shows it. */
export type FormatCellsState = {
  value: unknown;
  fa: string;
  ht: "general" | "0" | "1" | "2";
  vt: "0" | "1" | "2";
  wrap: boolean;
  shrink: boolean;
  indent: number;
  rotation: number | "vertical";
  merge: boolean;
  ff: string;
  fs: number;
  bl: boolean;
  it: boolean;
  un: number;
  cl: boolean;
  fc: string | null;
  bg: string | null;
  borders: {
    top: BorderLine | null;
    bottom: BorderLine | null;
    left: BorderLine | null;
    right: BorderLine | null;
  };
  locked: boolean;
  hidden: boolean;
  /** Number formats used on the sheet (for the Custom list). */
  usedFormats: string[];
  /** Whether the selection spans more than one row / column. */
  multiRow: boolean;
  multiCol: boolean;
};

/** Extra cell attributes this module reads and writes. */
type FormatCell = Cell & {
  ht?: number | string;
  vt?: number | string;
  /** shrink to fit */
  sk?: number;
  /** indent level */
  ind?: number;
  /** hidden formula (sheet protection) */
  hi?: number;
};

const ROTATION_PRESETS: Record<string, number> = {
  "1": 45,
  "2": -45,
  "4": 90,
  "5": -90,
};

/** Rotation in degrees (-90..90) from the cell's rt/tr attributes. */
export function cellRotation(
  cell: Cell | null | undefined
): number | "vertical" {
  if (!cell) return 0;
  if (!_.isNil(cell.rt)) {
    const rt = Number(cell.rt);
    if (rt > 90 && rt <= 180) return 90 - rt;
    return rt >= 0 && rt <= 90 ? rt : 0;
  }
  if (cell.tr === "3") return "vertical";
  return ROTATION_PRESETS[cell.tr ?? "0"] ?? 0;
}

function setRotation(cell: FormatCell, rotation: number | "vertical") {
  delete cell.rt;
  if (rotation === "vertical") {
    cell.tr = "3";
    return;
  }
  const deg = Math.max(-90, Math.min(90, Math.round(rotation)));
  const preset = _.findKey(ROTATION_PRESETS, (v) => v === deg);
  if (deg === 0) cell.tr = "0";
  else if (preset) cell.tr = preset;
  else {
    cell.tr = "0";
    // xlsx textRotation convention: 1..90 up, 91..180 down
    cell.rt = deg > 0 ? deg : 90 - deg;
  }
}

function activeCellPosition(ctx: Context) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return null;
  const r = sel.row_focus ?? sel.row[0];
  const c = sel.column_focus ?? sel.column[0];
  return { r, c };
}

function fontName(ctx: Context, ff: Cell["ff"]) {
  if (_.isNil(ff) || ff === "") return "";
  if (typeof ff === "number" || /^\d+$/.test(`${ff}`)) {
    const names = ["Times New Roman", "Arial", "Tahoma", "Verdana"];
    return names[Number(ff)] ?? "";
  }
  return `${ff}`;
}

/** Snapshot of the active cell's formatting for the Format Cells dialog. */
export function getFormatCellsState(ctx: Context): FormatCellsState | null {
  const flowdata = getFlowdata(ctx);
  const pos = activeCellPosition(ctx);
  if (!flowdata || !pos) return null;
  const { r, c } = pos;
  const cell = (flowdata[r]?.[c] ?? null) as FormatCell | null;
  const selections = ctx.luckysheet_select_save ?? [];
  const multiRow = selections.some((s) => s.row[1] > s.row[0]);
  const multiCol = selections.some((s) => s.column[1] > s.column[0]);

  const borderMap = getBorderInfoComputeRange(ctx, r, r, c, c);
  const b = borderMap[`${r}_${c}`] || {};
  const line = (x: any): BorderLine | null =>
    x && x.style != null && `${x.style}` !== "0"
      ? { style: `${x.style}`, color: x.color || "#000000" }
      : null;

  const used = new Set<string>();
  for (let i = 0; i < flowdata.length && used.size < 200; i += 1) {
    const row = flowdata[i];
    if (row) {
      for (let j = 0; j < row.length; j += 1) {
        const fa = row[j]?.ct?.fa;
        if (fa && fa !== "General") used.add(fa);
      }
    }
  }

  const htRaw = cell?.ht;
  const ht =
    _.isNil(htRaw) || !["0", "1", "2"].includes(`${htRaw}`)
      ? "general"
      : (`${htRaw}` as "0" | "1" | "2");

  return {
    value: cell?.v,
    fa: cell?.ct?.fa || "General",
    ht,
    vt: normalizedCellAttr(cell as Cell, "vt") as "0" | "1" | "2",
    wrap: cell?.tb === "2",
    shrink: !!cell?.sk,
    indent: cell?.ind ?? 0,
    rotation: cellRotation(cell),
    merge: !!cell?.mc,
    ff: fontName(ctx, cell?.ff),
    fs: Number(cell?.fs) || ctx.defaultFontSize || 10,
    bl: !!Number(cell?.bl ?? 0),
    it: !!Number(cell?.it ?? 0),
    un: Number(cell?.un ?? 0) || 0,
    cl: !!Number(cell?.cl ?? 0),
    fc: cell?.fc || null,
    bg: cell?.bg || null,
    borders: {
      top: line(b.t),
      bottom: line(b.b),
      left: line(b.l),
      right: line(b.r),
    },
    locked: cell?.lo !== 0,
    hidden: !!cell?.hi,
    usedFormats: Array.from(used),
    multiRow,
    multiCol,
  };
}

/* ------------------------------------------------------------------ */
/* Borders                                                             */
/* ------------------------------------------------------------------ */

type Rect = { row: number[]; column: number[] };

function pushBorder(
  ctx: Context,
  borderType: string,
  line: BorderLine | null,
  ranges: Rect[]
) {
  const cfg = ctx.config;
  if (!cfg.borderInfo) cfg.borderInfo = [];
  cfg.borderInfo.push({
    rangeType: "range",
    borderType,
    color: line?.color ?? "#000000",
    style: line?.style ?? "1",
    range: _.cloneDeep(ranges),
  } as any);
}

/**
 * Remove single edges: rewrite the selection's borders cell by cell
 * without them (border records are additive, so an edge can only be taken
 * away by clearing the range and adding the rest back).
 */
function removeEdges(ctx: Context, range: Rect, changes: BorderChanges) {
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  const current = getBorderInfoComputeRange(ctx, r1, r2, c1, c2);
  pushBorder(ctx, "border-none", null, [range]);
  const cfg = ctx.config;
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const b = current[`${r}_${c}`];
      if (b) {
        const keep = (edge: "t" | "b" | "l" | "r") => {
          const outer =
            (edge === "t" && r === r1) ||
            (edge === "b" && r === r2) ||
            (edge === "l" && c === c1) ||
            (edge === "r" && c === c2);
          let change: BorderLine | null | undefined;
          if (edge === "t") change = outer ? changes.top : changes.insideH;
          if (edge === "b") change = outer ? changes.bottom : changes.insideH;
          if (edge === "l") change = outer ? changes.left : changes.insideV;
          if (edge === "r") change = outer ? changes.right : changes.insideV;
          return change === null ? null : b[edge] || null;
        };
        const value = {
          t: keep("t"),
          b: keep("b"),
          l: keep("l"),
          r: keep("r"),
        };
        if (value.t || value.b || value.l || value.r) {
          cfg.borderInfo!.push({
            rangeType: "cell",
            value: { row_index: r, col_index: c, ...value },
          } as any);
        }
      }
    }
  }
}

function applyBorders(ctx: Context, changes: BorderChanges, ranges: Rect[]) {
  const cfg = ctx.config;
  if (!cfg.borderInfo) cfg.borderInfo = [];
  ranges.forEach((range) => {
    const single = [range];
    const multiRow = range.row[1] > range.row[0];
    const multiCol = range.column[1] > range.column[0];
    if (changes.none) {
      pushBorder(ctx, "border-none", null, single);
    } else if (
      [
        changes.top,
        changes.bottom,
        changes.left,
        changes.right,
        changes.insideH,
        changes.insideV,
      ].some((x) => x === null)
    ) {
      removeEdges(ctx, range, changes);
    }
    const set: [keyof BorderChanges, string, boolean][] = [
      ["top", "border-top", true],
      ["bottom", "border-bottom", true],
      ["left", "border-left", true],
      ["right", "border-right", true],
      ["insideH", "border-horizontal", multiRow],
      ["insideV", "border-vertical", multiCol],
    ];
    set.forEach(([key, type, applies]) => {
      const line = changes[key];
      if (applies && line && typeof line === "object") {
        pushBorder(ctx, type, line, single);
      }
    });
  });
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index != null) ctx.luckysheetfile[index].config = ctx.config;
}

/* ------------------------------------------------------------------ */
/* Applying changes                                                    */
/* ------------------------------------------------------------------ */

function setStyleAttr(cell: FormatCell, attr: string, value: any) {
  if (value === undefined) return;
  if (value === null) {
    delete (cell as any)[attr];
  } else {
    (cell as any)[attr] = value;
  }
  if (cell.ct?.t === "inlineStr") {
    updateInlineStringFormatOutside(cell, attr, value ?? undefined);
  }
}

function eachCell(
  d: CellMatrix,
  ranges: Rect[],
  fn: (cell: FormatCell, r: number, c: number) => void
) {
  ranges.forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      if (d[r]) {
        for (let c = range.column[0]; c <= range.column[1]; c += 1) {
          if (c < d[r].length) {
            if (!d[r][c]) d[r][c] = {};
            fn(d[r][c] as FormatCell, r, c);
          }
        }
      }
    }
  });
}

/**
 * Apply Format Cells changes to every selected cell (one undo step when
 * run inside one setContext).
 */
export function applyFormatCells(
  ctx: Context,
  changes: FormatCellsChanges,
  canvas?: CanvasRenderingContext2D
) {
  if (!checkProtection(ctx, "formatCells")) return;
  if (!isAllowEdit(ctx, undefined, true)) return;
  const d = getFlowdata(ctx);
  const ranges = (ctx.luckysheet_select_save ?? []) as Rect[];
  if (!d || ranges.length === 0) return;

  if (changes.fa !== undefined) {
    ranges.forEach((range) =>
      updateFormatCell(
        ctx,
        d,
        "ct",
        changes.fa,
        range.row[0],
        range.row[1],
        range.column[0],
        range.column[1]
      )
    );
  }

  eachCell(d, ranges, (cell) => {
    if (changes.ht !== undefined) {
      if (changes.ht === "general") delete cell.ht;
      else cell.ht = changes.ht as any;
    }
    if (changes.vt !== undefined) cell.vt = changes.vt as any;
    if (changes.wrap !== undefined) {
      if (changes.wrap) cell.tb = "2";
      else if (cell.tb === "2") delete cell.tb;
    }
    if (changes.shrink !== undefined) {
      if (changes.shrink) cell.sk = 1;
      else delete cell.sk;
    }
    if (changes.indent !== undefined) {
      const ind = Math.max(0, Math.min(15, Math.round(changes.indent)));
      if (ind) cell.ind = ind;
      else delete cell.ind;
    }
    if (changes.rotation !== undefined) setRotation(cell, changes.rotation);
    if (changes.ff !== undefined) setStyleAttr(cell, "ff", changes.ff || null);
    if (changes.fs !== undefined) setStyleAttr(cell, "fs", changes.fs);
    if (changes.bl !== undefined) setStyleAttr(cell, "bl", changes.bl ? 1 : 0);
    if (changes.it !== undefined) setStyleAttr(cell, "it", changes.it ? 1 : 0);
    if (changes.un !== undefined) setStyleAttr(cell, "un", changes.un);
    if (changes.cl !== undefined) setStyleAttr(cell, "cl", changes.cl ? 1 : 0);
    if (changes.fc !== undefined) setStyleAttr(cell, "fc", changes.fc);
    if (changes.bg !== undefined) {
      if (changes.bg === null) delete cell.bg;
      else cell.bg = changes.bg;
    }
    if (changes.locked !== undefined) cell.lo = changes.locked ? 1 : 0;
    if (changes.hidden !== undefined) {
      if (changes.hidden) cell.hi = 1;
      else delete cell.hi;
    }
  });

  if (changes.borders) applyBorders(ctx, changes.borders, ranges);

  if (changes.fs !== undefined && canvas) {
    // grow rows for the larger font, like the toolbar's font size (this
    // writes row heights to the sheet's config; keep ctx.config in step)
    ranges.forEach((range) =>
      updateFormatCell(
        ctx,
        d,
        "fs",
        changes.fs,
        range.row[0],
        range.row[1],
        range.column[0],
        range.column[1],
        canvas
      )
    );
    const index = getSheetIndex(ctx, ctx.currentSheetId);
    const cfg = index == null ? null : ctx.luckysheetfile[index].config;
    if (cfg) ctx.config = cfg;
  }

  if (changes.merge !== undefined) {
    handleMerge(ctx, changes.merge ? "merge-all" : "merge-cancel");
  }
}

/* ------------------------------------------------------------------ */
/* Cell styles                                                         */
/* ------------------------------------------------------------------ */

export type CellStyleId =
  | "normal"
  | "good"
  | "bad"
  | "neutral"
  | "calculation"
  | "checkCell"
  | "explanatory"
  | "input"
  | "linkedCell"
  | "note"
  | "output"
  | "warning"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "title"
  | "total"
  | "comma"
  | "comma0"
  | "currency"
  | "currency0"
  | "percent";

export type CellStyleDef = {
  id: CellStyleId;
  group: "goodBad" | "data" | "titles" | "number";
  /** Font: colour, bold, italic, size; attributes not given are reset. */
  font?: { fc?: string; bl?: boolean; it?: boolean; fs?: number };
  /** Fill colour (null: no fill). */
  fill?: string | null;
  /** Borders applied to each selected cell's outline. */
  border?: Omit<BorderChanges, "none" | "insideH" | "insideV">;
  /** Number format code. */
  fa?: string;
};

const ACCENT1 = "#4472C4";
const TEXT2 = "#44546A";
const THIN = (color: string): BorderLine => ({ style: "1", color });
const DOUBLE = (color: string): BorderLine => ({ style: "7", color });
const box = (line: BorderLine) => ({
  top: line,
  bottom: line,
  left: line,
  right: line,
});

/**
 * Excel's built-in cell styles (Office theme colours). The symbol of the
 * Currency styles follows the workbook currency (settings.currency).
 */
export function getCellStyles(currency = "$"): CellStyleDef[] {
  const sym = currency.replace(/"/g, "");
  return [
    { id: "normal", group: "goodBad" },
    {
      id: "bad",
      group: "goodBad",
      font: { fc: "#9C0006" },
      fill: "#FFC7CE",
    },
    {
      id: "good",
      group: "goodBad",
      font: { fc: "#006100" },
      fill: "#C6EFCE",
    },
    {
      id: "neutral",
      group: "goodBad",
      font: { fc: "#9C5700" },
      fill: "#FFEB9C",
    },
    {
      id: "calculation",
      group: "data",
      font: { fc: "#FA7D00", bl: true },
      fill: "#F2F2F2",
      border: box(THIN("#7F7F7F")),
    },
    {
      id: "checkCell",
      group: "data",
      font: { fc: "#FFFFFF", bl: true },
      fill: "#A5A5A5",
      border: box(DOUBLE("#3F3F3F")),
    },
    {
      id: "explanatory",
      group: "data",
      font: { fc: "#7F7F7F", it: true },
    },
    {
      id: "input",
      group: "data",
      font: { fc: "#3F3F76" },
      fill: "#FFCC99",
      border: box(THIN("#7F7F7F")),
    },
    {
      id: "linkedCell",
      group: "data",
      font: { fc: "#FA7D00" },
      border: { bottom: DOUBLE("#FF8001") },
    },
    {
      id: "note",
      group: "data",
      fill: "#FFFFCC",
      border: box(THIN("#B2B2B2")),
    },
    {
      id: "output",
      group: "data",
      font: { fc: "#3F3F3F", bl: true },
      fill: "#F2F2F2",
      border: box(THIN("#3F3F3F")),
    },
    { id: "warning", group: "data", font: { fc: "#FF0000" } },
    {
      id: "heading1",
      group: "titles",
      font: { fc: TEXT2, bl: true, fs: 15 },
      border: { bottom: { style: "13", color: ACCENT1 } },
    },
    {
      id: "heading2",
      group: "titles",
      font: { fc: TEXT2, bl: true, fs: 13 },
      border: { bottom: { style: "13", color: "#A2B8E1" } },
    },
    {
      id: "heading3",
      group: "titles",
      font: { fc: TEXT2, bl: true, fs: 11 },
      border: { bottom: { style: "8", color: "#8EAADB" } },
    },
    {
      id: "heading4",
      group: "titles",
      font: { fc: TEXT2, bl: true, fs: 11 },
    },
    { id: "title", group: "titles", font: { fc: TEXT2, fs: 18 } },
    {
      id: "total",
      group: "titles",
      font: { bl: true },
      border: { top: THIN(ACCENT1), bottom: DOUBLE(ACCENT1) },
    },
    {
      id: "comma",
      group: "number",
      fa: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
    },
    {
      id: "comma0",
      group: "number",
      fa: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
    },
    {
      id: "currency",
      group: "number",
      fa: `_("${sym}"* #,##0.00_);_("${sym}"* \\(#,##0.00\\);_("${sym}"* "-"??_);_(@_)`,
    },
    {
      id: "currency0",
      group: "number",
      fa: `_("${sym}"* #,##0_);_("${sym}"* \\(#,##0\\);_("${sym}"* "-"_);_(@_)`,
    },
    { id: "percent", group: "number", fa: "0%" },
  ];
}

/**
 * Apply a built-in cell style to the selection. Like Excel, a style
 * replaces the attribute groups it defines (a font colour style resets
 * bold/italic/size); "normal" removes all formatting, borders included.
 */
export function applyCellStyle(
  ctx: Context,
  id: CellStyleId,
  currency?: string,
  canvas?: CanvasRenderingContext2D
) {
  const style = getCellStyles(currency || ctx.currency || "$").find(
    (s) => s.id === id
  );
  if (!style) return;
  if (id === "normal") {
    applyFormatCells(ctx, {
      fa: "General",
      ht: "general",
      bl: false,
      it: false,
      cl: false,
      un: 0,
      fc: null,
      bg: null,
      ff: "",
      borders: { none: true },
    });
    const d = getFlowdata(ctx);
    if (!d) return;
    eachCell(d, (ctx.luckysheet_select_save ?? []) as Rect[], (cell) => {
      delete cell.fs;
      delete cell.vt;
      delete cell.tr;
      delete cell.rt;
      delete cell.sk;
      delete cell.ind;
      if (cell.tb === "2") delete cell.tb;
    });
    return;
  }
  const changes: FormatCellsChanges = {};
  if (style.fa) changes.fa = style.fa;
  if (style.font) {
    changes.fc = style.font.fc ?? null;
    changes.bl = !!style.font.bl;
    changes.it = !!style.font.it;
    changes.fs = style.font.fs ?? ctx.defaultFontSize ?? 10;
  }
  if (style.fill !== undefined) changes.bg = style.fill;
  if (style.border) {
    changes.borders = { none: true, ...style.border };
  }
  applyFormatCells(ctx, changes, canvas);
}
