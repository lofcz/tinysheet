import { produce, isDraft } from "immer";
import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  edit,
  val,
} from "./recalc-helpers";
import {
  jfrefreshgrid,
  groupValuesRefresh,
  insertRowCol,
  getFlowdata,
  getCircularReferences as publicGetCircularReferences,
} from "../../src";
import { DependencyGraph } from "../../src/modules/dependencyGraph";
import {
  getCircularReferences,
  getDependencyGraph,
  peek,
} from "../../src/modules/formulaHelper";

function info(key, r, c, id, f, deps) {
  return {
    key,
    r,
    c,
    id,
    calc_funcStr: f,
    formulaDependency: deps.map(([r0, r1, c0, c1, sheetId = id]) => ({
      row: [r0, r1],
      column: [c0, c1],
      sheetId,
    })),
    parents: {},
    chidren: {},
    color: "w",
  };
}

function dependents(graph, sheetId, r, c) {
  const out = new Set();
  graph.forEachDependent(sheetId, r, c, (k) => out.add(k));
  return [...out].sort();
}

describe("DependencyGraph index", () => {
  test("single cells, bucketed ranges and large ranges", () => {
    const g = new DependencyGraph({}, "");
    g.setNode(info("a", 0, 5, "s", "=A1", [[0, 0, 0, 0]]));
    g.setNode(info("b", 1, 5, "s", "=SUM(A1:A100)", [[0, 99, 0, 0]]));
    g.setNode(info("c", 2, 5, "s", "=SUM(A60:B70)", [[59, 69, 0, 1]]));
    // spans far more than the bucket limit -> "large" list
    g.setNode(info("d", 3, 5, "s", "=SUM(A1:Z100000)", [[0, 99999, 0, 25]]));
    g.setNode(info("e", 4, 5, "t", "=s!A1", [[0, 0, 0, 0, "s"]]));

    expect(dependents(g, "s", 0, 0)).toEqual(["a", "b", "d", "e"]);
    expect(dependents(g, "s", 63, 0)).toEqual(["b", "c", "d"]);
    expect(dependents(g, "s", 64, 1)).toEqual(["c", "d"]); // bucket border
    expect(dependents(g, "s", 69, 1)).toEqual(["c", "d"]);
    expect(dependents(g, "s", 70, 1)).toEqual(["d"]);
    expect(dependents(g, "s", 99999, 25)).toEqual(["d"]);
    expect(dependents(g, "s", 100000, 25)).toEqual([]);
    expect(dependents(g, "t", 0, 0)).toEqual([]);

    g.removeNode("c");
    g.removeNode("d");
    expect(dependents(g, "s", 63, 0)).toEqual(["b"]);
    expect(dependents(g, "s", 65, 1)).toEqual([]);
    // re-registering replaces the old edges
    g.setNode(info("a", 0, 5, "s", "=A2", [[1, 1, 0, 0]]));
    expect(dependents(g, "s", 0, 0)).toEqual(["b", "e"]);
    expect(dependents(g, "s", 1, 0)).toEqual(["a", "b"]);
  });

  test("shared ranges are stored once and released with the last reader", () => {
    const g = new DependencyGraph({}, "");
    for (let i = 0; i < 100; i += 1) {
      g.setNode(info(`k${i}`, i, 3, "s", "=SUM(A1:A5000)", [[0, 4999, 0, 0]]));
    }
    expect(g.sheets.get("s").ranges.size).toBe(1);
    expect(dependents(g, "s", 4000, 0)).toHaveLength(100);
    for (let i = 0; i < 100; i += 1) g.removeNode(`k${i}`);
    expect(g.sheets.get("s").ranges.size).toBe(0);
    expect(g.sheets.get("s").buckets.size).toBe(0);
  });

  test("topological order and cycle detection", () => {
    const g = new DependencyGraph({}, "");
    // A1 -> B1 -> C1, A1 -> C1 (diamond-ish), D1 <-> E1 cycle fed by C1
    g.setNode(info("B1", 0, 1, "s", "=A1", [[0, 0, 0, 0]]));
    g.setNode(info("C1", 0, 2, "s", "=A1+B1", [[0, 0, 0, 1]]));
    g.setNode(
      info("D1", 0, 3, "s", "=C1+E1", [
        [0, 0, 2, 2],
        [0, 0, 4, 4],
      ])
    );
    g.setNode(info("E1", 0, 4, "s", "=D1", [[0, 0, 3, 3]]));
    const roots = [];
    g.forEachDependent("s", 0, 0, (k) => roots.push(k));
    const { order, cyclic } = g.order(roots);
    expect(order.indexOf("B1")).toBeLessThan(order.indexOf("C1"));
    expect(order.indexOf("C1")).toBeLessThan(order.indexOf("D1"));
    expect(order).toHaveLength(4);
    expect([...cyclic].sort()).toEqual(["D1", "E1"]);
  });

  test("a 100k-long chain is ordered without recursion", () => {
    const g = new DependencyGraph({}, "");
    const n = 100000;
    for (let r = 1; r < n; r += 1) {
      g.setNode(info(`A${r + 1}`, r, 0, "s", "=x", [[r - 1, r - 1, 0, 0]]));
    }
    const roots = [];
    g.forEachDependent("s", 0, 0, (k) => roots.push(k));
    const { order } = g.order(roots);
    expect(order).toHaveLength(n - 1);
    expect(order[0]).toBe("A2");
    expect(order[n - 2]).toBe(`A${n}`);
  });
});

describe("recalculation engine", () => {
  test("volatile functions recalculate on every edit", () => {
    const s = makeSheet("Sheet1", "s1", 6, 4);
    putFormula(s, 0, 0, "=RAND()", 0.5);
    putFormula(s, 0, 1, "=A1*0+1", 1);
    putFormula(s, 0, 2, "=A1", 0.5);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    // tests/setup.js pins Math.random; hand out a fresh value per call
    const original = Math.random;
    let n = 0;
    Math.random = () => {
      n += 1;
      return n / 100;
    };
    try {
      const seen = new Set();
      for (let i = 0; i < 5; i += 1) {
        edit(ctx, 5, 3, String(i)); // unrelated cell
        const v = val(ctx, 0, 0);
        expect(typeof v).toBe("number");
        expect(val(ctx, 0, 2)).toBe(v); // dependents follow in the same pass
        seen.add(v);
      }
      expect(seen.size).toBe(5);
    } finally {
      Math.random = original;
    }
  });

  test("cross-sheet chain continues into same-sheet dependents", () => {
    // Sheet2!A1 reads Sheet1; Sheet2!B1/C1 only read Sheet2, so Sheet2 is only
    // partially indexed until the propagation reaches it
    const s1 = makeSheet("Sheet1", "s1", 4, 4, 0);
    const s2 = makeSheet("Sheet2", "s2", 4, 4, 1);
    putValue(s1, 0, 0, 1);
    putFormula(s2, 0, 0, "=Sheet1!A1", 1);
    putFormula(s2, 0, 1, "=A1*2", 2);
    putFormula(s2, 0, 2, "=B1+1", 3);
    putFormula(s2, 1, 0, "=SUM(A1:C1)", 6);
    const ctx = makeCtx([s1, s2]);
    loadWorkbook(ctx);

    edit(ctx, 0, 0, "10", "s1");
    expect(val(ctx, 0, 0, "s2")).toBe(10);
    expect(val(ctx, 0, 1, "s2")).toBe(20);
    expect(val(ctx, 0, 2, "s2")).toBe(21);
    expect(val(ctx, 1, 0, "s2")).toBe(51);
  });

  test("circular references are reported and cleared", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putFormula(s, 0, 1, "=A1+1", 2);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 2, "=B1+D1"); // C1
    expect(getCircularReferences(ctx)).toEqual([]);
    edit(ctx, 0, 3, "=C1*2"); // D1 closes C1 <-> D1
    const circ = getCircularReferences(ctx).map((x) => `${x.r},${x.c}`);
    expect(circ.sort()).toEqual(["0,2", "0,3"]);
    edit(ctx, 0, 0, "5"); // terminates, still circular
    expect(getCircularReferences(ctx)).toHaveLength(2);
    edit(ctx, 0, 3, "7"); // D1 becomes a value: cycle gone
    edit(ctx, 0, 0, "6");
    expect(getCircularReferences(ctx)).toEqual([]);
    expect(val(ctx, 0, 2)).toBe(14);

    edit(ctx, 3, 3, "=D4+1"); // self reference
    expect(getCircularReferences(ctx)).toEqual([{ r: 3, c: 3, id: "s1" }]);
    // also part of the public core API
    expect(publicGetCircularReferences(ctx)).toEqual(
      getCircularReferences(ctx)
    );
  });

  test("a deleted and re-created sheet name resolves to the new sheet", () => {
    const s1 = makeSheet("Sheet1", "s1", 4, 4, 0);
    const old = makeSheet("Data", "old", 4, 4, 1);
    putValue(old, 0, 0, 1);
    putFormula(s1, 0, 0, "=Data!A1*10", 10);
    const ctx = makeCtx([s1, old]);
    loadWorkbook(ctx);
    edit(ctx, 0, 0, "2", "old");
    expect(val(ctx, 0, 0, "s1")).toBe(20);

    const fresh = makeSheet("Data", "new", 4, 4, 1);
    ctx.luckysheetfile = [ctx.luckysheetfile[0], fresh];
    edit(ctx, 0, 0, "3", "new");
    expect(val(ctx, 0, 0, "s1")).toBe(30);
  });

  test("paste right after a row insert still finds dependents", () => {
    const s = makeSheet("Sheet1", "s1", 12, 4);
    for (let r = 0; r < 3; r += 1) putValue(s, r, 0, 1);
    putFormula(s, 0, 1, "=SUM(A1:A3)", 3);
    putFormula(s, 1, 1, "=A1+A3", 2);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 0, "1");

    insertRowCol(ctx, {
      type: "row",
      index: 8,
      count: 1,
      direction: "rightbottom",
      id: "s1",
    });
    for (let r = 0; r < 3; r += 1) {
      getFlowdata(ctx)[r][0] = { v: 4, m: "4", ct: { fa: "General", t: "n" } };
    }
    jfrefreshgrid(ctx, null, [{ row: [0, 2], column: [0, 0] }]);
    groupValuesRefresh(ctx);
    expect(val(ctx, 0, 1)).toBe(12);
    expect(val(ctx, 1, 1)).toBe(8);
  });

  test("calcChain membership stays in sync without scanning", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 1, "=A1+1");
    edit(ctx, 0, 1, "=A1+2");
    edit(ctx, 0, 2, "=B1+1");
    const chain = () =>
      ctx.luckysheetfile[0].calcChain.map((x) => `${x.r},${x.c}`).sort();
    expect(chain()).toEqual(["0,1", "0,2"]);
    edit(ctx, 0, 1, "9");
    expect(chain()).toEqual(["0,2"]);
    expect(val(ctx, 0, 2)).toBe(10);
    edit(ctx, 0, 1, "=A1*3");
    expect(chain()).toEqual(["0,1", "0,2"]);
    expect(val(ctx, 0, 2)).toBe(4);
  });

  test("a formula overwritten behind the engine's back is not resurrected", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putFormula(s, 0, 1, "=A1+1", 2);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 0, "2");
    expect(val(ctx, 0, 1)).toBe(3);
    // raw write that does not notify the graph
    getFlowdata(ctx)[0][1] = { v: "manual", m: "manual" };
    edit(ctx, 0, 0, "3");
    expect(val(ctx, 0, 1)).toBe("manual");
    expect(getDependencyGraph(ctx).nodes.size).toBe(0);
  });

  test("whole-column / whole-row references", () => {
    const s1 = makeSheet("Sheet1", "s1", 200, 6, 0);
    const s2 = makeSheet("Sheet2", "s2", 50, 4, 1);
    for (let r = 0; r < 3; r += 1) {
      putValue(s1, r, 0, r + 1); // A1:A3 = 1,2,3
      putValue(s1, r, 1, 10); // B1:B3 = 10
    }
    putFormula(s1, 0, 3, "=SUM(A:A)", 6);
    putFormula(s1, 1, 3, "=SUMPRODUCT(A:A,B:B)", 60);
    putFormula(s1, 3, 3, "=SUM(Sheet2!B:B)", 0);
    putFormula(s1, 4, 3, "=SUM(2:2)", 12);
    const ctx = makeCtx([s1, s2]);
    loadWorkbook(ctx);

    edit(ctx, 150, 0, "4", "s1"); // far below the data: extends the column
    expect(val(ctx, 0, 3, "s1")).toBe(10);
    // both whole columns are bounded to the same used extent
    expect(val(ctx, 1, 3, "s1")).toBe(60);

    edit(ctx, 7, 1, "5", "s2"); // Sheet2!B8
    expect(val(ctx, 3, 3, "s1")).toBe(5);

    edit(ctx, 1, 2, "100", "s1"); // C2, inside row 2
    expect(val(ctx, 4, 3, "s1")).toBe(2 + 10 + 100 + 60); // A2+B2+C2+D2
  });

  test("implicit intersection @ tracks the referenced range", () => {
    const s = makeSheet("Sheet1", "s1", 10, 4);
    for (let r = 0; r < 5; r += 1) putValue(s, r, 0, r);
    putFormula(s, 2, 1, "=@A1:A5*10", 20);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 2, 0, "7");
    expect(val(ctx, 2, 1)).toBe(70);
  });

  test("peek reads immer drafts without creating child drafts", () => {
    // plain objects are returned as-is
    const o = { a: 1 };
    expect(peek(o)).toBe(o);
    expect(peek(null)).toBe(null);
    expect(peek(5)).toBe(5);

    const base = { rows: [{ v: 1 }, { v: 2 }, { v: 3 }] };
    produce(base, (d) => {
      const rows = peek(d.rows);
      expect(isDraft(rows)).toBe(false);
      expect(rows).toBe(base.rows); // untouched: the base itself
      d.rows[1].v = 20; // modify through the draft
      const latest = peek(d.rows);
      expect(isDraft(latest)).toBe(false);
      expect(peek(latest[1]).v).toBe(20); // sees the draft's change
      expect(peek(latest[2])).toBe(base.rows[2]); // no draft created
    });
  });
});
