/**
 * Format › Insert Shapes: the gallery shape the next drag in the selected
 * chart draws (Excel: pick a shape, then drag in the chart; a click gives
 * the shape's default size). Esc or a click outside the chart drops it.
 */
import { useSyncExternalStore } from "react";

let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingChartShape(key: string | null) {
  if (pending === key) return;
  pending = key;
  listeners.forEach((l) => l());
}

export function pendingChartShape() {
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const get = () => pending;

export function usePendingChartShape() {
  return useSyncExternalStore(subscribe, get, get);
}
