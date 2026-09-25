import { current, isDraft } from "immer";

/**
 * Row/column geometry.
 *
 * `ctx.visibledatarow[r]` is the bottom edge (px, zoomed, headers excluded)
 * of row r, i.e. a prefix sum of the row heights, with hidden rows repeating
 * the previous edge. The same holds for `visibledatacolumn`. Everything here
 * works on those arrays with binary search, so hit-testing and viewport
 * computation cost O(log n) regardless of the sheet size.
 */

/** A non-draft view of `value` for tight read loops (proxy reads are slow). */
export function plainValue<T>(value: T): T {
  return isDraft(value) ? (current(value) as T) : value;
}

/** First index i with ends[i] >= pos (same result as lodash `sortedIndex`). */
export function lowerBound(ends: ArrayLike<number>, pos: number) {
  let lo = 0;
  let hi = ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ends[mid] < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index i with ends[i] > pos (same result as lodash `sortedLastIndex`). */
export function upperBound(ends: ArrayLike<number>, pos: number) {
  let lo = 0;
  let hi = ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ends[mid] <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Edge positions of `count` rows (or columns): a prefix sum of
 * round((len + 1) * zoom), where len is `lens[i]` or `defaultLen`; hidden
 * entries add nothing. Only the sparse `lens`/`hidden` keys are looked up, on
 * plain objects, so a million rows take a few milliseconds.
 */
export function computeAxisPositions(
  count: number,
  defaultLen: number,
  lens: Record<string | number, number | string> | undefined | null,
  hidden: Record<string | number, unknown> | undefined | null,
  zoom: number
) {
  const positions: number[] = new Array(count);
  const lensPlain = lens ? plainValue(lens) : undefined;
  const hiddenPlain = hidden ? plainValue(hidden) : undefined;
  const defaultStep = Math.round((defaultLen + 1) * zoom);
  const hasLens = lensPlain != null && Object.keys(lensPlain).length > 0;
  const hasHidden = hiddenPlain != null && Object.keys(hiddenPlain).length > 0;
  let total = 0;
  if (!hasLens && !hasHidden) {
    for (let i = 0; i < count; i += 1) {
      total += defaultStep;
      positions[i] = total;
    }
    return { positions, total };
  }
  for (let i = 0; i < count; i += 1) {
    if (hasHidden && hiddenPlain![i] != null) {
      positions[i] = total;
      continue;
    }
    const len = hasLens ? lensPlain![i] : undefined;
    total += len ? Math.round(((len as number) + 1) * zoom) : defaultStep;
    positions[i] = total;
  }
  return { positions, total };
}

/**
 * Where one wheel notch scrolls to: `steps` distinct row edges down
 * (steps > 0) or up (steps < 0) from `pos`. Equivalent to the legacy
 * computation over `_.uniq(ends)`, without building that O(rows) copy.
 */
export function wheelScrollPosition(
  ends: ArrayLike<number>,
  pos: number,
  steps: number
) {
  const n = ends.length;
  if (n === 0) return 0;
  // first occurrence of the second-to-last distinct edge, or -1
  const secondLast = () => {
    const i = lowerBound(ends, ends[n - 1]) - 1;
    return i < 0 ? 0 : ends[i];
  };
  // p: first occurrence of the first distinct edge >= pos (n if none)
  let p = lowerBound(ends, pos);
  if (steps > 0) {
    if (p >= n) return secondLast();
    for (let k = 0; k < steps; k += 1) {
      p = upperBound(ends, ends[p]);
      if (p >= n) return secondLast();
    }
    // the target must not be the last distinct edge
    if (upperBound(ends, ends[p]) >= n) return secondLast();
    return ends[p];
  }
  for (let k = 0; k < -steps; k += 1) {
    if (p <= 0) return 0;
    p = lowerBound(ends, ends[p - 1]);
  }
  return ends[p];
}
