/**
 * Data tab: Sort & Filter (A→Z, Z→A, Sort…, Filter, Clear, Reapply,
 * Advanced), Data Tools (Text to Columns, Flash Fill, Remove Duplicates,
 * Data Validation), Forecast (What-If Analysis) and Outline (Group,
 * Ungroup, Subtotal, Show / Hide Detail). The logic lives in core and in
 * the CustomSort / CellTools / DataVerification / Outline features.
 */
import React from "react";
import _ from "lodash";
import {
  activeCellTable,
  autoOutline,
  clearAdvancedFilter,
  clearAllFilterConditions,
  clearOutline,
  createFilter,
  getAdvancedFilter,
  groupSelection,
  handleSort,
  hasDataTables,
  isShowingInvalidDataCircles,
  locale,
  recalcDataTables,
  reapplyFilter,
  runFlashFillCommand,
  selectionOutlineAxis,
  setInvalidDataCircles,
  showHideDetail,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import {
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
  CircleDot,
  CopyMinus,
  Eraser,
  FlaskConical,
  Funnel,
  FunnelPlus,
  FunnelX,
  Group,
  ListChecks,
  ListMinus,
  ListPlus,
  ListTree,
  ListX,
  PanelRight,
  RefreshCw,
  RotateCw,
  Settings2,
  SquareSigma,
  Table,
  TableColumnsSplit,
  Target,
  Ungroup,
  Zap,
} from "lucide-react";
import type { MenuItem } from "../../ui";
import type { RibbonCommandProps } from "../registry";
import { shortcutText, useRibbonCommandHelpers } from "./helpers";
import type { RibbonCommandHelpers } from "./helpers";
import { RibbonButton, useFdrText, useNotify } from "./kit";
import CustomSort from "../../CustomSort";
import RemoveDuplicates from "../../RemoveDuplicates";
import { SplitColumn } from "../../SplitColumn";
import DataVerification from "../../DataVerification";
import { AdvancedFilter, DataTable, GoalSeek } from "../../CellTools";
import {
  GroupDialog,
  OutlineSettingsDialog,
  SubtotalDialog,
} from "../../Outline/dialogs";
import { outlineStep } from "../../Outline/history";

const editable = (h: RibbonCommandHelpers) => h.context.allowEdit !== false;

/* ------------------------------------------------------------------ */
/*  Sort & Filter                                                      */
/* ------------------------------------------------------------------ */

export const SortAscCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      icon={ArrowDownAZ}
      label={t.sortAsc}
      description={t.sortAscTip}
      disabled={!editable(h)}
      onClick={() => {
        h.setContext((ctx) => handleSort(ctx, true));
        h.focusSheet();
      }}
    />
  );
};

export const SortDescCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      icon={ArrowDownZA}
      label={t.sortDesc}
      description={t.sortDescTip}
      disabled={!editable(h)}
      onClick={() => {
        h.setContext((ctx) => handleSort(ctx, false));
        h.focusSheet();
      }}
    />
  );
};

export const SortDialogCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={ArrowUpDown}
      label={t.sort}
      description={t.sortTip}
      disabled={!editable(h)}
      onClick={() => h.showDialog(<CustomSort />)}
    />
  );
};

/** Filter buttons are on (the sheet's AutoFilter, or the table's). */
export function isFilterOn(context: Context) {
  const inTable = activeCellTable(context);
  if (inTable) return inTable.table.filterButton !== false;
  return !_.isEmpty(context.luckysheet_filter_save);
}

function hasFilterState(context: Context) {
  return (
    !_.isEmpty(context.filter) ||
    !!getAdvancedFilter(context) ||
    !!activeCellTable(context)
  );
}

export const FilterCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Funnel}
      label={t.filter}
      shortcut={shortcutText(t.filterShortcut)}
      description={t.filterTip}
      pressed={isFilterOn(h.context)}
      disabled={!editable(h)}
      onClick={() => {
        h.setContext((ctx) => createFilter(ctx));
        h.focusSheet();
      }}
    />
  );
};

export const ClearFilterCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={FunnelX}
      label={t.clear}
      description={t.clearTip}
      disabled={!editable(h) || !hasFilterState(h.context)}
      onClick={() => {
        h.setContext((ctx) => {
          if (getAdvancedFilter(ctx)) clearAdvancedFilter(ctx);
          clearAllFilterConditions(ctx);
        });
        h.focusSheet();
      }}
    />
  );
};

export const ReapplyFilterCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={RotateCw}
      label={t.reapply}
      shortcut={shortcutText(t.reapplyShortcut)}
      description={t.reapplyTip}
      disabled={
        !editable(h) ||
        !(!_.isEmpty(h.context.filter) || activeCellTable(h.context))
      }
      onClick={() => {
        h.setContext((ctx) => reapplyFilter(ctx));
        h.focusSheet();
      }}
    />
  );
};

export const AdvancedFilterCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={FunnelPlus}
      label={t.advanced}
      description={t.advancedTip}
      pressed={!!getAdvancedFilter(h.context)}
      disabled={!editable(h)}
      onClick={() => h.showDialog(<AdvancedFilter />)}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Data Tools                                                         */
/* ------------------------------------------------------------------ */

export const TextToColumnsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  const notify = useNotify();
  const { splitText } = locale(h.context);
  const run = () => {
    const sel = h.context.luckysheet_select_save;
    if (!sel?.length) notify(splitText.tipNoSelect);
    else if (sel.length > 1) notify(splitText.tipNoMulti);
    else if (sel[0].column[0] !== sel[0].column[1])
      notify(splitText.tipNoMultiColumn);
    else h.showDialog(<SplitColumn />);
  };
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={TableColumnsSplit}
      label={t.textToColumns}
      description={t.textToColumnsTip}
      disabled={!editable(h)}
      onClick={run}
    />
  );
};

export const FlashFillCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Zap}
      label={t.flashFill}
      shortcut={shortcutText(t.flashFillShortcut)}
      description={t.flashFillTip}
      disabled={!editable(h)}
      onClick={() => {
        h.setContext((ctx) => {
          runFlashFillCommand(ctx);
        });
        h.focusSheet();
      }}
    />
  );
};

export const RemoveDuplicatesCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={CopyMinus}
      label={t.removeDuplicates}
      description={t.removeDuplicatesTip}
      disabled={!editable(h)}
      onClick={() => h.showDialog(<RemoveDuplicates />)}
    />
  );
};

export const DataValidationCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  const open = () => h.showDialog(<DataVerification />);
  const circles = isShowingInvalidDataCircles(h.context);
  const menu: MenuItem[] = [
    {
      id: "dialog",
      label: t.dataValidationMenu,
      icon: ListChecks,
      disabled: !editable(h),
      onSelect: open,
    },
    {
      id: "circle",
      label: t.circleInvalid,
      icon: CircleDot,
      onSelect: () => h.setContext((ctx) => setInvalidDataCircles(ctx, true)),
    },
    {
      id: "clear-circles",
      label: t.clearCircles,
      icon: Eraser,
      disabled: !circles,
      onSelect: () => h.setContext((ctx) => setInvalidDataCircles(ctx, false)),
    },
    { type: "separator" },
    {
      id: "rules",
      label: t.validationRules,
      icon: PanelRight,
      checked: !!h.context.dataVerificationSidebar,
      onSelect: () =>
        h.setContext((ctx) => {
          ctx.dataVerificationSidebar = !ctx.dataVerificationSidebar;
        }),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={ListChecks}
      label={t.dataValidation}
      description={t.dataValidationTip}
      disabled={!editable(h)}
      onClick={open}
      menu={menu}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Forecast                                                           */
/* ------------------------------------------------------------------ */

export const WhatIfCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  const menu: MenuItem[] = [
    {
      id: "goal-seek",
      label: t.goalSeek,
      icon: Target,
      disabled: !editable(h),
      onSelect: () => h.showDialog(<GoalSeek />),
    },
    {
      id: "data-table",
      label: t.dataTable,
      icon: Table,
      disabled: !editable(h),
      onSelect: () => h.showDialog(<DataTable />),
    },
    { type: "separator" },
    {
      id: "recalc-data-tables",
      label: t.recalcDataTables,
      icon: RefreshCw,
      disabled: !hasDataTables(h.context),
      onSelect: () =>
        h.setContext(
          (ctx) => {
            recalcDataTables(ctx);
          },
          { noHistory: true }
        ),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={FlaskConical}
      label={t.whatIf}
      description={t.whatIfTip}
      menu={menu}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Outline                                                            */
/* ------------------------------------------------------------------ */

function useOutlineGroup(h: RibbonCommandHelpers) {
  return (ungroup: boolean) => {
    if (selectionOutlineAxis(h.context)) {
      h.setContext((ctx) => {
        groupSelection(ctx, ungroup);
      }, outlineStep());
    } else h.showDialog(<GroupDialog ungroup={ungroup} />);
  };
}

export const GroupCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  const group = useOutlineGroup(h);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Group}
      label={t.group}
      shortcut={shortcutText(t.groupShortcut)}
      description={t.groupTip}
      disabled={!editable(h)}
      onClick={() => group(false)}
      menu={[
        {
          id: "group",
          label: t.groupMenu,
          icon: Group,
          onSelect: () => group(false),
        },
        {
          id: "auto-outline",
          label: t.autoOutline,
          icon: ListTree,
          onSelect: () =>
            h.setContext((ctx) => {
              autoOutline(ctx);
            }, outlineStep()),
        },
        { type: "separator" },
        {
          id: "settings",
          label: t.outlineSettings,
          icon: Settings2,
          onSelect: () => h.showDialog(<OutlineSettingsDialog />),
        },
      ]}
    />
  );
};

export const UngroupCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  const group = useOutlineGroup(h);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Ungroup}
      label={t.ungroup}
      shortcut={shortcutText(t.ungroupShortcut)}
      description={t.ungroupTip}
      disabled={!editable(h)}
      onClick={() => group(true)}
      menu={[
        {
          id: "ungroup",
          label: t.ungroupMenu,
          icon: Ungroup,
          onSelect: () => group(true),
        },
        {
          id: "clear-outline",
          label: t.clearOutline,
          icon: ListX,
          onSelect: () =>
            h.setContext((ctx) => {
              const sel = ctx.luckysheet_select_save?.[0];
              const single =
                !sel ||
                (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]);
              clearOutline(
                ctx,
                single ? undefined : { row: sel!.row, column: sel!.column }
              );
            }, outlineStep()),
        },
      ]}
    />
  );
};

export const SubtotalCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().data;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={SquareSigma}
      label={t.subtotal}
      description={t.subtotalTip}
      disabled={!editable(h)}
      onClick={() => h.showDialog(<SubtotalDialog />)}
    />
  );
};

const detailCommand = (show: boolean): React.FC<RibbonCommandProps> => {
  const Command: React.FC<RibbonCommandProps> = ({ size }) => {
    const h = useRibbonCommandHelpers();
    const t = useFdrText().data;
    return (
      <RibbonButton
        size={size}
        small="labeled"
        icon={show ? ListPlus : ListMinus}
        label={show ? t.showDetail : t.hideDetail}
        description={show ? t.showDetailTip : t.hideDetailTip}
        onClick={() =>
          h.setContext((ctx) => {
            showHideDetail(ctx, show);
          }, outlineStep())
        }
      />
    );
  };
  Command.displayName = show ? "ShowDetailCommand" : "HideDetailCommand";
  return Command;
};

export const ShowDetailCommand = detailCommand(true);
export const HideDetailCommand = detailCommand(false);
