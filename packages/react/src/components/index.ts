import Workbook from "./Workbook";

export { Workbook };
export type { WorkbookInstance } from "./Workbook";
export {
  installThreadedCommentsUI,
  ThreadedCommentsLayer,
  CommentsPane,
} from "./ThreadedComments";
export { registerInsertFunction } from "./FxEditor/insertFunction";
export type {
  InsertFunctionHandler,
  InsertFunctionHelpers,
} from "./FxEditor/insertFunction";
export {
  registerContextMenuItem,
  registerContextMenuAction,
} from "./ContextMenu/actions";
export type {
  ContextMenuItem,
  ContextMenuItemBuilder,
} from "./ContextMenu/actions";
export {
  registerCellTools,
  AdvancedFilter,
  DataTable,
  GoalSeek,
} from "./CellTools";

// dialogs other features open (ribbon: View > Zoom, Formulas > Insert Function)
export { ZoomDialog } from "./ZoomControl/ZoomDialog";
export { InsertFunctionDialog } from "./FormulaSearch";
