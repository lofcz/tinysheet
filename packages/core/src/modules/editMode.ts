/**
 * Excel's cell editing modes, shown in the status bar:
 *
 * - **Ready**: not editing.
 * - **Enter**: editing started by typing. Arrow keys commit the entry and
 *   move the active cell, except in a formula at a position where a
 *   reference can go (after `=`, `(`, `,` or an operator): there they switch
 *   to Point mode.
 * - **Edit**: editing started with F2, a double-click or in the formula bar.
 *   Arrow keys, Home and End move the caret.
 * - **Point**: arrow keys pick the reference being inserted into the formula
 *   (Shift extends it to a range, Ctrl jumps to the edge of the data).
 *
 * F2 toggles between Edit and Enter/Point.
 *
 * The mode belongs to the edit session: {@link EditState} records the cell
 * it was set for, so a session started by some other path (a toolbar
 * button, the data validation dropdown...) reads as Edit mode.
 */
import type { Context } from "../context";
import { getRangetxt } from "./cell";
import { handleFormulaInput } from "./formula";
import {
  getCaretOffset,
  setCaretOffset,
  tokenizeFormula,
} from "./formulaEditor";
import {
  expandRangeForMerges,
  findDataEdge,
  getSheetNavInfo,
  nextVisibleIndex,
  NavDirection,
  SheetNavInfo,
  SimpleRange,
} from "./navigation";
import { scrollToHighlightCell } from "./selection";

export type EditMode = "ready" | "enter" | "edit" | "point";

export type PointState = {
  /** text offsets of the reference being pointed at in the editor */
  start: number;
  end: number;
  /** the reference text inserted at [start, end) */
  text: string;
  /** fixed corner and moving corner of the pointed range */
  anchor: [number, number];
  focus: [number, number];
};

export type EditState = {
  mode: "enter" | "edit";
  /** the cell and sheet of the edit session this mode belongs to */
  cell: [number, number];
  sheetId: string;
  /** set while arrow keys are picking a reference */
  point?: PointState;
};

function sessionState(ctx: Context): EditState | undefined {
  const [r, c] = ctx.luckysheetCellUpdate ?? [];
  const s = ctx.editState;
  if (
    r == null ||
    !s ||
    s.sheetId !== ctx.currentSheetId ||
    s.cell[0] !== r ||
    s.cell[1] !== c
  ) {
    return undefined;
  }
  return s;
}

/** The mode shown in the status bar. */
export function getEditMode(ctx: Context): EditMode {
  if (!ctx.luckysheetCellUpdate || ctx.luckysheetCellUpdate.length === 0) {
    return "ready";
  }
  const fc = ctx.formulaCache;
  if (fc?.rangestart || fc?.rangedrag_column_start || fc?.rangedrag_row_start)
    return "point";
  const s = sessionState(ctx);
  if (!s) return "edit";
  if (s.point) return "point";
  return s.mode;
}

/** Sets the mode of the current edit session (call after starting it). */
export function setEditMode(ctx: Context, mode: "enter" | "edit") {
  const [r, c] = ctx.luckysheetCellUpdate ?? [];
  if (r == null || c == null) return;
  ctx.editState = { mode, cell: [r, c], sheetId: ctx.currentSheetId };
}

/** Forgets the mode (the session ended). */
export function clearEditMode(ctx: Context) {
  if (ctx.editState) ctx.editState = undefined;
}

/** Ends Point mode (e.g. an operator was typed); the next arrow starts over. */
export function endPointMode(ctx: Context) {
  const s = sessionState(ctx);
  if (s?.point) s.point = undefined;
}

/**
 * F2 while editing: Edit mode switches to Enter mode (arrows then commit or
 * point), Enter and Point mode switch to Edit mode.
 */
export function toggleEditMode(ctx: Context) {
  const mode = getEditMode(ctx);
  setEditMode(ctx, mode === "edit" ? "enter" : "edit");
}

/** Text right of the caret that a reference inserted there would run into. */
const TOKEN_CONTINUATION = /^[A-Za-z0-9_.$!'"#{(\u00C0-\uFFFF]/;

/**
 * True when `caret` in formula `text` is where a reference can be inserted:
 * right after `=`, `(`, `,` or an operator (spaces allowed), and not in the
 * middle of a token.
 */
export function isReferenceInsertPosition(text: string, caret: number) {
  if (!text.startsWith("=") || caret < 1 || caret > text.length) return false;
  const after = text.slice(caret);
  if (TOKEN_CONTINUATION.test(after)) return false;
  const before = text.slice(0, caret).replace(/\s+$/, "");
  const tokens = tokenizeFormula(before);
  const last = tokens[tokens.length - 1];
  if (!last) return false;
  if (last.type === "lparen" || last.type === "comma") return true;
  return last.type === "operator" && last.text !== "%";
}

function editorText(editor: HTMLElement) {
  return editor.textContent ?? "";
}

/** The reference text for `range` on the current sheet (`A1`, `B2:C5`). */
function referenceText(ctx: Context, range: SimpleRange) {
  return getRangetxt(ctx, ctx.currentSheetId, range, ctx.currentSheetId);
}

function stepCell(
  info: SheetNavInfo,
  [r, c]: [number, number],
  direction: NavDirection,
  jump: boolean
): [number, number] {
  const vertical = direction === "up" || direction === "down";
  const dir = direction === "down" || direction === "right" ? 1 : -1;
  const length = vertical ? info.rows : info.cols;
  const isHidden = vertical ? info.isRowHidden : info.isColHidden;
  const block = info.blockAt(r, c);
  if (vertical) {
    const from = dir > 0 ? block.row[1] : block.row[0];
    const next = jump
      ? findDataEdge(from, dir, length, (i) => info.isFilled(i, c), isHidden)
      : nextVisibleIndex(from, dir, length, isHidden);
    return [next ?? r, c];
  }
  const from = dir > 0 ? block.column[1] : block.column[0];
  const next = jump
    ? findDataEdge(from, dir, length, (i) => info.isFilled(r, i), isHidden)
    : nextVisibleIndex(from, dir, length, isHidden);
  return [r, next ?? c];
}

/** The point state still matching the editor text and caret, if any. */
function livePoint(
  ctx: Context,
  text: string,
  caret: number
): PointState | undefined {
  const point = sessionState(ctx)?.point;
  if (
    point &&
    caret === point.end &&
    text.slice(point.start, point.end) === point.text
  ) {
    return point;
  }
  return undefined;
}

/**
 * Whether an arrow key in `editor` would pick a reference (Point mode)
 * rather than commit or move the caret.
 */
export function canPointAt(ctx: Context, editor: HTMLElement) {
  const text = editorText(editor);
  if (!text.startsWith("=")) return false;
  const caret = getCaretOffset(editor) ?? text.length;
  return (
    !!livePoint(ctx, text, caret) || isReferenceInsertPosition(text, caret)
  );
}

/**
 * Point mode: inserts or moves the reference at the caret for an arrow key.
 * `extend` (Shift) grows the range from its anchor, `jump` (Ctrl) moves to
 * the edge of the data region. `copyTo` is the other editor to mirror the
 * text to. Returns false when the caret is not at a reference position.
 */
export function movePointReference(
  ctx: Context,
  editor: HTMLDivElement,
  copyTo: HTMLDivElement | null | undefined,
  direction: NavDirection,
  extend = false,
  jump = false
): boolean {
  const text = editorText(editor);
  if (!text.startsWith("=")) return false;
  const caret = getCaretOffset(editor) ?? text.length;
  let point = livePoint(ctx, text, caret);
  if (!point) {
    if (!isReferenceInsertPosition(text, caret)) return false;
    const [r, c] = ctx.luckysheetCellUpdate;
    // the first reference starts from the cell being edited
    point = {
      start: caret,
      end: caret,
      text: "",
      anchor: [r, c],
      focus: [r, c],
    };
  }
  const info = getSheetNavInfo(ctx);
  if (!info) return false;

  const focus = stepCell(info, point.focus, direction, jump);
  const anchor: [number, number] = extend ? point.anchor : focus;
  let range: SimpleRange = {
    row: [Math.min(anchor[0], focus[0]), Math.max(anchor[0], focus[0])],
    column: [Math.min(anchor[1], focus[1]), Math.max(anchor[1], focus[1])],
  };
  // a merged cell is referenced by its top-left cell, a range covers merges
  if (range.row[0] === range.row[1] && range.column[0] === range.column[1]) {
    const block = info.blockAt(focus[0], focus[1]);
    range = {
      row: [block.row[0], block.row[0]],
      column: [block.column[0], block.column[0]],
    };
  } else {
    range = expandRangeForMerges(range, info.merges);
  }
  const ref = referenceText(ctx, range);
  if (!ref) return false;

  const next = text.slice(0, point.start) + ref + text.slice(point.end);
  editor.textContent = next;
  setCaretOffset(editor, point.start + ref.length);
  handleFormulaInput(ctx, copyTo, editor, 0, text);

  if (!sessionState(ctx)) setEditMode(ctx, "enter");
  const s = ctx.editState!;
  s.point = {
    start: point.start,
    end: point.start + ref.length,
    text: ref,
    anchor,
    focus,
  };
  scrollToHighlightCell(ctx, focus[0], focus[1]);
  return true;
}

export type EditorArrowAction = "caret" | "point" | "commit";

/**
 * What an arrow key does while editing in `editor`: move the caret (Edit
 * mode, the formula bar, modified keys outside Point mode), pick a reference
 * (Point mode) or commit and move the active cell (Enter mode).
 */
export function getEditorArrowAction(
  ctx: Context,
  e: Pick<KeyboardEvent, "key" | "altKey" | "metaKey" | "ctrlKey" | "shiftKey">,
  editor: HTMLElement | null | undefined,
  isFormulaBar = false
): EditorArrowAction {
  if (!editor || e.altKey || e.metaKey || isFormulaBar) return "caret";
  const mode = getEditMode(ctx);
  if (mode === "ready" || mode === "edit") return "caret";
  if (canPointAt(ctx, editor)) return "point";
  if (e.ctrlKey || e.shiftKey) return "caret";
  return "commit";
}
