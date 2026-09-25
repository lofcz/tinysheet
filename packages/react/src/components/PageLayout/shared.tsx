import React, { useCallback, useContext } from "react";
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

export const PrintIcon: React.FC = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M7 3h10v4h-2V5H9v2H7zM5 8h14a2 2 0 0 1 2 2v6h-3v4H6v-4H3v-6a2 2 0 0 1 2-2zm3 7v3h8v-3zm9-4.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
    />
  </svg>
);

export const PageLayoutIcon: React.FC = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M6 3h9l4 4v14H6zm2 2v14h9V8h-3V5zm1.5 5h6v1.5h-6zm0 3h6v1.5h-6zm0 3h4v1.5h-4z"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeDasharray="2 1.5"
      d="M3.5 7.5h2M3.5 16.5h2"
    />
  </svg>
);
