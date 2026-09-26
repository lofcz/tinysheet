/**
 * Built-in ribbon commands and File menu entries. Add a command here (or
 * from a feature's own register function) with `registerRibbonCommand`;
 * put its id into a group in ../tabs.
 */
import { requestPrintPreview, ribbonLocale } from "@lofcz/tinysheet-core";
import { registerFileMenuItem, registerRibbonCommand } from "../registry";
import { CopyCommand, CutCommand, PasteCommand } from "./clipboard";
import { RedoCommand, UndoCommand } from "./quickAccess";
import { registerFormulasDataReviewCommands } from "./registerFormulasDataReview";
import { registerHomeCommands } from "./home";
import { registerInsertCommands } from "./insert";
import { registerPageLayoutCommands } from "./pageLayout";
import { registerViewCommands } from "./view";
import { registerTabGroupIcons } from "./tabsCommon";

let registered = false;

export function registerBuiltinRibbonCommands() {
  if (registered) return;
  registered = true;
  registerRibbonCommand("undo", UndoCommand);
  registerRibbonCommand("redo", RedoCommand);
  registerRibbonCommand("paste", PasteCommand);
  registerRibbonCommand("cut", CutCommand);
  registerRibbonCommand("copy", CopyCommand);
  registerFormulasDataReviewCommands();
  registerHomeCommands();
  // Insert, Page Layout and View tabs
  registerInsertCommands();
  registerPageLayoutCommands();
  registerViewCommands();
  registerTabGroupIcons();

  // File menu: New / Open / Save As show when the host handles them
  registerFileMenuItem({
    id: "new",
    order: 10,
    icon: "file-new",
    label: (ctx) => ribbonLocale(ctx).file.new,
    visible: ({ settings }) => !!settings.onNewWorkbook,
    onSelect: ({ settings }) => settings.onNewWorkbook?.(),
  });
  registerFileMenuItem({
    id: "print",
    order: 50,
    icon: "print",
    label: (ctx) => ribbonLocale(ctx).file.print,
    shortcut: "Ctrl+P",
    onSelect: ({ setContext }) =>
      setContext((ctx) => requestPrintPreview(ctx), { noHistory: true }),
  });
}
