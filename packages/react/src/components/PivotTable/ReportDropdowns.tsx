import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  pivotFieldItems,
  pivotFieldList,
  pivotLocale,
} from "@lofcz/tinysheet-core";
import type { PivotFieldSettings, PivotTable } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { PivotButton, PivotCheck } from "./CreatePivotDialog";
import { FieldSettingsDialog } from "./FieldSettingsDialog";
import { usePivotUpdate } from "./usePivotUpdate";

const BUTTON = 16;

type Dropdown = {
  key: string;
  r: number;
  c: number;
  /** "filter": a report filter; "axis": sort / filter a row or column field */
  kind: "filter" | "axis";
  fields: string[];
  filterIndex?: number;
};

/** Where a report has drop-down buttons (Excel's field buttons). */
function dropdownsOf(pivot: PivotTable): Dropdown[] {
  const { layout, output } = pivot;
  if (!layout || !output) return [];
  const out: Dropdown[] = [];
  pivot.filters.forEach((f, i) => {
    out.push({
      key: `f${i}`,
      r: output.row[0] + i,
      c: layout.col + 1,
      kind: "filter",
      fields: [f.field],
      filterIndex: i,
    });
  });
  const compact = pivot.options.layout === "compact";
  const { rowLevels, colLevels } = layout;
  if (rowLevels.length) {
    const r = layout.row + layout.headerRows - 1;
    if (compact) {
      out.push({
        key: "rows",
        r,
        c: layout.col,
        kind: "axis",
        fields: rowLevels,
      });
    } else {
      rowLevels.forEach((id, i) =>
        out.push({
          key: `r${i}`,
          r,
          c: layout.col + i,
          kind: "axis",
          fields: [id],
        })
      );
    }
  }
  if (colLevels.length) {
    if (compact) {
      out.push({
        key: "cols",
        r: layout.row,
        c: layout.col + layout.labelCols,
        kind: "axis",
        fields: colLevels,
      });
    } else {
      colLevels.forEach((id, i) =>
        out.push({
          key: `c${i}`,
          r: layout.row,
          c: layout.col + layout.labelCols + i,
          kind: "axis",
          fields: [id],
        })
      );
    }
  }
  return out;
}

const Popover: React.FC<{
  sheetId: string;
  pivot: PivotTable;
  dropdown: Dropdown;
  onClose: () => void;
}> = ({ sheetId, pivot, dropdown, onClose }) => {
  const { context } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const apply = usePivotUpdate();
  const t = pivotLocale(context);
  const [field, setField] = useState(dropdown.fields[0]);
  const names = useMemo(
    () =>
      Object.fromEntries(
        pivotFieldList(context, pivot).map((f) => [f.id, f.name])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivot.id]
  );
  const items = useMemo(
    () => pivotFieldItems(context, pivot, field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivot.id, field]
  );
  const settings: PivotFieldSettings = pivot.fields?.[field] ?? {};
  const initialHidden = () => {
    if (dropdown.kind === "filter") {
      const sel = pivot.filters[dropdown.filterIndex!]?.selected;
      if (!sel) return new Set<string>();
      return new Set(items.map((i) => i.key).filter((k) => !sel.includes(k)));
    }
    return new Set(settings.hiddenItems ?? []);
  };
  const [hidden, setHidden] = useState(initialHidden);
  useEffect(() => setHidden(initialHidden()), [field]); // eslint-disable-line react-hooks/exhaustive-deps

  const sort = (dir: "asc" | "desc") => {
    const fields = {
      ...(pivot.fields ?? {}),
      [field]: { ...settings, sort: dir, sortByValue: undefined },
    };
    if (apply(sheetId, pivot.id, { fields })) onClose();
  };
  const ok = () => {
    if (dropdown.kind === "filter") {
      const filters = [...pivot.filters];
      const i = dropdown.filterIndex!;
      filters[i] = {
        ...filters[i],
        selected: hidden.size
          ? items.map((it) => it.key).filter((k) => !hidden.has(k))
          : undefined,
      };
      if (apply(sheetId, pivot.id, { filters })) onClose();
      return;
    }
    const next = {
      ...settings,
      hiddenItems: hidden.size ? [...hidden] : undefined,
    };
    if (!next.hiddenItems) delete next.hiddenItems;
    if (
      apply(sheetId, pivot.id, {
        fields: { ...(pivot.fields ?? {}), [field]: next },
      })
    ) {
      onClose();
    }
  };
  const nothingChecked = hidden.size === items.length && items.length > 0;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-pivot-popover"
      role="dialog"
      aria-label={names[field] ?? field}
      data-testid="pivot-popover"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      {dropdown.fields.length > 1 && (
        <select
          aria-label={t.fieldSettings}
          value={field}
          onChange={(e) => setField(e.target.value)}
        >
          {dropdown.fields.map((f) => (
            <option key={f} value={f}>
              {names[f] ?? f}
            </option>
          ))}
        </select>
      )}
      {dropdown.kind === "axis" && (
        <>
          <div
            className="fortune-pivot-popover-item"
            role="button"
            tabIndex={0}
            onClick={() => sort("asc")}
            onKeyDown={(e) => e.key === "Enter" && sort("asc")}
          >
            {t.sortAsc}
          </div>
          <div
            className="fortune-pivot-popover-item"
            role="button"
            tabIndex={0}
            onClick={() => sort("desc")}
            onKeyDown={(e) => e.key === "Enter" && sort("desc")}
          >
            {t.sortDesc}
          </div>
          <div
            className="fortune-pivot-popover-item"
            role="button"
            tabIndex={0}
            onClick={() => {
              onClose();
              showDialog(
                <FieldSettingsDialog
                  sheetId={sheetId}
                  pivotId={pivot.id}
                  field={field}
                />
              );
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              onClose();
              showDialog(
                <FieldSettingsDialog
                  sheetId={sheetId}
                  pivotId={pivot.id}
                  field={field}
                />
              );
            }}
          >
            {t.fieldSettings}
          </div>
          <div className="fortune-pivot-popover-divider" />
        </>
      )}
      <div className="fortune-pivot-items">
        <PivotCheck
          type="checkbox"
          checked={hidden.size === 0}
          onChange={(e) =>
            setHidden(
              e.target.checked ? new Set() : new Set(items.map((i) => i.key))
            )
          }
          label={dropdown.kind === "filter" ? t.all : t.selectAll}
        />
        {items.map((it) => (
          <PivotCheck
            key={it.key}
            type="checkbox"
            checked={!hidden.has(it.key)}
            onChange={(e) =>
              setHidden((set) => {
                const next = new Set(set);
                if (e.target.checked) next.delete(it.key);
                else next.add(it.key);
                return next;
              })
            }
            label={it.label}
          />
        ))}
      </div>
      <div className="fortune-pivot-dialog-footer">
        <PivotButton primary onClick={() => !nothingChecked && ok()}>
          {t.ok}
        </PivotButton>
        <PivotButton onClick={onClose}>{t.cancel}</PivotButton>
      </div>
    </div>
  );
};

/** Drop-down buttons of a report's filter and label cells. */
const ReportDropdowns: React.FC<{
  sheetId: string;
  pivot: PivotTable;
  style: (
    r1: number,
    c1: number,
    r2: number,
    c2: number
  ) => React.CSSProperties;
}> = ({ sheetId, pivot, style }) => {
  const { context } = useContext(WorkbookContext);
  const t = pivotLocale(context);
  const [open, setOpen] = useState<string | null>(null);
  const { visibledatarow: rows, visibledatacolumn: cols } = context;
  if (!rows.length || !cols.length || context.allowEdit === false) return null;
  const list = dropdownsOf(pivot).filter(
    (d) => d.r < rows.length && d.c < cols.length
  );
  return (
    <>
      {list.map((d) => {
        const top = d.r === 0 ? 0 : rows[d.r - 1];
        const bottom = rows[d.r];
        const right = cols[d.c];
        const h = Math.min(BUTTON, bottom - top - 2);
        const box: React.CSSProperties = {
          left: right - BUTTON - 2,
          top: bottom - h - 2,
          width: BUTTON,
          height: h,
          ...style(d.r, d.c, d.r, d.c),
        };
        const isOpen = open === d.key;
        const filtered =
          d.kind === "filter"
            ? pivot.filters[d.filterIndex!]?.selected != null
            : d.fields.some((f) => {
                const s = pivot.fields?.[f];
                return !!(
                  s?.hiddenItems?.length ||
                  s?.labelFilter ||
                  s?.valueFilter
                );
              });
        return (
          <React.Fragment key={d.key}>
            <button
              type="button"
              className={`fortune-pivot-dropdown${
                filtered ? " fortune-pivot-dropdown-active" : ""
              }`}
              style={box}
              aria-label={d.fields.join(", ")}
              title={d.kind === "filter" ? t.filtersArea : t.labelFilter}
              aria-expanded={isOpen}
              data-testid={`pivot-dropdown-${d.key}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(isOpen ? null : d.key)}
            >
              <svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true">
                {filtered ? (
                  <path d="M1 1h8L6 5v4L4 8V5z" fill="currentColor" />
                ) : (
                  <path d="M1 3h8L5 8z" fill="currentColor" />
                )}
              </svg>
            </button>
            {isOpen && (
              <div
                className="fortune-pivot-popover-anchor"
                style={{
                  left: right - BUTTON - 2,
                  top: bottom + 2,
                }}
              >
                <Popover
                  sheetId={sheetId}
                  pivot={pivot}
                  dropdown={d}
                  onClose={() => setOpen(null)}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default ReportDropdowns;
