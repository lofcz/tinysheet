/**
 * Which chart dialog is open (Select Data Source, Move Chart, Change Chart
 * Type, Add Trendline / Error Bars based on series). The dialogs are
 * rendered by `ChartDialogs` (mounted once per workbook), so they survive
 * a sheet switch while a range is picked on another sheet.
 */
import { useSyncExternalStore } from "react";
import type { ChartElementName } from "@lofcz/tinysheet-core";

export type ChartDialogRequest =
  | { kind: "selectData"; chartId: string; editSeries?: number }
  | { kind: "moveChart"; chartId: string }
  | {
      kind: "seriesPicker";
      chartId: string;
      element: Extract<ChartElementName, "trendline" | "errorBars">;
      option: string;
    };

let current: ChartDialogRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openChartDialog(request: ChartDialogRequest) {
  current = request;
  emit();
}

export function closeChartDialog() {
  current = null;
  refEdit = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const get = () => current;

export function useChartDialog() {
  return useSyncExternalStore(subscribe, get, get);
}

let refEdit = false;

/**
 * The Select Data Source dialog is picking ranges on the sheet: clicks on
 * cells go to its reference field and keep the chart selected.
 */
export function setChartRefEditActive(on: boolean) {
  refEdit = on;
}

export function isChartRefEditActive() {
  return refEdit;
}
