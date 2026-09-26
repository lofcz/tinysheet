/**
 * Frozen panes for objects drawn over the grid (charts, a chart's source
 * ranges), like Excel: the part of an object in the frozen rows / columns
 * stays put, the rest scrolls and is hidden under the frozen band. An
 * object across the frozen edge is drawn once per pane it shows in, each
 * copy clipped to its pane.
 */
import type { Context, Freezen } from "@lofcz/tinysheet-core";

export type Box = { left: number; top: number; width: number; height: number };

export type Pane = {
  left: number;
  top: number;
  /** clip-path inset: top, right, bottom, left. */
  clip: [number, number, number, number];
  /** The scrolling pane's copy carries the selection handles. */
  primary: boolean;
};

type Span = { offset: number; clipStart: number; clipEnd: number };

/** Room kept outside a clipped box for its handles and buttons. */
export const PANE_OUTSIDE = 48;

/**
 * One axis of the split: `edge` is the frozen boundary in sheet pixels,
 * `off` the scroll offset since freezing.
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

/** Screen copies of a box (zoomed sheet px) for the frozen panes (1–4). */
export function placeInPanes(
  ctx: Pick<Context, "scrollTop" | "scrollLeft">,
  freeze: Freezen | undefined,
  box: Box
) {
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
      if (r.clipStart + r.clipEnd >= box.height) return;
      if (c.clipStart + c.clipEnd >= box.width) return;
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

/**
 * The CSS clip-path of a pane copy: cut where the frozen band covers it;
 * the other sides keep room for handles drawn outside the box.
 */
export function paneClipPath(pane: Pane, outside = PANE_OUTSIDE) {
  if (!pane.clip.some((v) => v > 0)) return undefined;
  return `inset(${pane.clip
    .map((v) => (v > 0 ? `${v}px` : `-${outside}px`))
    .join(" ")})`;
}
