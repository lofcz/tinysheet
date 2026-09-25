/**
 * Sheet and workbook protection (Excel's Review › Protect Sheet, Allow Edit
 * Ranges and Protect Workbook).
 *
 * Model (Luckysheet compatible): a sheet is protected when
 * `config.authority.sheet` is 1. `authority` holds the allowed actions
 * (1 = allowed, see SHEET_PROTECTION_ACTIONS), the password hash (never the
 * password, see protectionHash.ts) and `allowRangeList` (Allow Edit Ranges).
 * Cells are locked unless `lo` is 0; `hi` = 1 hides the formula while the
 * sheet is protected. Workbook structure protection lives on one sheet as
 * `workbookProtection`.
 *
 * Enforcement: edit entry points call `checkProtection(ctx, action, range)`
 * (and `checkWorkbookStructure(ctx)` for sheet operations). A refused edit
 * sets `ctx.protectionAlert` (Excel's message) or, for an Allow Edit Range
 * with a password, `ctx.protectionUnlock`; the UI shows them.
 */
import _ from "lodash";
import type { Context } from "../context";
import type {
  AllowEditRange,
  ProtectionPasswordHash,
  Sheet,
  SheetProtection,
  WorkbookProtection,
} from "../types";
import { getSheetByIndex, getSheetIndex } from "../utils";
import { peek, peekCell } from "./dependencyGraph";
import { parseSqref } from "./cfRules";
import { scrollToHighlightCell } from "./selection";
import { protectionLocale } from "../locale/protection";

export {
  hashProtectionPassword,
  verifyProtectionPassword,
  legacyPasswordHash,
  hasProtectionPassword,
  sha512,
  DEFAULT_SPIN_COUNT,
} from "./protectionHash";
export { protectionLocale } from "../locale/protection";
export type { ProtectionLocale } from "../locale/protection";

/** The allowed actions of the Protect Sheet dialog, in Excel's order. */
export const SHEET_PROTECTION_ACTIONS = [
  "selectLockedCells",
  "selectunLockedCells",
  "formatCells",
  "formatColumns",
  "formatRows",
  "insertColumns",
  "insertRows",
  "insertHyperlinks",
  "deleteColumns",
  "deleteRows",
  "sort",
  "filter",
  "usePivotTablereports",
  "editObjects",
  "editScenarios",
] as const;

export type SheetProtectionAction = (typeof SHEET_PROTECTION_ACTIONS)[number];

/**
 * What an edit does, for `checkProtection`: an allowed action of the dialog,
 * "editCells" (change cell contents: locked cells are refused unless an
 * Allow Edit Range covers them) or "protected" (anything a protected sheet
 * refuses whatever is allowed: merge, create a filter, validation, tables).
 */
export type ProtectionAction =
  | SheetProtectionAction
  | "editCells"
  | "protected";

export type ProtectionRange = { row: number[]; column: number[] };

/** Excel's defaults: only selecting cells is allowed. */
export function defaultProtectionActions(): Record<
  SheetProtectionAction,
  number
> {
  const out = {} as Record<SheetProtectionAction, number>;
  SHEET_PROTECTION_ACTIONS.forEach((a) => {
    out[a] = a === "selectLockedCells" || a === "selectunLockedCells" ? 1 : 0;
  });
  return out;
}

function sheetConfig(ctx: Context, sheetId: string) {
  if (sheetId === ctx.currentSheetId && ctx.config?.authority) {
    return ctx.config;
  }
  return getSheetByIndex(ctx, sheetId)?.config;
}

/** The sheet's protection settings, whether it is protected or not. */
export function getSheetProtectionSettings(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
): SheetProtection | undefined {
  return sheetConfig(ctx, sheetId)?.authority;
}

/** The protection of a protected sheet, null when it is not protected. */
export function getSheetProtection(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
): SheetProtection | null {
  const aut = getSheetProtectionSettings(ctx, sheetId);
  if (!aut || !(aut.sheet === 1 || aut.sheet === true)) return null;
  return aut;
}

export function isSheetProtected(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
) {
  return getSheetProtection(ctx, sheetId) != null;
}

/** Is `action` allowed by these settings (missing flags: Excel's default)? */
export function isProtectionActionAllowed(
  aut: SheetProtection | null | undefined,
  action: SheetProtectionAction
) {
  if (!aut) return true;
  const v = aut[action];
  if (v == null) return defaultProtectionActions()[action] === 1;
  return Number(v) === 1;
}

/* ---- A1 references of Allow Edit Ranges ---------------------------------- */

function columnLetters(n: number) {
  let s = "";
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Ranges as an absolute A1 list ("$A$1:$B$5 $D$1"). */
export function protectionRangesToSqref(
  ranges: ProtectionRange[],
  absolute = true
) {
  const d = absolute ? "$" : "";
  return ranges
    .map(({ row, column }) => {
      const a = `${d}${columnLetters(column[0])}${d}${row[0] + 1}`;
      if (row[0] === row[1] && column[0] === column[1]) return a;
      return `${a}:${d}${columnLetters(column[1])}${d}${row[1] + 1}`;
    })
    .join(" ");
}

const sqrefCache = new Map<string, ProtectionRange[] | null>();

function rangesOf(item: AllowEditRange) {
  let ranges = sqrefCache.get(item.sqref);
  if (ranges === undefined) {
    ranges = parseSqref(item.sqref) as ProtectionRange[] | null;
    if (sqrefCache.size > 200) sqrefCache.clear();
    sqrefCache.set(item.sqref, ranges);
  }
  return ranges ?? [];
}

/** The first Allow Edit Range of the protection covering cell (r, c). */
export function findAllowEditRange(
  aut: SheetProtection | null | undefined,
  r: number,
  c: number
): AllowEditRange | undefined {
  const list = aut?.allowRangeList;
  if (!list?.length) return undefined;
  return list.find((item) =>
    rangesOf(item).some(
      (x) =>
        r >= x.row[0] && r <= x.row[1] && c >= x.column[0] && c <= x.column[1]
    )
  );
}

function unlockKey(sheetId: string, name: string) {
  return `${sheetId}|${name}`;
}

/** Can the range be edited now (no password, or unlocked this session)? */
export function isEditRangeUnlocked(
  ctx: Context,
  sheetId: string,
  item: AllowEditRange
) {
  if (!(item.hashValue || item.legacyHash || item.password)) return true;
  return !!ctx.unlockedEditRanges?.includes(unlockKey(sheetId, item.name));
}

/** Remember that an Allow Edit Range was unlocked with its password. */
export function unlockEditRange(ctx: Context, sheetId: string, name: string) {
  const key = unlockKey(sheetId, name);
  const list = ctx.unlockedEditRanges ?? [];
  if (!list.includes(key)) ctx.unlockedEditRanges = [...list, key];
  if (
    ctx.protectionUnlock?.sheetId === sheetId &&
    ctx.protectionUnlock?.name === name
  ) {
    ctx.protectionUnlock = undefined;
  }
}

/* ---- cells --------------------------------------------------------------- */

/** Cell attribute: locked unless `lo` is 0 (Excel's default is locked). */
export function isCellLockedAttribute(
  ctx: Context,
  r: number,
  c: number,
  sheetId: string
) {
  const sheetFile = getSheetByIndex(ctx, sheetId);
  // read without drafting: a draft row read makes immer copy every row
  const cell = sheetFile ? peekCell(sheetFile.data, r, c) : null;
  return !(cell && Number(cell.lo) === 0);
}

type Blocked = { r: number; c: number; range?: AllowEditRange } | null;

function firstBlockedCell(
  ctx: Context,
  aut: SheetProtection,
  sheetId: string,
  ranges: ProtectionRange[]
): Blocked {
  // read without drafting (see peek)
  const data = peek(getSheetByIndex(ctx, sheetId)?.data);
  for (let i = 0; i < ranges.length; i += 1) {
    const { row, column } = ranges[i];
    if (!row || !column) continue;
    // cells past the sheet's data are empty, i.e. locked: check the first
    const rowEnd = data
      ? Math.min(row[1], Math.max(data.length, row[0]))
      : row[0];
    for (let r = row[0]; r <= rowEnd; r += 1) {
      const line = data ? peek(data[r]) : null;
      const colEnd = Math.min(
        column[1],
        Math.max(line?.length ?? 0, column[0])
      );
      for (let c = column[0]; c <= colEnd; c += 1) {
        const cell = line ? peek(line[c]) : null;
        if (cell && Number(cell.lo) === 0) continue;
        const item = findAllowEditRange(aut, r, c);
        if (!item) return { r, c };
        if (!isEditRangeUnlocked(ctx, sheetId, item))
          return { r, c, range: item };
      }
    }
  }
  return null;
}

/**
 * True when the cell cannot be edited: the sheet is protected, the cell is
 * locked and no (unlocked) Allow Edit Range covers it.
 */
export function checkCellIsLocked(
  ctx: Context,
  r: number,
  c: number,
  sheetId: string
) {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return false;
  if (!isCellLockedAttribute(ctx, r, c, sheetId)) return false;
  const item = findAllowEditRange(aut, r, c);
  return !item || !isEditRangeUnlocked(ctx, sheetId, item);
}

/** The formula bar shows nothing for hidden cells of a protected sheet. */
export function isCellContentHidden(
  ctx: Context,
  r: number,
  c: number,
  sheetId: string = ctx.currentSheetId
) {
  if (!isSheetProtected(ctx, sheetId)) return false;
  const cell = peekCell(getSheetByIndex(ctx, sheetId)?.data, r, c);
  return !!cell && Number(cell.hi) === 1;
}

/* ---- the guard ----------------------------------------------------------- */

/** Show Excel's "protected sheet" message (or the sheet's own hint text). */
export function alertProtection(ctx: Context, message?: string) {
  const aut = getSheetProtection(ctx);
  const text =
    message || aut?.hintText || protectionLocale(ctx).protectedMessage;
  ctx.protectionAlert = {
    message: text,
    seq: (ctx.protectionAlert?.seq ?? 0) + 1,
  };
}

/**
 * The protection guard of edit entry points: true when `action` may run on
 * the sheet (the current one by default); otherwise tells the user why and
 * returns false. `ranges` (default: the selection) matter for "editCells".
 */
export function checkProtection(
  ctx: Context,
  action: ProtectionAction,
  ranges?: ProtectionRange[] | null,
  sheetId: string = ctx.currentSheetId
): boolean {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return true;
  if (action === "protected") {
    alertProtection(ctx);
    return false;
  }
  if (action === "editCells") {
    const blocked = firstBlockedCell(
      ctx,
      aut,
      sheetId,
      ranges ?? ctx.luckysheet_select_save ?? []
    );
    if (!blocked) return true;
    if (blocked.range) {
      ctx.protectionUnlock = { sheetId, name: blocked.range.name };
    } else {
      alertProtection(ctx);
    }
    return false;
  }
  if (isProtectionActionAllowed(aut, action)) return true;
  alertProtection(ctx);
  return false;
}

/**
 * Delete Rows / Delete Columns on a protected sheet: the action must be
 * allowed and the rows / columns must not hold locked cells (Excel).
 */
export function checkDeleteRowCol(
  ctx: Context,
  type: "row" | "column",
  start: number,
  end: number,
  sheetId: string = ctx.currentSheetId
) {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return true;
  if (
    !checkProtection(
      ctx,
      type === "row" ? "deleteRows" : "deleteColumns",
      null,
      sheetId
    )
  ) {
    return false;
  }
  const data = peek(getSheetByIndex(ctx, sheetId)?.data);
  const rows = Math.max((data?.length ?? 1) - 1, 0);
  const cols = Math.max((peek(data?.[0])?.length ?? 1) - 1, 0);
  const range =
    type === "row"
      ? { row: [start, Math.min(end, rows)], column: [0, cols] }
      : { row: [0, rows], column: [start, Math.min(end, cols)] };
  return checkProtection(ctx, "editCells", [range], sheetId);
}

/** Can the sheet's cells be edited at all (pure: no message)? */
export function canEditCells(
  ctx: Context,
  ranges?: ProtectionRange[] | null,
  sheetId: string = ctx.currentSheetId
) {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return true;
  return (
    firstBlockedCell(
      ctx,
      aut,
      sheetId,
      ranges ?? ctx.luckysheet_select_save ?? []
    ) == null
  );
}

/* ---- selection (select locked / unlocked cells) -------------------------- */

export function checkProtectionSelectLockedOrUnLockedCells(
  ctx: Context,
  r: number,
  c: number,
  sheetId: string
) {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return true;
  const locked = checkCellIsLocked(ctx, r, c, sheetId);
  return isProtectionActionAllowed(
    aut,
    locked ? "selectLockedCells" : "selectunLockedCells"
  );
}

/** Whole rows / columns / sheet can be selected (both kinds allowed). */
export function checkProtectionAllSelected(ctx: Context, sheetId: string) {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return true;
  return (
    isProtectionActionAllowed(aut, "selectLockedCells") &&
    isProtectionActionAllowed(aut, "selectunLockedCells")
  );
}

/** Format cells guard (kept for callers of the Luckysheet-era API). */
export function checkProtectionFormatCells(ctx: Context) {
  return checkProtection(ctx, "formatCells");
}

/**
 * The next cell Tab should move to on a protected sheet: the next unlocked
 * (or editable Allow Edit Range) cell in reading order, wrapping around.
 * Null when the sheet is not protected or has no such cell.
 */
export function nextUnlockedCell(
  ctx: Context,
  r: number,
  c: number,
  backwards = false,
  sheetId: string = ctx.currentSheetId
): { r: number; c: number } | null {
  const aut = getSheetProtection(ctx, sheetId);
  if (!aut) return null;
  const data = getSheetByIndex(ctx, sheetId)?.data;
  if (!data?.length) return null;
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const total = rows * cols;
  if (total === 0) return null;
  const hidden = (rr: number, cc: number) =>
    ctx.config?.rowhidden?.[rr] != null || ctx.config?.colhidden?.[cc] != null;
  const start = r * cols + c;
  const step = backwards ? -1 : 1;
  for (let k = 1; k <= total; k += 1) {
    const i = (((start + k * step) % total) + total) % total;
    const rr = Math.floor(i / cols);
    const cc = i % cols;
    const cell = data[rr]?.[cc];
    if (cell?.mc && (cell.mc.r !== rr || cell.mc.c !== cc)) continue;
    if (hidden(rr, cc)) continue;
    if (!checkCellIsLocked(ctx, rr, cc, sheetId)) return { r: rr, c: cc };
  }
  return null;
}

/**
 * Tab / Shift+Tab on a protected sheet: select the next unlocked cell.
 * False (nothing done) when the sheet is not protected or has none.
 */
export function selectNextUnlockedCell(ctx: Context, backwards = false) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  const r = sel?.row_focus ?? sel?.row?.[0] ?? 0;
  const c = sel?.column_focus ?? sel?.column?.[0] ?? 0;
  const next = nextUnlockedCell(ctx, r, c, backwards);
  if (!next) return false;
  ctx.luckysheet_select_save = [
    {
      row: [next.r, next.r],
      column: [next.c, next.c],
      row_focus: next.r,
      column_focus: next.c,
    },
  ];
  scrollToHighlightCell(ctx, next.r, next.c);
  return true;
}

/* ---- protect / unprotect a sheet ----------------------------------------- */

function setSheetAuthority(
  ctx: Context,
  sheetId: string,
  authority: SheetProtection | undefined
) {
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return false;
  const sheet = ctx.luckysheetfile[index];
  const config = { ...(sheet.config ?? {}) };
  if (authority) config.authority = authority;
  else delete config.authority;
  sheet.config = config;
  if (sheetId === ctx.currentSheetId) ctx.config = config;
  return true;
}

export type ProtectSheetOptions = {
  /** Allowed actions; missing ones keep Excel's defaults. */
  allow?: Partial<Record<SheetProtectionAction, boolean>>;
  /** The password hash (hashProtectionPassword); none: no password. */
  password?: ProtectionPasswordHash;
  hintText?: string;
};

/** Protect a sheet (the hash of its password is computed beforehand). */
export function protectSheet(
  ctx: Context,
  sheetId: string = ctx.currentSheetId,
  options: ProtectSheetOptions = {}
) {
  if (ctx.allowEdit === false) return false;
  const prev = getSheetProtectionSettings(ctx, sheetId);
  const flags = defaultProtectionActions();
  Object.entries(options.allow ?? {}).forEach(([k, v]) => {
    if ((SHEET_PROTECTION_ACTIONS as readonly string[]).includes(k)) {
      flags[k as SheetProtectionAction] = v ? 1 : 0;
    }
  });
  const authority: SheetProtection = {
    ...flags,
    sheet: 1,
    ...(options.password ?? {}),
  };
  // plain-text passwords of Luckysheet data are not kept
  delete authority.password;
  if (options.hintText) authority.hintText = options.hintText;
  if (prev?.allowRangeList?.length) {
    authority.allowRangeList = _.cloneDeep(prev.allowRangeList);
  }
  return setSheetAuthority(ctx, sheetId, authority);
}

/**
 * Unprotect a sheet (the password was checked by the caller). The allowed
 * actions and the Allow Edit Ranges are kept for the next protection.
 */
export function unprotectSheet(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
) {
  const prev = getSheetProtectionSettings(ctx, sheetId);
  if (!prev) return false;
  const next: SheetProtection = { ...prev, sheet: 0 };
  [
    "algorithmName",
    "hashValue",
    "saltValue",
    "spinCount",
    "legacyHash",
    "password",
  ].forEach((k) => delete next[k]);
  if (!next.allowRangeList?.length) {
    // nothing worth keeping: drop the settings
    return setSheetAuthority(ctx, sheetId, undefined);
  }
  return setSheetAuthority(ctx, sheetId, next);
}

/**
 * Replace the Allow Edit Ranges of a sheet (only while it is unprotected,
 * as in Excel). Ranges keep the password hashes they are given.
 */
export function setAllowEditRanges(
  ctx: Context,
  sheetId: string,
  ranges: AllowEditRange[]
) {
  if (ctx.allowEdit === false || isSheetProtected(ctx, sheetId)) return false;
  const prev = getSheetProtectionSettings(ctx, sheetId);
  const clean = ranges.map((item) => {
    const out: AllowEditRange = { ...item };
    delete out.password;
    return out;
  });
  if (!prev && clean.length === 0) return true;
  const next: SheetProtection = { ...(prev ?? { sheet: 0 }) };
  if (clean.length) next.allowRangeList = clean;
  else delete next.allowRangeList;
  return setSheetAuthority(ctx, sheetId, next);
}

/* ---- workbook structure --------------------------------------------------- */

/** The workbook protection, null when the structure is not protected. */
export function getWorkbookProtection(
  ctx: Pick<Context, "luckysheetfile">
): WorkbookProtection | null {
  const sheet = ctx.luckysheetfile.find(
    (s) => s.workbookProtection?.lockStructure
  );
  return sheet?.workbookProtection ?? null;
}

export function isWorkbookStructureProtected(
  ctx: Pick<Context, "luckysheetfile">
) {
  return getWorkbookProtection(ctx) != null;
}

/**
 * The guard of sheet operations (add, delete, rename, move, copy, hide,
 * unhide, tab colour): false with Excel's message when the workbook
 * structure is protected.
 */
export function checkWorkbookStructure(ctx: Context) {
  if (!isWorkbookStructureProtected(ctx)) return true;
  alertProtection(ctx, protectionLocale(ctx).workbookProtectedMessage);
  return false;
}

function firstSheet(ctx: Context): Sheet | undefined {
  return _.sortBy(ctx.luckysheetfile, (s) => Number(s.order ?? 0))[0];
}

/** Protect the workbook structure (optionally with a password hash). */
export function protectWorkbook(
  ctx: Context,
  password: ProtectionPasswordHash = {}
) {
  if (ctx.allowEdit === false) return false;
  const holder = firstSheet(ctx);
  if (!holder) return false;
  ctx.luckysheetfile.forEach((s) => {
    if (s !== holder && s.workbookProtection) delete s.workbookProtection;
  });
  const next: WorkbookProtection = { lockStructure: true, ...password };
  delete next.password;
  holder.workbookProtection = next;
  return true;
}

/** Unprotect the workbook (the password was checked by the caller). */
export function unprotectWorkbook(ctx: Context) {
  let changed = false;
  ctx.luckysheetfile.forEach((s) => {
    if (s.workbookProtection) {
      delete s.workbookProtection;
      changed = true;
    }
  });
  return changed;
}
