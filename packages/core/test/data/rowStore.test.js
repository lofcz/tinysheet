/**
 * Chunked row storage (rowStore.ts): large sheets keep their rows in chunks
 * behind a matrix view, so an edit does not copy the whole row array.
 */
import _ from "lodash";
import { produce } from "immer";
import { makeHost, type, val, sheetOf } from "../editing/historyHarness";
import {
  createChunkedMatrix,
  isChunkedMatrix,
  materializeMatrix,
  setChunkedRowThreshold,
  getChunkedRowThreshold,
  ROW_CHUNK_SIZE,
  ROW_CHUNKS,
  reconcileChunkedSheets,
} from "../../src/modules/rowStore";
import { expandCellData } from "../../src/modules/sheetLoad";
import {
  produceWithHistory,
  produceContext,
  applyContextPatches,
} from "../../src/modules/history";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { sortSelection } from "../../src/modules/sort";
import { getFlowdata } from "../../src/context";
import { peek } from "../../src/modules/dependencyGraph";

const initialThreshold = getChunkedRowThreshold();
afterEach(() => setChunkedRowThreshold(initialThreshold));

function grid(rows, cols, fill = () => null) {
  return Array.from({ length: rows }, (_r, r) =>
    Array.from({ length: cols }, (_c, c) => fill(r, c))
  );
}

function plain(data) {
  return JSON.parse(JSON.stringify(data));
}

function chunkedHost(rows = 3000, cols = 6) {
  setChunkedRowThreshold(0);
  const host = makeHost({ rows, cols });
  // as loading a workbook does
  host.ctx = reconcileChunkedSheets(null, host.ctx);
  return host;
}

describe("matrix view", () => {
  test("indexes, iterates and serialises like a 2D array", () => {
    const rows = grid(2500, 3, (r, c) => (c === 0 ? { v: r } : null));
    const m = createChunkedMatrix(rows);
    expect(isChunkedMatrix(m)).toBe(true);
    expect(isChunkedMatrix(rows)).toBe(false);
    expect(Array.isArray(m)).toBe(false);
    expect(m instanceof Array).toBe(true);
    expect(m.length).toBe(2500);
    expect(m[0][0].v).toBe(0);
    expect(m[2499][0].v).toBe(2499);
    expect(m[2500]).toBeUndefined();
    expect(m[ROW_CHUNK_SIZE][0].v).toBe(ROW_CHUNK_SIZE);
    expect(1200 in m).toBe(true);
    expect(2500 in m).toBe(false);
    expect(m.map((row) => row[0].v)).toEqual(rows.map((row) => row[0].v));
    expect([...m].length).toBe(2500);
    expect(Array.from(m)[7]).toBe(rows[7]);
    expect([].concat(m).length).toBe(2500);
    expect(m.slice(10, 12)).toEqual([rows[10], rows[11]]);
    expect(m.slice(-1)[0]).toBe(rows[2499]);
    expect(m.findIndex((row) => row[0].v === 1500)).toBe(1500);
    expect(m.some((row) => row[0].v === 2400)).toBe(true);
    expect(m.filter((row) => row[0].v < 3).length).toBe(3);
    expect(m.reduce((n, row) => n + row[0].v, 0)).toBe((2499 * 2500) / 2);
    expect(JSON.stringify(m)).toBe(JSON.stringify(rows));
    expect(_.isEmpty(m)).toBe(false);
    expect(_.size(m)).toBe(2500);
    expect(_.map(m, (row) => row[0].v)[42]).toBe(42);
    expect(materializeMatrix(m)).toEqual(rows);
    expect(Object.keys(m).length).toBe(2500);
    expect(peek(m)[3][0].v).toBe(3);
  });

  test("is read-only outside of an update, like a frozen matrix", () => {
    const m = createChunkedMatrix(grid(10, 2).map((r) => Object.freeze(r)));
    expect(() => {
      m[1] = [1, 2];
    }).toThrow(TypeError);
    expect(() => m.push([1])).toThrow(TypeError);
    expect(() => {
      m[1][1] = 5;
    }).toThrow(TypeError);
    expect(() => Object.freeze(m)).toThrow(TypeError);
  });

  test("expandCellData chunks large sheets only", () => {
    setChunkedRowThreshold(1000);
    const small = expandCellData({ celldata: [], row: 999, column: 3 }, 1, 1);
    expect(isChunkedMatrix(small)).toBe(false);
    const big = expandCellData(
      { celldata: [{ r: 1500, c: 2, v: { v: 7 } }], row: 3000, column: 3 },
      1,
      1
    );
    expect(isChunkedMatrix(big)).toBe(true);
    expect(big.length).toBe(3000);
    expect(big[1500][2].v).toBe(7);
    expect(big[0].length).toBe(3);
  });
});

describe("editing chunked sheets", () => {
  test("large plain matrices become chunked after an update", () => {
    const host = chunkedHost();
    const sheet = sheetOf(host.ctx);
    expect(isChunkedMatrix(sheet.data)).toBe(true);
    expect(Object.keys(sheet)).not.toContain(String(ROW_CHUNKS));
    expect(Object.getOwnPropertySymbols(sheet)).toContain(ROW_CHUNKS);
    expect(Object.prototype.propertyIsEnumerable.call(sheet, ROW_CHUNKS)).toBe(
      false
    );
    expect(sheet.data.length).toBe(3000);
  });

  test("an edit copies one chunk and one row, and keeps old states intact", () => {
    const host = chunkedHost();
    const before = host.ctx;
    const oldData = sheetOf(before).data;
    type(host, "C2500", "hello");
    const { data } = sheetOf(host.ctx);
    expect(data).not.toBe(oldData);
    expect(data[2499][2].v).toBe("hello");
    expect(oldData[2499][2]).toBeNull();
    const oldChunks = sheetOf(before)[ROW_CHUNKS];
    const chunks = sheetOf(host.ctx)[ROW_CHUNKS];
    const touched = 2499 >> Math.log2(ROW_CHUNK_SIZE);
    const changed = chunks
      .map((chunk, i) => (chunk === oldChunks[i] ? -1 : i))
      .filter((i) => i >= 0);
    expect(changed).toEqual([touched]);
    expect(Object.isFrozen(chunks)).toBe(true);
    expect(Object.isFrozen(data[2499])).toBe(true);
    expect(Object.isFrozen(data[2499][2])).toBe(true);
  });

  test("patches use public paths; undo and redo restore the cells", () => {
    const host = chunkedHost();
    type(host, "B2100", "5");
    const step = host.cache.undoList[host.cache.undoList.length - 1];
    const dataPatches = step.patches.filter((p) => p.path[2] === "data");
    expect(dataPatches.length).toBeGreaterThan(0);
    dataPatches.forEach((p) => {
      expect(p.path.slice(0, 5)).toEqual([
        "luckysheetfile",
        0,
        "data",
        2099,
        1,
      ]);
    });
    expect(
      step.patches
        .concat(step.inversePatches)
        .some((p) => p.path.includes(ROW_CHUNKS))
    ).toBe(false);
    expect(val(host.ctx, "B2100")).toBe(5);
    host.undo();
    expect(val(host.ctx, "B2100")).toBeUndefined();
    expect(isChunkedMatrix(sheetOf(host.ctx).data)).toBe(true);
    host.redo();
    expect(val(host.ctx, "B2100")).toBe(5);
  });

  test("formulas recalculate across chunks", () => {
    const host = chunkedHost();
    type(host, "A1", "2");
    type(host, "A2999", "=A1*10");
    expect(val(host.ctx, "A2999")).toBe(20);
    type(host, "A1", "3");
    expect(val(host.ctx, "A2999")).toBe(30);
    host.undo();
    expect(val(host.ctx, "A2999")).toBe(20);
  });

  test("row and column operations match a plain matrix", () => {
    const run = (threshold) => {
      setChunkedRowThreshold(threshold);
      const host = makeHost({ rows: 2600, cols: 5 });
      host.ctx = reconcileChunkedSheets(null, host.ctx);
      type(host, "A1", "1");
      type(host, "B1030", "x");
      type(host, "C2050", "=A1+1");
      type(host, "E2600", "last");
      const ops = [
        { type: "row", index: 1024, count: 3, direction: "lefttop" },
        { type: "row", index: 0, count: 1, direction: "rightbottom" },
        { type: "column", index: 1, count: 2, direction: "lefttop" },
      ];
      const states = [];
      ops.forEach((op) => {
        host.act((d) => insertRowCol(d, { ...op, id: "id_1" }), {
          insertRowColOp: { ...op, id: "id_1" },
        });
        states.push(plain(sheetOf(host.ctx).data));
      });
      host.act(
        (d) =>
          deleteRowCol(d, { type: "row", start: 10, end: 1500, id: "id_1" }),
        {
          deleteRowColOp: { type: "row", start: 10, end: 1500, id: "id_1" },
        }
      );
      states.push(plain(sheetOf(host.ctx).data));
      host.undo();
      states.push(plain(sheetOf(host.ctx).data));
      host.undo();
      host.undo();
      states.push(plain(sheetOf(host.ctx).data));
      host.redo();
      host.redo();
      host.redo();
      states.push(plain(sheetOf(host.ctx).data));
      return { states, chunked: isChunkedMatrix(sheetOf(host.ctx).data) };
    };
    const a = run(0);
    const b = run(1e9);
    expect(a.chunked).toBe(true);
    expect(b.chunked).toBe(false);
    expect(a.states).toEqual(b.states);
  });

  test("splice, push and length inside an update", () => {
    const host = chunkedHost(2100, 2);
    host.act((d) => {
      const data = getFlowdata(d);
      const row = data[5];
      row[0] = { v: "drafted" };
      data.splice(3, 2, ["a", "b"]);
      data.push(["p", "q"]);
      data.unshift(["u", "v"]);
      // the row drafted before the move is still a draft
      data[5][1] = { v: "later" };
      data.length = 2000;
    });
    const { data } = sheetOf(host.ctx);
    expect(data.length).toBe(2000);
    expect(data[0]).toEqual(["u", "v"]);
    expect(data[4]).toEqual(["a", "b"]);
    expect(data[5][0].v).toBe("drafted");
    expect(data[5][1].v).toBe("later");
    host.undo();
    expect(sheetOf(host.ctx).data.length).toBe(2100);
    expect(sheetOf(host.ctx).data[5][0]).toBeNull();
    host.redo();
    expect(plain(sheetOf(host.ctx).data)).toEqual(plain(data));
  });

  test("sorting a chunked sheet", () => {
    const host = chunkedHost(2200, 2);
    [5, 3, 9, 1].forEach((v, i) => type(host, `A${2000 + i}`, String(v)));
    host.select("A2000", "A2003");
    host.act((d) => sortSelection(d, true));
    expect([0, 1, 2, 3].map((i) => val(host.ctx, `A${2000 + i}`))).toEqual([
      1, 3, 5, 9,
    ]);
  });

  test("applyContextPatches and produceContext work on chunked sheets", () => {
    const host = chunkedHost(2000, 2);
    const ctx = applyContextPatches(host.ctx, [
      {
        op: "replace",
        path: ["luckysheetfile", 0, "data", 1999, 1],
        value: { v: 9 },
      },
    ]);
    expect(sheetOf(ctx).data[1999][1].v).toBe(9);
    expect(sheetOf(host.ctx).data[1999][1]).toBeNull();
    const ctx2 = produceContext(ctx, (d) => {
      d.luckysheetfile[0].data[1999][1].v = 10;
    });
    expect(sheetOf(ctx2).data[1999][1].v).toBe(10);
    expect(sheetOf(ctx).data[1999][1].v).toBe(9);
  });

  test("a whole matrix assigned in an update replaces the rows", () => {
    const host = chunkedHost(2000, 2);
    host.act((d) => {
      d.luckysheetfile[0].data = grid(2500, 3, () => ({ v: 1 }));
    });
    expect(isChunkedMatrix(sheetOf(host.ctx).data)).toBe(true);
    expect(sheetOf(host.ctx).data.length).toBe(2500);
    const step = host.cache.undoList[host.cache.undoList.length - 1];
    expect(
      step.patches.filter((p) => p.path[2] === "data").map((p) => p.path)
    ).toEqual([["luckysheetfile", 0, "data"]]);
    host.undo();
    expect(sheetOf(host.ctx).data.length).toBe(2000);
    host.redo();
    expect(sheetOf(host.ctx).data[2499][2].v).toBe(1);
  });

  test("plain immer drafts of a context still read chunked sheets", () => {
    const host = chunkedHost(2000, 2);
    type(host, "B1500", "7");
    const out = produce(host.ctx, (d) => {
      d.probe = d.luckysheetfile[0].data[1499][1].v;
    });
    expect(out.probe).toBe(7);
  });
});

describe("per-edit cost at 1M rows", () => {
  test("a single-cell edit does not copy the row array", () => {
    setChunkedRowThreshold(initialThreshold);
    const rows = 1_000_000;
    const data = expandCellData(
      { celldata: [{ r: 0, c: 0, v: { v: 1 } }], row: rows, column: 20 },
      1,
      1
    );
    expect(isChunkedMatrix(data)).toBe(true);
    const host = makeHost({ rows: 2, cols: 2 });
    host.ctx = produceContext(host.ctx, (d) => {
      d.luckysheetfile[0].data = data;
    });
    const times = [];
    for (let i = 0; i < 20; i += 1) {
      const t0 = performance.now();
      host.ctx = produceWithHistory(
        host.ctx,
        (d) => {
          d.luckysheetfile[0].data[500_000 + i * 997][3] = { v: i, m: `${i}` };
        },
        {},
        host.cache
      ).result;
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    // eslint-disable-next-line no-console
    if (process.env.TINYSHEET_BENCH) console.log("1M-row edit (ms)", times);
    expect(sheetOf(host.ctx).data[500_000][3].v).toBe(0);
    expect(sheetOf(host.ctx).data.length).toBe(rows);
    // < 5 ms in practice; generous for slow CI machines
    expect(median).toBeLessThan(25);
  }, 60000);
});
