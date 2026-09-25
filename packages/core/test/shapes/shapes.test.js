import { makeContext } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import {
  alignShapes,
  anchorToPoint,
  anchorsToBox,
  configGeometry,
  copyShapes,
  deleteShapes,
  distributeShapes,
  duplicateShapes,
  formatShapeText,
  getShapeBox,
  groupShapes,
  insertShape,
  moveShapes,
  pasteShapes,
  plainToShapeText,
  pointToAnchor,
  reorderShapes,
  selectShapes,
  setShapeBoxes,
  shapeLabel,
  shapeTextHas,
  shapeTextToPlain,
  ungroupShapes,
  SHAPE_GALLERY,
} from "../../src/modules/shapes";
import {
  arrowHeadPath,
  presetOutline,
  DRAWN_PRESETS,
} from "../../src/modules/shapeGeometry";
import { MODEL_ADJUSTER_KEYS } from "../../src/modules/modelSync";
import { getReferenceAdjusterKeys } from "../../src/modules/refAdjust";

// Default geometry of the test context: rows 19+1 px, columns 73+1 px.
const ROW = 20;
const COL = 74;

function ctxWithShapes(n = 0) {
  const ctx = makeContext({ rows: 40, cols: 12 });
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const s = insertShape(ctx, "rect", {
      box: { left: 10 + i * 100, top: 30, width: 80, height: 40 },
    });
    ids.push(s.id);
  }
  return { ctx, ids };
}

const shapes = (ctx) => ctx.luckysheetfile[0].shapes ?? [];

describe("anchors", () => {
  test("pixel positions round-trip through cell anchors", () => {
    const geo = configGeometry({}, 19, 73);
    expect(pointToAnchor(geo, 100, 45)).toEqual({ r: 2, c: 1, dx: 26, dy: 5 });
    expect(anchorToPoint(geo, { r: 2, c: 1, dx: 26, dy: 5 })).toEqual({
      x: 100,
      y: 45,
    });
    const box = { left: 10, top: 30, width: 200, height: 70 };
    const from = pointToAnchor(geo, box.left, box.top);
    const to = pointToAnchor(geo, box.left + box.width, box.top + box.height);
    expect(anchorsToBox(geo, from, to)).toEqual(box);
  });

  test("hidden and resized rows move the anchor's pixel position", () => {
    const geo = configGeometry({ rowlen: { 0: 39 }, rowhidden: { 1: 0 } });
    // row 0 is 40px, row 1 hidden: row 2 starts at 40
    expect(anchorToPoint(geo, { r: 2, c: 0, dx: 0, dy: 3 })).toEqual({
      x: 0,
      y: 43,
    });
    // a point at y=40 lands in the visible row 2, not the hidden row 1
    expect(pointToAnchor(geo, 0, 40).r).toBe(2);
  });

  test("offsets are clamped to the cell when it shrinks", () => {
    const geo = configGeometry({ columnlen: { 0: 9 } });
    expect(anchorToPoint(geo, { r: 0, c: 0, dx: 50, dy: 0 }).x).toBe(10);
  });
});

describe("insert, select, move and delete", () => {
  test("insertShape adds a selected shape with Office defaults", () => {
    const { ctx } = ctxWithShapes();
    const s = insertShape(ctx, "ellipse", {
      box: { left: COL, top: ROW, width: 100, height: 50 },
    });
    expect(s.prst).toBe("ellipse");
    expect(s.name).toBe("Oval 1");
    expect(s.from).toEqual({ r: 1, c: 1, dx: 0, dy: 0 });
    expect(s.fill.color).toBe("#4472C4");
    expect(s.line).toEqual({ color: "#2F528F", width: 1 });
    expect(ctx.activeShapes).toEqual([s.id]);
    expect(getShapeBox(ctx, s)).toEqual({
      left: COL,
      top: ROW,
      width: 100,
      height: 50,
    });
  });

  test("gallery lines and text boxes get their own defaults", () => {
    const { ctx } = ctxWithShapes();
    const arrow = insertShape(ctx, "doubleArrowLine");
    expect(arrow.prst).toBe("line");
    expect(arrow.fill).toBeUndefined();
    expect(arrow.line.head).toBe("triangle");
    expect(arrow.line.tail).toBe("triangle");
    const tb = insertShape(ctx, "textBox", { text: "Hello\nworld" });
    expect(tb.textBox).toBe(true);
    expect(tb.fill.color).toBe("#FFFFFF");
    expect(shapeTextToPlain(tb.text)).toBe("Hello\nworld");
    expect(tb.text.anchor).toBe("t");
    expect(insertShape(ctx, "nope")).toBeNull();
    expect(SHAPE_GALLERY.length).toBeGreaterThanOrEqual(21);
  });

  test("read-only workbooks cannot insert", () => {
    const { ctx } = ctxWithShapes();
    ctx.allowEdit = false;
    expect(insertShape(ctx, "rect")).toBeNull();
  });

  test("moveShapes moves every selected shape and stops at the sheet edge", () => {
    const { ctx, ids } = ctxWithShapes(2);
    moveShapes(ctx, ids, 5, 10);
    expect(getShapeBox(ctx, shapes(ctx)[0])).toEqual({
      left: 15,
      top: 40,
      width: 80,
      height: 40,
    });
    moveShapes(ctx, ids, -500, 0);
    expect(getShapeBox(ctx, shapes(ctx)[0]).left).toBe(0);
    expect(getShapeBox(ctx, shapes(ctx)[1]).left).toBe(100);
  });

  test("setShapeBoxes re-anchors", () => {
    const { ctx, ids } = ctxWithShapes(1);
    setShapeBoxes(ctx, {
      [ids[0]]: { left: COL * 2 + 4, top: ROW * 3, width: COL, height: ROW },
    });
    expect(shapes(ctx)[0].from).toEqual({ r: 3, c: 2, dx: 4, dy: 0 });
    expect(shapes(ctx)[0].to).toEqual({ r: 4, c: 3, dx: 4, dy: 0 });
  });

  test("deleteShapes removes them and dissolves groups of one", () => {
    const { ctx, ids } = ctxWithShapes(3);
    groupShapes(ctx, [ids[0], ids[1]]);
    deleteShapes(ctx, [ids[0]]);
    expect(shapes(ctx).map((s) => s.id)).toEqual([ids[1], ids[2]]);
    expect(shapes(ctx)[0].group).toBeUndefined();
    expect(ctx.activeShapes).toEqual([ids[1]]);
  });

  test("selecting a group member selects the group; toggling adds/removes", () => {
    const { ctx, ids } = ctxWithShapes(3);
    groupShapes(ctx, [ids[0], ids[1]]);
    selectShapes(ctx, [ids[1]]);
    expect(ctx.activeShapes).toEqual([ids[0], ids[1]]);
    selectShapes(ctx, [ids[2]], true);
    expect(ctx.activeShapes).toEqual(ids);
    selectShapes(ctx, [ids[0]], true);
    expect(ctx.activeShapes).toEqual([ids[2]]);
  });
});

describe("z-order and groups", () => {
  test("front, back, forward and backward", () => {
    const { ctx, ids } = ctxWithShapes(4);
    const [a, b, c, d] = ids;
    const order = () => shapes(ctx).map((s) => s.id);
    reorderShapes(ctx, [a], "front");
    expect(order()).toEqual([b, c, d, a]);
    reorderShapes(ctx, [a], "back");
    expect(order()).toEqual([a, b, c, d]);
    reorderShapes(ctx, [a], "forward");
    expect(order()).toEqual([b, a, c, d]);
    reorderShapes(ctx, [d], "backward");
    expect(order()).toEqual([b, a, d, c]);
  });

  test("groups are contiguous and reorder as one", () => {
    const { ctx, ids } = ctxWithShapes(4);
    const [a, b, c, d] = ids;
    const g = groupShapes(ctx, [a, c]);
    expect(g).toBeTruthy();
    // members sit together at the topmost member's place
    expect(shapes(ctx).map((s) => s.id)).toEqual([b, a, c, d]);
    reorderShapes(ctx, [a], "front");
    expect(shapes(ctx).map((s) => s.id)).toEqual([b, d, a, c]);
    ungroupShapes(ctx, [c]);
    expect(shapes(ctx).every((s) => !s.group)).toBe(true);
    expect(groupShapes(ctx, [a])).toBeNull();
  });
});

describe("align and distribute", () => {
  test("align left / middle", () => {
    const { ctx, ids } = ctxWithShapes(3);
    alignShapes(ctx, ids, "left");
    expect(shapes(ctx).map((s) => getShapeBox(ctx, s).left)).toEqual([
      10, 10, 10,
    ]);
    setShapeBoxes(ctx, {
      [ids[1]]: { left: 10, top: 100, width: 80, height: 20 },
    });
    alignShapes(ctx, ids, "middle");
    const mids = shapes(ctx).map((s) => {
      const b = getShapeBox(ctx, s);
      return b.top + b.height / 2;
    });
    expect(new Set(mids).size).toBe(1);
  });

  test("distribute horizontally leaves equal gaps", () => {
    const { ctx, ids } = ctxWithShapes(3);
    setShapeBoxes(ctx, {
      [ids[1]]: { left: 120, top: 30, width: 80, height: 40 },
    });
    distributeShapes(ctx, ids, "horizontal");
    const lefts = shapes(ctx).map((s) => getShapeBox(ctx, s).left);
    expect(lefts).toEqual([10, 110, 210]);
  });
});

describe("clipboard", () => {
  test("copy + paste creates new shapes (and groups) at a position", () => {
    const { ctx, ids } = ctxWithShapes(2);
    groupShapes(ctx, ids);
    const clip = copyShapes(ctx, [ids[0]]);
    expect(clip.shapes).toHaveLength(2);
    const pasted = pasteShapes(ctx, clip, { left: COL * 5, top: ROW * 10 });
    expect(pasted).toHaveLength(2);
    const [p1, p2] = shapes(ctx).slice(2);
    expect(p1.id).not.toBe(ids[0]);
    expect(p1.group).toBeTruthy();
    expect(p1.group).toBe(p2.group);
    expect(p1.group).not.toBe(shapes(ctx)[0].group);
    expect(getShapeBox(ctx, p1).left).toBe(COL * 5);
    expect(getShapeBox(ctx, p1).top).toBe(ROW * 10);
    expect(ctx.activeShapes).toEqual(pasted);
  });

  test("duplicate offsets the copy", () => {
    const { ctx, ids } = ctxWithShapes(1);
    const [copy] = duplicateShapes(ctx, ids);
    const dup = shapes(ctx).find((s) => s.id === copy);
    expect(shapes(ctx)).toHaveLength(2);
    expect(getShapeBox(ctx, dup).left).toBe(22);
    expect(dup.name).not.toBe(shapes(ctx)[0].name);
  });
});

describe("structural changes (shapes follow their cells)", () => {
  test("adjuster is registered", () => {
    expect(MODEL_ADJUSTER_KEYS).toContain("model.shapes");
    expect(getReferenceAdjusterKeys()).toContain("model.shapes");
  });

  test("inserting rows above moves the shape, inside grows it", () => {
    const { ctx } = ctxWithShapes();
    const s = insertShape(ctx, "rect", {
      box: { left: 0, top: ROW * 2, width: 50, height: ROW * 3 },
    });
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    let shape = shapes(ctx)[0];
    expect(shape.from.r).toBe(4);
    expect(shape.to.r).toBe(7);
    insertRowCol(ctx, {
      type: "row",
      index: 5,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    [shape] = shapes(ctx);
    expect(shape.from.r).toBe(4);
    expect(shape.to.r).toBe(8);
    expect(shape.id).toBe(s.id);
  });

  test("deleting columns shrinks, deleting all of them removes", () => {
    const { ctx } = ctxWithShapes();
    insertShape(ctx, "rect", {
      box: { left: COL, top: 0, width: COL * 3, height: 20 },
    });
    insertShape(ctx, "rect", {
      box: { left: COL * 6, top: 0, width: COL - 10, height: 20 },
    });
    deleteRowCol(ctx, { type: "column", start: 2, end: 2, id: "id_1" });
    const [a, b] = shapes(ctx);
    expect(a.from.c).toBe(1);
    expect(a.to.c).toBe(3);
    expect(b.from.c).toBe(5);
    deleteRowCol(ctx, { type: "column", start: 5, end: 5, id: "id_1" });
    expect(shapes(ctx)).toHaveLength(1);
  });
});

describe("text", () => {
  test("plain text and formatting helpers", () => {
    const text = plainToShapeText("a\nb", {
      paragraphs: [{ align: "ctr", runs: [{ text: "x", b: true }] }],
    });
    expect(text.paragraphs).toEqual([
      { align: "ctr", runs: [{ text: "a", b: true }] },
      { align: "ctr", runs: [{ text: "b", b: true }] },
    ]);
    expect(shapeTextHas(text, "b")).toBe(true);
    const off = formatShapeText(text, { b: false, color: "#FF0000" });
    expect(shapeTextHas(off, "b")).toBe(false);
    expect(off.paragraphs[0].runs[0]).toEqual({ text: "a", color: "#FF0000" });
    expect(off.defaults).toEqual({ color: "#FF0000" });
    // empty text keeps its formatting in the defaults
    expect(shapeTextHas(formatShapeText(undefined, { i: true }), "i")).toBe(
      true
    );
  });

  test("labels for assistive technology", () => {
    expect(
      shapeLabel({
        prst: "ellipse",
        text: { paragraphs: [{ runs: [{ text: "Go" }] }] },
      })
    ).toBe("Oval: Go");
    expect(shapeLabel({ prst: "rect", alt: "Logo", name: "Rectangle 1" })).toBe(
      "Logo"
    );
  });
});

describe("preset geometry", () => {
  test.each(DRAWN_PRESETS)("%s has an outline and text box", (prst) => {
    const o = presetOutline(prst, 120, 80);
    expect(o.d).toMatch(/^M/);
    expect(o.d).not.toMatch(/NaN/);
    expect(o.text.w).toBeGreaterThanOrEqual(0);
  });

  test("lines are open with end directions; unknown presets are rectangles", () => {
    const line = presetOutline("line", 100, 50);
    expect(line.open).toBe(true);
    expect(line.ends.end).toMatchObject({ x: 100, y: 50 });
    expect(arrowHeadPath(line.ends.end, 2)).toMatch(/^M100,50/);
    expect(presetOutline("flowChartProcess", 10, 10).d).toBe(
      presetOutline("rect", 10, 10).d
    );
  });

  test("adjust values change the geometry", () => {
    expect(presetOutline("roundRect", 100, 100, { adj: 0 }).d).not.toBe(
      presetOutline("roundRect", 100, 100).d
    );
  });
});
