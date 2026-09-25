/* eslint-disable import/no-cycle */
/**
 * Built-in features that plug in through the extension registries
 * (extensions.tsx, ContextMenu/actions.ts, core modules/extensions.ts).
 * The registries call `loadBuiltinFeatures` on their first lookup, so every
 * feature is registered before the toolbar, overlays or menus render.
 */
import { registerFormulaAuditing } from "./components/FormulaAuditing/register";
import { installSparklineUI } from "./components/Sparkline";
import { installOutlineUI } from "./components/Outline";
import { registerShapesFeature } from "./components/Shapes";
import { registerPivotTableFeatures } from "./components/PivotTable";
import { installTablesUI } from "./components/Tables";
import { registerProtectionFeatures } from "./components/Protection";
import { registerPageLayoutFeature } from "./components/PageLayout";

let loaded = false;

export function loadBuiltinFeatures() {
  if (loaded) return;
  loaded = true;
  registerFormulaAuditing();
  installSparklineUI();
  installOutlineUI();
  registerShapesFeature();
  registerPivotTableFeatures();
  installTablesUI();
  registerProtectionFeatures();
  registerPageLayoutFeature();
}
