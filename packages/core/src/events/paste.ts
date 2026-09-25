import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { locale } from "../locale";
import { delFunctionGroup, execfunction } from "../modules/formula";
import { update } from "../modules/format";
import { resolveTypedInput } from "../modules/inputParse";
import { selectionCache } from "../modules/selection";
import { Cell } from "../types";
import { getSheetIndex, isAllowEdit } from "../utils";
import { expandRowsAndColumns } from "../modules/sheet";
import { jfrefreshgrid } from "../modules/refresh";
import { reconcileSpills } from "../modules/spill";
import {
  clipboardState,
  getClipboardToken,
  parseClipboardHtml,
  parseTsv,
  ParsedClipboard,
} from "../modules/clipboard";
import {
  liveSheetConfig,
  moveCellRange,
  rangeCutsMerge,
  stripBorders,
} from "../modules/moveCells";
import { pasteSpecial, PasteSpecialOptions } from "../modules/pasteSpecial";

type Rect = { row: [number, number]; column: [number, number] };

/** Top-left cell of the paste target (the active selection). */
function pasteAnchor(ctx: Context) {
  const sel = ctx.luckysheet_select_save;
  if (!sel || sel.length !== 1) return null;
  return { r: sel[0].row[0], c: sel[0].column[0] };
}

function selectPasted(ctx: Context, rect: Rect) {
  const last = ctx.luckysheet_select_save?.[0];
  if (!last) return;
  last.row = [rect.row[0], rect.row[1]];
  last.column = [rect.column[0], rect.column[1]];
}

/**
 * Cut + paste: move the cut cells to the selection (Excel semantics: the
 * moved formulas keep their text and every reference to the moved cells, on
 * any sheet, follows them). See moveCellRange.
 */
function pasteHandlerOfCutPaste(
  ctx: Context,
  copyRange: Context["luckysheet_copy_save"]
) {
  if (!isAllowEdit(ctx) || !copyRange) return;
  const anchor = pasteAnchor(ctx);
  if (!anchor || copyRange.copyRange.length !== 1) return;
  const [src] = copyRange.copyRange;
  const range: Rect = {
    row: [src.row[0], src.row[1]],
    column: [src.column[0], src.column[1]],
  };
  try {
    moveCellRange(
      ctx,
      { sheetId: copyRange.dataSheetId, range },
      { sheetId: ctx.currentSheetId, row: anchor.r, column: anchor.c }
    );
  } catch (e) {
    // the source or the target would cut a merged area
    return;
  }
  selectPasted(ctx, {
    row: [anchor.r, anchor.r + range.row[1] - range.row[0]],
    column: [anchor.c, anchor.c + range.column[1] - range.column[0]],
  });
}

/** Paste our own copy (formulas with adjusted references). */
function pasteHandlerOfCopyPaste(
  ctx: Context,
  copyRange: Context["luckysheet_copy_save"],
  options: PasteSpecialOptions = {}
) {
  if (!isAllowEdit(ctx) || !copyRange) return;
  pasteSpecial(ctx, options);
}

/**
 * Paste cells parsed from foreign HTML (Excel, Google Sheets, ...): values,
 * formats, merges and borders replace the target block.
 */
function pasteHandler(ctx: Context, parsed: ParsedClipboard) {
  if (!isAllowEdit(ctx)) return;
  const anchor = pasteAnchor(ctx);
  if (!anchor) return;
  const { cells, borders } = parsed;
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  if (h === 0 || w === 0) return;
  const d = getFlowdata(ctx);
  if (!d) return;
  const cfg = liveSheetConfig(ctx, ctx.currentSheetId);
  const target: Rect = {
    row: [anchor.r, anchor.r + h - 1],
    column: [anchor.c, anchor.c + w - 1],
  };
  if (rangeCutsMerge(cfg.merge || {}, target)) return;

  const addr = target.row[1] - d.length + 1;
  const addc = target.column[1] - (d[0]?.length ?? 0) + 1;
  if (addr > 0 || addc > 0) {
    expandRowsAndColumns(d, Math.max(addr, 0), Math.max(addc, 0));
  }

  _.forEach(cfg.merge, (mc, key) => {
    if (
      mc.r >= target.row[0] &&
      mc.r <= target.row[1] &&
      mc.c >= target.column[0] &&
      mc.c <= target.column[1]
    ) {
      delete cfg.merge![key];
    }
  });
  cfg.borderInfo = stripBorders(cfg.borderInfo, target);

  for (let i = 0; i < h; i += 1) {
    for (let j = 0; j < w; j += 1) {
      const R = anchor.r + i;
      const C = anchor.c + j;
      if (d[R][C]?.f) delFunctionGroup(ctx, R, C, ctx.currentSheetId);
      const src = cells[i][j];
      const cell: Cell | null = src ? _.cloneDeep(src) : null;
      if (cell?.mc) {
        cell.mc = {
          ...cell.mc,
          r: cell.mc.r + anchor.r,
          c: cell.mc.c + anchor.c,
        };
        if (cell.mc.rs != null) {
          if (!cfg.merge) cfg.merge = {};
          cfg.merge[`${cell.mc.r}_${cell.mc.c}`] = {
            r: cell.mc.r,
            c: cell.mc.c,
            rs: cell.mc.rs,
            cs: cell.mc.cs ?? 1,
          };
        }
      }
      d[R][C] = cell;
      const bd = borders[`${i}_${j}`];
      if (bd && (bd.l || bd.r || bd.t || bd.b)) {
        if (!cfg.borderInfo) cfg.borderInfo = [];
        cfg.borderInfo.push({
          rangeType: "cell",
          value: {
            row_index: R,
            col_index: C,
            l: bd.l,
            r: bd.r,
            t: bd.t,
            b: bd.b,
          },
        });
      }
    }
  }

  const file = ctx.luckysheetfile[getSheetIndex(ctx, ctx.currentSheetId)!];
  file.config = cfg;
  ctx.config = cfg;
  selectPasted(ctx, target);
  jfrefreshgrid(ctx, null, [target]);
  reconcileSpills(ctx, ctx.currentSheetId, { pasted: [target] });
}

/**
 * Paste plain text (TSV): every field is typed into its cell like Excel
 * does: numbers, dates, percentages and booleans are recognised, a leading
 * `=` makes a formula, and the target cells keep their formatting (a Text
 * formatted cell keeps the text as is).
 */
function pasteTextHandler(ctx: Context, rows: string[][]) {
  if (!isAllowEdit(ctx)) return;
  const anchor = pasteAnchor(ctx);
  if (!anchor || rows.length === 0 || rows[0].length === 0) return;
  const d = getFlowdata(ctx);
  if (!d) return;
  const cfg = liveSheetConfig(ctx, ctx.currentSheetId);
  const h = rows.length;
  const w = rows[0].length;
  const target: Rect = {
    row: [anchor.r, anchor.r + h - 1],
    column: [anchor.c, anchor.c + w - 1],
  };
  if (rangeCutsMerge(cfg.merge || {}, target)) return;

  const addr = target.row[1] - d.length + 1;
  const addc = target.column[1] - (d[0]?.length ?? 0) + 1;
  if (addr > 0 || addc > 0) {
    expandRowsAndColumns(d, Math.max(addr, 0), Math.max(addc, 0));
  }

  const formulas: { r: number; c: number }[] = [];
  for (let i = 0; i < h; i += 1) {
    for (let j = 0; j < w; j += 1) {
      const R = anchor.r + i;
      const C = anchor.c + j;
      const raw = rows[i][j] ?? "";
      const old = d[R][C];
      if (old?.f) delFunctionGroup(ctx, R, C, ctx.currentSheetId);
      const cell: Cell = old ? _.cloneDeep(old) : {};
      delete cell.v;
      delete cell.m;
      delete cell.f;
      delete cell.spl;
      delete cell.qp;
      if (cell.ct?.t === "inlineStr") cell.ct = { fa: "General", t: "g" };

      const fa = cell.ct?.fa;
      if (raw.length > 1 && raw[0] === "=" && fa !== "@") {
        cell.f = raw;
        formulas.push({ r: R, c: C });
      } else if (raw !== "") {
        let text = raw;
        let forceText = fa === "@";
        if (text[0] === "'") {
          text = text.slice(1);
          forceText = true;
        }
        if (forceText) {
          cell.v = text;
          cell.m = text;
          cell.ct = { ...(cell.ct || {}), fa: fa ?? "General", t: "s" };
          if (raw[0] === "'") cell.qp = 1;
        } else {
          const typed = resolveTypedInput(text, fa);
          cell.v = typed.v;
          cell.ct = { ...(cell.ct || {}), fa: typed.fa, t: typed.t };
          if (typeof typed.v === "number") cell.m = update(typed.fa, typed.v);
          else if (typeof typed.v === "boolean") {
            cell.m = typed.v ? "TRUE" : "FALSE";
          } else cell.m = String(typed.v);
          if (typeof typed.v === "string" && typed.v.indexOf("\n") >= 0) {
            cell.tb = "2";
          }
        }
      }
      d[R][C] = _.isEmpty(cell) ? null : cell;
    }
  }

  formulas.forEach(({ r, c }) => {
    const cell = d[r][c]!;
    const res = execfunction(ctx, cell.f!, r, c, undefined, undefined, true);
    [, cell.v, cell.f] = res;
    const cfa = cell.ct?.fa ?? "General";
    cell.m = cell.v == null ? "" : update(cfa, cell.v);
  });

  selectPasted(ctx, target);
  jfrefreshgrid(ctx, null, [target]);
  reconcileSpills(ctx, ctx.currentSheetId, { pasted: [target] });
}

/** Whether the clipboard holds this page's current copy. */
function isOwnCopy(ctx: Context, html: string, text: string) {
  const save = ctx.luckysheet_copy_save;
  if (!save?.copyRange?.length || !clipboardState.token) return false;
  const token = getClipboardToken(html);
  if (token) return token === clipboardState.token;
  // plain text only (e.g. the context menu reads text): compare with what
  // the last copy wrote
  return !!text && text === clipboardState.text;
}

/** Whether this page holds a copy (or an unpasted cut) to paste. */
function hasPendingOwnCopy(ctx: Context) {
  return (
    !!ctx.luckysheet_copy_save?.copyRange?.length &&
    !!clipboardState.token &&
    clipboardState.token !== clipboardState.consumedCutToken
  );
}

function pasteOwnCopy(ctx: Context) {
  if (ctx.luckysheet_paste_iscut) {
    ctx.luckysheet_paste_iscut = false;
    pasteHandlerOfCutPaste(ctx, ctx.luckysheet_copy_save);
    // a cut is pasted only once (Excel)
    clipboardState.consumedCutToken = clipboardState.token;
    ctx.luckysheet_copy_save = undefined;
    ctx.luckysheet_selection_range = [];
  } else {
    pasteHandlerOfCopyPaste(ctx, ctx.luckysheet_copy_save);
  }
}

/**
 * Paste clipboard content: our own copy (formulas adjusted, cut = move),
 * then foreign HTML tables, then plain text (TSV).
 */
export function pasteClipboardContent(
  ctx: Context,
  html: string,
  text: string,
  files?: FileList | File[]
) {
  if (isOwnCopy(ctx, html, text)) {
    pasteOwnCopy(ctx);
    return;
  }
  const token = getClipboardToken(html);
  if (token && token === clipboardState.consumedCutToken) return;
  if (html && html.indexOf("fortune-copy-action-image") > -1) return;

  if (html && html.toLowerCase().indexOf("<table") > -1) {
    const parsed = parseClipboardHtml(html, {
      fontjson: locale(ctx).fontjson as Record<string, number>,
    });
    if (parsed) {
      ctx.luckysheet_selection_range = [];
      pasteHandler(ctx, parsed);
      return;
    }
  }
  if (files && files.length === 1 && files[0].type.indexOf("image") > -1) {
    // images are not pasted into cells
    return;
  }
  if (text) pasteTextHandler(ctx, parseTsv(text));
}

export function handlePaste(ctx: Context, e: ClipboardEvent) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;

  if (selectionCache.isPasteAction) {
    ctx.luckysheetCellUpdate = [];
    selectionCache.isPasteAction = false;

    let { clipboardData } = e;
    if (!clipboardData) {
      // @ts-ignore
      // for IE
      clipboardData = window.clipboardData;
    }
    if (!clipboardData) return;

    const html = clipboardData.getData("text/html") || "";
    const text = clipboardData.getData("text/plain") || "";
    const txtdata = html || text;

    if (
      ctx.hooks.beforePaste?.(ctx.luckysheet_select_save, txtdata) === false
    ) {
      return;
    }
    pasteClipboardContent(ctx, html, text, clipboardData.files);
  } else if (ctx.luckysheetCellUpdate.length > 0) {
    // editing a cell: paste plain text only
    e.preventDefault();

    let { clipboardData } = e;
    if (!clipboardData) {
      // for IE
      // @ts-ignore
      clipboardData = window.clipboardData;
    }
    const text = clipboardData?.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
    }
  }
}

/**
 * Paste from the context menu, where only the plain text of the clipboard
 * can be read (navigator.clipboard.readText, or the session fallback).
 */
export function handlePasteByClick(
  ctx: Context,
  clipboardData: string,
  triggerType?: string
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;

  if (
    ctx.hooks.beforePaste?.(ctx.luckysheet_select_save, clipboardData) === false
  ) {
    return;
  }

  if (isOwnCopy(ctx, "", clipboardData)) {
    pasteOwnCopy(ctx);
  } else if (!clipboardData && hasPendingOwnCopy(ctx)) {
    // the system clipboard couldn't be read (permission denied, no API):
    // paste this page's last copy, like the old in-page clipboard did
    pasteOwnCopy(ctx);
  } else if (triggerType !== "btn" && clipboardData) {
    pasteTextHandler(ctx, parseTsv(clipboardData));
  }
}

/**
 * Paste Special from the internal clipboard (the last copy of this page).
 * Returns false when there is no copied range to paste from.
 */
export function handlePasteSpecial(ctx: Context, options: PasteSpecialOptions) {
  if (!isAllowEdit(ctx)) return false;
  if (!ctx.luckysheet_copy_save?.copyRange?.length) return false;
  if (ctx.luckysheet_paste_iscut) {
    // Excel offers only a plain paste for a cut
    pasteOwnCopy(ctx);
    return true;
  }
  return pasteSpecial(ctx, options);
}

/**
 * Open the Paste Special dialog (Ctrl+Alt+V / Ctrl+Shift+V). Returns false
 * when there is no copied range to paste from, so the caller can fall back
 * to a normal paste.
 */
export function openPasteSpecial(ctx: Context) {
  if (!isAllowEdit(ctx)) return false;
  if (!ctx.luckysheet_copy_save?.copyRange?.length) return false;
  if ((ctx.luckysheet_select_save?.length ?? 0) !== 1) return false;
  ctx.showPasteSpecial = true;
  return true;
}
