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

let loaded = false;

export function loadBuiltinFeatures() {
  if (loaded) return;
  loaded = true;
  registerFormulaAuditing();
  installSparklineUI();
  installOutlineUI();
}
