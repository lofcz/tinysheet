import type { Context, Freezen } from "@lofcz/tinysheet-core";

/** A zoomed box in cell-area pixels. */
export type PaneBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Pane = {
  left: number;
  top: number;
  /** clip-path inset: top, right, bottom, left. */
  clip: [number, number, number, number];
  /** The scrolling pane's copy carries the selection handles. */
  primary: boolean;
};

type Span = { offset: number; clipStart: number; clipEnd: number };

/**
 * One axis of the frozen-pane split, like Excel: the part of an object in
 * the frozen rows (columns) stays put, the rest scrolls and is hidden under
 * the frozen band. `data` is the freeze data `[edge, _, scrollAtFreeze]`.
 */
function splitAxis(
  start: number,
  size: number,
  data: any[] | undefined,
  scroll: number
): { frozen?: Span; scrolled: Span } {
  if (!data) return { scrolled: { offset: 0, clipStart: 0, clipEnd: 0 } };
  const edge = data[0] as number;
  const off = scroll - (data[2] as number);
  const scrolled = {
    offset: 0,
    clipStart: Math.max(0, edge + off - start),
    clipEnd: 0,
  };
  const frozen =
    start < edge
      ? { offset: off, clipStart: 0, clipEnd: Math.max(0, start + size - edge) }
      : undefined;
  return { frozen, scrolled };
}

/**
 * Screen copies of a floating object for the current frozen panes (1, 2 or
 * 4), each clipped to its pane; the same rules as the chart layer. The
 * scrolling pane's copy is always first when present.
 */
export function placeInPanes(
  ctx: Context,
  freeze: Freezen | undefined,
  box: PaneBox
): Pane[] {
  const rows = splitAxis(
    box.top,
    box.height,
    freeze?.horizontal?.freezenhorizontaldata,
    ctx.scrollTop
  );
  const cols = splitAxis(
    box.left,
    box.width,
    freeze?.vertical?.freezenverticaldata,
    ctx.scrollLeft
  );
  const panes: Pane[] = [];
  [rows.scrolled, rows.frozen].forEach((r, ri) => {
    if (!r) return;
    [cols.scrolled, cols.frozen].forEach((c, ci) => {
      if (!c) return;
      // zero-size boxes (horizontal / vertical lines) still show
      if (r.clipStart + r.clipEnd >= Math.max(1, box.height)) return;
      if (c.clipStart + c.clipEnd >= Math.max(1, box.width)) return;
      panes.push({
        left: box.left + c.offset,
        top: box.top + r.offset,
        clip: [r.clipStart, c.clipEnd, r.clipEnd, c.clipStart],
        primary: ri === 0 && ci === 0,
      });
    });
  });
  return panes;
}
