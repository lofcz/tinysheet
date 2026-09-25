/* eslint-disable import/no-cycle */
import React from "react";
import {
  formulaAuditLocale,
  isAllowEdit,
  isShowFormulas,
  registerErrorCheckingDecorator,
  registerFormulaAuditingCore,
} from "@lofcz/tinysheet-core";
import {
  registerSheetOverlay,
  registerStatusBarItem,
  registerToolbarItem,
} from "../../extensions";
import { registerContextMenuItem } from "../ContextMenu/actions";
import TraceArrows from "./TraceArrows";
import ErrorSmartTag from "./ErrorSmartTag";
import FormulaAuditingHost from "./Host";
import CalcStatus from "./CalcStatus";
import {
  CalculationOptionsItem,
  ErrorCheckingItem,
  EvaluateFormulaItem,
  RemoveArrowsItem,
  ShowFormulasItem,
  TraceDependentsItem,
  TracePrecedentsItem,
  WatchWindowItem,
} from "./ToolbarItems";
import {
  AuditHelpers,
  runAddWatch,
  runCalculate,
  runEvaluateFormula,
  runRemoveArrows,
  runToggleShowFormulas,
  runTraceDependents,
  runTracePrecedents,
} from "./actions";
import "./index.css";

/**
 * Formulas > Formula Auditing and Calculation (R4): toolbar items, the cell
 * menu's "Formula Auditing" submenu, the trace-arrow / smart-tag / host
 * overlays, the status bar indicators, and the grid pieces from core (Show
 * Formulas and error-indicator decorators, Ctrl+` and F9 shortcuts).
 */
export function registerFormulaAuditing() {
  const offs = [
    registerFormulaAuditingCore(),
    registerErrorCheckingDecorator(),
    registerToolbarItem("trace-precedents", () => <TracePrecedentsItem />),
    registerToolbarItem("trace-dependents", () => <TraceDependentsItem />),
    registerToolbarItem("remove-arrows", () => <RemoveArrowsItem />),
    registerToolbarItem("show-formulas", () => <ShowFormulasItem />),
    registerToolbarItem("error-checking", () => <ErrorCheckingItem />),
    registerToolbarItem("evaluate-formula", () => <EvaluateFormulaItem />),
    registerToolbarItem("watch-window", () => <WatchWindowItem />),
    registerToolbarItem("calculation-options", () => (
      <CalculationOptionsItem />
    )),
    registerSheetOverlay("traceArrows", TraceArrows),
    registerSheetOverlay("errorSmartTag", ErrorSmartTag),
    registerSheetOverlay("formulaAuditingHost", FormulaAuditingHost),
    registerStatusBarItem("calcStatus", CalcStatus),
    registerContextMenuItem("formula-auditing", (helpers) => {
      if (helpers.headerType) return null;
      const { context } = helpers;
      const t = formulaAuditLocale(context);
      const h: AuditHelpers = {
        context,
        setContext: helpers.setContext,
        showDialog: helpers.showDialog,
        showMessage: (text) => helpers.showDialog(text),
      };
      return {
        key: "formula-auditing",
        label: t.auditing.menu,
        children: [
          {
            key: "trace-precedents",
            label: t.auditing.tracePrecedents,
            onSelect: () => runTracePrecedents(h),
          },
          {
            key: "trace-dependents",
            label: t.auditing.traceDependents,
            onSelect: () => runTraceDependents(h),
          },
          {
            key: "remove-arrows",
            label: t.auditing.removeArrows,
            disabled: !context.traceArrows,
            onSelect: () => runRemoveArrows(h),
          },
          {
            key: "show-formulas",
            label: t.auditing.showFormulas,
            icon: isShowFormulas(context) ? "check" : undefined,
            shortcut: "Ctrl+`",
            onSelect: () => runToggleShowFormulas(h),
          },
          {
            key: "evaluate-formula",
            label: `${t.auditing.evaluateFormula}…`,
            onSelect: () => runEvaluateFormula(h),
          },
          {
            key: "add-watch",
            label: t.auditing.addWatch,
            onSelect: () => runAddWatch(h),
          },
          {
            key: "calculate-now",
            label: t.calc.calculateNow,
            shortcut: "F9",
            disabled: !isAllowEdit(context),
            onSelect: () => runCalculate(h, "now"),
          },
        ],
      };
    }),
  ];
  return () => offs.forEach((off) => off());
}
