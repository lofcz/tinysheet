/**
 * Excel's zoom slider scale: the centre is 100%, the left half runs
 * linearly from the minimum (10%) to 100%, the right half from 100% to the
 * maximum (400%). Positions are 0..1 along the track.
 */
import { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO } from "@lofcz/tinysheet-core";

export const ZOOM_MIN_PERCENT = Math.round(MIN_ZOOM_RATIO * 100);
export const ZOOM_MAX_PERCENT = Math.round(MAX_ZOOM_RATIO * 100);

/** Pixels around the centre of the track that snap to 100%. */
export const ZOOM_SNAP_PX = 4;

/** Where `percent` sits on the track (0..1). */
export function zoomToPosition(percent: number) {
  const p = Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, percent));
  if (p <= 100) {
    return ((p - ZOOM_MIN_PERCENT) / (100 - ZOOM_MIN_PERCENT)) * 0.5;
  }
  return 0.5 + ((p - 100) / (ZOOM_MAX_PERCENT - 100)) * 0.5;
}

/**
 * The zoom (whole percent) at `position` (0..1) of a track `width` pixels
 * wide; within ZOOM_SNAP_PX of the centre it snaps to 100%.
 */
export function positionToZoom(position: number, width = 0) {
  const pos = Math.min(1, Math.max(0, position));
  if (width > 0 && Math.abs(pos - 0.5) * width <= ZOOM_SNAP_PX) return 100;
  const percent =
    pos <= 0.5
      ? ZOOM_MIN_PERCENT + (pos / 0.5) * (100 - ZOOM_MIN_PERCENT)
      : 100 + ((pos - 0.5) / 0.5) * (ZOOM_MAX_PERCENT - 100);
  return Math.round(percent);
}

/** The next 10% step below (-1) or above (+1): 115% -> 110% / 120%. */
export function stepZoom(percent: number, dir: -1 | 1) {
  const tenths = percent / 10;
  const next =
    dir < 0
      ? (Math.ceil(tenths - 1e-6) - 1) * 10
      : (Math.floor(tenths + 1e-6) + 1) * 10;
  return Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, next));
}
