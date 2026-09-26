/**
 * Home › Editing: AutoSum (Sum, Average, Count Numbers, Max, Min, More
 * Functions…), Fill (Down, Right, Up, Left, Series…, Flash Fill), Clear
 * (All, Formats, Contents, Comments and Notes, Hyperlinks), Sort & Filter
 * and Find & Select.
 */
import React, { useContext, useState } from "react";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Delete,
  Eraser,
  Funnel,
  FunnelX,
  Hash,
  Highlighter,
  ListChecks,
  ListFilter,
  ListOrdered,
  Locate,
  LocateFixed,
  MessageSquareX,
  RefreshCw,
  RemoveFormatting,
  Replace,
  Search,
  Sigma,
  SquareArrowDown,
  SquareFunction,
  StickyNote,
  Unlink,
  Unlink2,
  Zap,
} from "lucide-react";
import {
  api,
  autoSelectionFormula,
  applyGoToSpecial,
  checkProtection,
  clearAllFilterConditions,
  clearGroupedSheetsContents,
  Context,
  createFilter,
  deleteComment,
  deleteSelectedCellText,
  deleteThreadedCommentsInRanges,
  dropCellCache,
  fillSelectionFromEdge,
  getFlowdata,
  getGoToSpecialRanges,
  getSheetIndex,
  GoToSpecialType,
  handleClearFormat,
  isAllowEdit,
  jfrefreshgrid,
  locale,
  normalizeSelection,
  reapplyFilter,
  removeHyperlink,
  runFlashFillCommand,
  sortSelection,
  update,
  updateDropCell,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { ModalContext } from "../../../../context/modal";
import {
  Button,
  DialogShell,
  LargeButton,
  MenuButton,
  MenuItem,
  NumberInput,
  SplitButton,
} from "../../../ui";
import { InsertFunctionDialog } from "../functions";
import CustomSort from "../../../CustomSort";
import { LocationCondition } from "../../../LocationCondition";
import type { RibbonCommandProps } from "../../registry";
import { shortcutText } from "../helpers";
import { Home, moreLabel, useHome } from "./shared";

type Range = { row: number[]; column: number[] };

/** Every existing cell of the selection, clipped to the sheet. */
function eachSelectedCell(ctx: Context, fn: (r: number, c: number) => void) {
  const d = getFlowdata(ctx);
  if (!d) return;
  (ctx.luckysheet_select_save ?? []).forEach((sel) => {
    const r2 = Math.min(sel.row[1], d.length - 1);
    for (let r = Math.max(0, sel.row[0]); r <= r2; r += 1) {
      const row = d[r];
      if (row) {
        const c2 = Math.min(sel.column[1], row.length - 1);
        for (let c = Math.max(0, sel.column[0]); c <= c2; c += 1) fn(r, c);
      }
    }
  });
}

const selectionRanges = (ctx: Context): Range[] =>
  (ctx.luckysheet_select_save ?? []).map((s) => ({
    row: [...s.row],
    column: [...s.column],
  }));

/* ---------------- AutoSum ---------------- */

export const AutoSumCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, h } = home;
  const sum = (fn: string) => () =>
    home.run((ctx) =>
      autoSelectionFormula(
        ctx,
        home.input(),
        h.refs.fxInput.current,
        fn,
        h.refs.globalCache
      )
    );
  const entry = (fn: string, label: string): MenuItem => ({
    id: `autosum-${fn.toLowerCase()}`,
    label,
    hint: fn,
    onSelect: sum(fn),
  });
  const menu: MenuItem[] = [
    entry("SUM", t.sum),
    entry("AVERAGE", t.average),
    entry("COUNT", t.countNumbers),
    entry("MAX", t.max),
    entry("MIN", t.min),
    { type: "separator" },
    {
      id: "autosum-more",
      label: t.moreFunctions,
      icon: SquareFunction,
      onSelect: () =>
        h.showDialog(<InsertFunctionDialog onCancel={() => h.hideDialog()} />),
    },
  ];
  return (
    <SplitButton
      icon={Sigma}
      label={t.autoSum}
      shortcut={shortcutText(t.autoSumShortcut)}
      description={t.autoSumDescription}
      text={<span className="ts-home-label">{t.autoSum}</span>}
      arrowLabel={moreLabel(t, t.autoSum)}
      disabled={!home.editable}
      onClick={sum("SUM")}
      menu={menu}
    />
  );
};

/* ---------------- Fill ---------------- */

/**
 * Fill Up / Left: the bottom row (right column) of each range into the
 * rest of it, or the cell below (to the right) of a single row (column);
 * the counterpart of the core's Ctrl+D / Ctrl+R.
 */
export function fillSelectionTowards(ctx: Context, direction: "up" | "left") {
  const d = getFlowdata(ctx);
  const sels = ctx.luckysheet_select_save;
  if (!d || !sels?.length) return false;
  if (!checkProtection(ctx, "editCells") || !isAllowEdit(ctx)) return false;
  const ranges = _.cloneDeep(sels);
  let done = false;
  ranges.forEach((sel) => {
    const [r1, r2] = sel.row;
    const [c1, c2] = sel.column;
    let copyRange: Range;
    let applyRange: Range;
    if (direction === "up") {
      if (r1 === r2) {
        if (r2 + 1 >= d.length) return;
        copyRange = { row: [r2 + 1, r2 + 1], column: [c1, c2] };
        applyRange = { row: [r1, r2], column: [c1, c2] };
      } else {
        copyRange = { row: [r2, r2], column: [c1, c2] };
        applyRange = { row: [r1, r2 - 1], column: [c1, c2] };
      }
    } else if (c1 === c2) {
      if (c2 + 1 >= (d[0]?.length ?? 0)) return;
      copyRange = { row: [r1, r2], column: [c2 + 1, c2 + 1] };
      applyRange = { row: [r1, r2], column: [c1, c2] };
    } else {
      copyRange = { row: [r1, r2], column: [c2, c2] };
      applyRange = { row: [r1, r2], column: [c1, c2 - 1] };
    }
    dropCellCache.copyRange = copyRange;
    dropCellCache.applyRange = applyRange;
    dropCellCache.direction = direction;
    dropCellCache.applyType = "0";
    dropCellCache.ctrlKey = false;
    updateDropCell(ctx);
    done = true;
  });
  ctx.luckysheet_select_save = normalizeSelection(ctx, ranges);
  return done;
}

type SeriesOptions = {
  byRows: boolean;
  growth: boolean;
  step: number;
  stop: number | null;
};

/**
 * Fill › Series: each row (or column) of the selection continues from its
 * first cell, adding (Linear) or multiplying by (Growth) the step, up to
 * the stop value.
 */
export function fillSeries(ctx: Context, opts: SeriesOptions) {
  const d = getFlowdata(ctx);
  const sel = ctx.luckysheet_select_save?.[0];
  if (!d || !sel) return;
  if (!checkProtection(ctx, "editCells") || !isAllowEdit(ctx)) return;
  const [r1, r2] = sel.row;
  const [c1, c2] = sel.column;
  const lines = opts.byRows ? _.range(r1, r2 + 1) : _.range(c1, c2 + 1);
  lines.forEach((line) => {
    const first = opts.byRows ? d[line]?.[c1] : d[r1]?.[line];
    const start = Number(first?.v);
    if (first?.v == null || first.v === "" || !Number.isFinite(start)) return;
    const count = opts.byRows ? c2 - c1 : r2 - r1;
    for (let i = 1; i <= count; i += 1) {
      const value = opts.growth
        ? start * opts.step ** i
        : start + opts.step * i;
      if (opts.stop != null) {
        const past = opts.step >= 0 ? value > opts.stop : value < opts.stop;
        if (past) break;
      }
      const r = opts.byRows ? line : r1 + i;
      const c = opts.byRows ? c1 + i : line;
      api.setCellValue(ctx, r, c, Number(value.toPrecision(15)), null);
    }
  });
}

const SeriesDialog: React.FC<{ home: Home }> = ({ home }) => {
  const { hideModal } = useContext(ModalContext);
  const { t } = home;
  const sel = home.context.luckysheet_select_save?.[0];
  const rows = sel ? sel.row[1] - sel.row[0] + 1 : 1;
  const cols = sel ? sel.column[1] - sel.column[0] + 1 : 1;
  const [byRows, setByRows] = useState(cols > rows);
  const [growth, setGrowth] = useState(false);
  const [step, setStep] = useState(1);
  const [stop, setStop] = useState<string>("");
  const close = () => {
    hideModal();
    home.h.focusSheet();
  };
  const ok = () => {
    close();
    const stopValue = stop.trim() === "" ? null : Number(stop);
    home.run((ctx) =>
      fillSeries(ctx, {
        byRows,
        growth,
        step,
        stop: Number.isFinite(stopValue as number) ? stopValue : null,
      })
    );
  };
  const radio = (
    name: string,
    checked: boolean,
    label: string,
    onChange: () => void
  ) => (
    <label className="ts-home-radio">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
  return (
    <DialogShell
      title={t.seriesTitle}
      width={360}
      onClose={close}
      onConfirm={ok}
      footer={
        <>
          <Button onClick={close}>{t.cancel}</Button>
          <Button variant="primary" onClick={ok}>
            {t.ok}
          </Button>
        </>
      }
    >
      <div className="ts-home-series">
        <fieldset>
          <legend>{t.seriesIn}</legend>
          {radio("series-in", byRows, t.seriesRows, () => setByRows(true))}
          {radio("series-in", !byRows, t.seriesColumns, () => setByRows(false))}
        </fieldset>
        <fieldset>
          <legend>{t.seriesType}</legend>
          {radio("series-type", !growth, t.seriesLinear, () =>
            setGrowth(false)
          )}
          {radio("series-type", growth, t.seriesGrowth, () => setGrowth(true))}
        </fieldset>
        <label className="ts-home-series-field">
          <span>{t.stepValue}</span>
          <NumberInput
            aria-label={t.stepValue}
            value={step}
            step={1}
            onChange={setStep}
            width={120}
          />
        </label>
        <label className="ts-home-series-field">
          <span>{t.stopValue}</span>
          <input
            className="ts-home-plain-input"
            aria-label={t.stopValue}
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </label>
      </div>
    </DialogShell>
  );
};

export const FillCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const { showModal } = useContext(ModalContext);
  const menu: MenuItem[] = [
    {
      id: "fill-down",
      label: t.fillDown,
      icon: ArrowDown,
      shortcut: shortcutText(t.fillDownShortcut),
      onSelect: () => home.run((ctx) => fillSelectionFromEdge(ctx, "down")),
    },
    {
      id: "fill-right",
      label: t.fillRight,
      icon: ArrowRight,
      shortcut: shortcutText(t.fillRightShortcut),
      onSelect: () => home.run((ctx) => fillSelectionFromEdge(ctx, "right")),
    },
    {
      id: "fill-up",
      label: t.fillUp,
      icon: ArrowUp,
      onSelect: () => home.run((ctx) => fillSelectionTowards(ctx, "up")),
    },
    {
      id: "fill-left",
      label: t.fillLeft,
      icon: ArrowLeft,
      onSelect: () => home.run((ctx) => fillSelectionTowards(ctx, "left")),
    },
    { type: "separator" },
    {
      id: "fill-series",
      label: t.fillSeries,
      icon: ListOrdered,
      onSelect: () => showModal(<SeriesDialog home={home} />),
    },
    {
      id: "fill-flash",
      label: t.flashFill,
      icon: Zap,
      shortcut: shortcutText(t.flashFillShortcut),
      onSelect: () =>
        home.run((ctx) => {
          runFlashFillCommand(ctx);
        }),
    },
  ];
  return (
    <MenuButton
      icon={SquareArrowDown}
      label={t.fill}
      description={t.fillDescription2}
      text={<span className="ts-home-label">{t.fill}</span>}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

/* ---------------- Clear ---------------- */

/** Clear Formats also sets the number format back to General (Excel). */
function resetNumberFormats(ctx: Context) {
  const d = getFlowdata(ctx);
  if (!d) return;
  eachSelectedCell(ctx, (r, c) => {
    const cell = d[r][c];
    if (!cell?.ct || cell.ct.fa === "General" || cell.ct.t === "inlineStr") {
      return;
    }
    const numeric = typeof cell.v === "number";
    cell.ct = { fa: "General", t: numeric ? "n" : "g" };
    if (cell.v != null) cell.m = `${update("General", cell.v)}`;
  });
}

function clearComments(ctx: Context, home: Home) {
  const d = getFlowdata(ctx);
  if (!d) return;
  eachSelectedCell(ctx, (r, c) => {
    if (d[r][c]?.ps) deleteComment(ctx, home.h.refs.globalCache, r, c);
  });
  deleteThreadedCommentsInRanges(ctx, selectionRanges(ctx));
}

function clearHyperlinks(ctx: Context, removeFormatting: boolean) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const links = ctx.luckysheetfile[index].hyperlink;
  if (!links) return;
  const inSelection = (key: string) => {
    const [r, c] = key.split("_").map(Number);
    return (ctx.luckysheet_select_save ?? []).some(
      (s) =>
        r >= s.row[0] && r <= s.row[1] && c >= s.column[0] && c <= s.column[1]
    );
  };
  const keys = Object.keys(links).filter(inSelection);
  if (removeFormatting) {
    keys.forEach((key) => {
      const [r, c] = key.split("_").map(Number);
      removeHyperlink(ctx, r, c);
    });
    return;
  }
  if (!checkProtection(ctx, "insertHyperlinks") || !isAllowEdit(ctx)) return;
  ctx.luckysheetfile[index].hyperlink = _.omit(links, keys);
}

export const ClearCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const { generalDialog } = locale(home.context);
  const clearContents = (ctx: Context) => {
    const msg = deleteSelectedCellText(ctx);
    if (msg === "partMC") home.alert(generalDialog.partiallyError);
    else if (msg === "allowEdit") home.alert(generalDialog.readOnlyError);
    else if (msg === "success") clearGroupedSheetsContents(ctx);
    jfrefreshgrid(ctx, null, undefined);
  };
  const clearFormats = (ctx: Context) => {
    handleClearFormat(ctx);
    resetNumberFormats(ctx);
  };
  const menu: MenuItem[] = [
    {
      id: "clear-all",
      label: t.clearAll,
      icon: Eraser,
      onSelect: () =>
        home.run((ctx) => {
          clearContents(ctx);
          clearFormats(ctx);
          clearComments(ctx, home);
          clearHyperlinks(ctx, false);
        }),
    },
    {
      id: "clear-formats",
      label: t.clearFormats,
      icon: RemoveFormatting,
      onSelect: () => home.run(clearFormats),
    },
    {
      id: "clear-contents",
      label: t.clearContents,
      icon: Delete,
      shortcut: "Del",
      onSelect: () => home.run(clearContents),
    },
    {
      id: "clear-comments",
      label: t.clearComments,
      icon: MessageSquareX,
      onSelect: () => home.run((ctx) => clearComments(ctx, home)),
    },
    {
      id: "clear-hyperlinks",
      label: t.clearHyperlinks,
      icon: Unlink,
      onSelect: () => home.run((ctx) => clearHyperlinks(ctx, false)),
    },
    {
      id: "remove-hyperlinks",
      label: t.removeHyperlinks,
      icon: Unlink2,
      onSelect: () => home.run((ctx) => clearHyperlinks(ctx, true)),
    },
  ];
  return (
    <MenuButton
      icon={Eraser}
      label={t.clear}
      description={t.clearDescription}
      text={<span className="ts-home-label">{t.clear}</span>}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

/* ---------------- Sort & Filter ---------------- */

export const SortFilterCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const home = useHome();
  const { t, h, context } = home;
  const hasFilter = _.size(context.luckysheet_filter_save) > 0;
  const sort = (asc: boolean) => () =>
    home.run((ctx) => {
      const error = sortSelection(ctx, asc);
      if (error) home.alert(error);
    });
  const menu: MenuItem[] = [
    {
      id: "sort-az",
      label: t.sortAZ,
      icon: ArrowDownAZ,
      onSelect: sort(true),
    },
    {
      id: "sort-za",
      label: t.sortZA,
      icon: ArrowDownZA,
      onSelect: sort(false),
    },
    {
      id: "sort-custom",
      label: t.customSort,
      icon: ArrowUpDown,
      onSelect: () => h.showDialog(<CustomSort />),
    },
    { type: "separator" },
    {
      id: "filter-toggle",
      label: t.filter,
      icon: Funnel,
      checked: hasFilter,
      shortcut: shortcutText(t.filterShortcut),
      onSelect: () => home.run((ctx) => createFilter(ctx)),
    },
    {
      id: "filter-clear",
      label: t.clearFilter,
      icon: FunnelX,
      disabled: !hasFilter,
      onSelect: () => home.run((ctx) => clearAllFilterConditions(ctx)),
    },
    {
      id: "filter-reapply",
      label: t.reapply,
      icon: RefreshCw,
      disabled: !hasFilter,
      onSelect: () => home.run((ctx) => reapplyFilter(ctx)),
    },
  ];
  const Comp = size === "small" ? MenuButton : LargeButton;
  return (
    <Comp
      icon={ListFilter}
      label={t.sortFilter}
      description={t.sortFilterDescription}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

/* ---------------- Find & Select ---------------- */

export const FindSelectCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const home = useHome();
  const { t, h } = home;
  const special = (type: GoToSpecialType) => () => {
    if (getGoToSpecialRanges(home.context, type).length === 0) {
      home.alert(t.noCellsFound);
      return;
    }
    home.run((ctx) => {
      applyGoToSpecial(ctx, type);
    });
  };
  const menu: MenuItem[] = [
    {
      id: "find",
      label: t.find,
      icon: Search,
      shortcut: shortcutText(t.findShortcut),
      onSelect: () =>
        home.h.setContext(
          (ctx) => {
            ctx.showSearch = true;
            ctx.showReplace = false;
          },
          { noHistory: true }
        ),
    },
    {
      id: "replace",
      label: t.replace,
      icon: Replace,
      shortcut: shortcutText(t.replaceShortcut),
      onSelect: () =>
        home.h.setContext(
          (ctx) => {
            ctx.showSearch = true;
            ctx.showReplace = true;
          },
          { noHistory: true }
        ),
    },
    {
      id: "go-to",
      label: t.goTo,
      icon: Locate,
      shortcut: shortcutText(t.goToShortcut),
      onSelect: () =>
        home.h.setContext(
          (ctx) => {
            ctx.showGoTo = true;
          },
          { noHistory: true }
        ),
    },
    {
      id: "go-to-special",
      label: t.goToSpecial,
      icon: LocateFixed,
      onSelect: () => h.showDialog(<LocationCondition />),
    },
    { type: "separator" },
    {
      id: "select-formulas",
      label: t.selectFormulas,
      icon: SquareFunction,
      onSelect: special("formulas"),
    },
    {
      id: "select-notes",
      label: t.selectNotes,
      icon: StickyNote,
      onSelect: special("notes"),
    },
    {
      id: "select-conditional",
      label: t.selectConditional,
      icon: Highlighter,
      onSelect: special("conditionalFormats"),
    },
    {
      id: "select-constants",
      label: t.selectConstants,
      icon: Hash,
      onSelect: special("constants"),
    },
    {
      id: "select-validation",
      label: t.selectValidation,
      icon: ListChecks,
      onSelect: special("dataValidation"),
    },
  ];
  const Comp = size === "small" ? MenuButton : LargeButton;
  return (
    <Comp
      icon={Search}
      label={t.findSelect}
      description={t.findSelectDescription}
      menu={menu}
    />
  );
};
