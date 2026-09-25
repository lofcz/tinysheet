import React from "react";
import {
  activeCell,
  addWatchesForSelection,
  calculateFull,
  calculateNow,
  calculateSheet,
  Context,
  formulaAuditLocale,
  getCellDependents,
  getFlowdata,
  removeTraceArrows,
  toggleShowFormulas,
  traceDependents,
  tracePrecedents,
  TraceArrowKind,
} from "@lofcz/tinysheet-core";
import type { SetContextOptions } from "../../context";
import { CalcOptionsDialog, EvaluateFormulaDialog } from "./Dialogs";

/** What the toolbar items and the cell menu need to run a command. */
export type AuditHelpers = {
  context: Context;
  setContext: (
    recipe: (ctx: Context) => void,
    options?: SetContextOptions
  ) => void;
  showDialog: (content: React.ReactNode) => void;
  showMessage: (text: string) => void;
};

const UI_ONLY = { noHistory: true };

function activeFormula(context: Context) {
  const at = activeCell(context);
  if (!at) return null;
  const f = getFlowdata(context)?.[at.r]?.[at.c]?.f;
  return typeof f === "string" && f.startsWith("=") ? at : null;
}

export function runTracePrecedents(h: AuditHelpers) {
  if (!activeFormula(h.context)) {
    h.showMessage(formulaAuditLocale(h.context).auditing.noFormula);
    return;
  }
  h.setContext((ctx) => {
    tracePrecedents(ctx);
  }, UI_ONLY);
}

export function runTraceDependents(h: AuditHelpers) {
  const at = activeCell(h.context);
  if (!at) return;
  if (
    getCellDependents(h.context, h.context.currentSheetId, at.r, at.c)
      .length === 0
  ) {
    h.showMessage(formulaAuditLocale(h.context).auditing.noDependents);
    return;
  }
  h.setContext((ctx) => {
    traceDependents(ctx);
  }, UI_ONLY);
}

export function runRemoveArrows(h: AuditHelpers, kind?: TraceArrowKind) {
  h.setContext((ctx) => removeTraceArrows(ctx, kind), UI_ONLY);
}

export function runToggleShowFormulas(h: AuditHelpers) {
  h.setContext((ctx) => toggleShowFormulas(ctx), UI_ONLY);
}

export function runEvaluateFormula(h: AuditHelpers) {
  const at = activeFormula(h.context);
  if (!at) {
    h.showMessage(formulaAuditLocale(h.context).evaluate.noFormula);
    return;
  }
  h.showDialog(
    <EvaluateFormulaDialog
      sheetId={h.context.currentSheetId}
      r={at.r}
      c={at.c}
    />
  );
}

export function runToggleWatchWindow(h: AuditHelpers, open?: boolean) {
  h.setContext((ctx) => {
    const next = open ?? !ctx.watchWindow?.open;
    ctx.watchWindow = { watches: ctx.watchWindow?.watches ?? [], open: next };
  }, UI_ONLY);
}

export function runAddWatch(h: AuditHelpers) {
  h.setContext((ctx) => addWatchesForSelection(ctx), UI_ONLY);
}

export function runCalculate(
  h: AuditHelpers,
  scope: "now" | "sheet" | "full" = "now"
) {
  h.setContext((ctx) => {
    if (scope === "sheet") calculateSheet(ctx);
    else if (scope === "full") calculateFull(ctx);
    else calculateNow(ctx);
  });
}

export function runCalcOptions(h: AuditHelpers) {
  h.showDialog(<CalcOptionsDialog />);
}
