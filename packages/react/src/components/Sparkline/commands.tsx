import React from "react";
import _ from "lodash";
import {
  clearSparklineGroups,
  clearSparklines,
  computeSparklineAt,
  getSheetIndex,
  groupSparklines,
  parseSparklineRange,
  sparklineAt,
  sparklineGroupIdsInRanges,
  sparklineLocale,
  sparklineRangeText,
  sparklinesInRanges,
  ungroupSparklines,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  SparklineGroup,
  SparklineType,
} from "@lofcz/tinysheet-core";
import type { SetContextOptions } from "../../context";
import SparklineDataDialog from "./SparklineDataDialog";
import SparklineSettingsDialog from "./SparklineSettingsDialog";
import { selectionRangeText } from "./rangePicker";
import { SPARKLINE_TYPES } from "./icons";

export type SparklineCommand = {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  run: () => void;
};

type Helpers = {
  context: Context;
  setContext: (
    recipe: (ctx: Context) => void,
    options?: SetContextOptions
  ) => void;
  showDialog: (content: React.ReactNode) => void;
};

function selectionOf(context: Context) {
  return (context.luckysheet_select_save ?? []).map((s) => ({
    row: s.row,
    column: s.column,
  }));
}

function activeCell(context: Context) {
  const last = _.last(context.luckysheet_select_save);
  if (!last) return null;
  return {
    r: last.row_focus ?? last.row[0],
    c: last.column_focus ?? last.column[0],
  };
}

/** Bounding range text of the group's data (Excel's "Edit Group Data"). */
export function groupDataText(
  context: Context,
  group: SparklineGroup,
  sheetId: string
) {
  let sheet: string | null = null;
  let r1 = Infinity;
  let c1 = Infinity;
  let r2 = -Infinity;
  let c2 = -Infinity;
  let sameSheet = true;
  group.sparklines.forEach((s) => {
    const range = parseSparklineRange(context, s.f, sheetId);
    if (!range) return;
    if (sheet == null) sheet = range.sheetId;
    else if (sheet !== range.sheetId) sameSheet = false;
    r1 = Math.min(r1, range.row[0]);
    c1 = Math.min(c1, range.column[0]);
    r2 = Math.max(r2, range.row[1]);
    c2 = Math.max(c2, range.column[1]);
  });
  if (sheet == null || !sameSheet) return group.sparklines[0]?.f ?? "";
  const idx = getSheetIndex(context, sheet);
  const name =
    sheet !== sheetId && idx != null ? context.luckysheetfile[idx].name : null;
  return sparklineRangeText(name, r1, c1, r2, c2);
}

/** Bounding range text of the group's location cells. */
export function groupLocationText(group: SparklineGroup) {
  const rs = group.sparklines.map((s) => s.r);
  const cs = group.sparklines.map((s) => s.c);
  return sparklineRangeText(
    null,
    Math.min(...rs),
    Math.min(...cs),
    Math.max(...rs),
    Math.max(...cs)
  );
}

/** Open the Insert Sparklines dialog for `type`, prefilled from the selection. */
export function openInsertDialog(helpers: Helpers, type: SparklineType) {
  const { context } = helpers;
  const sheetId = context.currentSheetId;
  const text = selectionRangeText(context, sheetId);
  const last = _.last(context.luckysheet_select_save);
  const single =
    last && last.row[0] === last.row[1] && last.column[0] === last.column[1];
  helpers.showDialog(
    <SparklineDataDialog
      mode="insert"
      sheetId={sheetId}
      type={type}
      data={single ? "" : text}
      location={single ? text : ""}
    />
  );
}

/** Insert commands (Line / Column / Win/Loss). */
export function insertCommands(helpers: Helpers): SparklineCommand[] {
  const t = sparklineLocale(helpers.context);
  const disabled = helpers.context.allowEdit === false;
  return SPARKLINE_TYPES.map(({ type, label }) => ({
    key: `sparkline-insert-${type}`,
    label: t[label],
    disabled,
    run: () => openInsertDialog(helpers, type),
  }));
}

/**
 * Commands for the sparklines in the selection; empty when there are none.
 */
export function editCommands(helpers: Helpers): SparklineCommand[] {
  const { context, setContext, showDialog } = helpers;
  const sheetId = context.currentSheetId;
  const ranges = selectionOf(context);
  const hits = sparklinesInRanges(context, sheetId, ranges);
  if (hits.length === 0) return [];
  const t = sparklineLocale(context);
  const cell = activeCell(context);
  const active =
    (cell && sparklineAt(context, sheetId, cell.r, cell.c)) || hits[0];
  const groupIds = sparklineGroupIdsInRanges(context, sheetId, ranges);
  // the active cell's group first: it gives the options shown
  const ordered = [
    active.group.id,
    ...groupIds.filter((id) => id !== active.group.id),
  ];
  const readOnly = context.allowEdit === false;
  const grouped = hits.some((h) => h.group.sparklines.length > 1);
  const run = (fn: (ctx: Context) => void) => () =>
    setContext((ctx) => {
      fn(ctx);
    });
  return [
    {
      key: "sparkline-settings",
      label: t.settings,
      icon: "sparkline",
      disabled: readOnly,
      run: () => {
        const computed = computeSparklineAt(
          context,
          sheetId,
          active.sparkline.r,
          active.sparkline.c
        )?.computed;
        const values = computed?.points.length
          ? computed.points.map((p) => p.v)
          : undefined;
        showDialog(
          <SparklineSettingsDialog
            sheetId={sheetId}
            groupIds={ordered}
            values={values}
          />
        );
      },
    },
    {
      key: "sparkline-edit-group",
      label: t.editGroupData,
      disabled: readOnly,
      run: () =>
        showDialog(
          <SparklineDataDialog
            mode="group"
            sheetId={sheetId}
            groupId={active.group.id}
            data={groupDataText(context, active.group, sheetId)}
            location={groupLocationText(active.group)}
          />
        ),
    },
    {
      key: "sparkline-edit-single",
      label: t.editSingleData,
      disabled: readOnly,
      run: () =>
        showDialog(
          <SparklineDataDialog
            mode="single"
            sheetId={sheetId}
            cell={{ r: active.sparkline.r, c: active.sparkline.c }}
            data={active.sparkline.f}
          />
        ),
    },
    {
      key: "sparkline-group",
      label: t.group,
      disabled: readOnly || hits.length < 2,
      run: run((ctx) => {
        groupSparklines(ctx, sheetId, ranges, cell ?? undefined);
      }),
    },
    {
      key: "sparkline-ungroup",
      label: t.ungroup,
      disabled: readOnly || !grouped,
      run: run((ctx) => {
        ungroupSparklines(ctx, sheetId, ranges);
      }),
    },
    {
      key: "sparkline-clear",
      label: t.clearSelected,
      icon: "clear",
      disabled: readOnly,
      run: run((ctx) => {
        clearSparklines(ctx, sheetId, ranges);
      }),
    },
    {
      key: "sparkline-clear-groups",
      label: t.clearGroups,
      disabled: readOnly,
      run: run((ctx) => {
        clearSparklineGroups(ctx, sheetId, ranges);
      }),
    },
  ];
}
