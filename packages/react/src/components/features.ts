import { installSparklineUI } from "./Sparkline";

/**
 * Built-in features that plug into the extension registries (toolbar items,
 * sheet overlays, context-menu items). Called when the context menu module
 * loads: the Workbook always renders it, whichever entry point imported it.
 */
export function installBuiltinFeatures() {
  installSparklineUI();
}
