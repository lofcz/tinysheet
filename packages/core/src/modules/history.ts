/**
 * Undo/redo history.
 *
 * Every state change goes through {@link produceWithHistory}: the recipe runs
 * on an immer draft of the whole context and the patches touching the
 * workbook (`luckysheetfile`) become one undo step. Undo and redo apply the
 * recorded (inverse) patches, then {@link syncContextAfterHistory} copies the
 * sheet state that the context mirrors (`ctx.config`, filters, images) back
 * from the restored sheet and the formula cache / dependency graph is
 * refreshed.
 *
 * Steps recorded inside {@link withUndoGroup} share a group id and are undone
 * and redone together, so multi-step operations (insert rows then paste, a
 * dialog applying several changes, ...) are a single Ctrl+Z.
 */
import _ from "lodash";
import produce, {
  applyPatches,
  enablePatches,
  Patch,
  produceWithPatches,
} from "immer";
import type { Context } from "../context";
import type {
  CellMatrix,
  CellWithRowAndCol,
  GlobalCache,
  History,
  Sheet,
} from "../types";
import { getSheetIndex } from "../utils";
import {
  filterPatch,
  inverseRowColOptions,
  PatchOptions,
} from "../utils/patch";
import { createFilterOptions } from "./filter";
import {
  DataSession,
  prepareChunkedSheets,
  publicDataPatches,
  reconcileChunkedSheets,
  runDataSession,
} from "./rowStore";
import { invalidateSpillAnchors } from "./spillIndex";

enablePatches();
export type HistoryOptions = PatchOptions & {
  /** apply the change without recording an undo step */
  noHistory?: boolean;
  /** log the raw patches to the console */
  logPatch?: boolean;
};

/**
 * Runs `recipe` on a draft of `ctx` in a data session, so chunked sheet
 * matrices (rowStore.ts) resolve to the draft, and returns the result with
 * every changed sheet's matrix view brought up to date, and the patches and
 * inverse patches with public paths.
 */
function produceInSessionWithPatches(
  base: Context,
  recipe: (draft: Context) => void
): [Context, Patch[], Patch[]] {
  const ctx = prepareChunkedSheets(base);
  const session = new DataSession(null);
  const [produced, patches, inversePatches] = produceWithPatches(
    ctx,
    (draft: Context) => {
      session.root = draft;
      runDataSession(session, () => {
        recipe(draft);
      });
    }
  );
  const result = reconcileChunkedSheets(ctx, produced, session);
  return [
    result,
    publicDataPatches(patches, ctx, result, true),
    publicDataPatches(inversePatches, ctx, result, false),
  ];
}

/** Like produceInSessionWithPatches, without the patches. */
function produceInSession(
  base: Context,
  recipe: (draft: Context) => void
): Context {
  const ctx = prepareChunkedSheets(base);
  const session = new DataSession(null);
  const produced = produce(ctx, (draft: Context) => {
    session.root = draft;
    runDataSession(session, () => {
      recipe(draft);
    });
  });
  return reconcileChunkedSheets(ctx, produced, session);
}

function produceNoPatches(ctx: Context, recipe: (draft: Context) => void) {
  return produceInSession(ctx, recipe);
}

/**
 * `immer.produce` for contexts: use it (rather than immer directly) for any
 * update of a context, so the cells of chunked (large) sheets can be edited
 * (see rowStore.ts).
 */
export function produceContext(
  ctx: Context,
  recipe: (draft: Context) => void
): Context {
  return produceInSession(ctx, recipe);
}

/**
 * `immer.applyPatches` for contexts: applies patches with public paths
 * (`["luckysheetfile", i, "data", r, c]`), to chunked sheets too.
 */
export function applyContextPatches(ctx: Context, patches: Patch[]): Context {
  if (patches.length === 0) return ctx;
  return produceInSession(ctx, (draft) => {
    applyPatches(draft, patches);
  });
}

type HistoryHost = GlobalCache | Pick<Context, "getRefs">;

function cacheOf(host: HistoryHost): GlobalCache | undefined {
  if ((host as GlobalCache).undoList) return host as GlobalCache;
  const refs = (host as Pick<Context, "getRefs">).getRefs?.();
  return refs?.globalCache;
}

let nextGroupId = 1;

/**
 * Imperative form of {@link withUndoGroup}: starts (or joins) an undo group
 * and returns the function that ends it. Every begin must be paired with
 * exactly one call of the returned function.
 */
export function beginUndoGroup(host: HistoryHost): () => void {
  const cache = cacheOf(host);
  if (!cache) return () => {};
  if (!cache.undoGroup) {
    cache.undoGroup = { id: nextGroupId, depth: 0 };
    nextGroupId += 1;
  }
  const group = cache.undoGroup;
  group.depth += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    group.depth -= 1;
    if (group.depth <= 0 && cache.undoGroup === group) {
      cache.undoGroup = undefined;
    }
  };
}

/**
 * Runs `fn` so that every undo step recorded while it runs (including the
 * steps of `setContext` calls it makes, even though React applies them
 * later) is undone and redone as one step. Groups nest: the outermost group
 * wins. Accepts the context (or the draft inside a recipe) or the global
 * cache.
 */
export function withUndoGroup<T>(host: HistoryHost, fn: () => T): T {
  const end = beginUndoGroup(host);
  try {
    return fn();
  } finally {
    end();
  }
}

/** Id of the undo group being recorded, if any (see {@link withUndoGroup}). */
export function currentUndoGroup(host: HistoryHost): number | undefined {
  return cacheOf(host)?.undoGroup?.id;
}

function dataToCelldata(data: CellMatrix | undefined) {
  const cellData: CellWithRowAndCol[] = [];
  if (!data) return cellData;
  for (let row = 0; row < data.length; row += 1) {
    for (let col = 0; col < data[row]?.length; col += 1) {
      if (data[row][col] != null) {
        cellData.push({ r: row, c: col, v: data[row][col] });
      }
    }
  }
  return cellData;
}

/** A deep copy of a sheet with its cells as `celldata` (no `data`). */
function sheetWithCelldata(sheet: Sheet): Sheet {
  const { data, ...rest } = sheet;
  const value = _.cloneDeep(rest) as Sheet;
  value.celldata = _.cloneDeep(dataToCelldata(data));
  return value;
}

/**
 * Drops undo steps of sheets that no longer exist (deleted by a
 * collaborator) and re-indexes the remaining steps after a sheet removal.
 */
export function pruneHistoryForRemovedSheets(
  cache: GlobalCache,
  before: Context,
  after: Context
) {
  const sheetsId = after.luckysheetfile.map((sheet) => sheet.id);
  const sheetDeletedByMe = cache.undoList
    .filter((undo) => undo.options?.deleteSheetOp)
    .map((item) => item.options?.deleteSheetOp?.id);
  cache.undoList = cache.undoList.filter(
    (undo) =>
      undo.options?.deleteSheetOp ||
      undo.options?.id === undefined ||
      _.indexOf(sheetsId, undo.options?.id) !== -1 ||
      _.indexOf(sheetDeletedByMe, undo.options?.id) !== -1
  );
  if (before.luckysheetfile.length > after.luckysheetfile.length) {
    const deletedIndex = before.luckysheetfile
      .filter((sheet) => !sheetsId.includes(sheet.id))
      .map((item) => getSheetIndex(before, item.id as string))[0];
    if (deletedIndex == null) return;
    const shift = (p: Patch) => {
      if (typeof p.path[1] === "number" && p.path[1] > deletedIndex) {
        p.path[1] -= 1;
      }
      return p;
    };
    cache.undoList = cache.undoList.map((step) => {
      step.patches = step.patches.map(shift);
      step.inversePatches = step.inversePatches.map(shift);
      return step;
    });
  }
}

/**
 * `ctx.config` is a working copy of the current sheet's `config` and code
 * often assigns one draft to both (`sheet.config = cfg; ctx.config = cfg`).
 * Immer then records the changes under whichever path it finalizes first; if
 * that is `config`, the workbook patches miss them. Re-target those patches
 * to the sheet so the change is undoable.
 */
function recoverSharedConfigPatches(
  before: Context,
  result: Context,
  filteredPatches: Patch[],
  filteredInversePatches: Patch[]
) {
  const idx = getSheetIndex(result, result.currentSheetId);
  if (idx == null) return;
  const sheetId = result.luckysheetfile[idx]?.id;
  const beforeIdx = getSheetIndex(before, sheetId as string);
  if (beforeIdx == null) return;
  const oldConfig = before.luckysheetfile[beforeIdx]?.config;
  const newConfig = result.luckysheetfile[idx]?.config;
  // unchanged, or not shared with ctx.config (then immer saw it directly)
  if (oldConfig === newConfig || result.config !== newConfig) return;
  const isSheetConfig = (p: Patch) =>
    p.path[0] === "luckysheetfile" &&
    p.path[1] === idx &&
    p.path[2] === "config";
  if (filteredPatches.some(isSheetConfig)) return;
  filteredPatches.push({
    op: "replace",
    path: ["luckysheetfile", idx, "config"],
    value: newConfig,
  });
  filteredInversePatches.push({
    op: "replace",
    path: ["luckysheetfile", idx, "config"],
    value: oldConfig,
  });
}

export type HistoryStepResult = {
  context: Context;
  /** undo steps applied, with the patches/options to broadcast */
  applied: { history: History; patches: Patch[]; options?: PatchOptions }[];
};

export type ProduceResult = {
  result: Context;
  /** the recorded undo step, when the change was recorded */
  recorded?: History;
  /** raw immer patches of the change */
  patches: Patch[];
};

/**
 * Applies `recipe` to `ctx` and records the workbook changes it made as one
 * undo step in `cache` (clearing the redo list). `group` tags the step (see
 * {@link withUndoGroup}); by default the group active in `cache` is used.
 */
export function produceWithHistory(
  ctx: Context,
  recipe: (draft: Context) => void,
  options: HistoryOptions,
  cache: GlobalCache,
  group: number | undefined = cache.undoGroup?.id
): ProduceResult {
  const [result, patches, inversePatches] = produceInSessionWithPatches(
    ctx,
    recipe
  );
  if (patches.length === 0 || options.noHistory) {
    if (
      patches.length > 0 &&
      patches[0]?.value?.length < ctx.luckysheetfile?.length
    ) {
      pruneHistoryForRemovedSheets(cache, ctx, result);
    }
    return { result, patches };
  }
  if (options.logPatch) {
    // eslint-disable-next-line no-console
    console.info("patch", patches);
  }
  const filteredPatches = filterPatch(patches);
  let filteredInversePatches = filterPatch(inversePatches);
  recoverSharedConfigPatches(
    ctx,
    result,
    filteredPatches,
    filteredInversePatches
  );
  if (filteredInversePatches.length === 0) return { result, patches };

  options.id = ctx.currentSheetId;
  if (options.deleteSheetOp) {
    const index = getSheetIndex(ctx, options.deleteSheetOp.id);
    if (index != null) {
      const value = sheetWithCelldata(ctx.luckysheetfile[index]);
      value.status = 0;
      options.deletedSheet = { id: options.deleteSheetOp.id, index, value };
      filteredInversePatches = [
        { op: "add", path: ["luckysheetfile", 0], value },
      ];
    }
  } else if (options.addSheetOp) {
    options.addSheet = {
      id: result.luckysheetfile[result.luckysheetfile.length - 1]?.id,
    };
  }
  const recorded: History = {
    patches: filteredPatches,
    inversePatches: filteredInversePatches,
    options,
  };
  if (group != null) recorded.group = group;
  cache.undoList.push(recorded);
  cache.redoList = [];
  return { result, recorded, patches };
}

/** Sheet indexes (in `luckysheetfile`) touched by `patches`, per field. */
function touchedSheetFields(patches: Patch[]) {
  const touched = new Map<number, Set<string>>();
  let structural = false;
  patches.forEach((p) => {
    if (p.path[0] !== "luckysheetfile") return;
    if (p.path.length <= 2) {
      structural = true;
      return;
    }
    const idx = p.path[1] as number;
    if (!touched.has(idx)) touched.set(idx, new Set());
    touched.get(idx)!.add(String(p.path[2]));
  });
  return { touched, structural };
}

/**
 * After undo/redo: copies the sheet state that the context keeps a working
 * copy of (config, filter, images) from the current sheet, and makes sure
 * the current sheet still exists.
 */
export function syncContextAfterHistory(
  ctx: Context,
  patches: Patch[],
  full = false
) {
  if (
    getSheetIndex(ctx, ctx.currentSheetId) == null &&
    ctx.luckysheetfile.length > 0
  ) {
    const visible = _.sortBy(
      ctx.luckysheetfile.filter((s) => s.hide !== 1),
      (s) => s.order ?? 0
    );
    ctx.currentSheetId = (visible[0] ?? ctx.luckysheetfile[0]).id!;
  }
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const sheet = ctx.luckysheetfile[index];
  const { touched, structural } = touchedSheetFields(patches);
  const fields = touched.get(index);
  if (!full && !structural && !fields) return;
  const has = (f: string) => full || structural || !!fields?.has(f);
  if (has("config")) ctx.config = sheet.config ?? {};
  if (has("images")) ctx.insertedImgs = sheet.images;
  if (has("filter") || has("filter_select")) {
    ctx.luckysheet_filter_save = sheet.filter_select;
    ctx.filter = sheet.filter || {};
    try {
      createFilterOptions(ctx, sheet.filter_select, undefined, sheet.filter);
    } catch (e) {
      // geometry not ready (e.g. headless): the UI re-creates it
      ctx.filterOptions = undefined;
    }
  }
}

/**
 * Like Excel, undo and redo show the sheet the change was made on. Returns
 * true when the current sheet changed.
 */
function showHistorySheet(ctx: Context, history: History, patches: Patch[]) {
  const o = history.options;
  const id = o?.id;
  if (!id || id === ctx.currentSheetId || o?.addSheetOp || o?.deleteSheetOp)
    return false;
  const index = getSheetIndex(ctx, id);
  if (index == null || ctx.luckysheetfile[index].hide === 1) return false;
  if (!touchedSheetFields(patches).touched.has(index)) return false;
  if (ctx.sheetScrollRecord) {
    ctx.sheetScrollRecord[ctx.currentSheetId] = {
      scrollLeft: ctx.scrollLeft,
      scrollTop: ctx.scrollTop,
      luckysheet_select_status: ctx.luckysheet_select_status,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: ctx.luckysheet_selection_range,
    };
  }
  ctx.dataVerificationDropDownList = false;
  ctx.currentSheetId = id;
  ctx.zoomRatio = ctx.luckysheetfile[index].zoomRatio || 1;
  return true;
}

function refreshFormulaCache(
  ctx: Context,
  history: History,
  type: "undo" | "redo",
  options: PatchOptions | undefined
) {
  // restored cells may hold spill anchors the anchor index does not know
  invalidateSpillAnchors(ctx);
  if (
    options?.deleteRowColOp ||
    options?.insertRowColOp ||
    options?.restoreDeletedCells ||
    history.options?.deleteRowColOp ||
    history.options?.insertRowColOp
  ) {
    ctx.formulaCache.formulaCellInfoMap = null;
  } else {
    ctx.formulaCache.updateFormulaCache(ctx, history, type);
  }
}

/**
 * Removes the last step (and the steps of its group) from `list`, most
 * recent first.
 */
export function popHistoryGroup(list: History[]): History[] {
  const top = list.pop();
  if (!top) return [];
  const steps = [top];
  if (top.group != null) {
    while (list.length > 0 && list[list.length - 1].group === top.group) {
      steps.push(list.pop()!);
    }
  }
  return steps;
}

/**
 * Applies the inverse patches of `steps` (most recent first, as returned by
 * {@link popHistoryGroup}) without touching the undo/redo lists.
 */
export function applyUndoSteps(
  ctx: Context,
  steps: History[]
): HistoryStepResult {
  let context = ctx;
  const applied: HistoryStepResult["applied"] = [];
  // most recent first
  steps.forEach((history) => {
    const before = context;
    let inverse = history.inversePatches;
    if (history.options?.deleteSheetOp) {
      // re-insert the deleted sheet at the end and shift the order of the
      // sheets that were right of it
      inverse = [
        {
          ...inverse[0],
          path: ["luckysheetfile", before.luckysheetfile.length],
        },
      ];
      const order = history.options.deletedSheet?.value?.order as number;
      before.luckysheetfile
        .filter(
          (sheet) =>
            (sheet?.order as number) >= order &&
            sheet.id !== history.options?.deleteSheetOp?.id
        )
        .forEach((sheet) => {
          inverse.push({
            op: "replace",
            path: [
              "luckysheetfile",
              getSheetIndex(before, sheet.id as string) as number,
              "order",
            ],
            value: (sheet?.order as number) + 1,
          });
        });
    }
    context = applyContextPatches(context, inverse);
    const inversedOptions = inverseRowColOptions(history.options);
    if (inversedOptions?.insertRowColOp) {
      inversedOptions.restoreDeletedCells = true;
    }
    if (history.options?.addSheetOp && inversedOptions) {
      const index = getSheetIndex(before, history.options.addSheet!.id!);
      if (index != null) {
        const value = sheetWithCelldata(before.luckysheetfile[index]);
        inversedOptions.addSheet = {
          id: history.options.addSheet!.id,
          index,
          value,
        };
      }
    }
    context = produceNoPatches(context, (draft) => {
      const switched = showHistorySheet(draft, history, inverse);
      syncContextAfterHistory(draft, inverse, switched);
    });
    refreshFormulaCache(
      context,
      { ...history, inversePatches: inverse },
      "undo",
      inversedOptions
    );
    applied.push({
      history,
      patches: inverse,
      options: inversedOptions,
    });
  });
  return { context, applied };
}

/**
 * Undoes the last undo step (or group of steps) in `cache`, moving it to the
 * redo list. Returns null when there is nothing to undo.
 */
export function undoHistory(
  ctx: Context,
  cache: GlobalCache
): HistoryStepResult | null {
  const steps = popHistoryGroup(cache.undoList);
  if (steps.length === 0) return null;
  cache.redoList.push(...steps);
  return applyUndoSteps(ctx, steps);
}

/**
 * Re-applies the patches of `steps` (oldest first, as returned by
 * {@link popHistoryGroup} on the redo list) without touching the lists.
 */
export function applyRedoSteps(
  ctx: Context,
  steps: History[]
): HistoryStepResult {
  let context = ctx;
  const applied: HistoryStepResult["applied"] = [];
  steps.forEach((history) => {
    context = applyContextPatches(context, history.patches);
    context = produceNoPatches(context, (draft) => {
      const switched = showHistorySheet(draft, history, history.patches);
      syncContextAfterHistory(draft, history.patches, switched);
    });
    refreshFormulaCache(context, history, "redo", history.options);
    applied.push({
      history,
      patches: history.patches,
      options: history.options,
    });
  });
  return { context, applied };
}

/**
 * Redoes the last undone step (or group of steps). Returns null when there
 * is nothing to redo.
 */
export function redoHistory(
  ctx: Context,
  cache: GlobalCache
): HistoryStepResult | null {
  const steps = popHistoryGroup(cache.redoList);
  if (steps.length === 0) return null;
  cache.undoList.push(...steps);
  return applyRedoSteps(ctx, steps);
}
