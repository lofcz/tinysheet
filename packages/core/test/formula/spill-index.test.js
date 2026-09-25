/**
 * The spill anchor index (spillIndex.ts): inserting or deleting rows and
 * columns re-spills every anchor, looking only at the anchors and the
 * rectangles of their spills instead of scanning the whole sheet. The
 * results must be exactly those of the whole-sheet scan.
 */
import { makeContext, input, parseA1 } from "./helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import {
  setSpillScanVerifier,
  setSpillStructureFullScan,
  spillAnchorsOf,
  invalidateSpillAnchors,
} from "../../src/modules/spill";

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sheet with values, a few spilling formulas and some obstacles. */
function scenario(seed) {
  const rand = mulberry32(seed);
  const ctx = makeContext({ rows: 40, cols: 12 });
  for (let r = 1; r <= 12; r += 1) input(ctx, `A${r}`, String(r * 3));
  const anchors = [
    ["C2", "=A1:A5*2"],
    ["E1", "=SEQUENCE(4,3)"],
    ["C12", "=TRANSPOSE(A1:A4)"],
    ["J20", "=SEQUENCE(6)"],
    ["B25", "=SEQUENCE(2,5)"],
  ];
  anchors.forEach(([a1, f]) => {
    if (rand() < 0.85) input(ctx, a1, f);
  });
  // an obstacle blocking one spill now and then
  if (rand() < 0.5) input(ctx, "F3", "x");
  input(ctx, "L30", "=SUM(C2:C6)");
  input(ctx, "K1", "=SEQUENCE(3)", "id_2");
  input(ctx, "A1", `=SUM(Sheet1!C2#)`, "id_2");
  return { ctx, rand };
}

function operations(rand) {
  const ops = [];
  for (let i = 0; i < 6; i += 1) {
    const type = rand() < 0.5 ? "row" : "column";
    const max = type === "row" ? 30 : 10;
    const at = Math.floor(rand() * max);
    if (rand() < 0.5) {
      ops.push({
        insert: true,
        type,
        index: at,
        count: 1 + Math.floor(rand() * 3),
        direction: rand() < 0.5 ? "lefttop" : "rightbottom",
      });
    } else {
      ops.push({
        insert: false,
        type,
        start: at,
        end: at + Math.floor(rand() * 3),
      });
    }
  }
  return ops;
}

function apply(ctx, op) {
  if (op.insert) {
    const { type, index, count, direction } = op;
    insertRowCol(ctx, { type, index, count, direction, id: "id_1" }, false);
  } else {
    deleteRowCol(ctx, {
      type: op.type,
      start: op.start,
      end: op.end,
      id: "id_1",
    });
  }
}

function snapshot(ctx) {
  return JSON.parse(
    JSON.stringify(ctx.luckysheetfile.map((s) => ({ id: s.id, data: s.data })))
  );
}

describe("spill anchor index", () => {
  afterEach(() => {
    setSpillStructureFullScan(false);
    setSpillScanVerifier(null);
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "row/column changes give the whole-scan result (seed %i)",
    (seed) => {
      const run = (full) => {
        setSpillStructureFullScan(full);
        const { ctx, rand } = scenario(seed);
        const states = [];
        operations(rand).forEach((op) => {
          apply(ctx, op);
          states.push(snapshot(ctx));
        });
        return states;
      };
      const indexed = run(false);
      const full = run(true);
      expect(indexed).toEqual(full);
    }
  );

  test("the restricted scan finds what a whole-sheet scan finds", () => {
    let checks = 0;
    setSpillScanVerifier((restricted, full) => {
      checks += 1;
      const byPos = (a, b) => a.r - b.r || a.c - b.c;
      expect(Array.from(restricted.anchors.values()).sort(byPos)).toEqual(
        Array.from(full.anchors.values()).sort(byPos)
      );
      expect(restricted.ghosts).toEqual(full.ghosts);
    });
    const { ctx, rand } = scenario(11);
    operations(rand).forEach((op) => apply(ctx, op));
    expect(checks).toBeGreaterThan(0);
  });

  test("a structural change looks at the anchors, not the whole sheet", () => {
    const ctx = makeContext({ rows: 3000, cols: 40 });
    input(ctx, "A1", "1");
    input(ctx, "A2", "2");
    input(ctx, "C1", "=A1:A2*10");
    input(ctx, "AA1500", "=SEQUENCE(3,2)");
    const visited = [];
    setSpillScanVerifier((restricted) => {
      visited.push(restricted.visited);
    });
    insertRowCol(
      ctx,
      { type: "row", index: 100, count: 2, direction: "lefttop", id: "id_1" },
      false
    );
    expect(visited.length).toBeGreaterThan(0);
    expect(Math.max(...visited)).toBeLessThan(100);
    const { r } = parseA1("AA1502");
    expect(ctx.luckysheetfile[0].data[r][26].spill).toEqual({ rs: 3, cs: 2 });
    expect(ctx.luckysheetfile[0].data[r + 2][27].v).toBe(6);
  });

  test("the index follows spill writes and survives invalidation", () => {
    const ctx = makeContext({ rows: 30, cols: 10 });
    input(ctx, "B2", "=SEQUENCE(3)");
    expect(spillAnchorsOf(ctx, "id_1")).toEqual([
      { r: 1, c: 1, rs: 3, cs: 1, blocked: false },
    ]);
    input(ctx, "D2", "=SEQUENCE(1,2)");
    input(ctx, "B2", "5");
    expect(spillAnchorsOf(ctx, "id_1")).toEqual([
      { r: 1, c: 3, rs: 1, cs: 2, blocked: false },
    ]);
    invalidateSpillAnchors(ctx);
    expect(spillAnchorsOf(ctx, "id_1")).toEqual([
      { r: 1, c: 3, rs: 1, cs: 2, blocked: false },
    ]);
    input(ctx, "E2", "block");
    expect(spillAnchorsOf(ctx, "id_1")).toEqual([
      { r: 1, c: 3, rs: 1, cs: 2, blocked: true },
    ]);
  });
});
