/**
 * Pasting our own copy (Ctrl+V and Paste Special), with Excel semantics.
 *
 * The source is read live from the copied range (`ctx.luckysheet_copy_save`)
 * so formulas can be pasted with their relative references shifted by the
 * paste offset ({@link offsetFormula}); absolute references are kept, also
 * across sheets.
 *
 * Paste Special picks what is pasted (all, formulas, values, formats,
 * comments, validation, all except borders, column widths, formulas or
 * values with number formats), optionally combined with an arithmetic
 * operation (add, subtract, multiply, divide), "skip blanks" and "transpose",
 * or pastes links to the source cells (`=Sheet1!A1`).
 */
import _ from "lodash";
import type { Context } from "../context";
import type { Cell, CellMatrix } from "../types";
import { getSheetIndex } from "../utils";
import { getBorderInfoCompute } from "./border";
import { execfunction, delFunctionGroup } from "./formula";
import { update } from "./format";
import { jfrefreshgrid } from "./refresh";
// eslint-disable-next-line import/no-cycle
import { reconcileSpills } from "./spill";
import { applyCellImage } from "./cellImage";
import { expandRowsAndColumns } from "./sheet";
import {
  borderEntriesForCell,
  liveSheetConfig,
  rangeCutsMerge,
  stripBorders,
} from "./moveCells";
import {
  formatRefBody,
  offsetFormula,
  sheetPrefix,
  transposeFormula,
} from "./refAdjust";

export type PasteSpecialMode =
  | "all"
  | "formulas"
  | "values"
  | "formats"
  | "comments"
  | "validation"
  | "allExceptBorders"
  | "columnWidths"
  | "formulasAndNumberFormats"
  | "valuesAndNumberFormats"
  | "allUsingSourceColumnWidths";

export type PasteSpecialOperation =
  | "none"
  | "add"
  | "subtract"
  | "multiply"
  | "divide";

export type PasteSpecialOptions = {
  paste?: PasteSpecialMode;
  operation?: PasteSpecialOperation;
  skipBlanks?: boolean;
  transpose?: boolean;
  /** paste formulas linking to the source cells instead */
  pasteLink?: boolean;
};

type Parts = {
  content?: "formulas" | "values";
  styles?: "all" | "numberFormat";
  borders?: boolean;
  merges?: boolean;
  comments?: boolean;
  validation?: boolean;
  links?: boolean;
  cf?: boolean;
  colWidths?: boolean;
};

const ALL: Parts = {
  content: "formulas",
  styles: "all",
  borders: true,
  merges: true,
  comments: true,
  validation: true,
  links: true,
  cf: true,
};

function partsOf(mode: PasteSpecialMode): Parts {
  switch (mode) {
    case "allExceptBorders":
      return { ...ALL, borders: false };
    case "allUsingSourceColumnWidths":
      return { ...ALL, colWidths: true };
    case "formulas":
      return { content: "formulas" };
    case "values":
      return { content: "values" };
    case "formats":
      return { styles: "all", borders: true, merges: true, cf: true };
    case "formulasAndNumberFormats":
      return { content: "formulas", styles: "numberFormat" };
    case "valuesAndNumberFormats":
      return { content: "values", styles: "numberFormat" };
    case "comments":
      return { comments: true };
    case "validation":
      return { validation: true };
    case "columnWidths":
      return { colWidths: true };
    default:
      return ALL;
  }
}

/** Cell properties that are formatting (pasted by "Formats"). */
export const STYLE_KEYS = [
  "bg",
  "fc",
  "ff",
  "fs",
  "bl",
  "it",
  "un",
  "cl",
  "ht",
  "vt",
  "tb",
  "tr",
  "rt",
] as const;

const CONTENT_KEYS = ["v", "m", "f", "spl", "qp", "img"] as const;

type SourceItem = { cell: Cell | null; r: number; c: number };

type Block = {
  sheetId: string;
  items: SourceItem[][];
  /** the single source range (null for multi-range copies) */
  range: { row: [number, number]; column: [number, number] } | null;
};

function isBlank(cell: Cell | null | undefined) {
  if (!cell) return true;
  if (cell.f || cell.img) return false;
  if (cell.ct?.t === "inlineStr" && cell.ct.s?.length) return false;
  return cell.v == null || cell.v === "";
}

/** Build the source block of the current copy (hidden rows/columns skipped). */
export function getCopyBlock(ctx: Context): Block | null {
  const save = ctx.luckysheet_copy_save;
  if (!save || !save.copyRange || save.copyRange.length === 0) return null;
  const sheetId = save.dataSheetId;
  const idx = getSheetIndex(ctx, sheetId);
  if (idx == null) return null;
  const file = ctx.luckysheetfile[idx];
  const d = file.data;
  if (!d) return null;
  const cfg = (sheetId === ctx.currentSheetId ? ctx.config : file.config) || {};

  const visibleRows = (r1: number, r2: number) => {
    const out: number[] = [];
    for (let r = r1; r <= r2; r += 1) {
      if (cfg.rowhidden?.[r] == null) out.push(r);
    }
    return out;
  };
  const visibleCols = (c1: number, c2: number) => {
    const out: number[] = [];
    for (let c = c1; c <= c2; c += 1) {
      if (cfg.colhidden?.[c] == null) out.push(c);
    }
    return out;
  };
  const grab = (rows: number[], cols: number[]) =>
    rows.map((r) => cols.map((c) => ({ cell: d[r]?.[c] ?? null, r, c })));

  const ranges = save.copyRange;
  if (ranges.length === 1) {
    const [range] = ranges;
    const items = grab(
      visibleRows(range.row[0], range.row[1]),
      visibleCols(range.column[0], range.column[1])
    );
    if (items.length === 0 || items[0].length === 0) return null;
    return {
      sheetId,
      items,
      range: {
        row: [range.row[0], range.row[1]],
        column: [range.column[0], range.column[1]],
      },
    };
  }

  // several ranges sharing their rows (side by side) or columns (stacked)
  const sameRows = ranges.every(
    (rg) => rg.row[0] === ranges[0].row[0] && rg.row[1] === ranges[0].row[1]
  );
  const sameCols = ranges.every(
    (rg) =>
      rg.column[0] === ranges[0].column[0] &&
      rg.column[1] === ranges[0].column[1]
  );
  if (sameRows) {
    const sorted = _.sortBy(ranges, (rg) => rg.column[0]);
    const rows = visibleRows(ranges[0].row[0], ranges[0].row[1]);
    const cols = _.flatten(
      sorted.map((rg) => visibleCols(rg.column[0], rg.column[1]))
    );
    return { sheetId, items: grab(rows, cols), range: null };
  }
  if (sameCols) {
    const sorted = _.sortBy(ranges, (rg) => rg.row[0]);
    const rows = _.flatten(
      sorted.map((rg) => visibleRows(rg.row[0], rg.row[1]))
    );
    const cols = visibleCols(ranges[0].column[0], ranges[0].column[1]);
    return { sheetId, items: grab(rows, cols), range: null };
  }
  return null;
}

function transposeItems<T>(items: T[][]): T[][] {
  if (items.length === 0) return items;
  return items[0].map((_col, j) => items.map((row) => row[j]));
}

function numericValue(cell: Cell | null | undefined): number | null {
  if (isBlank(cell)) return 0;
  const { v } = cell!;
  if (typeof v === "number") return v;
  return null;
}

const OP_SYMBOL: Record<Exclude<PasteSpecialOperation, "none">, string> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
};

function applyOperation(
  op: Exclude<PasteSpecialOperation, "none">,
  a: number,
  b: number
): number | string {
  switch (op) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    default:
      return b === 0 ? "#DIV/0!" : a / b;
  }
}

function numberLiteral(n: number) {
  return n < 0 ? `(${n})` : String(n);
}

/** Set ct.t and m to match the value of a (non-formula) cell. */
function refreshDisplay(cell: Cell) {
  const { v } = cell;
  if (cell.ct?.t === "inlineStr") return;
  if (v == null || v === "") {
    delete cell.m;
    if (v === "") delete cell.v;
    return;
  }
  const isError = typeof v === "string" && /^#[A-Z0-9/]+[!?]?$/.test(v);
  let t = "g";
  if (typeof v === "number") t = "n";
  else if (typeof v === "boolean") t = "b";
  else if (isError) t = "e";
  const fa = cell.ct?.fa ?? "General";
  if (!cell.ct || fa === "General") cell.ct = { ...(cell.ct || {}), fa, t };
  if (typeof v === "boolean") cell.m = v ? "TRUE" : "FALSE";
  else if (isError || typeof v === "string") cell.m = v as string;
  else cell.m = update(fa, v);
}

/**
 * Paste the current copy (`ctx.luckysheet_copy_save`) at the selection.
 * Returns false (and changes nothing) when there is nothing to paste or the
 * paste is not possible (e.g. it would cut a merged area).
 */
export function pasteSpecial(
  ctx: Context,
  options: PasteSpecialOptions = {}
): boolean {
  const mode = options.paste ?? "all";
  const operation = options.operation ?? "none";
  const parts = partsOf(mode);
  const block = getCopyBlock(ctx);
  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!block || !last) return false;

  const dstId = ctx.currentSheetId;
  const dstIdx = getSheetIndex(ctx, dstId);
  if (dstIdx == null) return false;
  const dstFile = ctx.luckysheetfile[dstIdx];
  const d = dstFile.data;
  if (!d) return false;
  const cfg = liveSheetConfig(ctx, dstId);

  const items = options.transpose ? transposeItems(block.items) : block.items;
  const bh = items.length;
  const bw = items[0].length;
  const minh = last.row[0];
  const minc = last.column[0];
  const selH = last.row[1] - last.row[0] + 1;
  const selW = last.column[1] - last.column[0] + 1;
  // an exact multiple of the copied size is filled by repeating it (Excel)
  const tile = selH % bh === 0 && selW % bw === 0;
  const timesH = tile ? selH / bh : 1;
  const timesW = tile ? selW / bw : 1;
  const maxh = minh + bh * timesH - 1;
  const maxc = minc + bw * timesW - 1;
  const target = { row: [minh, maxh], column: [minc, maxc] } as {
    row: [number, number];
    column: [number, number];
  };

  if (rangeCutsMerge(cfg.merge || {}, target)) return false;

  const addr = maxh - d.length + 1;
  const addc = maxc - (d[0]?.length ?? 0) + 1;
  if (addr > 0 || addc > 0) {
    expandRowsAndColumns(d, Math.max(addr, 0), Math.max(addc, 0));
  }

  const srcIdx = getSheetIndex(ctx, block.sheetId)!;
  const srcFile = ctx.luckysheetfile[srcIdx];
  const srcCfg =
    (block.sheetId === ctx.currentSheetId ? ctx.config : srcFile.config) || {};
  const needBorders = parts.borders && !options.pasteLink;
  const srcBorders = needBorders
    ? getBorderInfoCompute(
        ctx,
        block.sheetId === ctx.currentSheetId ? undefined : block.sheetId
      )
    : {};
  // snapshot everything read from the source: it may overlap the target
  const srcCells: (Cell | null)[][] = items.map((row) =>
    row.map((it) => (it.cell ? _.cloneDeep(it.cell) : null))
  );
  const srcDV = _.cloneDeep(srcFile.dataVerification || {});
  const srcLinks = _.cloneDeep(srcFile.hyperlink || {});
  const srcColLen = { ...(srcCfg.columnlen || {}) };
  const srcCustomWidth = { ...(srcCfg.customWidth || {}) };
  const srcCF = _.cloneDeep(srcFile.luckysheet_conditionformat_save || []);

  const hiddenRows = cfg.rowhidden || {};
  const hiddenCols = cfg.colhidden || {};
  const singleSource = block.items.length === 1 && block.items[0].length === 1;
  const srcPrefix = block.sheetId !== dstId ? sheetPrefix(srcFile.name) : "";

  const formulaCells: { r: number; c: number }[] = [];
  const adjustCopiedFormula = (
    f: string,
    sr: number,
    sc: number,
    R: number,
    C: number
  ) =>
    options.transpose
      ? transposeFormula(f, sr, sc, R, C)
      : offsetFormula(f, R - sr, C - sc);
  const touchesContent =
    parts.content != null || options.pasteLink || parts.styles != null;

  if (parts.borders && !options.pasteLink) {
    cfg.borderInfo = stripBorders(cfg.borderInfo, target);
  }
  if (parts.merges && !options.pasteLink) {
    _.forEach(cfg.merge, (mc, key) => {
      if (mc.r >= minh && mc.r <= maxh && mc.c >= minc && mc.c <= maxc) {
        delete cfg.merge![key];
      }
    });
  }

  for (let th = 0; th < timesH; th += 1) {
    for (let tw = 0; tw < timesW; tw += 1) {
      for (let i = 0; i < bh; i += 1) {
        for (let j = 0; j < bw; j += 1) {
          const R = minh + th * bh + i;
          const C = minc + tw * bw + j;
          if (hiddenRows[R] != null || hiddenCols[C] != null) continue;
          const item = items[i][j];
          const s = srcCells[i][j];
          if (options.skipBlanks && isBlank(s) && !options.pasteLink) continue;

          const t = d[R]?.[C] ?? null;
          const n: Cell = t ? _.cloneDeep(t) : {};

          if (options.pasteLink) {
            // =Sheet1!A1 (absolute for a single cell, like Excel)
            const body = formatRefBody({
              prefix: "",
              sheet: null,
              kind: "cell",
              r1: item.r,
              c1: item.c,
              r2: item.r,
              c2: item.c,
              ar1: singleSource,
              ac1: singleSource,
              ar2: singleSource,
              ac2: singleSource,
            });
            CONTENT_KEYS.forEach((k) => delete n[k]);
            delete (n as any).spill;
            delete (n as any).spillFrom;
            if (n.ct?.t === "inlineStr") n.ct = { fa: "General", t: "g" };
            if (t?.f) delFunctionGroup(ctx, R, C, dstId);
            n.f = `=${srcPrefix}${body}`;
            d[R][C] = n;
            formulaCells.push({ r: R, c: C });
            continue;
          }

          // formatting
          if (parts.styles === "all") {
            STYLE_KEYS.forEach((k) => {
              delete n[k];
              if (s && s[k] != null) (n as any)[k] = _.cloneDeep(s[k]);
            });
            if (s?.ct && s.ct.t !== "inlineStr") {
              n.ct = { ...(n.ct?.t === "inlineStr" ? {} : n.ct), fa: s.ct.fa };
            } else if (n.ct && n.ct.t !== "inlineStr") {
              // the source is General: drop the target's number format
              n.ct = { ...n.ct, fa: "General" };
            }
          } else if (parts.styles === "numberFormat") {
            if (n.ct?.t !== "inlineStr") {
              n.ct = { ...(n.ct || {}), fa: s?.ct?.fa ?? "General" };
            }
          }

          // content
          if (parts.content) {
            const srcFormula =
              parts.content === "formulas" && s?.f
                ? adjustCopiedFormula(s.f, item.r, item.c, R, C)
                : null;
            const sNum = srcFormula ? null : numericValue(s);
            const tNum = t?.f ? null : numericValue(t);
            const hadFormula = !!t?.f;

            let applied = false;
            if (operation !== "none") {
              const sym = OP_SYMBOL[operation];
              const srcIsText = !srcFormula && sNum == null;
              const tgtIsText = !t?.f && tNum == null;
              if (tgtIsText && !srcIsText) {
                // Excel leaves text targets alone
                applied = true;
              } else if (!srcIsText) {
                if (t?.f || srcFormula) {
                  const a = t?.f ? `(${t.f.slice(1)})` : numberLiteral(tNum!);
                  const b = srcFormula
                    ? `(${srcFormula.slice(1)})`
                    : numberLiteral(sNum!);
                  CONTENT_KEYS.forEach((k) => delete n[k]);
                  n.f = `=${a}${sym}${b}`;
                  formulaCells.push({ r: R, c: C });
                } else {
                  CONTENT_KEYS.forEach((k) => delete n[k]);
                  n.v = applyOperation(operation, tNum!, sNum!);
                  refreshDisplay(n);
                }
                applied = true;
              }
            }

            if (!applied) {
              CONTENT_KEYS.forEach((k) => delete n[k]);
              // spill tags follow the pasted content: a copied spilled cell
              // keeps its tag (reconcileSpills turns it into a value unless
              // its anchor was pasted too), the target's old tag goes
              delete (n as any).spill;
              delete (n as any).spillFrom;
              if (parts.content === "formulas" && (s as any)?.spillFrom) {
                (n as any).spillFrom = { ...(s as any).spillFrom };
              }
              if (n.ct?.t === "inlineStr") {
                n.ct = { fa: n.ct.fa ?? "General", t: "g" };
              }
              if (srcFormula) {
                n.f = srcFormula;
                formulaCells.push({ r: R, c: C });
              } else if (s?.ct?.t === "inlineStr") {
                n.ct = _.cloneDeep(s.ct);
              } else if (s?.img) {
                // a picture (placed, or an IMAGE() result pasted as a value)
                applyCellImage(n, s.img);
              } else if (s && s.v != null) {
                n.v = s.v;
                if (s.qp != null && parts.content === "formulas") n.qp = s.qp;
                if (s.ct?.t && (!n.ct || n.ct.fa === s.ct.fa)) {
                  n.ct = {
                    ...(n.ct || {}),
                    fa: n.ct?.fa ?? "General",
                    t: s.ct.t,
                  };
                }
                refreshDisplay(n);
              }
            }
            if (hadFormula && !n.f) delFunctionGroup(ctx, R, C, dstId);
          } else if (parts.styles && n.v != null && !n.f) {
            refreshDisplay(n);
          }

          if (parts.comments) {
            if (s?.ps) n.ps = _.cloneDeep(s.ps);
            else delete n.ps;
          }

          // merges are rebuilt below
          if (parts.merges) delete n.mc;
          if (parts.merges && s?.mc?.rs != null) {
            const rs = options.transpose ? s.mc.cs ?? 1 : s.mc.rs;
            const cs = options.transpose ? s.mc.rs : s.mc.cs ?? 1;
            if (!cfg.merge) cfg.merge = {};
            cfg.merge[`${R}_${C}`] = { r: R, c: C, rs, cs };
          }

          if (needBorders) {
            let bd = srcBorders[`${item.r}_${item.c}`];
            if (bd && options.transpose) {
              bd = { ...bd, l: bd.t, t: bd.l, r: bd.b, b: bd.r };
            }
            const entries = borderEntriesForCell(bd, R, C);
            if (entries.length > 0) {
              cfg.borderInfo = [...(cfg.borderInfo || []), ...entries];
            }
          }

          if (parts.validation) {
            const src = srcDV[`${item.r}_${item.c}`];
            if (!dstFile.dataVerification) dstFile.dataVerification = {};
            if (src) dstFile.dataVerification[`${R}_${C}`] = _.cloneDeep(src);
            else delete dstFile.dataVerification[`${R}_${C}`];
          }

          if (parts.links) {
            const src = srcLinks[`${item.r}_${item.c}`];
            if (src) {
              if (!dstFile.hyperlink) dstFile.hyperlink = {};
              dstFile.hyperlink[`${R}_${C}`] = _.cloneDeep(src);
            } else if (dstFile.hyperlink) {
              delete dstFile.hyperlink[`${R}_${C}`];
            }
          }

          if (
            n.ct &&
            n.ct.t !== "inlineStr" &&
            (n.ct.fa ?? "General") === "General" &&
            n.v == null &&
            !n.f
          ) {
            delete n.ct;
          }
          if (touchesContent || parts.comments || parts.merges) {
            d[R][C] = _.isEmpty(n) ? null : n;
          }
        }
      }
    }
  }

  // merged areas: mark the covered cells
  if (parts.merges && cfg.merge) {
    _.forEach(cfg.merge, (mc) => {
      if (mc.r < minh || mc.r > maxh || mc.c < minc || mc.c > maxc) return;
      for (let { r } = mc; r < mc.r + mc.rs; r += 1) {
        for (let { c } = mc; c < mc.c + mc.cs; c += 1) {
          if (!d[r]) continue;
          if (r === mc.r && c === mc.c) {
            d[r][c] = { ...(d[r][c] || {}), mc: { ...mc } };
          } else {
            d[r][c] = { ...(d[r][c] || {}), mc: { r: mc.r, c: mc.c } };
          }
        }
      }
    });
  }

  // conditional formats: rules covering the copied cells are copied along
  if (parts.cf && block.range && srcCF.length > 0) {
    const src = block.range;
    const added: any[] = [];
    srcCF.forEach((rule: any) => {
      const ranges: any[] = [];
      (rule.cellrange || []).forEach((cr: any) => {
        const r1 = Math.max(cr.row[0], src.row[0]);
        const r2 = Math.min(cr.row[1], src.row[1]);
        const c1 = Math.max(cr.column[0], src.column[0]);
        const c2 = Math.min(cr.column[1], src.column[1]);
        if (r1 > r2 || c1 > c2) return;
        // position inside the copied block (hidden rows/cols ignored)
        let [i1, i2, j1, j2] = [
          r1 - src.row[0],
          r2 - src.row[0],
          c1 - src.column[0],
          c2 - src.column[0],
        ];
        if (options.transpose) [i1, i2, j1, j2] = [j1, j2, i1, i2];
        for (let th = 0; th < timesH; th += 1) {
          for (let tw = 0; tw < timesW; tw += 1) {
            ranges.push({
              row: [minh + th * bh + i1, minh + th * bh + i2],
              column: [minc + tw * bw + j1, minc + tw * bw + j2],
            });
          }
        }
      });
      if (ranges.length > 0) added.push({ ...rule, cellrange: ranges });
    });
    if (added.length > 0) {
      dstFile.luckysheet_conditionformat_save = [
        ...(dstFile.luckysheet_conditionformat_save || []),
        ...added,
      ];
    }
  }

  // column widths
  if (parts.colWidths) {
    const cols = options.transpose
      ? block.items.map((row) => row[0].r)
      : block.items[0].map((it) => it.c);
    if (!options.transpose) {
      for (let tw = 0; tw < timesW; tw += 1) {
        cols.forEach((sc, j) => {
          const C = minc + tw * bw + j;
          if (!cfg.columnlen) cfg.columnlen = {};
          if (srcColLen[sc] != null) cfg.columnlen[C] = srcColLen[sc];
          else delete cfg.columnlen[C];
          if (srcCustomWidth[sc] != null) {
            if (!cfg.customWidth) cfg.customWidth = {};
            cfg.customWidth[C] = srcCustomWidth[sc];
          }
        });
      }
    }
  }

  // evaluate pasted formulas, then recalculate their dependents
  formulaCells.forEach(({ r, c }) => {
    const cell = d[r][c];
    if (!cell?.f) return;
    const res = execfunction(ctx, cell.f, r, c, dstId, undefined, true);
    [, cell.v, cell.f] = res;
    refreshDisplay(cell);
  });

  dstFile.config = cfg;
  if (dstId === ctx.currentSheetId) ctx.config = cfg;

  last.row = [minh, maxh];
  last.column = [minc, maxc];
  if (parts.content || options.pasteLink || operation !== "none") {
    jfrefreshgrid(ctx, d as CellMatrix, [
      { row: [minh, maxh], column: [minc, maxc] },
    ]);
  }
  // pasted formulas spill; pasted spilled cells without their anchor are values
  reconcileSpills(ctx, dstId, {
    pasted: [{ row: [minh, maxh], column: [minc, maxc] }],
  });
  return true;
}
