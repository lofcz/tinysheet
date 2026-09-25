import React, { useContext, useEffect, useId, useRef, useState } from "react";
import {
  defaultPivotAggregate,
  isPivotFieldUsed,
  PIVOT_VALUES_FIELD,
  pivotAreaFields,
  pivotFieldList,
  pivotLocale,
  pivotMoveField,
  pivotValueCaption,
} from "@lofcz/tinysheet-core";
import type {
  PivotArea,
  PivotAreaPosition,
  PivotOptions,
  PivotPatch,
  PivotTable,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import SVGIcon from "../SVGIcon";
import { PivotButton, PivotCheck } from "./CreatePivotDialog";
import {
  FieldSettingsDialog,
  ValueFieldSettingsDialog,
} from "./FieldSettingsDialog";
import { usePivotUpdate } from "./usePivotUpdate";

const DRAG_TYPE = "application/x-tinysheet-pivot-field";

type DragData = { field: string; from: PivotAreaPosition | null };

const AREAS: PivotArea[] = ["filters", "columns", "rows", "values"];

/** The PivotTable Fields pane (field list, areas, options). */
const FieldsPane: React.FC<{ sheetId: string; pivot: PivotTable }> = ({
  sheetId,
  pivot,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const apply = usePivotUpdate();
  const t = pivotLocale(context);
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<{
    field: string;
    from: PivotAreaPosition;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragRef = useRef<DragData | null>(null);
  const readonly = context.allowEdit === false;

  // keep wheel scrolling inside the pane (the sheet listens on an ancestor)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop);
    return () => el.removeEventListener("wheel", stop);
  });

  useEffect(() => setMenu(null), [pivot.id]);

  const fields = pivotFieldList(context, pivot);
  const fieldName = (id: string) =>
    id === PIVOT_VALUES_FIELD
      ? t.valuesField
      : fields.find((f) => f.id === id)?.name ?? id;
  const visible = fields.filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const change = (patch: PivotPatch) => {
    if (readonly) return;
    setMenu(null);
    apply(sheetId, pivot.id, patch);
  };
  const move = (
    field: string,
    from: PivotAreaPosition | null,
    to: { area: PivotArea; index?: number } | null
  ) => {
    const info = fields.find((f) => f.id === field);
    change(pivotMoveField(pivot, field, from, to, defaultPivotAggregate(info)));
  };
  const setOption = (patch: Partial<PivotOptions>) =>
    change({ options: patch });

  const toggleField = (id: string, on: boolean) => {
    if (!on) {
      move(id, null, null);
      return;
    }
    const info = fields.find((f) => f.id === id);
    move(id, null, {
      area: info?.isNumeric && !info.isDate ? "values" : "rows",
    });
  };

  const close = () =>
    setContext(
      (ctx) => {
        ctx.pivotFieldListHidden = true;
      },
      { noHistory: true }
    );

  const onDragStart = (e: React.DragEvent, data: DragData) => {
    dragRef.current = data;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(data));
    e.dataTransfer.setData("text/plain", data.field);
  };
  const readDrag = (e: React.DragEvent): DragData | null => {
    try {
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (raw) return JSON.parse(raw);
    } catch {
      // fall back to the remembered drag
    }
    return dragRef.current;
  };
  const drop = (e: React.DragEvent, area: PivotArea, index?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const data = readDrag(e);
    dragRef.current = null;
    if (!data) return;
    if (
      data.field === PIVOT_VALUES_FIELD &&
      (area === "values" || area === "filters")
    ) {
      return;
    }
    move(data.field, data.from, { area, index });
  };
  // dropped outside the areas: removed, like Excel
  const onDragEnd = (e: React.DragEvent) => {
    const data = dragRef.current;
    dragRef.current = null;
    setDropTarget(null);
    if (!data?.from || e.dataTransfer.dropEffect !== "none") return;
    const pane = rootRef.current?.getBoundingClientRect();
    if (
      pane &&
      e.clientX > 0 &&
      (e.clientX < pane.left || e.clientX > pane.right)
    ) {
      move(data.field, data.from, null);
    }
  };

  const areaTitle: Record<PivotArea, string> = {
    filters: t.filtersArea,
    columns: t.columnsArea,
    rows: t.rowsArea,
    values: t.valuesArea,
  };

  const chipLabel = (area: PivotArea, id: string, index: number) =>
    area === "values"
      ? pivotValueCaption(context, pivot.values[index])
      : fieldName(id);

  const menuItems = (field: string, from: PivotAreaPosition) => {
    const list = pivotAreaFields(pivot, from.area);
    const items: { key: string; label: string; run: () => void }[] = [];
    const reorder = (delta: number) => () => {
      if (from.area === "values") {
        const values = [...pivot.values];
        const [v] = values.splice(from.index, 1);
        values.splice(from.index + delta, 0, v);
        change({ values });
      } else {
        move(field, from, {
          area: from.area,
          index: from.index + (delta > 0 ? 2 : -1),
        });
      }
    };
    const lastMovable =
      field !== PIVOT_VALUES_FIELD &&
      list.filter((x) => x !== PIVOT_VALUES_FIELD).length - 1 > from.index;
    if (from.index > 0)
      items.push({ key: "up", label: t.moveUp, run: reorder(-1) });
    if (lastMovable)
      items.push({ key: "down", label: t.moveDown, run: reorder(1) });
    const targets: [PivotArea, string][] = [
      ["filters", t.moveToFilters],
      ["rows", t.moveToRows],
      ["columns", t.moveToColumns],
      ["values", t.moveToValues],
    ];
    targets.forEach(([area, label]) => {
      if (area === from.area) return;
      if (
        field === PIVOT_VALUES_FIELD &&
        (area === "filters" || area === "values")
      ) {
        return;
      }
      items.push({ key: area, label, run: () => move(field, from, { area }) });
    });
    if (field !== PIVOT_VALUES_FIELD) {
      items.push({
        key: "remove",
        label: t.removeField,
        run: () => move(field, from, null),
      });
      items.push(
        from.area === "values"
          ? {
              key: "settings",
              label: t.valueFieldSettings,
              run: () => {
                setMenu(null);
                showDialog(
                  <ValueFieldSettingsDialog
                    sheetId={sheetId}
                    pivotId={pivot.id}
                    index={from.index}
                  />
                );
              },
            }
          : {
              key: "settings",
              label: t.fieldSettings,
              run: () => {
                setMenu(null);
                showDialog(
                  <FieldSettingsDialog
                    sheetId={sheetId}
                    pivotId={pivot.id}
                    field={field}
                  />
                );
              },
            }
      );
    }
    return items;
  };

  return (
    // Keys, clicks and pastes stay in the pane (the grid listens on ancestors).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      ref={rootRef}
      className="fortune-pivot-pane"
      aria-label={t.fieldsTitle}
      data-testid="pivot-fields-pane"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") setMenu(null);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
    >
      <div className="fortune-pivot-pane-header">
        <span>{t.fieldsTitle}</span>
        <button
          type="button"
          className="fortune-pivot-pane-close"
          aria-label={t.close}
          title={t.close}
          onClick={close}
        >
          <SVGIcon name="close" width={18} height={18} />
        </button>
      </div>
      <div className="fortune-pivot-pane-body">
        <div className="fortune-pivot-pane-hint">{t.chooseFields}</div>
        <input
          className="fortune-pivot-pane-search"
          type="search"
          placeholder={t.searchFields}
          aria-label={t.searchFields}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="fortune-pivot-field-list" aria-label={t.chooseFields}>
          {visible.map((f) => {
            const used = isPivotFieldUsed(pivot, f.id);
            return (
              <li
                key={f.id}
                className="fortune-pivot-field"
                draggable={!readonly}
                data-field={f.id}
                onDragStart={(e) => onDragStart(e, { field: f.id, from: null })}
                onDragEnd={onDragEnd}
              >
                <label htmlFor={`${uid}-${f.id}`}>
                  <input
                    id={`${uid}-${f.id}`}
                    type="checkbox"
                    checked={used}
                    disabled={readonly}
                    onChange={(e) => toggleField(f.id, e.target.checked)}
                  />
                  <span>{f.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="fortune-pivot-pane-hint">{t.dragHint}</div>
        <div className="fortune-pivot-areas">
          {AREAS.map((area) => {
            const list = pivotAreaFields(pivot, area);
            return (
              <section
                key={area}
                className={`fortune-pivot-area${
                  dropTarget === area ? " fortune-pivot-area-over" : ""
                }`}
                data-area={area}
                aria-label={areaTitle[area]}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== area) setDropTarget(area);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => drop(e, area)}
              >
                <div className="fortune-pivot-area-title">
                  {areaTitle[area]}
                </div>
                <ul className="fortune-pivot-area-list">
                  {list.map((id, index) => {
                    const from = { area, index };
                    const open =
                      menu?.from.area === area && menu.from.index === index;
                    return (
                      <li
                        // eslint-disable-next-line react/no-array-index-key
                        key={`${id}-${index}`}
                        className="fortune-pivot-chip"
                        data-field={id}
                        draggable={!readonly}
                        onDragStart={(e) => onDragStart(e, { field: id, from })}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => drop(e, area, index)}
                      >
                        <button
                          type="button"
                          className="fortune-pivot-chip-button"
                          aria-haspopup="menu"
                          aria-expanded={open}
                          disabled={readonly}
                          onClick={() =>
                            setMenu(open ? null : { field: id, from })
                          }
                        >
                          <span className="fortune-pivot-chip-label">
                            {chipLabel(area, id, index)}
                          </span>
                          <span
                            className="fortune-pivot-chip-arrow"
                            aria-hidden
                          >
                            ▾
                          </span>
                        </button>
                        {open && (
                          <div className="fortune-pivot-chip-menu" role="menu">
                            {menuItems(id, from).map((it) => (
                              <div
                                key={it.key}
                                role="menuitem"
                                tabIndex={0}
                                className="fortune-pivot-chip-menu-item"
                                onClick={it.run}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    it.run();
                                  }
                                }}
                              >
                                {it.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <details className="fortune-pivot-options">
          <summary>{t.pivotOptions}</summary>
          <label className="fortune-pivot-pane-field" htmlFor={`${uid}-layout`}>
            <span>{t.layout}</span>
            <select
              id={`${uid}-layout`}
              value={pivot.options.layout}
              disabled={readonly}
              onChange={(e) =>
                setOption({ layout: e.target.value as PivotOptions["layout"] })
              }
            >
              <option value="compact">{t.layoutCompact}</option>
              <option value="outline">{t.layoutOutline}</option>
              <option value="tabular">{t.layoutTabular}</option>
            </select>
          </label>
          <label className="fortune-pivot-pane-field" htmlFor={`${uid}-sub`}>
            <span>{t.subtotals}</span>
            <select
              id={`${uid}-sub`}
              value={pivot.options.subtotals}
              disabled={readonly}
              onChange={(e) =>
                setOption({
                  subtotals: e.target.value as PivotOptions["subtotals"],
                })
              }
            >
              <option value="top">{t.subtotalsTop}</option>
              <option value="bottom">{t.subtotalsBottom}</option>
              <option value="off">{t.subtotalsOff}</option>
            </select>
          </label>
          {(
            [
              ["grandTotalRow", t.grandTotalRow],
              ["grandTotalColumn", t.grandTotalColumn],
              ["repeatLabels", t.repeatLabels],
              ["preserveFormatting", t.preserveFormatting],
              ["autoRefresh", t.autoRefresh],
            ] as [keyof PivotOptions, string][]
          ).map(([key, label]) => (
            <PivotCheck
              key={key}
              className="fortune-pivot-pane-check"
              type="checkbox"
              checked={!!pivot.options[key]}
              disabled={readonly}
              onChange={(e) => setOption({ [key]: e.target.checked })}
              label={label}
            />
          ))}
          <label className="fortune-pivot-pane-field" htmlFor={`${uid}-empty`}>
            <span>{t.emptyCells}</span>
            <input
              id={`${uid}-empty`}
              type="text"
              defaultValue={pivot.options.emptyText ?? ""}
              disabled={readonly}
              onBlur={(e) => {
                if (e.target.value !== (pivot.options.emptyText ?? "")) {
                  setOption({ emptyText: e.target.value || undefined });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          <label className="fortune-pivot-pane-field" htmlFor={`${uid}-name`}>
            <span>{t.pivotName}</span>
            <input
              id={`${uid}-name`}
              type="text"
              defaultValue={pivot.name}
              disabled={readonly}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== pivot.name) change({ name });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
        </details>
      </div>
      <div className="fortune-pivot-pane-footer">
        <PivotButton
          onClick={() => !readonly && apply(sheetId, pivot.id, null)}
        >
          {t.refresh}
        </PivotButton>
      </div>
    </aside>
  );
};

export default FieldsPane;
