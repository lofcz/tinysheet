import { useCallback, useContext } from "react";
import { Context, pageLayoutLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { WorkbookStoreContext } from "../../context/store";

/** Page layout strings of the workbook's language. */
export function usePageLayoutText() {
  const { context } = useContext(WorkbookContext);
  return pageLayoutLocale(context);
}

/**
 * The latest plain (untracked) workbook context, for work that reads a lot
 * of it (pagination, rendering pages) without subscribing to all of it.
 */
export function useRawContext(): () => Context {
  const store = useContext(WorkbookStoreContext);
  const { context } = useContext(WorkbookContext);
  return useCallback(
    () => (store ? store.getState() : context),
    [store, context]
  );
}

export function formatText(text: string, values: Record<string, unknown>) {
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in values ? String(values[k]) : m
  );
}
