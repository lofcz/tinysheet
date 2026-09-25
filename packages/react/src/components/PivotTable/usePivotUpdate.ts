import { useCallback, useContext } from "react";
import {
  checkPivotUpdate,
  pivotLocale,
  refreshPivotTable,
  updatePivotTable,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  PivotError,
  PivotLocale,
  PivotPatch,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";

/** The message for a PivotTable error code. */
export function pivotErrorText(t: PivotLocale, error: PivotError) {
  switch (error) {
    case "headers":
      return t.errorHeaders;
    case "location":
      return t.errorLocation;
    case "overlapPivot":
      return t.errorOverlapPivot;
    case "overlapTable":
      return t.errorOverlapTable;
    case "replaceData":
      return t.confirmReplace;
    default:
      return t.errorSource;
  }
}

/**
 * Applies a PivotTable change (or refresh, `patch` null) after checking it:
 * when the report would run into data the user is asked first, like
 * Excel; other errors are shown.
 */
export function usePivotUpdate() {
  const { context, setContext } = useContext(WorkbookContext);
  const { showAlert, hideAlert } = useAlert();
  return useCallback(
    (
      sheetId: string,
      id: string,
      patch: PivotPatch | null,
      extra?: (ctx: Context) => void
    ) => {
      const t = pivotLocale(context);
      const run = (force: boolean) =>
        setContext((ctx) => {
          if (patch) updatePivotTable(ctx, sheetId, id, patch, { force });
          else refreshPivotTable(ctx, sheetId, id, { force });
          extra?.(ctx);
        });
      const error = checkPivotUpdate(context, sheetId, id, patch ?? undefined);
      if (!error) {
        run(false);
        return true;
      }
      if (error === "replaceData") {
        showAlert(t.confirmReplace, "yesno", () => {
          hideAlert();
          run(true);
        });
        return false;
      }
      showAlert(pivotErrorText(t, error), "ok");
      return false;
    },
    [context, hideAlert, setContext, showAlert]
  );
}
