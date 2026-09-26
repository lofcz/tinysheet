/**
 * Floating objects selected together: charts and shapes of the current
 * sheet (Ctrl / Shift + click), as Excel's Arrange commands see them —
 * Align, Distribute, Group / Regroup / Ungroup, Rotate and Flip.
 *
 * One chart alone is `ctx.activeChart` (the Chart Design / Format tabs);
 * anything more is `ctx.selectedCharts` plus `ctx.activeShapes`. Charts
 * and shapes of one group share a `group` id; a click on one selects the
 * whole group, a second click the object itself (Excel).
 */
import type { Context } from "../context";
import type { Chart } from "./chart";
import { getChartBox, setChartBox } from "./chartAnchor";
import {
  getShapeBox,
  getSheetShapes,
  setShapeBoxes,
  Shape,
  ShapeAlign,
  ShapeBox,
  unionBox,
} from "./shapes";

export type ObjectRef = { kind: "chart" | "shape"; id: string };

function sheetOf(ctx: Context) {
  return ctx.luckysheetfile.find((s) => s.id === ctx.currentSheetId);
}

function sheetCharts(ctx: Context): Chart[] {
  return sheetOf(ctx)?.charts ?? [];
}

/** The objects selected now (a chart alone, or a multi-selection). */
export function selectedObjects(ctx: Context): ObjectRef[] {
  const out: ObjectRef[] = [];
  const charts = new Set(sheetCharts(ctx).map((c) => c.id));
  if (ctx.activeChart && charts.has(ctx.activeChart)) {
    out.push({ kind: "chart", id: ctx.activeChart });
  }
  (ctx.selectedCharts ?? []).forEach((id) => {
    if (charts.has(id) && id !== ctx.activeChart) {
      out.push({ kind: "chart", id });
    }
  });
  (ctx.activeShapes ?? []).forEach((id) => out.push({ kind: "shape", id }));
  return out;
}

/** Charts and shapes of group `group` on the current sheet. */
export function groupMembers(ctx: Context, group: string): ObjectRef[] {
  return [
    ...sheetCharts(ctx)
      .filter((c) => c.group === group)
      .map((c) => ({ kind: "chart" as const, id: c.id })),
    ...getSheetShapes(ctx)
      .filter((s) => s.group === group)
      .map((s) => ({ kind: "shape" as const, id: s.id })),
  ];
}

function objectOf(ctx: Context, ref: ObjectRef): Chart | Shape | undefined {
  return ref.kind === "chart"
    ? sheetCharts(ctx).find((c) => c.id === ref.id)
    : getSheetShapes(ctx).find((s) => s.id === ref.id);
}

export function objectGroup(ctx: Context, ref: ObjectRef) {
  return objectOf(ctx, ref)?.group;
}

/**
 * Select `refs` (their groups included unless `inside`): one chart alone
 * becomes the active chart, more make a multi-selection.
 */
export function selectObjects(ctx: Context, refs: ObjectRef[], inside = false) {
  let all = refs;
  if (!inside) {
    const seen = new Set<string>();
    all = [];
    refs.forEach((r) => {
      const g = objectGroup(ctx, r);
      const members = g ? groupMembers(ctx, g) : [r];
      members.forEach((m) => {
        const key = `${m.kind}:${m.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        all.push(m);
      });
    });
  }
  const charts = all.filter((r) => r.kind === "chart").map((r) => r.id);
  const shapes = all.filter((r) => r.kind === "shape").map((r) => r.id);
  if (charts.length === 1 && shapes.length === 0) {
    ctx.activeChart = charts[0];
    ctx.selectedCharts = undefined;
    ctx.activeShapes = undefined;
    return;
  }
  ctx.activeChart = undefined;
  ctx.chartEditorOpen = false;
  ctx.chartElement = undefined;
  ctx.selectedCharts = charts.length ? charts : undefined;
  ctx.activeShapes = shapes.length ? shapes : undefined;
  ctx.editingShape = undefined;
}

/** Ctrl / Shift + click: add or remove an object (and its group). */
export function toggleObject(ctx: Context, ref: ObjectRef) {
  const current = selectedObjects(ctx);
  const g = objectGroup(ctx, ref);
  const members = g ? groupMembers(ctx, g) : [ref];
  const key = (r: ObjectRef) => `${r.kind}:${r.id}`;
  const have = new Set(current.map(key));
  const allIn = members.every((m) => have.has(key(m)));
  const next = allIn
    ? current.filter((r) => !members.some((m) => key(m) === key(r)))
    : [...current, ...members.filter((m) => !have.has(key(m)))];
  selectObjects(ctx, next, true);
}

/** Clear a multi-selection (charts and shapes). */
export function clearObjectSelection(ctx: Context) {
  ctx.selectedCharts = undefined;
  ctx.activeShapes = undefined;
  ctx.editingShape = undefined;
}

/** Box of an object in sheet px (zoom 1). */
export function objectBox(ctx: Context, ref: ObjectRef): ShapeBox | null {
  const o = objectOf(ctx, ref);
  if (!o) return null;
  if (ref.kind === "chart") {
    return getChartBox(ctx, ctx.currentSheetId, o as Chart);
  }
  return getShapeBox(ctx, o as Shape);
}

function setObjectBox(ctx: Context, ref: ObjectRef, box: ShapeBox) {
  const o = objectOf(ctx, ref);
  if (!o) return;
  const clamped = {
    ...box,
    left: Math.max(0, box.left),
    top: Math.max(0, box.top),
  };
  if (ref.kind === "chart") {
    setChartBox(ctx, ctx.currentSheetId, o as Chart, clamped);
  } else {
    setShapeBoxes(ctx, { [ref.id]: clamped });
  }
}

/** Move objects by (dx, dy) sheet px, kept on the sheet as a whole. */
export function moveObjects(
  ctx: Context,
  refs: ObjectRef[],
  dx: number,
  dy: number
) {
  const boxes = refs
    .map((r) => ({ r, b: objectBox(ctx, r) }))
    .filter((x): x is { r: ObjectRef; b: ShapeBox } => !!x.b);
  const u = unionBox(boxes.map((x) => x.b));
  if (!u) return;
  const mx = Math.max(dx, -u.left);
  const my = Math.max(dy, -u.top);
  boxes.forEach(({ r, b }) =>
    setObjectBox(ctx, r, { ...b, left: b.left + mx, top: b.top + my })
  );
}

/** Selected objects as units: a group moves as one. */
function units(ctx: Context, refs: ObjectRef[]) {
  const byGroup = new Map<string, ObjectRef[]>();
  const out: ObjectRef[][] = [];
  refs.forEach((r) => {
    const g = objectGroup(ctx, r);
    if (!g) {
      out.push([r]);
      return;
    }
    const unit = byGroup.get(g);
    if (unit) unit.push(r);
    else {
      const created = [r];
      byGroup.set(g, created);
      out.push(created);
    }
  });
  return out
    .map((unit) => {
      const boxes = unit
        .map((r) => objectBox(ctx, r))
        .filter((b): b is ShapeBox => !!b);
      return { unit, box: unionBox(boxes) };
    })
    .filter((u): u is { unit: ObjectRef[]; box: ShapeBox } => !!u.box);
}

/** Align Left / Center / Right / Top / Middle / Bottom (two or more). */
export function alignObjects(ctx: Context, how: ShapeAlign) {
  const list = units(ctx, selectedObjects(ctx));
  if (list.length < 2) return;
  const all = unionBox(list.map((u) => u.box))!;
  list.forEach(({ unit, box }) => {
    let dx = 0;
    let dy = 0;
    if (how === "left") dx = all.left - box.left;
    if (how === "center")
      dx = all.left + all.width / 2 - (box.left + box.width / 2);
    if (how === "right") dx = all.left + all.width - (box.left + box.width);
    if (how === "top") dy = all.top - box.top;
    if (how === "middle")
      dy = all.top + all.height / 2 - (box.top + box.height / 2);
    if (how === "bottom") dy = all.top + all.height - (box.top + box.height);
    if (dx || dy) moveObjects(ctx, unit, dx, dy);
  });
}

/** Distribute Horizontally / Vertically (three or more: equal gaps). */
export function distributeObjects(
  ctx: Context,
  axis: "horizontal" | "vertical"
) {
  const list = units(ctx, selectedObjects(ctx));
  if (list.length < 3) return;
  const pos = (b: ShapeBox) => (axis === "horizontal" ? b.left : b.top);
  const size = (b: ShapeBox) => (axis === "horizontal" ? b.width : b.height);
  list.sort((a, b) => pos(a.box) - pos(b.box));
  const first = list[0].box;
  const last = list[list.length - 1].box;
  const span = pos(last) + size(last) - pos(first);
  const used = list.reduce((sum, u) => sum + size(u.box), 0);
  const gap = (span - used) / (list.length - 1);
  let at = pos(first);
  list.forEach(({ unit, box }) => {
    const delta = at - pos(box);
    at += size(box) + gap;
    if (Math.abs(delta) > 0.01) {
      moveObjects(
        ctx,
        unit,
        axis === "horizontal" ? delta : 0,
        axis === "vertical" ? delta : 0
      );
    }
  });
}

let groupSeed = 0;

/** Whether Group applies: two or more objects that are not one group. */
export function canGroupObjects(ctx: Context) {
  return units(ctx, selectedObjects(ctx)).length >= 2;
}

/** Whether Ungroup applies: a group is selected. */
export function canUngroupObjects(ctx: Context) {
  return selectedObjects(ctx).some((r) => !!objectGroup(ctx, r));
}

/** Whether Regroup applies: the selection was ungrouped from a group. */
export function canRegroupObjects(ctx: Context) {
  return selectedObjects(ctx).some((r) => !!objectOf(ctx, r)?.ungroupedFrom);
}

/** Group the selected objects (charts and shapes) into one. */
export function groupObjects(ctx: Context): string | null {
  const refs = selectedObjects(ctx);
  if (units(ctx, refs).length < 2) return null;
  groupSeed += 1;
  const group = `group_${Date.now().toString(36)}_${groupSeed}`;
  // every member of the groups involved
  const members: ObjectRef[] = [];
  const seen = new Set<string>();
  refs.forEach((r) => {
    const g = objectGroup(ctx, r);
    (g ? groupMembers(ctx, g) : [r]).forEach((m) => {
      const key = `${m.kind}:${m.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        members.push(m);
      }
    });
  });
  members.forEach((m) => {
    const o = objectOf(ctx, m);
    if (!o) return;
    o.group = group;
    delete o.ungroupedFrom;
  });
  selectObjects(ctx, members, true);
  return group;
}

/** Ungroup: the members stay selected and remember the group (Regroup). */
export function ungroupObjects(ctx: Context) {
  const refs = selectedObjects(ctx);
  const groups = new Set(
    refs.map((r) => objectGroup(ctx, r)).filter((g): g is string => !!g)
  );
  const members: ObjectRef[] = [];
  groups.forEach((g) =>
    groupMembers(ctx, g).forEach((m) => {
      const o = objectOf(ctx, m);
      if (!o) return;
      o.ungroupedFrom = g;
      delete o.group;
      members.push(m);
    })
  );
  if (members.length) selectObjects(ctx, members, true);
}

/** Regroup: the most recently ungrouped group of the selection again. */
export function regroupObjects(ctx: Context) {
  const refs = selectedObjects(ctx);
  const from = refs
    .map((r) => objectOf(ctx, r)?.ungroupedFrom)
    .find((g): g is string => !!g);
  if (!from) return;
  const members: ObjectRef[] = [
    ...sheetCharts(ctx)
      .filter((c) => c.ungroupedFrom === from)
      .map((c) => ({ kind: "chart" as const, id: c.id })),
    ...getSheetShapes(ctx)
      .filter((s) => s.ungroupedFrom === from)
      .map((s) => ({ kind: "shape" as const, id: s.id })),
  ];
  if (members.length < 2) return;
  members.forEach((m) => {
    const o = objectOf(ctx, m);
    if (!o) return;
    o.group = from;
    delete o.ungroupedFrom;
  });
  selectObjects(ctx, members, true);
}

/**
 * Rotate Right / Left 90°, Flip Vertical / Horizontal: shapes only —
 * charts cannot be rotated or flipped (Excel greys Rotate for them).
 */
export function canRotateObjects(ctx: Context) {
  const refs = selectedObjects(ctx);
  return refs.length > 0 && refs.every((r) => r.kind === "shape");
}

export function rotateObjects(
  ctx: Context,
  how: "right" | "left" | "flipV" | "flipH"
) {
  if (!canRotateObjects(ctx)) return;
  const want = new Set(
    selectedObjects(ctx)
      .filter((r) => r.kind === "shape")
      .map((r) => r.id)
  );
  getSheetShapes(ctx).forEach((s) => {
    if (!want.has(s.id)) return;
    if (how === "flipH") {
      if (s.flipH) delete s.flipH;
      else s.flipH = true;
    } else if (how === "flipV") {
      if (s.flipV) delete s.flipV;
      else s.flipV = true;
    } else {
      const rot =
        ((((s.rot ?? 0) + (how === "right" ? 90 : -90)) % 360) + 360) % 360;
      if (rot) s.rot = rot;
      else delete s.rot;
    }
  });
}
