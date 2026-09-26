/**
 * Live preview of a chart change (Excel previews a gallery pick while the
 * pointer rests on it): the chart layer draws the preview chart instead of
 * the stored one until the preview is cleared. Nothing is recorded.
 */
import { useSyncExternalStore } from "react";
import type { Chart } from "@lofcz/tinysheet-core";

let preview: Chart | null = null;
const listeners = new Set<() => void>();

export function setChartPreview(chart: Chart | null) {
  if (preview === chart) return;
  preview = chart;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const get = () => preview;

/** The chart being previewed (null when none). */
export function useChartPreview() {
  return useSyncExternalStore(subscribe, get, get);
}
