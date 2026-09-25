/**
 * PivotTables in the React UI (the model and engine live in the core
 * package, modules/pivot.ts). Everything plugs in through the extension
 * registries:
 *
 * - toolbar item "pivotTable": Insert › PivotTable (CreatePivotDialog);
 * - sheet overlay "pivotTable": the PivotTable Fields pane (while the
 *   active cell is in a report), drop-down buttons on report filter and
 *   label cells, edit protection of report cells (Excel's message),
 *   drill-down on double-click and auto refresh;
 * - context-menu items "pivot-refresh", "pivot-field-list" and
 *   "pivot-value-settings".
 */
import React, { useContext, useEffect, useRef } from "react";
import _ from "lodash";
import {
  checkPivotUpdate,
  deletePivotTable,
  fixColumnStyleOverflowInFreeze,
  fixRowStyleOverflowInFreeze,
  getPivotTables,
  pivotAt,
  pivotCellInfo,
  pivotDrillDown,
  pivotInRange,
  dialogsLocale,
  pivotLocale,
  pivotSourceSignature,
  refreshPivotTable,
  resolvePivotSource,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import { registerSheetOverlay } from "../../extensions";
import { registerContextMenuItem } from "../ContextMenu/actions";
import CreatePivotDialog, { PivotButton } from "./CreatePivotDialog";
import FieldsPane from "./FieldsPane";
import { SidePane } from "../SidePane";
import { ValueFieldSettingsDialog } from "./FieldSettingsDialog";
import ReportDropdowns from "./ReportDropdowns";
import { pivotErrorText } from "./usePivotUpdate";
import "./index.css";
import { DialogShell } from "../ui";

/** The PivotTable of the active cell, with its sheet. */
export function activePivot(ctx: Context) {
  const sel = _.last(ctx.luckysheet_select_save);
  if (!sel) return null;
  const r = sel.row_focus ?? sel.row[0];
  const c = sel.column_focus ?? sel.column[0];
  const pivot = pivotAt(ctx, ctx.currentSheetId, r, c);
  return pivot ? { sheetId: ctx.currentSheetId, pivot, r, c } : null;
}

/** Asks before a refresh overwrites cells (context-menu Refresh). */
const ConfirmRefresh: React.FC<{ sheetId: string; id: string }> = ({
  sheetId,
  id,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = pivotLocale(context);
  return (
    <DialogShell
      title={dialogsLocale(context).appName}
      className="fortune-pivot-dialog"
      footer={
        <>
          <PivotButton onClick={hideDialog}>{t.cancel}</PivotButton>
          <PivotButton
            primary
            onClick={() => {
              setContext((ctx) => {
                refreshPivotTable(ctx, sheetId, id, { force: true });
              });
              hideDialog();
            }}
          >
            {t.ok}
          </PivotButton>
        </>
      }
    >
      <div>{t.confirmReplace}</div>
    </DialogShell>
  );
};

function overlaps(ctx: Context, sheetId: string) {
  return (ctx.luckysheet_select_save ?? []).some((s) =>
    pivotInRange(ctx, sheetId, s)
  );
}

/** Selection covering a whole report: Delete removes the PivotTable. */
function wholePivotSelected(ctx: Context, sheetId: string) {
  const sel = _.last(ctx.luckysheet_select_save);
  if (!sel) return null;
  return (
    getPivotTables(ctx, sheetId).find(({ pivot }) => {
      const o = pivot.output;
      return (
        o &&
        sel.row[0] <= o.row[0] &&
        sel.row[1] >= o.row[1] &&
        sel.column[0] <= o.column[0] &&
        sel.column[1] >= o.column[1]
      );
    })?.pivot ?? null
  );
}

function isEditKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    return e.key.toLowerCase() === "x" || e.key.toLowerCase() === "v";
  }
  if (e.altKey) return false;
  return (
    e.key.length === 1 ||
    e.key === "F2" ||
    e.key === "Delete" ||
    e.key === "Backspace"
  );
}

/**
 * Report cells are protected, double-clicking a value drills down, and
 * auto-refresh PivotTables follow their source.
 */
function usePivotGuards() {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    const wb = refs.workbookContainer.current;
    const area = refs.cellArea.current;
    const fx = refs.fxInput.current;
    if (!wb || !area) return undefined;
    const message = () =>
      showAlert(pivotLocale(contextRef.current).cannotChange, "ok");
    const fromGrid = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return (
        !el ||
        el === refs.cellInput.current ||
        el === wb ||
        el === area ||
        !!el.closest?.(".fortune-cell-area") ||
        el === document.body
      );
    };
    const blocked = () => {
      const ctx = contextRef.current;
      return (
        ctx.luckysheetCellUpdate.length === 0 &&
        overlaps(ctx, ctx.currentSheetId)
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!fromGrid(e.target) || !isEditKey(e) || !blocked()) return;
      const ctx = contextRef.current;
      const whole = wholePivotSelected(ctx, ctx.currentSheetId);
      if (whole && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        e.stopPropagation();
        setContext((draft) => {
          deletePivotTable(draft, draft.currentSheetId, whole.id);
        });
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      message();
    };
    const onClipboard = (e: Event) => {
      if (!fromGrid(e.target) || !blocked()) return;
      e.preventDefault();
      e.stopPropagation();
      message();
    };
    const onDblClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.(".fortune-pivot-dropdown, .fortune-pivot-popover")) {
        return;
      }
      const ctx = contextRef.current;
      const sel = _.last(ctx.luckysheet_select_save);
      if (!sel) return;
      const r = sel.row_focus ?? sel.row[0];
      const c = sel.column_focus ?? sel.column[0];
      const info = pivotCellInfo(ctx, ctx.currentSheetId, r, c);
      if (!info) return;
      e.preventDefault();
      e.stopPropagation();
      if (info.kind === "value") {
        if (ctx.allowEdit === false) return;
        setContext((draft) => {
          pivotDrillDown(draft, draft.currentSheetId, r, c);
        });
        return;
      }
      if (info.kind !== "filter") message();
    };
    const onFxKeyDown = (e: KeyboardEvent) => {
      const ctx = contextRef.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== "Delete" && e.key !== "Backspace") {
        return;
      }
      if (!overlaps(ctx, ctx.currentSheetId)) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).blur?.();
      message();
    };
    wb.addEventListener("keydown", onKeyDown, true);
    wb.addEventListener("paste", onClipboard, true);
    wb.addEventListener("cut", onClipboard, true);
    area.addEventListener("dblclick", onDblClick, true);
    fx?.addEventListener("keydown", onFxKeyDown, true);
    return () => {
      wb.removeEventListener("keydown", onKeyDown, true);
      wb.removeEventListener("paste", onClipboard, true);
      wb.removeEventListener("cut", onClipboard, true);
      area.removeEventListener("dblclick", onDblClick, true);
      fx?.removeEventListener("keydown", onFxKeyDown, true);
    };
  }, [refs, setContext, showAlert]);

  // auto refresh: when a source changes, refresh (not an undo step of its
  // own: undoing the edit refreshes again)
  const signatures = useRef(new Map<string, { data: unknown; sig: string }>());
  const initialized = useRef(new Set<string>());
  const { luckysheetfile } = context;
  useEffect(() => {
    const ctx = contextRef.current;
    const due: { sheetId: string; id: string }[] = [];
    getPivotTables(ctx).forEach(({ sheetId, pivot }) => {
      // reports loaded without a layout (a saved model, an xlsx import) are
      // refreshed once their source is loaded
      if (!pivot.layout && !initialized.current.has(pivot.id)) {
        const error = checkPivotUpdate(ctx, sheetId, pivot.id);
        if (error !== "source" && error !== "notFound") {
          initialized.current.add(pivot.id);
          if (!error) due.push({ sheetId, id: pivot.id });
        }
      }
      if (!pivot.options.autoRefresh) {
        signatures.current.delete(pivot.id);
        return;
      }
      const src = resolvePivotSource(ctx, pivot.source);
      const data = ctx.luckysheetfile.find((s) => s.id === src?.sheetId)?.data;
      const prev = signatures.current.get(pivot.id);
      if (prev && prev.data === data) return;
      const sig = pivotSourceSignature(ctx, pivot);
      signatures.current.set(pivot.id, { data, sig });
      if (prev && prev.sig !== sig) due.push({ sheetId, id: pivot.id });
    });
    const runnable = _.uniqBy(due, "id").filter(
      (d) => checkPivotUpdate(ctx, d.sheetId, d.id) == null
    );
    if (runnable.length) {
      setContext(
        (draft) => {
          runnable.forEach((d) => refreshPivotTable(draft, d.sheetId, d.id));
        },
        { noHistory: true }
      );
    }
  }, [luckysheetfile, setContext]);
}

const PivotOverlay: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  usePivotGuards();
  const active = activePivot(context);
  const pivots = getPivotTables(context, context.currentSheetId);
  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  return (
    <>
      {pivots.map(({ pivot }) => (
        <ReportDropdowns
          key={pivot.id}
          sheetId={context.currentSheetId}
          pivot={pivot}
          style={(r1, c1, r2, c2) =>
            _.assign(
              {},
              fixRowStyleOverflowInFreeze(context, r1, r2, freeze),
              fixColumnStyleOverflowInFreeze(context, c1, c2, freeze)
            )
          }
        />
      ))}
      <SidePane
        id="pivot-fields"
        title={pivotLocale(context).fieldsTitle}
        open={!!active && !context.pivotFieldListHidden}
        onClose={() =>
          setContext(
            (ctx) => {
              ctx.pivotFieldListHidden = true;
            },
            { noHistory: true }
          )
        }
      >
        {active && (
          <FieldsPane
            key={active.pivot.id}
            sheetId={active.sheetId}
            pivot={active.pivot}
          />
        )}
      </SidePane>
    </>
  );
};

let registered = false;

/** Registers the PivotTable UI (idempotent). */
export function registerPivotTableFeatures() {
  if (registered) return;
  registered = true;
  registerSheetOverlay("pivotTable", PivotOverlay);
  registerContextMenuItem("pivot-refresh", {
    label: (context) => pivotLocale(context).refresh,
    icon: "refresh",
    visible: (context) => !!activePivot(context),
    disabled: (context) => context.allowEdit === false,
    onSelect: ({ context, setContext, showDialog }) => {
      const a = activePivot(context);
      if (!a) return;
      const t = pivotLocale(context);
      const error = checkPivotUpdate(context, a.sheetId, a.pivot.id);
      if (error === "replaceData") {
        showDialog(<ConfirmRefresh sheetId={a.sheetId} id={a.pivot.id} />);
        return;
      }
      if (error) {
        showDialog(pivotErrorText(t, error));
        return;
      }
      setContext((ctx) => {
        refreshPivotTable(ctx, a.sheetId, a.pivot.id);
      });
    },
  });
  registerContextMenuItem("pivot-value-settings", {
    label: (context) => pivotLocale(context).valueFieldSettings,
    visible: (context) => {
      const a = activePivot(context);
      return (
        !!a && pivotCellInfo(context, a.sheetId, a.r, a.c)?.kind === "value"
      );
    },
    disabled: (context) => context.allowEdit === false,
    onSelect: ({ context, showDialog }) => {
      const a = activePivot(context);
      const info = a && pivotCellInfo(context, a.sheetId, a.r, a.c);
      if (!a || info?.valueIndex == null) return;
      showDialog(
        <ValueFieldSettingsDialog
          sheetId={a.sheetId}
          pivotId={a.pivot.id}
          index={info.valueIndex}
        />
      );
    },
  });
  registerContextMenuItem("pivot-field-list", {
    label: (context) => {
      const t = pivotLocale(context);
      return context.pivotFieldListHidden ? t.showFieldList : t.hideFieldList;
    },
    icon: "pivot",
    visible: (context) => !!activePivot(context),
    onSelect: ({ setContext }) =>
      setContext(
        (ctx) => {
          if (ctx.pivotFieldListHidden) delete ctx.pivotFieldListHidden;
          else ctx.pivotFieldListHidden = true;
        },
        { noHistory: true }
      ),
  });
}

export { CreatePivotDialog, FieldsPane };
