import type { ShapeClip } from "@lofcz/tinysheet-core";

/**
 * In-page shape clipboard. Copying shapes writes a marker string to the
 * system clipboard and keeps the shapes here; a paste whose text is that
 * marker pastes the shapes (like the chart clipboard).
 */
let current: { marker: string; clip: ShapeClip } | null = null;

const PREFIX = "tinysheet-shapes:";

export function setShapeClipboard(clip: ShapeClip) {
  const marker = `${PREFIX}${clip.shapes.length}:${Date.now().toString(36)}`;
  current = { marker, clip: JSON.parse(JSON.stringify(clip)) };
  return marker;
}

/** The copied shapes when `text` is the marker of the latest shape copy. */
export function getShapeClipboard(text: string | null | undefined) {
  if (!current || !text || text.trim() !== current.marker) return null;
  return current.clip;
}
