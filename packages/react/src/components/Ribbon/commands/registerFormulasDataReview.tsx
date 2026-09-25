/**
 * Registers the Formulas, Data and Review commands (their ids are placed
 * in ../tabs/formulas.ts, data.ts, review.ts), their icons, and the Excel
 * shortcuts behind their tooltips that the grid does not handle itself:
 * Shift+F3 Insert Function, Ctrl+F3 Name Manager, Ctrl+Shift+F3 Create
 * from Selection, Alt+= AutoSum, Shift+F2 New / Edit Note, Ctrl+Shift+L
 * Filter and Ctrl+Alt+L Reapply.
 *
 * Commands that stand for a legacy toolbar item keep its name (so a
 * `settings.toolbarItems` list naming it still shows it); the others list
 * the legacy names they belong to as aliases.
 */
import React, { useContext } from "react";
import {
  createFilter,
  editComment,
  getFlowdata,
  handleSum,
  newComment,
  reapplyFilter,
  registerShortcut,
  activeCell,
} from "@lofcz/tinysheet-core";
import { FlaskConical, SquareFunction } from "lucide-react";
import WorkbookContext from "../../../context";
import { ModalContext } from "../../../context/modal";
import { registerSheetOverlay } from "../../../extensions";
import { registerIcon } from "../../ui";
import { NameManager } from "../../NameManager";
import { registerInsertFunction } from "../../FxEditor/insertFunction";
import { registerRibbonCommand } from "../registry";
import { useRibbonCommandHelpers } from "./helpers";
import {
  requestRibbonCommand,
  useFdrText,
  useRibbonCommandRequest,
} from "./kit";
import {
  InsertFunctionDialog,
  insertIntoFormula,
  rememberEditorCaret,
} from "./functions";
import {
  AutoSumCommand,
  CalculateNowCommand,
  CalculateSheetCommand,
  CalculationOptionsCommand,
  CreateFromSelectionCommand,
  DefineNameCommand,
  ErrorCheckingCommand,
  EvaluateFormulaCommand,
  functionCategoryCommand,
  InsertFunctionCommand,
  MoreFunctionsCommand,
  NameManagerCommand,
  RecentlyUsedCommand,
  RemoveArrowsCommand,
  ShowFormulasCommand,
  TraceDependentsCommand,
  TracePrecedentsCommand,
  UseInFormulaCommand,
  WatchWindowCommand,
} from "./formulas";
import {
  AdvancedFilterCommand,
  ClearFilterCommand,
  DataValidationCommand,
  FilterCommand,
  FlashFillCommand,
  GroupCommand,
  HideDetailCommand,
  ReapplyFilterCommand,
  RemoveDuplicatesCommand,
  ShowDetailCommand,
  SortAscCommand,
  SortDescCommand,
  SortDialogCommand,
  SubtotalCommand,
  TextToColumnsCommand,
  UngroupCommand,
  WhatIfCommand,
} from "./data";
import {
  AllowEditRangesCommand,
  DeleteCommentCommand,
  NewCommentCommand,
  NextCommentCommand,
  NotesCommand,
  PreviousCommentCommand,
  ProtectSheetCommand,
  ProtectWorkbookCommand,
  ShowCommentsCommand,
} from "./review";

/**
 * Runs the shortcuts that need the UI (dialogs, the cell editor) for the
 * workbook that has the keyboard.
 */
const RibbonShortcutHost: React.FC = () => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const { showModal, hideModal } = useContext(ModalContext);
  const { refs } = useContext(WorkbookContext);
  useRibbonCommandRequest((request) => {
    const container = refs.workbookContainer.current;
    if (!container?.contains(document.activeElement)) return;
    if (request === "insertFunction") {
      if (h.context.allowEdit === false) return;
      // the caret of the editor in use: the formula bar or the cell
      const fx = refs.fxInput.current;
      rememberEditorCaret(
        fx && fx.contains(document.activeElement) ? fx : refs.cellInput.current
      );
      showModal(
        <InsertFunctionDialog
          t={t}
          onClose={() => {
            hideModal();
            h.focusSheet();
          }}
          onInsert={(name) => {
            hideModal();
            insertIntoFormula(h, name);
          }}
        />
      );
    } else if (request === "nameManager") {
      h.showDialog(<NameManager />);
    } else if (request === "createFromSelection") {
      if (h.context.allowEdit === false) return;
      h.showDialog(<NameManager initialMode="fromSelection" />);
    } else if (request === "autoSum") {
      const input = refs.cellInput.current;
      if (!input || h.context.allowEdit === false) return;
      h.setContext((ctx) =>
        handleSum(ctx, input, refs.fxInput.current, refs.globalCache)
      );
    } else if (request === "note") {
      const at = activeCell(h.context);
      if (!at) return;
      const has = !!getFlowdata(h.context)?.[at.r]?.[at.c]?.ps;
      h.setContext((ctx) =>
        (has ? editComment : newComment)(ctx, refs.globalCache, at.r, at.c)
      );
    }
  });
  return null;
};

let registered = false;

export function registerFormulasDataReviewCommands() {
  if (registered) return;
  registered = true;
  registerIcon("insert-function", SquareFunction);
  registerIcon("what-if", FlaskConical);

  // Formulas
  const fn = { aliases: ["quick-formula"] };
  registerRibbonCommand("insert-function", InsertFunctionCommand, fn);
  registerRibbonCommand("formulas-autosum", AutoSumCommand, fn);
  registerRibbonCommand("functions-recent", RecentlyUsedCommand, fn);
  registerRibbonCommand(
    "functions-financial",
    functionCategoryCommand("financial", true),
    fn
  );
  registerRibbonCommand(
    "functions-logical",
    functionCategoryCommand("logical", false),
    fn
  );
  registerRibbonCommand(
    "functions-text",
    functionCategoryCommand("text", false),
    fn
  );
  registerRibbonCommand(
    "functions-datetime",
    functionCategoryCommand("dateTime", false),
    fn
  );
  registerRibbonCommand(
    "functions-lookup",
    functionCategoryCommand("lookup", false),
    fn
  );
  registerRibbonCommand(
    "functions-math",
    functionCategoryCommand("math", false),
    fn
  );
  registerRibbonCommand("functions-more", MoreFunctionsCommand, fn);
  const names = { aliases: ["nameManager"] };
  registerRibbonCommand("nameManager", NameManagerCommand);
  registerRibbonCommand("define-name", DefineNameCommand, names);
  registerRibbonCommand("use-in-formula", UseInFormulaCommand, names);
  registerRibbonCommand(
    "create-from-selection",
    CreateFromSelectionCommand,
    names
  );
  registerRibbonCommand("trace-precedents", TracePrecedentsCommand);
  registerRibbonCommand("trace-dependents", TraceDependentsCommand);
  registerRibbonCommand("remove-arrows", RemoveArrowsCommand);
  registerRibbonCommand("show-formulas", ShowFormulasCommand);
  registerRibbonCommand("error-checking", ErrorCheckingCommand);
  registerRibbonCommand("evaluate-formula", EvaluateFormulaCommand);
  registerRibbonCommand("watch-window", WatchWindowCommand);
  registerRibbonCommand("calculation-options", CalculationOptionsCommand);
  const calc = { aliases: ["calculation-options"] };
  registerRibbonCommand("calculate-now", CalculateNowCommand, calc);
  registerRibbonCommand("calculate-sheet", CalculateSheetCommand, calc);

  // Data
  const sortFilter = { aliases: ["filter"] };
  registerRibbonCommand("data-sort-asc", SortAscCommand, sortFilter);
  registerRibbonCommand("data-sort-desc", SortDescCommand, sortFilter);
  registerRibbonCommand("data-sort", SortDialogCommand, sortFilter);
  registerRibbonCommand("data-filter", FilterCommand, sortFilter);
  registerRibbonCommand("data-filter-clear", ClearFilterCommand, sortFilter);
  registerRibbonCommand(
    "data-filter-reapply",
    ReapplyFilterCommand,
    sortFilter
  );
  const tools = { aliases: ["data-tools"] };
  registerRibbonCommand("data-filter-advanced", AdvancedFilterCommand, tools);
  registerRibbonCommand("splitColumn", TextToColumnsCommand);
  registerRibbonCommand("flash-fill", FlashFillCommand, tools);
  registerRibbonCommand("remove-duplicates", RemoveDuplicatesCommand, {
    aliases: ["filter"],
  });
  registerRibbonCommand("dataVerification", DataValidationCommand);
  registerRibbonCommand("data-tools", WhatIfCommand);
  const outline = { aliases: ["outline"] };
  registerRibbonCommand("outline", GroupCommand);
  registerRibbonCommand("outline-ungroup", UngroupCommand, outline);
  registerRibbonCommand("outline-subtotal", SubtotalCommand, outline);
  registerRibbonCommand("outline-show-detail", ShowDetailCommand, outline);
  registerRibbonCommand("outline-hide-detail", HideDetailCommand, outline);

  // Review
  const comments = { aliases: ["threaded-comment"] };
  registerRibbonCommand("review-new-comment", NewCommentCommand, comments);
  registerRibbonCommand(
    "review-delete-comment",
    DeleteCommentCommand,
    comments
  );
  registerRibbonCommand(
    "review-previous-comment",
    PreviousCommentCommand,
    comments
  );
  registerRibbonCommand("review-next-comment", NextCommentCommand, comments);
  registerRibbonCommand("review-show-comments", ShowCommentsCommand, comments);
  registerRibbonCommand("review-notes", NotesCommand, { aliases: ["comment"] });
  const protect = { aliases: ["protection"] };
  registerRibbonCommand("protection", ProtectSheetCommand);
  registerRibbonCommand("protect-workbook", ProtectWorkbookCommand, protect);
  registerRibbonCommand("allow-edit-ranges", AllowEditRangesCommand, protect);

  // shortcuts
  registerSheetOverlay("ribbonShortcutHost", RibbonShortcutHost);
  // the formula bar's fx button (and its Shift+F3) opens the same dialog
  registerInsertFunction(() => {
    requestRibbonCommand("insertFunction");
    return true;
  });
  registerShortcut("ribbon.insertFunction", {
    key: "F3",
    shift: true,
    when: "any",
    handler: () => requestRibbonCommand("insertFunction"),
  });
  registerShortcut("ribbon.nameManager", {
    key: "F3",
    mod: true,
    handler: () => requestRibbonCommand("nameManager"),
  });
  registerShortcut("ribbon.createFromSelection", {
    key: "F3",
    mod: true,
    shift: true,
    handler: () => requestRibbonCommand("createFromSelection"),
  });
  registerShortcut("ribbon.autoSum", {
    key: "=",
    alt: true,
    handler: () => requestRibbonCommand("autoSum"),
  });
  registerShortcut("ribbon.note", {
    key: "F2",
    shift: true,
    handler: () => requestRibbonCommand("note"),
  });
  registerShortcut("ribbon.filter", {
    key: "l",
    mod: true,
    shift: true,
    handler: (ctx) => {
      createFilter(ctx);
    },
  });
  registerShortcut("ribbon.reapply", {
    key: "l",
    mod: true,
    alt: true,
    handler: (ctx) => {
      reapplyFilter(ctx);
    },
  });
}
