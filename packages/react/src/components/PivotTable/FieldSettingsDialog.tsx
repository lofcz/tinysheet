import React, { useContext, useId, useMemo, useState } from "react";
import {
  findPivotTable,
  groupPivotDateField,
  PIVOT_AGGREGATES,
  PIVOT_DATE_GROUPS,
  pivotFieldItems,
  pivotFieldList,
  pivotLocale,
  pivotValueCaption,
} from "@lofcz/tinysheet-core";
import type {
  PivotAggregate,
  PivotDateGroup,
  PivotFieldSettings,
  PivotLabelFilter,
  PivotShowAs,
  PivotValueField,
  PivotValueFilter,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { PivotButton, PivotCheck } from "./CreatePivotDialog";
import { usePivotUpdate } from "./usePivotUpdate";

const SHOW_AS: PivotShowAs[] = [
  "normal",
  "percentOfGrandTotal",
  "percentOfColumnTotal",
  "percentOfRowTotal",
  "difference",
  "percentDifference",
];

const NUMBER_FORMATS = [
  "General",
  "0",
  "0.00",
  "#,##0",
  "#,##0.00",
  "0%",
  "0.00%",
  "$#,##0.00",
];

/** Value Field Settings: name, summarize by, show values as, format. */
export const ValueFieldSettingsDialog: React.FC<{
  sheetId: string;
  pivotId: string;
  index: number;
}> = ({ sheetId, pivotId, index }) => {
  const { context } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const apply = usePivotUpdate();
  const t = pivotLocale(context);
  const uid = useId();
  const pivot = findPivotTable(context, sheetId, pivotId);
  const current = pivot?.values[index];
  const [draft, setDraft] = useState<PivotValueField | undefined>(current);
  const axisFields = useMemo(
    () => (pivot ? [...pivot.rows, ...pivot.columns] : []),
    [pivot]
  );
  if (!pivot || !current || !draft) return null;
  const caption = pivotValueCaption(context, { ...draft, name: undefined });
  const baseItems =
    draft.baseField != null
      ? pivotFieldItems(context, pivot, draft.baseField)
      : [];
  const set = (patch: Partial<PivotValueField>) =>
    setDraft((d) => ({ ...d!, ...patch }));
  const ok = () => {
    const values = [...pivot.values];
    const next: PivotValueField = { ...draft };
    if (!next.name || next.name === caption) delete next.name;
    if (next.showAs === "normal") delete next.showAs;
    if (!next.showAs?.includes("ifference")) {
      delete next.baseField;
      delete next.baseItem;
    }
    if (next.numberFormat === "General") delete next.numberFormat;
    values[index] = next;
    if (apply(sheetId, pivotId, { values })) hideDialog();
  };
  const needsBase =
    draft.showAs === "difference" || draft.showAs === "percentDifference";
  return (
    <div className="fortune-pivot-dialog" data-testid="pivot-value-settings">
      <div className="fortune-pivot-dialog-title">
        {t.valueFieldSettings.replace("…", "")}
      </div>
      <div className="fortune-pivot-dialog-muted">{draft.field}</div>
      <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-name`}>
        <span>{t.customName}</span>
        <input
          id={`${uid}-name`}
          type="text"
          value={draft.name ?? caption}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-agg`}>
        <span>{t.summarizeBy}</span>
        <select
          id={`${uid}-agg`}
          size={6}
          value={draft.aggregate}
          onChange={(e) => {
            const aggregate = e.target.value as PivotAggregate;
            // a default caption follows the function
            setDraft((d) => {
              const auto =
                !d!.name ||
                d!.name ===
                  pivotValueCaption(context, { ...d!, name: undefined });
              return { ...d!, aggregate, name: auto ? undefined : d!.name };
            });
          }}
        >
          {PIVOT_AGGREGATES.map((a) => (
            <option key={a} value={a}>
              {t.aggregates[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-show`}>
        <span>{t.showValuesAs}</span>
        <select
          id={`${uid}-show`}
          value={draft.showAs ?? "normal"}
          onChange={(e) => {
            const showAs = e.target.value as PivotShowAs;
            set({
              showAs,
              baseField:
                showAs.includes("ifference") && !draft.baseField
                  ? axisFields[0]
                  : draft.baseField,
            });
          }}
        >
          {SHOW_AS.map((s) => (
            <option key={s} value={s}>
              {t.showAs[s]}
            </option>
          ))}
        </select>
      </label>
      {needsBase && (
        <div className="fortune-pivot-dialog-inline">
          <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-bf`}>
            <span>{t.baseField}</span>
            <select
              id={`${uid}-bf`}
              value={draft.baseField ?? ""}
              onChange={(e) =>
                set({ baseField: e.target.value, baseItem: undefined })
              }
            >
              {axisFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-bi`}>
            <span>{t.baseItem}</span>
            <select
              id={`${uid}-bi`}
              value={draft.baseItem ?? "(previous)"}
              onChange={(e) => set({ baseItem: e.target.value })}
            >
              <option value="(previous)">{t.previousItem}</option>
              <option value="(next)">{t.nextItem}</option>
              {baseItems.map((it) => (
                <option key={it.key} value={it.label}>
                  {it.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-fmt`}>
        <span>{t.numberFormat}</span>
        <input
          id={`${uid}-fmt`}
          type="text"
          list={`${uid}-fmts`}
          value={draft.numberFormat ?? "General"}
          onChange={(e) => set({ numberFormat: e.target.value })}
        />
        <datalist id={`${uid}-fmts`}>
          {NUMBER_FORMATS.map((f) => (
            <option key={f} value={f} aria-label={f} />
          ))}
        </datalist>
      </label>
      <div className="fortune-pivot-dialog-footer">
        <PivotButton primary onClick={ok}>
          {t.ok}
        </PivotButton>
        <PivotButton onClick={hideDialog}>{t.cancel}</PivotButton>
      </div>
    </div>
  );
};

const LABEL_OPS: PivotLabelFilter["op"][] = [
  "equals",
  "notEquals",
  "beginsWith",
  "endsWith",
  "contains",
  "notContains",
  "greaterThan",
  "lessThan",
  "between",
];

const VALUE_OPS: PivotValueFilter["op"][] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterOrEqual",
  "lessThan",
  "lessOrEqual",
  "between",
  "top",
  "bottom",
];

type SortChoice = "asc" | "desc" | "none" | "value";

/**
 * Field Settings of a Rows / Columns / Filters field: sorting, subtotals,
 * the items shown, label and value filters and date grouping.
 */
export const FieldSettingsDialog: React.FC<{
  sheetId: string;
  pivotId: string;
  field: string;
}> = ({ sheetId, pivotId, field }) => {
  const { context } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const apply = usePivotUpdate();
  const t = pivotLocale(context);
  const uid = useId();
  const pivot = findPivotTable(context, sheetId, pivotId);
  const settings: PivotFieldSettings = pivot?.fields?.[field] ?? {};
  const items = useMemo(
    () => (pivot ? pivotFieldItems(context, pivot, field) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivotId, field]
  );
  const info = useMemo(
    () =>
      (pivot ? pivotFieldList(context, pivot) : []).find((f) => f.id === field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pivotId, field]
  );
  const [hidden, setHidden] = useState(
    () => new Set(settings.hiddenItems ?? [])
  );
  const [sort, setSort] = useState<SortChoice>(
    settings.sortByValue != null ? "value" : settings.sort ?? "asc"
  );
  const [sortDesc, setSortDesc] = useState(settings.sort === "desc");
  const [sortValue, setSortValue] = useState(settings.sortByValue ?? 0);
  const [subtotal, setSubtotal] = useState(settings.subtotal !== false);
  const [labelFilter, setLabelFilter] = useState<PivotLabelFilter | null>(
    settings.labelFilter ?? null
  );
  const [valueFilter, setValueFilter] = useState<PivotValueFilter | null>(
    settings.valueFilter ?? null
  );
  const [groups, setGroups] = useState<PivotDateGroup[]>(
    settings.dateGroups ?? []
  );
  if (!pivot) return null;
  const isFilterField = pivot.filters.some((f) => f.field === field);
  const canGroup = !!info?.isDate && !field.includes("|");

  const ok = () => {
    const next: PivotFieldSettings = { ...settings };
    next.hiddenItems = hidden.size ? [...hidden] : undefined;
    if (sort === "value") {
      next.sortByValue = sortValue;
      next.sort = sortDesc ? "desc" : "asc";
    } else {
      next.sortByValue = undefined;
      next.sort = sort === "asc" ? undefined : sort;
    }
    next.subtotal = subtotal ? undefined : false;
    next.labelFilter = labelFilter ?? undefined;
    next.valueFilter = valueFilter ?? undefined;
    (Object.keys(next) as (keyof PivotFieldSettings)[]).forEach((k) => {
      if (next[k] === undefined) delete next[k];
    });
    const fields = { ...(pivot.fields ?? {}), [field]: next };
    const same =
      JSON.stringify([...(settings.dateGroups ?? [])].sort()) ===
      JSON.stringify([...groups].sort());
    const done = apply(sheetId, pivotId, { fields }, (ctx) => {
      if (canGroup && !same) {
        groupPivotDateField(ctx, sheetId, pivotId, field, groups);
      }
    });
    if (done) hideDialog();
  };

  const allChecked = hidden.size === 0;
  return (
    <div
      className="fortune-pivot-dialog fortune-pivot-field-dialog"
      data-testid="pivot-field-settings"
    >
      <div className="fortune-pivot-dialog-title">
        {t.fieldSettings.replace("…", "")}
      </div>
      <div className="fortune-pivot-dialog-muted">{info?.name ?? field}</div>
      <div className="fortune-pivot-dialog-cols">
        <div>
          <div className="fortune-pivot-dialog-subtitle">{t.sortBy}</div>
          {(["asc", "desc", "none"] as SortChoice[]).map((s) => (
            <PivotCheck
              key={s}
              type="radio"
              name={`${uid}-sort`}
              checked={sort === s}
              onChange={() => setSort(s)}
              label={
                <>
                  {s === "asc" && t.sortAsc}
                  {s === "desc" && t.sortDesc}
                  {s === "none" && t.sortNone}
                </>
              }
            />
          ))}
          {pivot.values.length > 0 && (
            <div className="fortune-pivot-dialog-inline">
              <PivotCheck
                type="radio"
                name={`${uid}-sort`}
                checked={sort === "value"}
                onChange={() => setSort("value")}
                label={t.sortByValue}
              />
              <select
                aria-label={t.sortByValue}
                value={sortValue}
                disabled={sort !== "value"}
                onChange={(e) => setSortValue(Number(e.target.value))}
              >
                {pivot.values.map((v, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <option key={i} value={i}>
                    {pivotValueCaption(context, v)}
                  </option>
                ))}
              </select>
              <PivotCheck
                type="checkbox"
                checked={sortDesc}
                disabled={sort !== "value"}
                onChange={(e) => setSortDesc(e.target.checked)}
                label={t.descending}
              />
            </div>
          )}
          {!isFilterField && (
            <PivotCheck
              type="checkbox"
              checked={subtotal}
              onChange={(e) => setSubtotal(e.target.checked)}
              label={t.subtotals}
            />
          )}
          {canGroup && (
            <>
              <div className="fortune-pivot-dialog-subtitle">
                {t.groupTitle}
              </div>
              <div className="fortune-pivot-dialog-inline">
                {PIVOT_DATE_GROUPS.map((g) => (
                  <PivotCheck
                    key={g}
                    type="checkbox"
                    checked={groups.includes(g)}
                    onChange={(e) =>
                      setGroups((list) =>
                        e.target.checked
                          ? [...list, g]
                          : list.filter((x) => x !== g)
                      )
                    }
                    label={t.dateGroups[g]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="fortune-pivot-dialog-subtitle">{t.labelFilter}</div>
          <div className="fortune-pivot-dialog-inline">
            <select
              aria-label={t.labelFilter}
              value={labelFilter?.op ?? ""}
              onChange={(e) =>
                setLabelFilter(
                  e.target.value
                    ? {
                        op: e.target.value as PivotLabelFilter["op"],
                        value: labelFilter?.value ?? "",
                        value2: labelFilter?.value2,
                      }
                    : null
                )
              }
            >
              <option value="">—</option>
              {LABEL_OPS.map((op) => (
                <option key={op} value={op}>
                  {t.labelOps[op]}
                </option>
              ))}
            </select>
            {labelFilter && (
              <input
                type="text"
                aria-label={t.labelOps[labelFilter.op]}
                value={labelFilter.value}
                onChange={(e) =>
                  setLabelFilter({ ...labelFilter, value: e.target.value })
                }
              />
            )}
            {labelFilter?.op === "between" && (
              <input
                type="text"
                aria-label={t.and}
                value={labelFilter.value2 ?? ""}
                onChange={(e) =>
                  setLabelFilter({ ...labelFilter, value2: e.target.value })
                }
              />
            )}
          </div>
          {pivot.values.length > 0 && (
            <>
              <div className="fortune-pivot-dialog-subtitle">
                {t.valueFilter}
              </div>
              <div className="fortune-pivot-dialog-inline">
                <select
                  aria-label={t.valueFilter}
                  value={valueFilter?.op ?? ""}
                  onChange={(e) =>
                    setValueFilter(
                      e.target.value
                        ? {
                            op: e.target.value as PivotValueFilter["op"],
                            valueIndex: valueFilter?.valueIndex ?? 0,
                            value: valueFilter?.value ?? 10,
                            value2: valueFilter?.value2,
                          }
                        : null
                    )
                  }
                >
                  <option value="">—</option>
                  {VALUE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {t.valueOps[op]}
                    </option>
                  ))}
                </select>
                {valueFilter && (
                  <>
                    <select
                      aria-label={t.values}
                      value={valueFilter.valueIndex}
                      onChange={(e) =>
                        setValueFilter({
                          ...valueFilter,
                          valueIndex: Number(e.target.value),
                        })
                      }
                    >
                      {pivot.values.map((v, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <option key={i} value={i}>
                          {pivotValueCaption(context, v)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      aria-label={t.valueOps[valueFilter.op]}
                      value={valueFilter.value}
                      onChange={(e) =>
                        setValueFilter({
                          ...valueFilter,
                          value: Number(e.target.value),
                        })
                      }
                    />
                  </>
                )}
                {valueFilter?.op === "between" && (
                  <input
                    type="number"
                    aria-label={t.and}
                    value={valueFilter.value2 ?? 0}
                    onChange={(e) =>
                      setValueFilter({
                        ...valueFilter,
                        value2: Number(e.target.value),
                      })
                    }
                  />
                )}
              </div>
            </>
          )}
          <div className="fortune-pivot-dialog-subtitle">{t.showItems}</div>
          <div
            className="fortune-pivot-items"
            role="group"
            aria-label={t.showItems}
          >
            <PivotCheck
              type="checkbox"
              checked={allChecked}
              onChange={(e) =>
                setHidden(
                  e.target.checked
                    ? new Set()
                    : new Set(items.map((i) => i.key))
                )
              }
              label={t.selectAll}
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
        </div>
      </div>
      <div className="fortune-pivot-dialog-footer">
        <PivotButton primary onClick={ok}>
          {t.ok}
        </PivotButton>
        <PivotButton onClick={hideDialog}>{t.cancel}</PivotButton>
      </div>
    </div>
  );
};
