/**
 * The ribbon: Excel's tabbed command structure in Fika's chrome.
 *
 * - Layout: ./tabs (one file per tab), `settings.ribbon` for a custom one.
 * - Commands: `registerRibbonCommand(id, Component, { aliases })` (see
 *   ./registry and ./commands for examples); a legacy toolbar name stands
 *   for the commands listing it in `aliases`; other ids without a command
 *   render the item registered with `registerToolbarItem`.
 * - Features: `placeRibbonItem`, `registerRibbonGroup`,
 *   `registerFileMenuItem`.
 */
export { default as Ribbon } from "./Ribbon";
export {
  registerRibbonCommand,
  getRibbonCommand,
  placeRibbonItem,
  registerRibbonGroup,
  registerFileMenuItem,
} from "./registry";
export type {
  RibbonCommandProps,
  RibbonCommandOptions,
  RibbonPlacement,
  FileMenuItem,
  FileMenuHelpers,
} from "./registry";
export { defaultRibbon, quickAccessItems } from "./tabs";
export { resolveRibbon } from "./layout";
export {
  useRibbonCommandHelpers,
  useRibbonText,
  shortcutText,
} from "./commands/helpers";
export type { RibbonCommandHelpers } from "./commands/helpers";
export type * from "./types";
