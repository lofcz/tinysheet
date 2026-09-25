import React from "react";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import ShapeLayer from "./ShapeLayer";
import ShapesToolbarItem from "./ShapesToolbarItem";

export { default as ShapeLayer } from "./ShapeLayer";
export { default as ShapeFormatPane } from "./ShapeFormatPane";
export { default as ShapesToolbarItem } from "./ShapesToolbarItem";
export { default as ShapeView } from "./ShapeView";

/**
 * Plug shapes and text boxes into the workbook: the shape layer over the
 * cells and the "shapes" toolbar item (Insert › Shapes). Returns a function
 * that removes both again.
 */
export function registerShapesFeature() {
  const offOverlay = registerSheetOverlay("shapes", ShapeLayer);
  const offToolbar = registerToolbarItem("shapes", ({ tooltip }) =>
    React.createElement(ShapesToolbarItem, { tooltip })
  );
  return () => {
    offOverlay();
    offToolbar();
  };
}
