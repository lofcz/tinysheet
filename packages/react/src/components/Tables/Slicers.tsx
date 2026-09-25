/**
 * Slicers: floating button panels that filter a table column (Insert ›
 * Slicer). The model lives in core (tableFilter.ts); this file draws the
 * panels over the grid (registered with registerSheetOverlay), moves and
 * resizes them, and has the Insert Slicer and Slicer Settings dialogs.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import {
  activeCellTable,
  addTableSlicers,
  clearSlicerFilter,
  colLocation,
  findSlicer,
  getSlicerItems,
  getTables,
  locale,
  removeSlicer,
  rowLocation,
  selectSlicerItem,
  slicerHasFilter,
  SLICER_DEFAULTS,
  tableToolsLocale,
  updateSlicer,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  SheetTable,
  SlicerPatch,
  TableSlicer,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import SVGIcon from "../SVGIcon";
import { FunnelX, Settings2, Trash2 } from "lucide-react";
import { ContextMenuPopup, MenuItem } from "../ui";

/* ------------------------------------------------------------------------ */
/* Styles                                                                   */
/* ------------------------------------------------------------------------ */

export type SlicerStyle = {
  group: "light" | "dark" | "other";
  /** accent colour of the selected items */
  accent: string;
};

const ACCENTS = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];

/** Excel's built-in slicer styles (the names are written to xlsx). */
export const SLICER_STYLES: Record<string, SlicerStyle> = {
  ...Object.fromEntries(
    ACCENTS.map((accent, i) => [
      `SlicerStyleLight${i + 1}`,
      { group: "light", accent },
    ])
  ),
  ...Object.fromEntries(
    ACCENTS.map((accent, i) => [
      `SlicerStyleDark${i + 1}`,
      { group: "dark", accent },
    ])
  ),
  SlicerStyleOther1: { group: "other", accent: "#7F7F7F" },
  SlicerStyleOther2: { group: "other", accent: "#262626" },
};

function slicerStyle(key?: string): SlicerStyle & { key: string } {
  const k = key && SLICER_STYLES[key] ? key : SLICER_DEFAULTS.style;
  return { key: k, ...SLICER_STYLES[k] };
}

/** CSS variables and class of a slicer style. */
function styleProps(key?: string) {
  const s = slicerStyle(key);
  return {
    className: `fortune-slicer-style-${s.group}`,
    style: { "--fortune-slicer-accent": s.accent } as React.CSSProperties,
  };
}

function styleLabel(ctx: Context, key: string) {
  const tt = tableToolsLocale(ctx);
  const m = /(Light|Dark|Other)(\d+)$/.exec(key);
  if (!m) return key;
  return tt.styleLabel
    .replace("{group}", tt.slicerStyleGroups[m[1].toLowerCase()] ?? m[1])
    .replace("{n}", m[2]);
}

/* ------------------------------------------------------------------------ */
/* Geometry                                                                 */
/* ------------------------------------------------------------------------ */

type Box = { left: number; top: number; width: number; height: number };
type DragMode = "move" | "lt" | "rt" | "lb" | "rb" | "l" | "r" | "t" | "b";

const rowTop = (ctx: Context, r: number) =>
  r <= 0 ? 0 : (ctx.visibledatarow[r - 1] ?? 0);
const colLeft = (ctx: Context, c: number) =>
  c <= 0 ? 0 : (ctx.visibledatacolumn[c - 1] ?? 0);

/** The slicer's box in sheet pixels (zoomed). */
function slicerBox(ctx: Context, s: TableSlicer): Box {
  const zoom = ctx.zoomRatio || 1;
  return {
    left: colLeft(ctx, s.c) + s.offsetX * zoom,
    top: rowTop(ctx, s.r) + s.offsetY * zoom,
    width: s.width * zoom,
    height: s.height * zoom,
  };
}

/** The anchor (cell + offset at 100%) of a box position. */
function anchorOf(ctx: Context, box: Box) {
  const zoom = ctx.zoomRatio || 1;
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  const [colPre, , c] = colLocation(left, ctx.visibledatacolumn);
  const [rowPre, , r] = rowLocation(top, ctx.visibledatarow);
  return {
    r,
    c,
    offsetX: Math.round((left - colPre) / zoom),
    offsetY: Math.round((top - rowPre) / zoom),
    width: Math.round(box.width / zoom),
    height: Math.round(box.height / zoom),
  };
}

function resizeBox(orig: Box, mode: DragMode, dx: number, dy: number): Box {
  if (mode === "move") {
    return { ...orig, left: orig.left + dx, top: orig.top + dy };
  }
  let { left, top, width, height } = orig;
  if (mode.includes("l")) {
    const w = Math.max(60, width - dx);
    left += width - w;
    width = w;
  }
  if (mode.includes("r")) width = Math.max(60, width + dx);
  if (mode.includes("t")) {
    const h = Math.max(40, height - dy);
    top += height - h;
    height = h;
  }
  if (mode.includes("b")) height = Math.max(40, height + dy);
  return { left, top, width, height };
}

const HANDLES: DragMode[] = ["lt", "t", "rt", "r", "rb", "b", "lb", "l"];

/* ------------------------------------------------------------------------ */
/* Panel                                                                    */
/* ------------------------------------------------------------------------ */

const MultiSelectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 5h4v4H3V5zm6 1h12v2H9V6zm-6 5h4v4H3v-4zm6 1h12v2H9v-2zm-6 5h4v4H3v-4zm6 1h12v2H9v-2z"
    />
  </svg>
);

const ClearFilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 4h14l-5.5 7v6l-3 2v-8L3 4zm12.6 9.2 1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2z"
    />
  </svg>
);

type PanelProps = {
  sheetId: string;
  table: SheetTable;
  slicer: TableSlicer;
  box: Box;
  active: boolean;
  onStartDrag: (
    e: React.MouseEvent,
    slicer: TableSlicer,
    mode: DragMode
  ) => void;
  onMenu: (e: React.MouseEvent, slicer: TableSlicer) => void;
};

const SlicerPanel: React.FC<PanelProps> = ({
  sheetId,
  table,
  slicer,
  box,
  active,
  onStartDrag,
  onMenu,
}) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const tt = tableToolsLocale(context);
  const readonly = context.allowEdit === false;
  const zoom = context.zoomRatio || 1;
  const data = context.luckysheetfile.find((f) => f.id === sheetId)?.data;
  const items = useMemo(
    () => getSlicerItems(context, sheetId, table, slicer),
    // the items depend on the table (filters) and the sheet's cells
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, sheetId, slicer, table]
  );
  const filtered = !!items.length && slicerHasFilter(context, slicer.name);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (active && !panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  const select = (text: string, toggle: boolean) => {
    if (readonly) return;
    setContext((ctx) => {
      ctx.activeSlicer = { sheetId, table: table.name, name: slicer.name };
      selectSlicerItem(ctx, slicer.name, text, toggle);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.code === "KeyZ" || e.code === "KeyY")) return;
    if (e.key === "Tab") return;
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      setContext((ctx) => {
        ctx.activeSlicer = undefined;
      });
      refs.cellInput.current?.focus();
      return;
    }
    if (readonly) return;
    if (e.altKey && e.code === "KeyS") {
      e.preventDefault();
      setContext((ctx) => {
        updateSlicer(ctx, slicer.name, { multiSelect: !slicer.multiSelect });
      });
      return;
    }
    if (e.altKey && e.code === "KeyC") {
      e.preventDefault();
      setContext((ctx) => {
        clearSlicerFilter(ctx, slicer.name);
      });
      return;
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      e.target === e.currentTarget
    ) {
      e.preventDefault();
      setContext((ctx) => {
        removeSlicer(ctx, slicer.name);
      });
      refs.cellInput.current?.focus();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = nudge[e.key];
    if (delta && e.target === e.currentTarget) {
      e.preventDefault();
      setContext((ctx) => {
        const moved = anchorOf(ctx, {
          ...box,
          left: box.left + delta[0] * zoom,
          top: box.top + delta[1] * zoom,
        });
        updateSlicer(ctx, slicer.name, {
          r: moved.r,
          c: moved.c,
          offsetX: moved.offsetX,
          offsetY: moved.offsetY,
        });
      });
    }
  };

  const columns = Math.max(1, slicer.columnCount ?? 1);
  const buttonHeight =
    (slicer.buttonHeight ?? SLICER_DEFAULTS.buttonHeight) * zoom;
  const buttonWidth = slicer.buttonWidth ? slicer.buttonWidth * zoom : null;
  const { className, style } = styleProps(slicer.style);

  return (
    // a focusable, draggable object like a chart: moved with the mouse,
    // nudged / deleted with the keyboard
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={panelRef}
      className={`fortune-slicer ${className}${
        active ? " fortune-slicer-active" : ""
      }`}
      role="group"
      aria-label={slicer.caption || slicer.name}
      data-slicer={slicer.name}
      tabIndex={0}
      style={{
        ...style,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        fontSize: 12 * zoom,
      }}
      onMouseDown={(e) => onStartDrag(e, slicer, "move")}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => onMenu(e, slicer)}
      onKeyDown={onKeyDown}
    >
      {slicer.showCaption !== false && (
        <div className="fortune-slicer-header">
          <div className="fortune-slicer-caption" title={slicer.caption}>
            {slicer.caption}
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label={tt.multiSelect}
            aria-pressed={!!slicer.multiSelect}
            title={tt.multiSelect}
            className={`fortune-slicer-tool${
              slicer.multiSelect ? " fortune-slicer-tool-on" : ""
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (readonly) return;
              setContext((ctx) => {
                updateSlicer(ctx, slicer.name, {
                  multiSelect: !slicer.multiSelect,
                });
              });
            }}
            onKeyDown={activateOnKey}
          >
            <MultiSelectIcon />
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label={tt.clearFilter}
            aria-disabled={!filtered}
            title={tt.clearFilter}
            className={`fortune-slicer-tool${
              filtered ? "" : " fortune-slicer-tool-disabled"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (!filtered || readonly) return;
              setContext((ctx) => {
                clearSlicerFilter(ctx, slicer.name);
              });
            }}
            onKeyDown={activateOnKey}
          >
            <ClearFilterIcon />
          </div>
        </div>
      )}
      <div
        className="fortune-slicer-items"
        role="listbox"
        aria-multiselectable
        aria-label={slicer.caption || slicer.column}
        style={{
          gridTemplateColumns: buttonWidth
            ? `repeat(${columns}, ${buttonWidth}px)`
            : `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: buttonHeight,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {items.map((item) => {
          const cls = [
            "fortune-slicer-item",
            item.selected ? "fortune-slicer-item-selected" : "",
            item.hasData ? "" : "fortune-slicer-item-nodata",
          ]
            .filter(Boolean)
            .join(" ");
          const label = item.text === "" ? tt.blank : item.text;
          return (
            <div
              key={item.text}
              role="option"
              tabIndex={0}
              aria-selected={item.selected}
              title={item.hasData ? label : `${label} (${tt.noData})`}
              className={cls}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!active) {
                  setContext((ctx) => {
                    ctx.activeSlicer = {
                      sheetId,
                      table: table.name,
                      name: slicer.name,
                    };
                  });
                }
              }}
              onClick={(e) =>
                select(
                  item.text,
                  !!slicer.multiSelect || e.ctrlKey || e.metaKey
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  select(item.text, !!slicer.multiSelect || e.ctrlKey);
                }
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
      {active && !readonly && (
        <div className="fortune-slicer-handles">
          {HANDLES.map((h) => (
            <div
              key={h}
              className={`fortune-slicer-handle fortune-slicer-handle-${h}`}
              onMouseDown={(e) => onStartDrag(e, slicer, h)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type Drag = {
  name: string;
  mode: DragMode;
  startX: number;
  startY: number;
  orig: Box;
  current: Box;
  moved: boolean;
};

/* ------------------------------------------------------------------------ */
/* Dialogs                                                                  */
/* ------------------------------------------------------------------------ */

const TextButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary, children }) => (
  <div
    className={`button-basic ${primary ? "button-primary" : "button-default"}`}
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={activateOnKey}
  >
    {children}
  </div>
);

/** Insert Slicers: pick the columns of the table to create slicers for. */
export const InsertSlicerDialog: React.FC<{ tableName: string }> = ({
  tableName,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { button } = locale(context);
  const tt = tableToolsLocale(context);
  const uid = useId();
  const table = getTables(context).find(
    (t) => t.table.name === tableName
  )?.table;
  const [picked, setPicked] = useState<string[]>([]);
  if (!table) return null;
  const ok = () => {
    if (picked.length > 0) {
      setContext((ctx) => {
        const created = addTableSlicers(ctx, tableName, picked);
        if (created[0]) {
          ctx.activeSlicer = {
            sheetId: ctx.currentSheetId,
            table: tableName,
            name: created[0].name,
          };
        }
      });
    }
    hideDialog();
  };
  return (
    <div className="fortune-table-dialog fortune-slicer-insert">
      <div className="fortune-table-dialog-title">{tt.insertSlicer}</div>
      <div className="fortune-slicer-dialog-hint">{tt.insertSlicerHint}</div>
      <div className="fortune-slicer-insert-list" role="group">
        {table.columns.map((col, i) => (
          <div key={col.name} className="fortune-table-dialog-check">
            <input
              id={`${uid}-${i}`}
              type="checkbox"
              checked={picked.includes(col.name)}
              onChange={(e) =>
                setPicked((list) =>
                  e.target.checked
                    ? [...list, col.name]
                    : list.filter((x) => x !== col.name)
                )
              }
            />
            <label htmlFor={`${uid}-${i}`}>{col.name}</label>
          </div>
        ))}
      </div>
      <div className="fortune-table-dialog-footer">
        <TextButton primary onClick={ok}>
          {button.confirm}
        </TextButton>
        <TextButton onClick={hideDialog}>{button.cancel}</TextButton>
      </div>
    </div>
  );
};

/** A small picture of a slicer style (a header and three buttons). */
const SlicerStylePreview: React.FC<{
  styleKey: string;
  selected: boolean;
  label: string;
  onClick: () => void;
}> = ({ styleKey, selected, label, onClick }) => {
  const { className, style } = styleProps(styleKey);
  return (
    <div
      className={`fortune-slicer-style-swatch ${className}${
        selected ? " fortune-table-style-selected" : ""
      }`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      onKeyDown={activateOnKey}
    >
      <div className="fortune-slicer-item fortune-slicer-item-selected" />
      <div className="fortune-slicer-item fortune-slicer-item-selected" />
      <div className="fortune-slicer-item" />
    </div>
  );
};

/** Slicer Settings: name, caption, sorting, layout and style. */
export const SlicerSettingsDialog: React.FC<{ name: string }> = ({ name }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { button } = locale(context);
  const tt = tableToolsLocale(context);
  const uid = useId();
  const found = findSlicer(context, name);
  const initial = found?.slicer;
  const [draft, setDraft] = useState<TableSlicer | undefined>(initial);
  const [error, setError] = useState<string | null>(null);
  if (!initial || !draft) return null;
  const set = (patch: Partial<TableSlicer>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));
  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const ok = () => {
    const nextName = draft.name.trim();
    if (
      nextName.toUpperCase() !== initial.name.toUpperCase() &&
      (!nextName || findSlicer(context, nextName))
    ) {
      setError(tt.errorSlicerName);
      return;
    }
    setContext((ctx) => {
      updateSlicer(ctx, initial.name, {
        ..._.omit(draft, ["column"]),
        name: nextName,
      });
    });
    hideDialog();
  };
  const groups = _.groupBy(
    Object.keys(SLICER_STYLES),
    (k) => SLICER_STYLES[k].group
  );
  return (
    <div className="fortune-table-dialog fortune-slicer-settings">
      <div className="fortune-table-dialog-title">{tt.slicerSettingsTitle}</div>
      <div className="fortune-table-design-grid">
        <div className="fortune-table-dialog-field">
          <label htmlFor={`${uid}-name`}>{tt.name}</label>
          <input
            id={`${uid}-name`}
            type="text"
            value={draft.name}
            spellCheck={false}
            onChange={(e) => {
              set({ name: e.target.value });
              setError(null);
            }}
          />
        </div>
        <div className="fortune-table-dialog-field">
          <label htmlFor={`${uid}-caption`}>{tt.caption}</label>
          <input
            id={`${uid}-caption`}
            type="text"
            value={draft.caption}
            onChange={(e) => set({ caption: e.target.value })}
          />
        </div>
      </div>
      <div className="fortune-table-dialog-check">
        <input
          id={`${uid}-show`}
          type="checkbox"
          checked={draft.showCaption !== false}
          onChange={(e) => set({ showCaption: e.target.checked })}
        />
        <label htmlFor={`${uid}-show`}>{tt.showCaption}</label>
      </div>
      <fieldset className="fortune-table-dialog-group">
        <legend>{tt.itemSorting}</legend>
        <div className="fortune-table-dialog-check">
          <input
            id={`${uid}-asc`}
            type="radio"
            name={`${uid}-sort`}
            checked={draft.sortOrder !== "descending"}
            onChange={() => set({ sortOrder: "ascending" })}
          />
          <label htmlFor={`${uid}-asc`}>{tt.ascending}</label>
        </div>
        <div className="fortune-table-dialog-check">
          <input
            id={`${uid}-desc`}
            type="radio"
            name={`${uid}-sort`}
            checked={draft.sortOrder === "descending"}
            onChange={() => set({ sortOrder: "descending" })}
          />
          <label htmlFor={`${uid}-desc`}>{tt.descending}</label>
        </div>
        <div className="fortune-table-dialog-check">
          <input
            id={`${uid}-hide`}
            type="checkbox"
            checked={!!draft.hideNoData}
            onChange={(e) => set({ hideNoData: e.target.checked })}
          />
          <label htmlFor={`${uid}-hide`}>{tt.hideNoData}</label>
        </div>
        <div className="fortune-table-dialog-check">
          <input
            id={`${uid}-last`}
            type="checkbox"
            disabled={!!draft.hideNoData}
            checked={draft.noDataLast !== false}
            onChange={(e) => set({ noDataLast: e.target.checked })}
          />
          <label htmlFor={`${uid}-last`}>{tt.noDataLast}</label>
        </div>
      </fieldset>
      <fieldset className="fortune-table-dialog-group">
        <legend>{tt.sizeAndLayout}</legend>
        <div className="fortune-slicer-size-grid">
          {(
            [
              ["columnCount", tt.columns, 1],
              ["buttonHeight", tt.buttonHeight, SLICER_DEFAULTS.buttonHeight],
              ["buttonWidth", tt.buttonWidth, 0],
              ["width", tt.width, SLICER_DEFAULTS.width],
              ["height", tt.height, SLICER_DEFAULTS.height],
            ] as const
          ).map(([key, label, fallback]) => (
            <div key={key} className="fortune-table-dialog-field">
              <label htmlFor={`${uid}-${key}`}>{label}</label>
              <input
                id={`${uid}-${key}`}
                type="number"
                min={key === "buttonWidth" ? 0 : 1}
                placeholder={key === "buttonWidth" ? tt.auto : undefined}
                value={(draft[key] as number | undefined) || ""}
                onChange={(e) => {
                  if (key === "buttonWidth") {
                    const n = Number(e.target.value);
                    set({ buttonWidth: n > 0 ? n : undefined });
                  } else {
                    set({ [key]: num(e.target.value, fallback) });
                  }
                }}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="fortune-table-dialog-group">
        <legend>{tt.slicerStyles}</legend>
        {(["light", "dark", "other"] as const).map((g) => (
          <div key={g} className="fortune-table-style-section">
            <div className="fortune-table-menu-title">
              {tt.slicerStyleGroups[g]}
            </div>
            <div className="fortune-slicer-style-grid">
              {(groups[g] ?? []).map((key) => (
                <SlicerStylePreview
                  key={key}
                  styleKey={key}
                  label={styleLabel(context, key)}
                  selected={slicerStyle(draft.style).key === key}
                  onClick={() => set({ style: key })}
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {error && (
        <div className="fortune-table-dialog-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-table-dialog-footer">
        <TextButton primary onClick={ok}>
          {button.confirm}
        </TextButton>
        <TextButton onClick={hideDialog}>{button.cancel}</TextButton>
      </div>
    </div>
  );
};

/** Context menu of a slicer (right-click; viewport coordinates). */
const SlicerMenu: React.FC<{
  x: number;
  y: number;
  name: string;
  onClose: () => void;
}> = ({ x, y, name, onClose }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const tt = tableToolsLocale(context);
  const filtered = slicerHasFilter(context, name);
  const items: MenuItem[] = [
    {
      id: "slicer-settings",
      label: tt.slicerSettings,
      icon: Settings2,
      onSelect: () => showDialog(<SlicerSettingsDialog name={name} />),
    },
    {
      id: "slicer-clear-filter",
      label: tt.clearFilter,
      icon: FunnelX,
      disabled: !filtered,
      onSelect: () =>
        setContext((ctx) => {
          clearSlicerFilter(ctx, name);
        }),
    },
    { type: "separator", id: "s1" },
    {
      id: "slicer-remove",
      label: tt.removeSlicer,
      icon: Trash2,
      onSelect: () =>
        setContext((ctx) => {
          removeSlicer(ctx, name);
        }),
    },
  ];
  return (
    <ContextMenuPopup
      x={x}
      y={y}
      items={items}
      within={refs.workbookContainer.current}
      popupClassName="fortune-slicer-menu"
      minWidth={180}
      aria-label={name}
      onClose={() => onClose()}
    />
  );
};

/** Every slicer of the current sheet (a registered sheet overlay). */
export const SlicerLayer: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const tables = getTables(context, context.currentSheetId).filter(
    (t) => t.table.slicers?.length
  );
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ name: string; box: Box } | null>(
    null
  );
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    name: string;
  } | null>(null);
  const readonly = context.allowEdit === false;
  const active = context.activeSlicer;

  // forget the selection when the slicer is gone
  useEffect(() => {
    if (active && !findSlicer(context, active.name)) {
      setContext((ctx) => {
        ctx.activeSlicer = undefined;
      });
    }
  }, [active, context, setContext]);

  // clicking elsewhere deselects
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(".fortune-slicer, .fortune-slicer-menu")) return;
      if (target?.closest?.(".fortune-modal, .fortune-dialog")) return;
      setContext((ctx) => {
        ctx.activeSlicer = undefined;
      });
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [active, setContext]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.pageX - d.startX;
    const dy = e.pageY - d.startY;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    d.moved = true;
    d.current = resizeBox(d.orig, d.mode, dx, dy);
    setPreview({ name: d.name, box: d.current });
  }, []);

  const onMouseUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    setPreview(null);
    if (!d?.moved) return;
    setContext((ctx) => {
      const a = anchorOf(ctx, d.current);
      const patch: SlicerPatch = {
        r: a.r,
        c: a.c,
        offsetX: a.offsetX,
        offsetY: a.offsetY,
      };
      if (d.mode !== "move") {
        patch.width = a.width;
        patch.height = a.height;
      }
      updateSlicer(ctx, d.name, patch);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMouseMove, setContext]);

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, slicer: TableSlicer, mode: DragMode) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const sheetId = context.currentSheetId;
      const table = tables.find((t) => t.table.slicers?.includes(slicer));
      if (context.activeSlicer?.name !== slicer.name && table) {
        setContext((ctx) => {
          ctx.activeSlicer = {
            sheetId,
            table: table.table.name,
            name: slicer.name,
          };
        });
      }
      (e.currentTarget as HTMLElement)
        .closest<HTMLElement>(".fortune-slicer")
        ?.focus({ preventScroll: true });
      if (readonly) return;
      const box = slicerBox(context, slicer);
      drag.current = {
        name: slicer.name,
        mode,
        startX: e.pageX,
        startY: e.pageY,
        orig: box,
        current: box,
        moved: false,
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [context, onMouseMove, onMouseUp, readonly, setContext, tables]
  );

  const openMenu = useCallback(
    (e: React.MouseEvent, slicer: TableSlicer) => {
      e.preventDefault();
      e.stopPropagation();
      if (readonly) return;
      setMenu({ x: e.clientX, y: e.clientY, name: slicer.name });
    },
    [readonly]
  );

  if (tables.length === 0) return null;
  return (
    <div className="fortune-slicer-layer">
      {tables.map(({ table }) =>
        table.slicers!.map((slicer) => (
          <SlicerPanel
            key={slicer.name}
            sheetId={context.currentSheetId}
            table={table}
            slicer={slicer}
            box={
              preview?.name === slicer.name
                ? preview.box
                : slicerBox(context, slicer)
            }
            active={active?.name === slicer.name}
            onStartDrag={startDrag}
            onMenu={openMenu}
          />
        ))
      )}
      {menu && (
        <SlicerMenu
          x={menu.x}
          y={menu.y}
          name={menu.name}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};

/** Opens Insert Slicer for the table of the active cell. */
export function useInsertSlicer() {
  const { context } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  return useCallback(() => {
    if (context.allowEdit === false) return;
    const ref = activeCellTable(context);
    if (!ref) {
      showDialog(tableToolsLocale(context).insertSlicerNoTable, "ok");
      return;
    }
    showDialog(<InsertSlicerDialog tableName={ref.table.name} />);
  }, [context, showDialog]);
}

/** Sprite symbol of the slicer toolbar icon. */
const SlicerIconSymbol: React.FC = () => (
  <svg style={{ display: "none" }} aria-hidden="true">
    <symbol id="tinysheet-slicer" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M4 3h16v18H4V3zm2 2v2h12V5H6zm1 4v3h10V9H7zm0 5v3h10v-3H7z"
      />
    </symbol>
  </svg>
);

/** Toolbar "Slicer" (Insert › Slicer). */
export const SlicerToolbarButton: React.FC<{ tooltip?: string }> = () => {
  const { context } = useContext(WorkbookContext);
  const insert = useInsertSlicer();
  const tt = tableToolsLocale(context);
  const label = tt.insertSlicer;
  return (
    <>
      <SlicerIconSymbol />
      <div
        className="fortune-toolbar-button fortune-toolbar-item"
        role="button"
        tabIndex={0}
        data-tips={label}
        aria-label={label}
        aria-disabled={context.allowEdit === false || undefined}
        onClick={insert}
        onKeyDown={activateOnKey}
      >
        <SVGIcon name="tinysheet-slicer" />
        <div className="fortune-tooltip" aria-hidden="true">
          {label}
        </div>
      </div>
    </>
  );
};
