import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RibbonGroup } from "./types";

export type GroupState = "full" | "compact" | "collapsed";

/** Width assumed for a collapsed group not measured yet (px). */
const COLLAPSED_ESTIMATE = 64;
/** Layout passes allowed per trigger before the ribbon stops adjusting. */
const MAX_PASSES = 24;

type Step = { group: string; to: GroupState };

/**
 * Excel's ribbon scaling. As the window narrows, groups get smaller in
 * their reduce order (lowest `priority` first, i.e. right to left by
 * default): first their large buttons turn small ("compact"), then each
 * group collapses into one drop-down button that opens the whole group.
 * Never a "More" dump of loose buttons.
 *
 * The ribbon renders at a `level` (how many reduce steps apply); after
 * every render the groups are measured (widths are remembered per group
 * and state), and the level moves to the lowest one that fits. Everything
 * happens in layout effects, so the user never sees an overflowing frame.
 */
export function useRibbonScaling(
  tabId: string | null,
  groups: RibbonGroup[],
  rowRef: React.RefObject<HTMLElement | null>,
  innerRef: React.RefObject<HTMLElement | null>
) {
  const steps = useMemo<Step[]>(() => {
    const order = groups
      .map((g, i) => ({ g, i }))
      .sort((a, b) => a.g.priority - b.g.priority || b.i - a.i)
      .map(({ g }) => g);
    const compactable = order.filter((g) =>
      g.columns.some((c) => c.kind === "large")
    );
    return [
      ...compactable.map((g) => ({ group: g.id, to: "compact" as const })),
      ...order.map((g) => ({ group: g.id, to: "collapsed" as const })),
    ];
  }, [groups]);

  const [level, setLevel] = useState(0);
  const [tick, setTick] = useState(0);
  const widths = useRef(new Map<string, Partial<Record<GroupState, number>>>());
  const passes = useRef(0);
  const lastKey = useRef<string | null>(null);

  const statesAt = (l: number) => {
    const out: Record<string, GroupState> = {};
    groups.forEach((g) => {
      out[g.id] = "full";
    });
    steps.slice(0, l).forEach((s) => {
      out[s.group] = s.to;
    });
    return out;
  };
  const states = statesAt(Math.min(level, steps.length));

  // a new tab (or group set) starts over from full size
  const key = `${tabId}|${groups.map((g) => g.id).join(",")}`;
  if (lastKey.current !== key) {
    lastKey.current = key;
    passes.current = 0;
    if (level !== 0) setLevel(0);
  }

  // container resized: re-evaluate
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return undefined;
    let last = row.clientWidth;
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === last) return;
      last = row.clientWidth;
      passes.current = 0;
      setTick((t) => t + 1);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const row = rowRef.current;
    const inner = innerRef.current;
    if (!row || !inner || row.clientWidth === 0) return;
    if (passes.current >= MAX_PASSES) return;
    passes.current += 1;

    // remember each group's width in the state it is shown in
    const els = Array.from(
      inner.querySelectorAll<HTMLElement>(":scope > [data-ribbon-group]")
    );
    let measured = 0;
    els.forEach((el) => {
      const id = el.dataset.ribbonGroup!;
      const w = el.getBoundingClientRect().width;
      measured += w;
      const rec = widths.current.get(`${tabId}/${id}`) ?? {};
      rec[states[id]] = w;
      widths.current.set(`${tabId}/${id}`, rec);
    });
    const content = inner.getBoundingClientRect().width;
    const overhead = content - measured;
    const style = getComputedStyle(row);
    const avail =
      row.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0);

    const estimate = (l: number, strict: boolean) => {
      const at = statesAt(l);
      let total = overhead;
      for (let i = 0; i < groups.length; i += 1) {
        const g = groups[i];
        const rec = widths.current.get(`${tabId}/${g.id}`) ?? {};
        const s = at[g.id];
        let w = rec[s];
        if (w == null) {
          if (strict) return Infinity;
          if (s === "collapsed") w = COLLAPSED_ESTIMATE;
          else w = rec.full ?? rec.compact ?? COLLAPSED_ESTIMATE * 3;
        }
        total += w;
      }
      return total;
    };

    const current = Math.min(level, steps.length);
    if (content > avail + 0.5 && current < steps.length) {
      let next = steps.length;
      for (let l = current + 1; l <= steps.length; l += 1) {
        if (estimate(l, false) <= avail) {
          next = l;
          break;
        }
      }
      setLevel(Math.max(current + 1, next));
      return;
    }
    if (content <= avail + 0.5 && current > 0) {
      // grew: the lowest level known to fit (a pixel of hysteresis)
      for (let l = 0; l < current; l += 1) {
        if (estimate(l, true) <= avail - 1) {
          setLevel(l);
          return;
        }
      }
    }
    // settled: later changes (window, selection) may adjust again
    passes.current = 0;
  });

  // `tick` only forces the layout effect above to run again
  void tick;
  return states;
}
