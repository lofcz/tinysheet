/**
 * Corner marks of a cell (note / comment red triangle, error-checking and
 * number-stored-as-text green triangle, data-validation marker): a right
 * triangle filling the cell's corner up to its grid lines, on whole CSS
 * pixels so its straight edges stay sharp at devicePixelRatio 1 and 2.
 *
 * `x`, `y`, `w` describe the cell like the renderer's cell decorators do
 * (`startX + offsetLeft`, `startY + offsetTop`, `endX - startX`): the grid
 * line above the cell is at `y - 2`, the one left of it at `x - 2` and the
 * one on its right at `x + w - 2`.
 */
export function drawCornerMark(
  g: CanvasRenderingContext2D,
  corner: "tl" | "tr",
  x: number,
  y: number,
  w: number,
  size: number,
  color: string
) {
  const s = Math.max(3, Math.round(size));
  const top = Math.round(y) - 1;
  g.beginPath();
  if (corner === "tl") {
    const left = Math.round(x) - 1;
    g.moveTo(left, top);
    g.lineTo(left + s, top);
    g.lineTo(left, top + s);
  } else {
    const right = Math.round(x + w) - 2;
    g.moveTo(right - s, top);
    g.lineTo(right, top);
    g.lineTo(right, top + s);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
}
