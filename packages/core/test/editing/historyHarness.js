/**
 * A headless stand-in for the Workbook component's history plumbing: every
 * `act` runs a recipe through produceWithHistory (like setContext), `undo`
 * and `redo` go through the same core functions as Ctrl+Z / Ctrl+Y.
 */
import _ from "lodash";
import { contextFactory } from "../factories/context";
import { FormulaCache } from "../../src";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  produceWithHistory,
  undoHistory,
  redoHistory,
} from "../../src/modules/history";
import { updateCell } from "../../src/modules/cell";

export function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
}

export function parseA1(a1) {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  let c = 0;
  for (let i = 0; i < m[1].length; i += 1) {
    c = c * 26 + (m[1].charCodeAt(i) - 64);
  }
  return { r: parseInt(m[2], 10) - 1, c: c - 1 };
}

export function makeHost({ rows = 12, cols = 8 } = {}) {
  const cache = { undoList: [], redoList: [] };
  const refs = { globalCache: cache };
  const ctx = contextFactory({
    formulaCache: new FormulaCache(),
    groupValuesRefreshData: [],
    luckysheetCellUpdate: [],
    luckysheet_select_save: [
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ],
    luckysheetfile: [
      {
        name: "Sheet1",
        id: "id_1",
        order: 0,
        status: 1,
        data: emptyGrid(rows, cols),
        config: {},
      },
      {
        name: "Sheet2",
        id: "id_2",
        order: 1,
        status: 0,
        data: emptyGrid(rows, cols),
        config: {},
      },
    ],
    visibledatarow: Array.from({ length: rows }, (_v, i) => (i + 1) * 20),
    visibledatacolumn: Array.from({ length: cols }, (_v, i) => (i + 1) * 74),
    ch_width: cols * 74,
    rh_height: rows * 20,
    cellmainWidth: 800,
    cellmainHeight: 600,
    getRefs: () => refs,
  });
  const host = {
    // like defaultContext(), the workbook comes first: immer records a draft
    // shared by two places (sheet.config and ctx.config) under the first one
    ctx: { luckysheetfile: ctx.luckysheetfile, ...ctx },
    cache,
    act(recipe, options = {}) {
      host.ctx = produceWithHistory(
        host.ctx,
        (d) => {
          recipe(d);
          if (d.groupValuesRefreshData.length > 0) groupValuesRefresh(d);
        },
        options,
        cache
      ).result;
      return host;
    },
    undo() {
      const step = undoHistory(host.ctx, cache);
      if (step) host.ctx = step.context;
      return host;
    },
    redo() {
      const step = redoHistory(host.ctx, cache);
      if (step) host.ctx = step.context;
      return host;
    },
    select(from, to = from) {
      const a = parseA1(from);
      const b = parseA1(to);
      host.ctx = { ...host.ctx };
      host.ctx.luckysheet_select_save = [
        {
          row: [a.r, b.r],
          column: [a.c, b.c],
          row_focus: a.r,
          column_focus: a.c,
        },
      ];
      return host;
    },
  };
  return host;
}

/** Types a value or formula into a cell (as one undo step). */
export function type(host, a1, text, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  host.act((d) => {
    const prev = d.currentSheetId;
    d.currentSheetId = sheetId;
    updateCell(d, r, c, { innerText: text, innerHTML: text }, text);
    d.currentSheetId = prev;
  });
}

export function sheetOf(ctx, sheetId = "id_1") {
  return ctx.luckysheetfile.find((s) => s.id === sheetId);
}

export function cellAt(ctx, a1, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  return sheetOf(ctx, sheetId)?.data?.[r]?.[c] ?? null;
}

export function val(ctx, a1, sheetId = "id_1") {
  return cellAt(ctx, a1, sheetId)?.v;
}

/** Everything undo must restore: the workbook plus the context mirrors. */
export function snapshot(ctx) {
  return _.cloneDeep({
    sheets: _.sortBy(
      ctx.luckysheetfile.map((s) =>
        _.omit(s, ["luckysheet_select_save", "luckysheet_selection_range"])
      ),
      "id"
    ),
    config: ctx.config,
    filter: ctx.filter ?? {},
    filterSave: ctx.luckysheet_filter_save ?? null,
  });
}

/**
 * Runs `operation` as one step, checks that it changed something, that
 * undo restores the exact previous state, and redo the exact new state.
 * Returns the host after redo.
 */
export function expectUndoRedo(host, operation) {
  const before = snapshot(host.ctx);
  const undoDepth = host.cache.undoList.length;
  operation(host);
  const after = snapshot(host.ctx);
  expect(after).not.toEqual(before);
  expect(host.cache.undoList.length).toBe(undoDepth + 1);
  host.undo();
  expect(snapshot(host.ctx)).toEqual(before);
  host.redo();
  expect(snapshot(host.ctx)).toEqual(after);
  return host;
}
