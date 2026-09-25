/**
 * reconcileSpills only looks at the cells an operation can have affected
 * (its regions, the formula cells of the calcChain, the rectangles of the
 * anchors found and the spilled cells reachable from the regions' edges)
 * instead of scanning the whole sheet. These tests check that this finds
 * exactly what a whole-sheet scan finds, over every spill scenario of the
 * spill suites, and that it looks at far fewer cells on a big sheet.
 */
import { makeContext, input, value, values, parseA1 } from "./helpers";
import {
  scanSpillCells,
  setSpillScanVerifier,
  reconcileSpills,
} from "../../src/modules/spill";

function normalize(scan) {
  const byPos = (a, b) => a.r - b.r || a.c - b.c;
  return {
    anchors: Array.from(scan.anchors.values()).sort(byPos),
    ghosts: scan.ghosts.slice().sort(byPos),
    pastedFormulas: scan.pastedFormulas.slice().sort(byPos),
    taggedFormulas: scan.taggedFormulas.slice().sort(byPos),
  };
}

let checked = 0;

function verify(restricted, full) {
  checked += 1;
  expect(normalize(restricted)).toEqual(normalize(full));
}

describe("restricted spill scan matches a whole-sheet scan", () => {
  beforeAll(() => setSpillScanVerifier(verify));
  afterAll(() => setSpillScanVerifier(null));

  // Every spill scenario (insert/delete rows and columns, sort, fill,
  // copy/cut/paste, drag-move, undo/redo, A1# references, sheet growth),
  // run again with the verifier on.
  /* eslint-disable global-require */
  require("./spill-ops.test");
  require("./spill.test");
  require("./spill-refs.test");
  /* eslint-enable global-require */

  test("the scenarios went through reconcileSpills", () => {
    expect(checked).toBeGreaterThan(20);
  });
});

describe("restricted spill scan", () => {
  function bigSheet() {
    const ctx = makeContext({ rows: 2000, cols: 40 });
    input(ctx, "A1", "1");
    input(ctx, "A2", "2");
    input(ctx, "A3", "3");
    input(ctx, "C1", "=A1:A3*10");
    input(ctx, "AA1500", "=SEQUENCE(3,2)");
    return ctx;
  }

  test("looks only at the regions, the formula cells and their spills", () => {
    const ctx = bigSheet();
    const view = ctx.luckysheetfile[0].data;
    const chain = ctx.luckysheetfile[0].calcChain;
    const options = { pasted: [{ row: [10, 11], column: [5, 6] }] };
    const restricted = scanSpillCells(view, options, chain);
    const full = scanSpillCells(view, options, chain, true);
    expect(normalize(restricted)).toEqual(normalize(full));
    expect(full.visited).toBe(2000 * 40);
    expect(restricted.visited).toBeLessThan(50);
    expect(restricted.anchors.size).toBe(2);
    expect(restricted.ghosts).toHaveLength(2 + 5);
  });

  test("a structural change still scans the whole sheet", () => {
    const ctx = bigSheet();
    const view = ctx.luckysheetfile[0].data;
    const scan = scanSpillCells(view, { all: true }, []);
    expect(scan.visited).toBe(2000 * 40);
    expect(scan.anchors.size).toBe(2);
  });

  test("finds the spill of an anchor moved out of the region", () => {
    const ctx = bigSheet();
    const { data } = ctx.luckysheetfile[0];
    const { r, c } = parseA1("C1");
    // cut C1 and paste it to E10, as moveCells does
    data[9][4] = data[r][c];
    data[r][c] = null;
    const options = {
      changed: [{ row: [0, 0], column: [2, 2] }],
      pasted: [{ row: [9, 9], column: [4, 4] }],
    };
    const chain = ctx.luckysheetfile[0].calcChain;
    const restricted = scanSpillCells(data, options, chain);
    const full = scanSpillCells(data, options, chain, true);
    // C2:C3 point at the old anchor: found from the region's bottom edge
    expect(normalize(restricted).ghosts).toEqual(normalize(full).ghosts);
    reconcileSpills(ctx, "id_1", options);
    expect(values(ctx, "C1", "C3")).toEqual([
      [undefined],
      [undefined],
      [undefined],
    ]);
    expect(values(ctx, "E10", "E12")).toEqual([[10], [20], [30]]);
    expect(value(ctx, "AA1500")).toBe(1);
  });
});
