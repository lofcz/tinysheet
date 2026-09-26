// eslint-disable-next-line import/no-cycle
import { registerSheetOverlay } from "../../extensions";
import ChartDataHighlight from "./ChartDataHighlight";

export { default as ChartLayer } from "./ChartLayer";
export { default as ChartEditor } from "./ChartEditor";
export { default as ChartDialogs } from "./dialogs";
export { openChartDialog } from "./dialogs/store";

let installed = false;

/** The selected chart's data outlines on the sheet (idempotent). */
export function installChartUI() {
  if (installed) return;
  installed = true;
  registerSheetOverlay("chartDataHighlight", ChartDataHighlight);
}
