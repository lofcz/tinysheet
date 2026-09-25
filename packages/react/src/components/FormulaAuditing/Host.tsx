import React, { useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import _ from "lodash";
import {
  formulaAuditLocale,
  getCalcSettings,
  getCircularReferences,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import WatchWindow from "./WatchWindow";

/** Circular references to report (none while iterative calculation is on). */
export function reportedCircularReferences(context: Context) {
  // re-read on every workbook change (the list lives in the formula cache)
  if (!context.luckysheetfile) return [];
  if (getCalcSettings(context).iterate) return [];
  return getCircularReferences(context);
}

/**
 * Invisible sheet overlay of the Formulas features: applies the
 * `calculation` / `errorChecking` settings, warns once about circular
 * references (like Excel) and hosts the Watch Window panel.
 */
const FormulaAuditingHost: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const warned = useRef(false);

  const { calculation, errorChecking } = settings;
  useEffect(() => {
    setContext(
      (ctx) => {
        if (_.isEmpty(calculation) && ctx.calcDefaults == null) return;
        if (!_.isEqual(ctx.calcDefaults, calculation)) {
          ctx.calcDefaults = { ...calculation };
        }
      },
      { noHistory: true }
    );
  }, [calculation, setContext]);
  useEffect(() => {
    setContext(
      (ctx) => {
        if (_.isEmpty(errorChecking) && ctx.errorCheckingOptions == null) {
          return;
        }
        if (!_.isEqual(ctx.errorCheckingOptions, errorChecking)) {
          ctx.errorCheckingOptions = { ...errorChecking };
        }
      },
      { noHistory: true }
    );
  }, [errorChecking, setContext]);

  const circular = reportedCircularReferences(context);
  const hasCircular = circular.length > 0;
  useEffect(() => {
    if (!hasCircular || warned.current) return;
    warned.current = true;
    showAlert(formulaAuditLocale(context).calc.circularWarning, "ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCircular]);

  const container = refs.workbookContainer.current;
  if (!context.watchWindow?.open || !container) return null;
  return createPortal(<WatchWindow />, container);
};

export default FormulaAuditingHost;
