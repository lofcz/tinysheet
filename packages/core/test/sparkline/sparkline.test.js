import { makeContext, input } from "../formula/helpers";
import { makeHost, type as typeInto } from "../editing/historyHarness";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { insertCells } from "../../src/modules/shiftCells";
import { moveCellRange } from "../../src/modules/moveCells";
import {
  deleteSheet,
  duplicateSheet,
  renameSheet,
} from "../../src/modules/sheet";
import { getReferenceAdjusterKeys } from "../../src/modules/refAdjust";
import { hasCellDecorators } from "../../src/modules/extensions";
import {
  clearSparklineGroups,
  clearSparklines,
  editSparklineData,
  editSparklineGroup,
  groupSparklines,
  insertSparklines,
  planSparklines,
  rangesHaveSparklines,
  setSparklineGroupOptions,
  sparklineAt,
  sparklineLocale,
  ungroupSparklines,
} from "../../src/modules/sparkline";
import {
  computeSparklineAt,
  computeSparklineGroup,
  drawSparkline,
  sparklinePointRole,
} from "../../src/modules/sparklineRender";

function fill(ctx, rows, sheetId = "id_1") {
  // rows: { A1: "1", ... }
  Object.entries(rows).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

/** Sheet1!A1:D3 = three series of four values; sparklines in E1:E3. */
function setup() {
  const ctx = makeContext({ rows: 12, cols: 8 });
  fill(ctx, {
    A1: "1",
    B1: "3",
    C1: "2",
    D1: "5",
    A2: "-2",
    B2: "4",
    C2: "-1",
    D2: "3",
    A3: "10",
    B3: "20",
    C3: "30",
    D3: "40",
  });
  const res = insertSparklines(ctx, {
    type: "line",
    data: "A1:D3",
    location: "E1:E3",
    sheetId: "id_1",
  });
  expect(res.error).toBeUndefined();
  return { ctx, group: res.group };
}

const groupsOf = (ctx, sheetId = "id_1") =>
  ctx.luckysheetfile.find((s) => s.id === sheetId).sparklineGroups;

const refs = (ctx, sheetId = "id_1") =>
  (groupsOf(ctx, sheetId) || []).flatMap((g) =>
    g.sparklines.map((s) => [s.r, s.c, s.f])
  );

describe("registration", () => {
  test("the adjuster and the cell decorator are registered", () => {
    expect(getReferenceAdjusterKeys()).toContain("model.sparklines");
    expect(hasCellDecorators()).toBe(true);
  });

  test("locale falls back to English", () => {
    expect(sparklineLocale({ lang: "zh" }).group).toBe("组合");
    expect(sparklineLocale({ lang: "zh" }).errorData).toBe(
      "The data range is not valid."
    );
    expect(sparklineLocale({ lang: null }).line).toBe("Line");
  });
});

describe("planSparklines (Insert Sparklines validation)", () => {
  const ctx = makeContext();
  const plan = (data, location) => planSparklines(ctx, data, location, "id_1");

  test("one data row per location cell in a column", () => {
    expect(plan("A1:D3", "E1:E3").sparklines).toEqual([
      { r: 0, c: 4, f: "Sheet1!A1:D1" },
      { r: 1, c: 4, f: "Sheet1!A2:D2" },
      { r: 2, c: 4, f: "Sheet1!A3:D3" },
    ]);
  });

  test("one data column per location cell in a row", () => {
    expect(plan("=A1:C4", "A6:C6").sparklines).toEqual([
      { r: 5, c: 0, f: "Sheet1!A1:A4" },
      { r: 5, c: 1, f: "Sheet1!B1:B4" },
      { r: 5, c: 2, f: "Sheet1!C1:C4" },
    ]);
  });

  test("a single location takes a 1-D range from another sheet", () => {
    expect(plan("'My Sheet'!B2:B9", "F1").sparklines).toEqual([
      { r: 0, c: 5, f: "'My Sheet'!B2:B9" },
    ]);
  });

  test("errors", () => {
    expect(plan("A1:D3", "E1:F3").error).toBe("locationShape");
    expect(plan("A1:D3", "E1:E2").error).toBe("mismatch");
    expect(plan("A1:D3", "E1").error).toBe("dataShape");
    expect(plan("nonsense", "E1").error).toBe("data");
    expect(plan("A1:D1", "").error).toBe("location");
    expect(plan("A1:D1", "'My Sheet'!E1").error).toBe("locationSheet");
  });
});

describe("editing", () => {
  test("insert with defaults, lookup by cell", () => {
    const { ctx, group } = setup();
    expect(group.type).toBe("line");
    expect(group.displayEmptyCellsAs).toBe("gap");
    expect(sparklineAt(ctx, "id_1", 1, 4).sparkline.f).toBe("Sheet1!A2:D2");
    expect(sparklineAt(ctx, "id_1", 1, 3)).toBeNull();
    expect(
      rangesHaveSparklines(ctx, "id_1", [{ row: [0, 5], column: [4, 4] }])
    ).toBe(true);
    expect(
      rangesHaveSparklines(ctx, "id_1", [{ row: [0, 5], column: [0, 3] }])
    ).toBe(false);
  });

  test("win/loss groups show negative points by default", () => {
    const ctx = makeContext();
    const { group } = insertSparklines(ctx, {
      type: "winloss",
      data: "A1:D1",
      location: "E1",
      sheetId: "id_1",
    });
    expect(group.negative).toBe(true);
  });

  test("inserting over existing sparklines replaces them", () => {
    const { ctx } = setup();
    insertSparklines(ctx, {
      type: "column",
      data: "A2:D2",
      location: "E2",
      sheetId: "id_1",
    });
    const groups = groupsOf(ctx);
    expect(groups).toHaveLength(2);
    expect(groups[0].sparklines.map((s) => s.r)).toEqual([0, 2]);
    expect(sparklineAt(ctx, "id_1", 1, 4).group.type).toBe("column");
  });

  test("edit group data and single sparkline data", () => {
    const { ctx, group } = setup();
    expect(
      editSparklineGroup(ctx, "id_1", group.id, "A1:C2", "G1:G2")
    ).toBeNull();
    expect(refs(ctx)).toEqual([
      [0, 6, "Sheet1!A1:C1"],
      [1, 6, "Sheet1!A2:C2"],
    ]);
    expect(
      editSparklineGroup(ctx, "id_1", group.id, "A1:C2", "G1:G5").error
    ).toBe("mismatch");
    expect(editSparklineData(ctx, "id_1", 1, 6, "B5:B9")).toBeNull();
    expect(sparklineAt(ctx, "id_1", 1, 6).sparkline.f).toBe("Sheet1!B5:B9");
    expect(editSparklineData(ctx, "id_1", 1, 6, "B5:C9").error).toBe(
      "dataShape"
    );
  });

  test("options, group, ungroup and clear", () => {
    const { ctx, group } = setup();
    setSparklineGroupOptions(ctx, "id_1", [group.id], {
      type: "column",
      high: true,
      colors: { high: "#00ff00" },
      manualMin: undefined,
    });
    expect(groupsOf(ctx)[0]).toMatchObject({
      type: "column",
      high: true,
      colors: { high: "#00ff00", series: "#376092" },
    });

    expect(
      ungroupSparklines(ctx, "id_1", [{ row: [0, 0], column: [4, 4] }])
    ).toBe(3);
    expect(groupsOf(ctx)).toHaveLength(3);
    expect(groupsOf(ctx).every((g) => g.type === "column" && g.high)).toBe(
      true
    );

    // style the second one, then group all three taking the active cell's
    setSparklineGroupOptions(ctx, "id_1", [groupsOf(ctx)[1].id], {
      type: "winloss",
    });
    const grouped = groupSparklines(
      ctx,
      "id_1",
      [{ row: [0, 2], column: [4, 4] }],
      { r: 1, c: 4 }
    );
    expect(grouped.type).toBe("winloss");
    expect(groupsOf(ctx)).toHaveLength(1);
    expect(groupsOf(ctx)[0].sparklines).toHaveLength(3);

    expect(
      clearSparklines(ctx, "id_1", [{ row: [1, 1], column: [4, 4] }])
    ).toBe(1);
    expect(refs(ctx).map(([r]) => r)).toEqual([0, 2]);
    expect(
      clearSparklineGroups(ctx, "id_1", [{ row: [0, 0], column: [4, 4] }])
    ).toBe(1);
    expect(groupsOf(ctx)).toBeUndefined();
  });
});

describe("values and axis", () => {
  test("per-sparkline, same-for-all and custom axis bounds", () => {
    const { ctx, group } = setup();
    const items = computeSparklineGroup(ctx, groupsOf(ctx)[0], "id_1");
    expect(items[0].points.map((p) => p.v)).toEqual([1, 3, 2, 5]);
    expect(items[0].points.map((p) => p.x)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect([items[1].min, items[1].max]).toEqual([-2, 4]);
    setSparklineGroupOptions(ctx, "id_1", [group.id], {
      minAxisType: "group",
      maxAxisType: "custom",
      manualMax: 100,
    });
    const next = computeSparklineGroup(ctx, groupsOf(ctx)[0], "id_1");
    expect(next.map((s) => [s.min, s.max])).toEqual([
      [-2, 100],
      [-2, 100],
      [-2, 100],
    ]);
  });

  test("empty cells, hidden rows, right-to-left and the cache", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "", A3: "3", A4: "4" });
    const { group } = insertSparklines(ctx, {
      type: "line",
      data: "A1:A4",
      location: "B1",
      sheetId: "id_1",
    });
    const values = () =>
      computeSparklineAt(ctx, "id_1", 0, 1).computed.points.map((p) => p.v);
    expect(values()).toEqual([1, null, 3, 4]);
    setSparklineGroupOptions(ctx, "id_1", [group.id], {
      displayEmptyCellsAs: "zero",
    });
    // mutated in place (no immer here): the cache is keyed by the group
    ctx.luckysheetfile[0].sparklineGroups = [
      { ...ctx.luckysheetfile[0].sparklineGroups[0] },
    ];
    expect(values()).toEqual([1, 0, 3, 4]);

    // hidden rows are left out unless the group shows them
    ctx.config = { rowhidden: { 2: 0 } };
    expect(values()).toEqual([1, 0, 4]);
    ctx.luckysheetfile[0].sparklineGroups = [
      { ...ctx.luckysheetfile[0].sparklineGroups[0], displayHidden: true },
    ];
    expect(values()).toEqual([1, 0, 3, 4]);

    ctx.luckysheetfile[0].sparklineGroups = [
      { ...ctx.luckysheetfile[0].sparklineGroups[0], rightToLeft: true },
    ];
    const { points } = computeSparklineAt(ctx, "id_1", 0, 1).computed;
    expect(points.map((p) => p.v)).toEqual([4, 3, 0, 1]);
    expect(points[0].x).toBe(0);

    // new data (a new cell matrix, as after an edit) is picked up
    ctx.luckysheetfile[0].data = ctx.luckysheetfile[0].data.map((row) =>
      row.slice()
    );
    ctx.luckysheetfile[0].data[0][0] = { v: 9, m: "9", ct: { t: "n" } };
    expect(values()[3]).toBe(9);
  });

  test("date axis spaces the points by date", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "1",
      B1: "2",
      C1: "3",
      A2: "10",
      B2: "11",
      C2: "20",
    });
    const { group } = insertSparklines(ctx, {
      type: "line",
      data: "A1:C1",
      location: "D1",
      sheetId: "id_1",
      options: { dateAxis: "Sheet1!A2:C2" },
    });
    const items = computeSparklineGroup(ctx, group, "id_1");
    expect(items[0].points.map((p) => p.x)).toEqual([0, 0.1, 1]);
  });

  test("marker roles follow Excel's precedence", () => {
    const group = {
      type: "line",
      markers: true,
      negative: true,
      high: true,
      low: true,
      first: true,
      last: true,
    };
    const sp = {
      points: [
        { x: 0, v: -1 },
        { x: 0.25, v: -3 },
        { x: 0.5, v: 7 },
        { x: 0.75, v: 2 },
        { x: 1, v: null },
      ],
      dataMin: -3,
      dataMax: 7,
    };
    expect(sp.points.map((_p, i) => sparklinePointRole(group, sp, i))).toEqual([
      "first",
      "low",
      "high",
      "last",
      null,
    ]);
    expect(
      sparklinePointRole({ type: "column", markers: true }, sp, 3)
    ).toBeNull();
  });
});

function mockCanvas() {
  const calls = [];
  const rc = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  };
  [
    "save",
    "restore",
    "beginPath",
    "rect",
    "clip",
    "moveTo",
    "lineTo",
    "stroke",
    "arc",
    "fill",
  ].forEach((name) => {
    rc[name] = (...args) => calls.push([name, ...args]);
  });
  rc.fillRect = (...args) => calls.push(["fillRect", rc.fillStyle, ...args]);
  return rc;
}

describe("drawing", () => {
  const box = { x: 0, y: 0, w: 100, h: 20 };

  test("line with markers and an axis when the data crosses 0", () => {
    const rc = mockCanvas();
    const group = {
      type: "line",
      markers: true,
      displayXAxis: true,
      colors: { markers: "#123456" },
    };
    const sp = {
      points: [
        { x: 0, v: -1 },
        { x: 0.5, v: null },
        { x: 1, v: 3 },
      ],
      dataMin: -1,
      dataMax: 3,
      min: -1,
      max: 3,
    };
    drawSparkline(rc, group, sp, box);
    const names = rc.calls.map((c) => c[0]);
    // gap: two moveTo, no line between the points, two isolated dots +
    // two markers
    expect(names.filter((n) => n === "moveTo").length).toBe(3); // axis + 2
    expect(names.filter((n) => n === "arc").length).toBe(4);
    expect(names[0]).toBe("save");
    expect(names[names.length - 1]).toBe("restore");
  });

  test("column bars use the negative and high colours", () => {
    const rc = mockCanvas();
    const group = {
      type: "column",
      negative: true,
      high: true,
      colors: { series: "#111111", negative: "#ff0000", high: "#00ff00" },
    };
    const sp = {
      points: [
        { x: 0, v: 2 },
        { x: 0.5, v: -1 },
        { x: 1, v: 5 },
      ],
      dataMin: -1,
      dataMax: 5,
      min: -1,
      max: 5,
    };
    drawSparkline(rc, group, sp, box);
    const bars = rc.calls.filter((c) => c[0] === "fillRect");
    expect(bars.map((b) => b[1])).toEqual(["#111111", "#ff0000", "#00ff00"]);
    // the negative bar hangs below the zero line, the others stand on it
    const [, , , y0, , h0] = bars[0];
    const [, , , y1] = bars[1];
    expect(y1).toBeCloseTo(y0 + h0, 5);
  });

  test("win/loss bars fill the upper or lower half", () => {
    const rc = mockCanvas();
    const group = { type: "winloss", colors: { series: "#111111" } };
    const sp = {
      points: [
        { x: 0, v: 5 },
        { x: 0.5, v: 0 },
        { x: 1, v: -0.1 },
      ],
      dataMin: -0.1,
      dataMax: 5,
      min: -0.1,
      max: 5,
    };
    drawSparkline(rc, group, sp, box);
    const bars = rc.calls.filter((c) => c[0] === "fillRect");
    expect(bars).toHaveLength(2);
    expect(bars[0][3]).toBe(2); // from the top inset
    expect(bars[1][3]).toBeGreaterThan(10);
  });
});

describe("structural edits", () => {
  test("rows inserted above move locations and data", () => {
    const { ctx } = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(refs(ctx)).toEqual([
      [2, 4, "Sheet1!A3:D3"],
      [3, 4, "Sheet1!A4:D4"],
      [4, 4, "Sheet1!A5:D5"],
    ]);
  });

  test("a column inserted inside the data widens it", () => {
    const { ctx } = setup();
    insertRowCol(ctx, {
      type: "column",
      index: 1,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(refs(ctx)[0]).toEqual([0, 5, "Sheet1!A1:E1"]);
  });

  test("deleting a location row removes its sparkline; deleted data is #REF!", () => {
    const { ctx } = setup();
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    expect(refs(ctx)).toEqual([
      [0, 4, "Sheet1!A1:D1"],
      [1, 4, "Sheet1!A2:D2"],
    ]);
    deleteRowCol(ctx, { type: "column", start: 0, end: 3, id: "id_1" });
    expect(refs(ctx)).toEqual([
      [0, 0, "#REF!"],
      [1, 0, "#REF!"],
    ]);
    // nothing to draw, nothing thrown
    expect(computeSparklineAt(ctx, "id_1", 0, 0).computed.points).toEqual([]);
  });

  test("cells inserted with a shift", () => {
    const { ctx } = setup();
    insertCells(ctx, { row: [0, 0], column: [4, 4] }, "right", "id_1");
    expect(refs(ctx).map(([r, c]) => [r, c])).toEqual([
      [0, 5],
      [1, 4],
      [2, 4],
    ]);
  });

  test("moving the location cells to another sheet takes the sparklines", () => {
    const { ctx } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 1], column: [4, 4] } },
      { sheetId: "id_2", row: 5, column: 1 }
    );
    expect(refs(ctx)).toEqual([[2, 4, "Sheet1!A3:D3"]]);
    expect(refs(ctx, "id_2")).toEqual([
      [5, 1, "Sheet1!A1:D1"],
      [6, 1, "Sheet1!A2:D2"],
    ]);
  });

  test("moving the data moves the references", () => {
    const { ctx } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 2], column: [0, 3] } },
      { sheetId: "id_1", row: 6, column: 0 }
    );
    expect(refs(ctx).map(([, , f]) => f)).toEqual([
      "Sheet1!A7:D7",
      "Sheet1!A8:D8",
      "Sheet1!A9:D9",
    ]);
  });

  test("rename, duplicate and delete sheets", () => {
    const { ctx } = setup();
    ctx.currentSheetId = "id_2";
    insertSparklines(ctx, {
      type: "column",
      data: "Sheet1!A1:D1",
      location: "A1",
      sheetId: "id_2",
    });
    ctx.currentSheetId = "id_1";
    expect(renameSheet(ctx, "id_1", "Data")).toBeNull();
    expect(refs(ctx)[0][2]).toBe("Data!A1:D1");
    expect(refs(ctx, "id_2")[0][2]).toBe("Data!A1:D1");

    const copyId = duplicateSheet(ctx, "id_1", { newSheetId: "id_3" });
    const copy = ctx.luckysheetfile.find((s) => s.id === copyId);
    expect(copy.sparklineGroups[0].id).not.toBe(groupsOf(ctx)[0].id);
    expect(copy.sparklineGroups[0].sparklines[0].f).toBe("'Data (2)'!A1:D1");

    deleteSheet(ctx, "id_1");
    expect(refs(ctx, "id_2")[0][2]).toBe("#REF!");
  });
});

describe("undo and redo", () => {
  test("insert and option changes are single undo steps", () => {
    const host = makeHost();
    typeInto(host, "A1", "1");
    typeInto(host, "B1", "2");
    host.act((d) => {
      insertSparklines(d, {
        type: "line",
        data: "A1:B1",
        location: "C1",
        sheetId: "id_1",
      });
    });
    const { id } = groupsOf(host.ctx)[0];
    host.act((d) => {
      setSparklineGroupOptions(d, "id_1", [id], { type: "column" });
    });
    expect(groupsOf(host.ctx)[0].type).toBe("column");
    host.undo();
    expect(groupsOf(host.ctx)[0].type).toBe("line");
    host.undo();
    expect(groupsOf(host.ctx)).toBeUndefined();
    host.redo();
    host.redo();
    expect(groupsOf(host.ctx)[0].type).toBe("column");
    expect(
      computeSparklineAt(host.ctx, "id_1", 0, 2).computed.points.map((p) => p.v)
    ).toEqual([1, 2]);
  });
});
