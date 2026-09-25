import { registerSheetOverlay } from "../../extensions";
import ShapeLayer from "./ShapeLayer";

export { default as ShapeLayer } from "./ShapeLayer";
export { default as ShapeFormatPane } from "./ShapeFormatPane";
export { ShapePresetIcon } from "./ShapePresetIcon";
export { default as ShapeView } from "./ShapeView";

/**
 * Plug shapes and text boxes into the workbook: the shape layer over the
 * cells (Insert › Shapes and Text Box are ribbon commands, ../Ribbon).
 * Returns a function that removes it again.
 */
export function registerShapesFeature() {
  return registerSheetOverlay("shapes", ShapeLayer);
}
