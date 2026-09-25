import _ from "lodash";
import produce from "immer";
import {
  computeAxisPositions,
  lowerBound,
  upperBound,
  wheelScrollPosition,
} from "../../src/modules/geometry";
import { updateContextWithSheetData } from "../../src/context";
import { handleGlobalWheel } from "../../src/events/mouse";

function rng(seed) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
}

// The pre-geometry implementation of one wheel notch, over _.uniq(ends).
function legacyWheel(ends, scrollTop, deltaY, step) {
  const u = _.uniq(ends);
  const rowSt = _.sortedIndex(u, scrollTop) + 1;
  let rowEd;
  if (deltaY > 0) {
    rowEd = rowSt + step;
    if (rowEd >= u.length) rowEd = u.length - 1;
  } else {
    rowEd = rowSt - step;
    if (rowEd < 0) rowEd = 0;
  }
  return rowEd === 0 ? 0 : u[rowEd - 1];
}

// The pre-geometry row edge computation.
function legacyAxis(count, defaultLen, lens, hidden, zoom) {
  const out = [];
  let total = 0;
  for (let r = 0; r < count; r += 1) {
    let len = defaultLen;
    if (lens?.[r]) len = lens[r];
    if (hidden?.[r] != null) {
      out.push(total);
      continue;
    }
    total += Math.round((len + 1) * zoom);
    out.push(total);
  }
  return { positions: out, total };
}

describe("geometry", () => {
  test("lowerBound/upperBound match lodash", () => {
    const next = rng(7);
    for (let t = 0; t < 200; t += 1) {
      const arr = _.sortBy(
        _.times(Math.floor(next() * 30), () => Math.floor(next() * 20))
      );
      const v = Math.floor(next() * 24) - 2;
      expect(lowerBound(arr, v)).toBe(_.sortedIndex(arr, v));
      expect(upperBound(arr, v)).toBe(_.sortedLastIndex(arr, v));
    }
  });

  test("computeAxisPositions matches the legacy prefix sums", () => {
    const next = rng(11);
    for (let t = 0; t < 50; t += 1) {
      const count = Math.floor(next() * 60);
      const lens = {};
      const hidden = {};
      for (let i = 0; i < count; i += 1) {
        if (next() < 0.2) lens[i] = Math.floor(next() * 50);
        if (next() < 0.15) hidden[i] = 0;
      }
      const zoom = [1, 0.5, 1.25, 2][t % 4];
      expect(computeAxisPositions(count, 19, lens, hidden, zoom)).toEqual(
        legacyAxis(count, 19, lens, hidden, zoom)
      );
    }
    // works on drafts too
    produce({ lens: { 2: 40 }, hidden: { 3: 0 } }, (d) => {
      expect(computeAxisPositions(5, 19, d.lens, d.hidden, 1)).toEqual(
        legacyAxis(5, 19, { 2: 40 }, { 3: 0 }, 1)
      );
    });
  });

  test("wheelScrollPosition matches the legacy _.uniq walk", () => {
    const next = rng(3);
    for (let t = 0; t < 400; t += 1) {
      const count = 1 + Math.floor(next() * 25);
      const hidden = {};
      for (let i = 0; i < count; i += 1) if (next() < 0.3) hidden[i] = 0;
      const { positions } = legacyAxis(count, 19, {}, hidden, 1);
      const max = positions.length ? positions[positions.length - 1] : 0;
      const scrollTop = Math.floor(next() * (max + 40));
      const deltaY = next() < 0.5 ? 1 : -1;
      const step = 1 + Math.floor(next() * 3);
      expect(wheelScrollPosition(positions, scrollTop, deltaY * step)).toBe(
        legacyWheel(positions, scrollTop, deltaY, step)
      );
    }
  });

  test("a million rows lay out and scroll without O(rows) work per notch", () => {
    const ctx = {
      defaultrowlen: 19,
      defaultcollen: 73,
      zoomRatio: 1,
      config: { rowlen: { 5: 40 }, rowhidden: { 7: 0 } },
      luckysheetfile: [{ id: "s", data: [] }],
      currentSheetId: "s",
      luckysheet_select_save: [],
    };
    const data = { length: 1000000, 0: new Array(100).fill(null) };
    const t0 = Date.now();
    updateContextWithSheetData(ctx, data);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(ctx.visibledatarow.length).toBe(1000000);
    expect(ctx.visibledatacolumn.length).toBe(100);
    expect(ctx.visibledatarow[5]).toBe(6 * 20 + 21);
    expect(ctx.visibledatarow[7]).toBe(ctx.visibledatarow[6]);
    expect(Object.isFrozen(ctx.visibledatarow)).toBe(true);

    const scrollbarY = { scrollTop: 500000 * 20 };
    const scrollbarX = { scrollLeft: 0 };
    const t1 = Date.now();
    for (let i = 0; i < 1000; i += 1) {
      handleGlobalWheel(
        ctx,
        { deltaY: 1, deltaX: 0, preventDefault() {} },
        {},
        scrollbarX,
        scrollbarY
      );
    }
    expect(Date.now() - t1).toBeLessThan(500);
    expect(scrollbarY.scrollTop).toBeGreaterThan(500000 * 20);
  });
});
