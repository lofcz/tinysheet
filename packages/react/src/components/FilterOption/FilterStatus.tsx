import {
  dataToolsLocale,
  formatLocaleText,
  getFilterRecordCount,
} from "@lofcz/tinysheet-core";
import React, { useContext, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import WorkbookContext from "../../context";

/**
 * "x of y records found" in the status bar while a filter hides rows, like
 * Excel. Rendered into the stats area when it is shown.
 */
const FilterStatus: React.FC = () => {
  const { context, refs } = useContext(WorkbookContext);
  const [target, setTarget] = useState<Element | null>(null);
  const count = getFilterRecordCount(context);

  // the stats area is rendered after this component: look it up each render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el =
      refs.workbookContainer.current?.querySelector(".fortune-stat-area") ??
      null;
    if (el !== target) setTarget(el);
  });

  if (!count || !target) return null;
  const t = dataToolsLocale(context).filter;
  return createPortal(
    <div
      className="fortune-filter-status"
      role="status"
      style={{
        order: -1,
        marginRight: "auto",
        padding: "0 12px",
        color: "var(--fortune-text-muted)",
        fontSize: "var(--fortune-font-size-sm)",
        whiteSpace: "nowrap",
      }}
    >
      {formatLocaleText(t.records, count)}
    </div>,
    target
  );
};

export default FilterStatus;
