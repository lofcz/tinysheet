const ZOOM_STEP = 0.1;

export const MAX_ZOOM_RATIO = 4;
export const MIN_ZOOM_RATIO = 0.1;

export function handleKeydownForZoom(ev: KeyboardEvent, currentZoom: number) {
  if (!ev.ctrlKey) {
    return currentZoom;
  }
  let handled = false;
  let zoom = currentZoom || 1;
  if (ev.key === "-" || ev.which === 189) {
    zoom -= ZOOM_STEP;
    handled = true;
  } else if (ev.key === "+" || ev.which === 187) {
    zoom += ZOOM_STEP;
    handled = true;
  } else if (ev.key === "0" || ev.which === 48) {
    zoom = 1;
    handled = true;
  }

  // any other Ctrl shortcut (Ctrl+Z, Ctrl+C...) leaves the zoom alone, even
  // one that is not a multiple of 10% (75%)
  if (!handled) return currentZoom;
  ev.preventDefault();
  if (zoom >= MAX_ZOOM_RATIO) {
    zoom = MAX_ZOOM_RATIO;
  } else if (zoom < MIN_ZOOM_RATIO) {
    zoom = MIN_ZOOM_RATIO;
  }
  return Math.round(zoom * 100) / 100;
}
