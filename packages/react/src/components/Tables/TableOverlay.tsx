/**
 * Table chrome drawn over the grid (registered with registerSheetOverlay):
 *
 * - filter buttons in the header row of every table (the regular filter
 *   menu opens scoped to the table, see core tableFilter.ts);
 * - the total-row function dropdown next to a selected total-row cell;
 * - the resize handle at the table's bottom-right corner;
 * - the AutoCorrect options of a calculated column.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import {
  colLocation,
  fillCalculatedColumn,
  fixColumnStyleOverflowInFreeze,
  fixRowStyleOverflowInFreeze,
  getTables,
  locale,
  resizeTable,
  rowLocation,
  setTableTotalFunction,
  tableAreas,
  tableAt,
  tableToolsLocale,
  undoCalculatedColumn,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  SheetTable,
  TableTotalFunction,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import SVGIcon from "../SVGIcon";
import { InsertFunctionDialog } from "../Ribbon/commands/functions";

const TOTAL_FUNCTIONS: [TableTotalFunction, string][] = [
  ["none", "fnNone"],
  ["average", "fnAverage"],
  ["count", "fnCount"],
  ["countNums", "fnCountNums"],
  ["max", "fnMax"],
  ["min", "fnMin"],
  ["sum", "fnSum"],
  ["stdDev", "fnStdDev"],
  ["var", "fnVar"],
];

type Geometry = Pick<Context, "visibledatarow" | "visibledatacolumn">;

const rowTop = (g: Geometry, r: number) =>
  r <= 0 ? 0 : (g.visibledatarow[r - 1] ?? 0);
const colLeft = (g: Geometry, c: number) =>
  c <= 0 ? 0 : (g.visibledatacolumn[c - 1] ?? 0);

/** Closes a popup when the mouse goes down outside `ref`. */
function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [close, open, ref]);
}

/** Header-row filter buttons of one table. */
const TableFilterButtons: React.FC<{ table: SheetTable }> = ({ table }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const tt = tableToolsLocale(context);
  const header = table.range.row[0];
  const { dataEnd } = tableAreas(table);
  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  const top = rowTop(context, header);
  const rowStyle = fixRowStyleOverflowInFreeze(context, header, header, freeze);

  const open = (c: number, left: number, buttonTop: number) => {
    const k = c - table.range.column[0];
    setContext((ctx) => {
      if (
        ctx.filterContextMenu?.col === c &&
        ctx.filterScope?.table === table.name
      ) {
        return;
      }
      ctx.filterScope = { sheetId: ctx.currentSheetId, table: table.name };
      ctx.filterContextMenu = {
        x: left + ctx.rowHeaderWidth - refs.scrollbarX.current!.scrollLeft,
        y:
          buttonTop +
          23 +
          ctx.toolbarHeight +
          ctx.calculatebarHeight +
          ctx.columnHeaderHeight -
          refs.scrollbarY.current!.scrollTop,
        col: c,
        startRow: header,
        endRow: dataEnd,
        startCol: table.range.column[0],
        endCol: table.range.column[1],
        hiddenRows: _.keys(table.filters?.[k]?.rowhidden).map((r) =>
          parseInt(r, 10)
        ),
        listBoxMaxHeight: 400,
      };
    });
  };

  return (
    <>
      {table.columns.map((col, k) => {
        const c = table.range.column[0] + k;
        if (context.config?.colhidden?.[c] != null) return null;
        const colStyle = fixColumnStyleOverflowInFreeze(context, c, c, freeze);
        const right = context.visibledatacolumn[c] ?? 0;
        const left =
          colStyle.left != null
            ? colStyle.left + right - colLeft(context, c) - 20
            : right - 20;
        const buttonTop = rowStyle.top != null ? rowStyle.top : top;
        const active = !!table.filters?.[k];
        return (
          <div
            key={col.name}
            role="button"
            tabIndex={0}
            aria-label={tt.filterColumn.replace("{column}", col.name)}
            aria-pressed={active}
            className={`luckysheet-filter-options fortune-table-filter-button${
              active ? " luckysheet-filter-options-active" : ""
            }`}
            style={{
              left,
              top: buttonTop,
              display: rowStyle.display ?? colStyle.display,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              open(c, left, buttonTop);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                open(c, left, buttonTop);
              }
            }}
          >
            {active ? (
              <SVGIcon
                name="filter-fill-white"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <div className="caret down" />
            )}
          </div>
        );
      })}
    </>
  );
};

/** Excel's total-row dropdown next to the selected total cell. */
const TotalRowDropdown: React.FC<{
  table: SheetTable;
  r: number;
  c: number;
}> = ({ table, r, c }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = locale(context).tables as Record<string, string>;
  const tt = tableToolsLocale(context);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(ref, open, close);
  useEffect(() => setOpen(false), [r, c]);
  const k = c - table.range.column[0];
  const current = table.columns[k]?.totalFunction ?? "none";
  const left = context.visibledatacolumn[c] + 1;
  const top = rowTop(context, r);
  const height = context.visibledatarow[r] - top - 1;
  const pick = (fn: TableTotalFunction) => {
    setOpen(false);
    setContext((ctx) => {
      setTableTotalFunction(ctx, table.name, k, fn);
    });
  };
  return (
    <div
      ref={ref}
      className="fortune-table-total-dropdown"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={tt.totalRowMenu}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={tt.totalRowMenu}
        className="fortune-table-total-button"
        style={{ height: Math.max(14, height) }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="caret down" />
      </div>
      {open && (
        <div className="fortune-table-popup" role="listbox">
          {TOTAL_FUNCTIONS.map(([fn, key]) => (
            <div
              key={fn}
              role="option"
              tabIndex={0}
              aria-selected={current === fn}
              className={`fortune-table-popup-item${
                current === fn ? " fortune-table-popup-item-selected" : ""
              }`}
              onClick={() => pick(fn)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pick(fn);
              }}
            >
              {t[key] ?? key}
            </div>
          ))}
          <div
            role="option"
            tabIndex={0}
            aria-selected={current === "custom"}
            className="fortune-table-popup-item"
            onClick={() => {
              setOpen(false);
              showDialog(<InsertFunctionDialog onCancel={hideDialog} />);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOpen(false);
                showDialog(<InsertFunctionDialog onCancel={hideDialog} />);
              }
            }}
          >
            {tt.moreFunctions}
          </div>
        </div>
      )}
    </div>
  );
};

type ResizeDrag = {
  table: string;
  startX: number;
  startY: number;
  right: number;
  bottom: number;
};

/** The resize handle at a table's bottom-right corner. */
const TableResizeHandle: React.FC<{ table: SheetTable }> = ({ table }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const tt = tableToolsLocale(context);
  const drag = useRef<ResizeDrag | null>(null);
  const [preview, setPreview] = useState<{ r2: number; c2: number } | null>(
    null
  );
  const geometry = useRef<Geometry>(context);
  geometry.current = context;
  const [r1] = table.range.row;
  const [c1] = table.range.column;
  const minRows = (table.headerRow ? 1 : 0) + (table.totalRow ? 1 : 0) + 1;

  const target = useCallback(
    (e: MouseEvent, d: NonNullable<typeof drag.current>) => {
      const g = geometry.current;
      const x = d.right + (e.pageX - d.startX);
      const y = d.bottom + (e.pageY - d.startY);
      const r2 = Math.max(
        r1 + minRows - 1,
        rowLocation(y, g.visibledatarow)[2]
      );
      const c2 = Math.max(c1, colLocation(x, g.visibledatacolumn)[2]);
      return { r2, c2 };
    },
    [c1, minRows, r1]
  );

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (drag.current) setPreview(target(e, drag.current));
    },
    [target]
  );
  const onUp = useCallback(
    (e: MouseEvent) => {
      const d = drag.current;
      drag.current = null;
      setPreview(null);
      if (!d) return;
      const { r2, c2 } = target(e, d);
      if (r2 === table.range.row[1] && c2 === table.range.column[1]) return;
      setContext((ctx) => {
        resizeTable(ctx, d.table, { row: [r1, r2], column: [c1, c2] });
      });
    },
    [c1, r1, setContext, table.range.column, table.range.row, target]
  );
  const handlers = useRef({ onMove, onUp });
  handlers.current = { onMove, onUp };
  const stopTracking = useRef<(() => void) | null>(null);
  useEffect(() => () => stopTracking.current?.(), []);

  const right = context.visibledatacolumn[table.range.column[1]] ?? 0;
  const bottom = context.visibledatarow[table.range.row[1]] ?? 0;
  return (
    <>
      <div
        className="fortune-table-resize-handle"
        role="presentation"
        title={tt.resizeHandle}
        style={{ left: right - 7, top: bottom - 7 }}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          drag.current = {
            table: table.name,
            startX: e.pageX,
            startY: e.pageY,
            right,
            bottom,
          };
          setPreview({ r2: table.range.row[1], c2: table.range.column[1] });
          stopTracking.current?.();
          stopTracking.current = trackPointerDrag(e, {
            onMove: (ev) => handlers.current.onMove(ev),
            onEnd: (ev) => {
              handlers.current.onUp(ev);
              refs.cellInput.current?.focus({ preventScroll: true });
            },
            // Esc: the table keeps its size
            onCancel: () => {
              drag.current = null;
              setPreview(null);
              refs.cellInput.current?.focus({ preventScroll: true });
            },
          });
        }}
      />
      {preview && (
        <div
          className="fortune-table-resize-preview"
          style={{
            left: colLeft(context, c1),
            top: rowTop(context, r1),
            width:
              (context.visibledatacolumn[preview.c2] ?? 0) -
              colLeft(context, c1) -
              1,
            height:
              (context.visibledatarow[preview.r2] ?? 0) -
              rowTop(context, r1) -
              1,
          }}
        />
      )}
    </>
  );
};

/** AutoCorrect options after a calculated column was created or offered. */
const CalculatedColumnTag: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const tt = tableToolsLocale(context);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(ref, open, close);
  const info = context.tableAutoCorrect;
  if (!info || info.sheetId !== context.currentSheetId) return null;
  if (context.luckysheetCellUpdate.length > 0) return null;
  // shown while the active cell stays in the edited column
  const sel = _.last(context.luckysheet_select_save);
  if ((sel?.column_focus ?? sel?.column[0]) !== info.c) return null;
  const left = context.visibledatacolumn[info.c] ?? 0;
  const top = context.visibledatarow[info.r] ?? 0;
  const run = () => {
    setOpen(false);
    setContext((ctx) => {
      const a = ctx.tableAutoCorrect;
      ctx.tableAutoCorrect = undefined;
      if (!a) return;
      if (a.kind === "created") {
        undoCalculatedColumn(ctx, a.table, a.column, a.r);
      } else {
        fillCalculatedColumn(ctx, a.table, a.column, a.r);
      }
    });
  };
  const label =
    info.kind === "created" ? tt.undoCalculatedColumn : tt.overwriteColumn;
  return (
    <div
      ref={ref}
      className="fortune-table-autocorrect"
      style={{ left: left + 2, top: top + 2 }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={tt.autoCorrect}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tt.autoCorrect}
        className="fortune-table-autocorrect-button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
        <div className="caret down" />
      </div>
      {open && (
        <div className="fortune-table-popup" role="menu">
          <div
            role="menuitem"
            tabIndex={0}
            className="fortune-table-popup-item"
            onClick={run}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  );
};

/** Everything tables draw over the current sheet. */
const TableOverlay: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const tables = getTables(context, context.currentSheetId);
  if (tables.length === 0 && !context.tableAutoCorrect) return null;
  const editable = context.allowEdit !== false;
  const last = _.last(context.luckysheet_select_save);
  const rf = last?.row_focus ?? last?.row[0];
  const cf = last?.column_focus ?? last?.column[0];
  const focused =
    rf == null || cf == null
      ? null
      : tableAt(context, context.currentSheetId, rf, cf);
  const inTotal =
    focused &&
    focused.table.totalRow &&
    rf === focused.table.range.row[1] &&
    editable &&
    context.luckysheetCellUpdate.length === 0;
  return (
    <div className="fortune-table-overlay">
      {tables.map(({ table }) => (
        <React.Fragment key={table.name}>
          {table.headerRow && table.filterButton !== false && (
            <TableFilterButtons table={table} />
          )}
          {editable && <TableResizeHandle table={table} />}
        </React.Fragment>
      ))}
      {inTotal && <TotalRowDropdown table={focused!.table} r={rf!} c={cf!} />}
      {editable && <CalculatedColumnTag />}
    </div>
  );
};

export default TableOverlay;
