/**
 * Find & Replace with Excel's options:
 * - Within: the sheet (the selection when more than one cell is selected) or
 *   the whole workbook (visible sheets, in tab order).
 * - Search: by rows or by columns.
 * - Look in: formulas (formula text, or the value as entered), values (the
 *   displayed text) or notes.
 * - Match case, match entire cell contents, and wildcards: `*` any run of
 *   characters, `?` one character, `~*` / `~?` / `~~` the literal character.
 * - Find Next / Find Previous start from the active cell and wrap around;
 *   Find All lists every match; Replace replaces the active match and moves
 *   to the next one; Replace All reports the number of replacements.
 */
import _ from "lodash";

import { Context, getFlowdata } from "../context";
import { locale } from "../locale";
import { Cell, CellMatrix, GlobalCache, SearchResult, Sheet } from "../types";
import { chatatABC, getSheetIndex, isAllowEdit, replaceHtml } from "../utils";
import { updateCell } from "./cell";
import { recalculate } from "./formulaHelper";
import { selectRangesOnSheet } from "./goTo";
import { SimpleRange } from "./navigation";
import { normalizeSelection, scrollToHighlightCell } from "./selection";

export type FindOptions = {
  matchCase?: boolean;
  matchEntire?: boolean;
  /** Treat the search text as a JavaScript regular expression. */
  regex?: boolean;
  scope?: "sheet" | "workbook";
  searchBy?: "rows" | "columns";
  lookIn?: "formulas" | "values" | "notes";
};

/** Legacy option names (FortuneSheet dialog). */
export type LegacyCheckModes = {
  regCheck?: boolean;
  wordCheck?: boolean;
  caseCheck?: boolean;
};

export type FindMatch = SearchResult & {
  /** Formula text of the cell, when it has one. */
  formula?: string;
};

function normalizeOptions(o: FindOptions & LegacyCheckModes = {}) {
  return {
    matchCase: !!(o.matchCase ?? o.caseCheck),
    matchEntire: !!(o.matchEntire ?? o.wordCheck),
    regex: !!(o.regex ?? o.regCheck),
    scope: o.scope ?? "sheet",
    searchBy: o.searchBy ?? "rows",
    lookIn: o.lookIn ?? "values",
  } as Required<FindOptions>;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Excel wildcard pattern to a RegExp source (`~` escapes `*`, `?`, `~`). */
export function wildcardToRegExpSource(pattern: string) {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (
      ch === "~" &&
      i + 1 < pattern.length &&
      "*?~".includes(pattern[i + 1])
    ) {
      out += _.escapeRegExp(pattern[i + 1]);
      i += 1;
    } else if (ch === "*") {
      out += "[\\s\\S]*";
    } else if (ch === "?") {
      out += "[\\s\\S]";
    } else {
      out += _.escapeRegExp(ch);
    }
  }
  return out;
}

export type Matcher = {
  test: (text: string) => boolean;
  /** The text with matches replaced (whole text when matching entirely). */
  replace: (text: string, replacement: string) => string;
};

export function createMatcher(
  searchText: string,
  options: FindOptions & LegacyCheckModes = {}
): Matcher | null {
  if (searchText == null || searchText === "") return null;
  const o = normalizeOptions(options);
  let source: string;
  if (o.regex) {
    try {
      // validate
      // eslint-disable-next-line no-new
      new RegExp(searchText);
    } catch (e) {
      return null;
    }
    source = searchText;
  } else {
    source = wildcardToRegExpSource(searchText);
  }
  const flags = o.matchCase ? "" : "i";
  if (o.matchEntire) {
    const re = new RegExp(`^(?:${source})$`, flags);
    return {
      test: (text) => re.test(text),
      replace: (text, replacement) => (re.test(text) ? replacement : text),
    };
  }
  const re = new RegExp(source, flags);
  const reAll = new RegExp(source, `${flags}g`);
  return {
    test: (text) => re.test(text),
    replace: (text, replacement) => text.replace(reAll, () => replacement),
  };
}

function inlineText(cell: Cell) {
  return (cell.ct?.s ?? []).map((x: any) => x?.v ?? "").join("");
}

/** Raw value as it would appear in the formula bar. */
function enteredText(cell: Cell): string | null {
  if (cell.f) return cell.f;
  if (cell.ct?.t === "inlineStr") return inlineText(cell);
  if (cell.v == null) return null;
  if (cell.ct?.t === "d" && cell.m != null) return String(cell.m);
  if (typeof cell.v === "boolean") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

/** Displayed text of a cell. */
function displayedText(cell: Cell): string | null {
  if (cell.ct?.t === "inlineStr") return inlineText(cell);
  if (cell.m != null) return String(cell.m);
  if (cell.v == null) return null;
  if (typeof cell.v === "boolean") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

/** The text Find looks at for a cell, or null to skip the cell. */
export function getCellSearchText(
  cell: Cell | null | undefined,
  lookIn: FindOptions["lookIn"] = "values"
): string | null {
  if (!cell) return null;
  if (lookIn === "notes") return cell.ps?.value ?? null;
  const text = lookIn === "formulas" ? enteredText(cell) : displayedText(cell);
  return text == null || text === "" ? null : text;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function orderedVisibleSheets(ctx: Context) {
  return _.sortBy(
    ctx.luckysheetfile.filter((s) => s.hide !== 1),
    (s) => Number(s.order ?? 0)
  );
}

function isMultiCellSelection(ctx: Context) {
  const sel = ctx.luckysheet_select_save ?? [];
  if (sel.length === 0) return false;
  if (sel.length > 1) return true;
  const [s] = sel;
  if (s.row[0] === s.row[1] && s.column[0] === s.column[1]) return false;
  const data = getFlowdata(ctx);
  const m = data?.[s.row[0]]?.[s.column[0]]?.mc;
  const isMerge =
    !!m &&
    m.rs != null &&
    m.cs != null &&
    s.row[1] === m.r + m.rs - 1 &&
    s.column[1] === m.c + m.cs - 1;
  return !isMerge;
}

type SheetScope = { sheet: Sheet; ranges: SimpleRange[] | null };

/** The sheets and ranges a search covers (null ranges: the whole sheet). */
function searchScopes(ctx: Context, o: Required<FindOptions>): SheetScope[] {
  if (o.scope === "workbook") {
    return orderedVisibleSheets(ctx).map((sheet) => ({ sheet, ranges: null }));
  }
  const i = getSheetIndex(ctx, ctx.currentSheetId);
  if (i == null) return [];
  const sheet = ctx.luckysheetfile[i];
  if (isMultiCellSelection(ctx)) {
    return [
      {
        sheet,
        ranges: (ctx.luckysheet_select_save ?? []).map((s) => ({
          row: [s.row[0], s.row[1]] as [number, number],
          column: [s.column[0], s.column[1]] as [number, number],
        })),
      },
    ];
  }
  return [{ sheet, ranges: null }];
}

function cellMatch(
  sheet: Sheet,
  data: CellMatrix,
  r: number,
  c: number,
  matcher: Matcher,
  lookIn: FindOptions["lookIn"]
): FindMatch | null {
  const cell = data[r]?.[c];
  if (!cell) return null;
  if (cell.mc && (cell.mc.r !== r || cell.mc.c !== c)) return null;
  const text = getCellSearchText(cell, lookIn);
  if (text == null || !matcher.test(text)) return null;
  const match: FindMatch = {
    r,
    c,
    sheetId: sheet.id!,
    sheetName: sheet.name,
    cellPosition: `${chatatABC(c)}${r + 1}`,
    value: displayedText(cell) ?? "",
  };
  if (cell.f) match.formula = cell.f;
  return match;
}

/**
 * Every match in search order (sheet by sheet; within a sheet by rows or by
 * columns). Does not change the selection.
 */
export function findAllMatches(
  ctx: Context,
  searchText: string,
  options: FindOptions & LegacyCheckModes = {}
): FindMatch[] {
  const o = normalizeOptions(options);
  const matcher = createMatcher(searchText, o);
  if (!matcher) return [];
  const out: FindMatch[] = [];
  searchScopes(ctx, o).forEach(({ sheet, ranges }) => {
    const { data } = sheet;
    if (!data || data.length === 0) return;
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    const areas = ranges ?? [{ row: [0, rows - 1], column: [0, cols - 1] }];
    const seen = new Set<number>();
    const found: FindMatch[] = [];
    areas.forEach((rg) => {
      const r1 = Math.max(0, rg.row[0]);
      const r2 = Math.min(rows - 1, rg.row[1]);
      const c1 = Math.max(0, rg.column[0]);
      const c2 = Math.min(cols - 1, rg.column[1]);
      for (let r = r1; r <= r2; r += 1) {
        const row = data[r];
        if (row) {
          for (let c = c1; c <= c2; c += 1) {
            if (row[c] != null) {
              const key = r * cols + c;
              if (!seen.has(key)) {
                seen.add(key);
                const m = cellMatch(sheet, data, r, c, matcher, o.lookIn);
                if (m) found.push(m);
              }
            }
          }
        }
      }
    });
    if (o.searchBy === "columns") {
      found.sort((a, b) => a.c - b.c || a.r - b.r);
    } else {
      found.sort((a, b) => a.r - b.r || a.c - b.c);
    }
    out.push(...found);
  });
  return out;
}

function activePosition(ctx: Context): [number, number] {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return [-1, -1];
  return [last.row_focus ?? last.row[0], last.column_focus ?? last.column[0]];
}

/** Position of a match in search order, for comparing with the active cell. */
function orderKey(
  ctx: Context,
  o: Required<FindOptions>,
  sheetId: string,
  r: number,
  c: number
): [number, number, number] {
  const sheets = orderedVisibleSheets(ctx);
  const si =
    o.scope === "workbook" ? sheets.findIndex((s) => s.id === sheetId) : 0;
  return o.searchBy === "columns" ? [si, c, r] : [si, r, c];
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Selects a match: moves the active cell inside the current multi-cell
 * selection when searching within it, otherwise selects the cell (switching
 * sheets for workbook searches).
 */
export function selectMatch(
  ctx: Context,
  match: { sheetId: string; r: number; c: number },
  keepSelection = false
) {
  if (keepSelection && match.sheetId === ctx.currentSheetId) {
    const sel = ctx.luckysheet_select_save ?? [];
    const i = sel.findIndex(
      (s) =>
        match.r >= s.row[0] &&
        match.r <= s.row[1] &&
        match.c >= s.column[0] &&
        match.c <= s.column[1]
    );
    if (i >= 0) {
      const next = sel.slice();
      const [holder] = next.splice(i, 1);
      next.push({ ...holder, row_focus: match.r, column_focus: match.c });
      ctx.luckysheet_select_save = normalizeSelection(ctx, next);
      if (ctx.visibledatarow?.length) {
        scrollToHighlightCell(ctx, match.r, match.c);
      }
      return;
    }
  }
  const data = getFlowdata(ctx, match.sheetId);
  const mc = data?.[match.r]?.[match.c]?.mc;
  const range: SimpleRange =
    mc?.rs != null && mc?.cs != null
      ? {
          row: [match.r, match.r + mc.rs - 1],
          column: [match.c, match.c + mc.cs - 1],
        }
      : { row: [match.r, match.r], column: [match.c, match.c] };
  selectRangesOnSheet(ctx, match.sheetId, [range], [match.r, match.c]);
}

/**
 * Find Next (or Find Previous with `backwards`): selects the next match after
 * the active cell, wrapping around. Returns the match, or null if none.
 */
export function findNextMatch(
  ctx: Context,
  searchText: string,
  options: FindOptions & LegacyCheckModes = {},
  backwards = false
): FindMatch | null {
  const o = normalizeOptions(options);
  const matches = findAllMatches(ctx, searchText, o);
  if (matches.length === 0) return null;
  const [ar, ac] = activePosition(ctx);
  const cur = orderKey(ctx, o, ctx.currentSheetId, ar, ac);
  let next: FindMatch | undefined;
  if (backwards) {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const m = matches[i];
      if (compareKeys(orderKey(ctx, o, m.sheetId, m.r, m.c), cur) < 0) {
        next = m;
        break;
      }
    }
    next ??= matches[matches.length - 1];
  } else {
    next = matches.find(
      (m) => compareKeys(orderKey(ctx, o, m.sheetId, m.r, m.c), cur) > 0
    );
    next ??= matches[0];
  }
  selectMatch(ctx, next, o.scope === "sheet" && isMultiCellSelection(ctx));
  return next;
}

// ---------------------------------------------------------------------------
// Replacing
// ---------------------------------------------------------------------------

/** Runs `fn` with `sheetId` temporarily made the current sheet. */
function withSheet<T>(ctx: Context, sheetId: string, fn: () => T): T {
  const prev = ctx.currentSheetId;
  if (prev === sheetId) return fn();
  ctx.currentSheetId = sheetId;
  try {
    return fn();
  } finally {
    ctx.currentSheetId = prev;
  }
}

/**
 * Replaces the matched text of one cell and re-enters the cell the way
 * typing it would (so `=` starts a formula and numbers are parsed).
 * Returns false when the cell no longer matches.
 */
function replaceInCell(
  ctx: Context,
  match: { sheetId: string; r: number; c: number },
  matcher: Matcher,
  replacement: string
) {
  const data = getFlowdata(ctx, match.sheetId);
  const cell = data?.[match.r]?.[match.c];
  const text = getCellSearchText(cell, "formulas");
  if (text == null || !matcher.test(text)) return false;
  const next = matcher.replace(text, replacement);
  if (next === text) return true;
  if (cell?.ct?.t === "inlineStr") {
    // rich text: replace inside each run to keep its formatting; a match
    // spanning runs turns the cell into plain text
    const runs: any[] = cell.ct.s ?? [];
    const replaced = runs.map((run) =>
      run?.v != null && matcher.test(String(run.v))
        ? { ...run, v: matcher.replace(String(run.v), replacement) }
        : run
    );
    if (replaced.map((run) => run?.v ?? "").join("") === next) {
      cell.ct.s = replaced;
      recalculate(ctx, [{ r: match.r, c: match.c, id: match.sheetId }], null);
      return true;
    }
    cell.ct = { fa: "General", t: "g" };
  }
  withSheet(ctx, match.sheetId, () => {
    updateCell(ctx, match.r, match.c, null, next === "" ? null : next);
  });
  return true;
}

/** Excel's Replace only looks in formulas; notes are never replaced. */
function replaceOptions(options: FindOptions & LegacyCheckModes) {
  const o = normalizeOptions(options);
  return { ...o, lookIn: "formulas" as const };
}

/**
 * Replace: when the active cell matches, replaces it; then selects the next
 * match. Returns the number of cells replaced (0 or 1) and the next match.
 */
export function replaceNextMatch(
  ctx: Context,
  searchText: string,
  replaceText: string,
  options: FindOptions & LegacyCheckModes = {}
): { replaced: number; next: FindMatch | null } {
  const o = replaceOptions(options);
  const matcher = createMatcher(searchText, o);
  if (!matcher) return { replaced: 0, next: null };
  const [ar, ac] = activePosition(ctx);
  let replaced = 0;
  const current = findAllMatches(ctx, searchText, o).find(
    (m) => m.sheetId === ctx.currentSheetId && m.r === ar && m.c === ac
  );
  if (current && replaceInCell(ctx, current, matcher, replaceText ?? "")) {
    replaced = 1;
  }
  const next = findNextMatch(ctx, searchText, o);
  return { replaced, next };
}

/**
 * Replace All: replaces every match in scope (one undo step when run in a
 * single context update). Returns the number of cells replaced.
 */
export function replaceAllMatches(
  ctx: Context,
  searchText: string,
  replaceText: string,
  options: FindOptions & LegacyCheckModes = {}
): number {
  const o = replaceOptions(options);
  const matcher = createMatcher(searchText, o);
  if (!matcher) return 0;
  const matches = findAllMatches(ctx, searchText, o);
  let count = 0;
  matches.forEach((m) => {
    if (replaceInCell(ctx, m, matcher, replaceText ?? "")) count += 1;
  });
  return count;
}

// ---------------------------------------------------------------------------
// Legacy API (FortuneSheet) on top of the engine above
// ---------------------------------------------------------------------------

export function getSearchIndexArr(
  searchText: string,
  range: {
    row: number[];
    column: number[];
  }[],
  flowdata: CellMatrix,
  checkModes: LegacyCheckModes = {
    regCheck: false,
    wordCheck: false,
    caseCheck: false,
  }
) {
  const matcher = createMatcher(searchText, checkModes);
  const arr: { r: number; c: number }[] = [];
  if (!matcher) return arr;
  const seen = new Set<string>();
  range.forEach((rg) => {
    for (let r = rg.row[0]; r <= rg.row[1]; r += 1) {
      for (let c = rg.column[0]; c <= rg.column[1]; c += 1) {
        const text = getCellSearchText(flowdata[r]?.[c], "values");
        if (text != null && matcher.test(text) && !seen.has(`${r}_${c}`)) {
          seen.add(`${r}_${c}`);
          arr.push({ r, c });
        }
      }
    }
  });
  return arr;
}

export function searchNext(
  ctx: Context,
  searchText: string,
  checkModes: FindOptions & LegacyCheckModes
) {
  const { findAndReplace } = locale(ctx);
  if (searchText === "" || searchText == null || getFlowdata(ctx) == null) {
    return findAndReplace.searchInputTip;
  }
  const found = findNextMatch(ctx, searchText, checkModes);
  return found ? null : findAndReplace.noFindTip;
}

export function searchAll(
  ctx: Context,
  searchText: string,
  checkModes: FindOptions & LegacyCheckModes
): FindMatch[] {
  const result = findAllMatches(ctx, searchText, checkModes);
  if (result.length > 0 && !isMultiCellSelection(ctx)) {
    selectMatch(ctx, result[0]);
  }
  return result;
}

export function replace(
  ctx: Context,
  searchText: string,
  replaceText: string,
  checkModes: FindOptions & LegacyCheckModes
) {
  const { findAndReplace } = locale(ctx);
  if (!isAllowEdit(ctx)) return findAndReplace.modeTip;
  if (searchText === "" || searchText == null || getFlowdata(ctx) == null) {
    return findAndReplace.searchInputTip;
  }
  const { replaced, next } = replaceNextMatch(
    ctx,
    searchText,
    replaceText,
    checkModes
  );
  if (!replaced && !next) return findAndReplace.noReplceTip;
  return null;
}

export function replaceAll(
  ctx: Context,
  searchText: string,
  replaceText: string,
  checkModes: FindOptions & LegacyCheckModes
) {
  const { findAndReplace } = locale(ctx);
  if (!isAllowEdit(ctx)) return findAndReplace.modeTip;
  if (searchText === "" || searchText == null || getFlowdata(ctx) == null) {
    return findAndReplace.searchInputTip;
  }
  const count = replaceAllMatches(ctx, searchText, replaceText, checkModes);
  if (count === 0) return findAndReplace.noReplceTip;
  return replaceHtml(findAndReplace.replacedCount, { count });
}

// ---------------------------------------------------------------------------
// Dialog dragging
// ---------------------------------------------------------------------------

export function onSearchDialogMoveStart(
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLDivElement
) {
  const box = document.getElementById("fortune-search-replace");
  if (!box) return;
  // eslint-disable-next-line prefer-const
  let { top, left, width, height } = box.getBoundingClientRect();
  const rect = container.getBoundingClientRect();
  left -= rect.left;
  top -= rect.top;
  const initialPosition = { left, top, width, height };
  _.set(globalCache, "searchDialog.moveProps", {
    cursorMoveStartPosition: {
      x: e.pageX,
      y: e.pageY,
    },
    initialPosition,
  });
}

export function onSearchDialogMove(globalCache: GlobalCache, e: MouseEvent) {
  const searchDialog = globalCache?.searchDialog;
  const moveProps = searchDialog?.moveProps;
  if (moveProps == null) return;
  const dialog = document.getElementById("fortune-search-replace");
  if (!dialog) return;
  const { x: startX, y: startY } = moveProps.cursorMoveStartPosition!;
  let { top, left } = moveProps.initialPosition!;
  left += e.pageX - startX;
  top += e.pageY - startY;
  if (top < 0) top = 0;
  (dialog as HTMLDivElement).style.left = `${left}px`;
  (dialog as HTMLDivElement).style.top = `${top}px`;
}

export function onSearchDialogMoveEnd(globalCache: GlobalCache) {
  _.set(globalCache, "searchDialog.moveProps", undefined);
}
