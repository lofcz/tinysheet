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
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Columns3,
  Filter,
  Funnel,
  GripVertical,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  Sigma,
  X,
} from "lucide-react";
import {
  Button,
  Checkbox,
  DropdownMenu,
  Field,
  ICON_STROKE,
  Input,
  LucideIcon,
  MenuItem,
  Section,
  Select,
} from "../ui";
import {
  FieldSettingsDialog,
  ValueFieldSettingsDialog,
} from "./FieldSettingsDialog";
import { usePivotUpdate } from "./usePivotUpdate";

const DRAG_TYPE = "application/x-tinysheet-pivot-field";

type DragData = { field: string; from: PivotAreaPosition | null };

const AREAS: PivotArea[] = ["filters", "columns", "rows", "values"];

/** Icons of the field chip menu (Excel's Move Up … Field Settings…). */
const PIVOT_MENU_ICONS: Record<string, LucideIcon | undefined> = {
  up: ArrowUp,
  down: ArrowDown,
  filters: Funnel,
  rows: Rows3,
  columns: Columns3,
  values: Sigma,
  remove: X,
  settings: Settings2,
};

const AREA_ICONS = {
  filters: Filter,
  columns: Columns3,
  rows: Rows3,
  values: Sigma,
};

/**
 * The PivotTable Fields pane (field list, areas, options), docked in the
 * side pane like Excel's task pane.
 */
const FieldsPane: React.FC<{ sheetId: string; pivot: PivotTable }> = ({
  sheetId,
  pivot,
}) => {
  const { context } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const apply = usePivotUpdate();
  const t = pivotLocale(context);
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<{
    field: string;
    from: PivotAreaPosition;
    anchor?: HTMLElement;
    byKeyboard?: boolean;
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
      : (fields.find((f) => f.id === id)?.name ?? id);
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
    // Escape closes an open chip menu (the dock keeps keys from the grid)
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={rootRef}
      className="fortune-pivot-pane ts-pane-content"
      data-testid="pivot-fields-pane"
      onKeyDown={(e) => {
        if (e.key === "Escape" && menu) {
          e.preventDefault();
          setMenu(null);
        }
      }}
    >
      <div className="fortune-pivot-pane-body">
        <Section label={t.chooseFields}>
          <Input
            className="fortune-pivot-pane-search"
            type="search"
            placeholder={t.searchFields}
            aria-label={t.searchFields}
            prefix={<Search size={14} strokeWidth={ICON_STROKE} aria-hidden />}
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
                  onDragStart={(e) =>
                    onDragStart(e, { field: f.id, from: null })
                  }
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
                  <GripVertical
                    className="fortune-pivot-field-grip"
                    size={14}
                    strokeWidth={ICON_STROKE}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ul>
        </Section>
        <Section label={t.dragHint}>
          <div className="fortune-pivot-areas">
            {AREAS.map((area) => {
              const list = pivotAreaFields(pivot, area);
              const AreaIcon = AREA_ICONS[area];
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
                    <AreaIcon size={14} strokeWidth={ICON_STROKE} aria-hidden />
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
                          onDragStart={(e) =>
                            onDragStart(e, { field: id, from })
                          }
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
                            onClick={(e) =>
                              setMenu(
                                open
                                  ? null
                                  : {
                                      field: id,
                                      from,
                                      anchor: e.currentTarget,
                                      byKeyboard: e.detail === 0,
                                    }
                              )
                            }
                          >
                            <span className="fortune-pivot-chip-label">
                              {chipLabel(area, id, index)}
                            </span>
                            <ChevronDown
                              className="fortune-pivot-chip-arrow"
                              size={14}
                              strokeWidth={ICON_STROKE}
                              aria-hidden
                            />
                          </button>
                          {open && menu?.anchor && (
                            <DropdownMenu
                              open
                              onOpenChange={(o) => {
                                if (!o) setMenu(null);
                              }}
                              anchorRef={{ current: menu.anchor }}
                              className="fortune-pivot-chip-menu"
                              aria-label={chipLabel(area, id, index)}
                              autoFocus={menu.byKeyboard}
                              items={menuItems(id, from).map(
                                (it): MenuItem => ({
                                  id: it.key,
                                  label: it.label,
                                  icon: PIVOT_MENU_ICONS[it.key],
                                  onSelect: it.run,
                                })
                              )}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </Section>
        <details className="fortune-pivot-options ts-section">
          <summary className="ts-section-label">
            <ChevronRight
              className="fortune-pivot-options-chevron"
              size={14}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            {t.pivotOptions}
          </summary>
          <div className="ts-section-body fortune-pivot-options-body">
            <Field label={t.layout}>
              <Select<PivotOptions["layout"]>
                aria-label={t.layout}
                value={pivot.options.layout}
                disabled={readonly}
                options={[
                  { value: "compact", label: t.layoutCompact },
                  { value: "outline", label: t.layoutOutline },
                  { value: "tabular", label: t.layoutTabular },
                ]}
                onChange={(layout) => setOption({ layout })}
              />
            </Field>
            <Field label={t.subtotals}>
              <Select<PivotOptions["subtotals"]>
                aria-label={t.subtotals}
                value={pivot.options.subtotals}
                disabled={readonly}
                options={[
                  { value: "top", label: t.subtotalsTop },
                  { value: "bottom", label: t.subtotalsBottom },
                  { value: "off", label: t.subtotalsOff },
                ]}
                onChange={(subtotals) => setOption({ subtotals })}
              />
            </Field>
            {(
              [
                ["grandTotalRow", t.grandTotalRow],
                ["grandTotalColumn", t.grandTotalColumn],
                ["repeatLabels", t.repeatLabels],
                ["preserveFormatting", t.preserveFormatting],
                ["autoRefresh", t.autoRefresh],
              ] as [keyof PivotOptions, string][]
            ).map(([key, label]) => (
              <Checkbox
                key={key}
                className="fortune-pivot-pane-check"
                checked={!!pivot.options[key]}
                disabled={readonly}
                onChange={(on) => setOption({ [key]: on })}
                label={label}
              />
            ))}
            <Field label={t.emptyCells} htmlFor={`${uid}-empty`}>
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
            </Field>
            <Field label={t.pivotName} htmlFor={`${uid}-name`}>
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
            </Field>
          </div>
        </details>
      </div>
      <div className="fortune-pivot-pane-footer">
        <Button
          icon={RefreshCw}
          onClick={() => !readonly && apply(sheetId, pivot.id, null)}
        >
          {t.refresh}
        </Button>
      </div>
    </div>
  );
};

export default FieldsPane;
