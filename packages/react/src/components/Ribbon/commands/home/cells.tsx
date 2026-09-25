/**
 * Home › Cells: Insert and Delete (split: cells…, sheet rows, sheet
 * columns, sheet) and Format (row height, AutoFit, column width, hide &
 * unhide, rename / move / tab colour of the sheet, protection, Format
 * Cells…). Insert / Delete reuse the context menu's runner and dialogs.
 */
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Eye,
  FilePlus2,
  FileX,
  Grid2x2Plus,
  Grid2x2X,
  MoveVertical,
  MoveHorizontal,
  Palette,
  Pencil,
  Rows3,
  Columns3,
  Settings2,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import {
  addSheet,
  applyFormatCells,
  autofitColumns,
  autofitRows,
  Context,
  deleteSheet,
  getSheetIndex,
  hideSelected,
  hideSheets,
  isSheetProtected,
  moveSheet,
  openFormatCells,
  renameSheet,
  setSheetTabColor,
  sheetNameErrorMessage,
  showSelected,
  validateSheetName,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { ModalContext } from "../../../../context/modal";
import {
  Button,
  DialogShell,
  Input,
  LargeButton,
  MenuButton,
  MenuItem,
  SplitButton,
} from "../../../ui";
import {
  InsertDeleteDialog,
  SizeDialog,
  useInsertDeleteRunner,
} from "../../../ContextMenu/dialogs";
import { MoveOrCopyDialog, UnhideDialog } from "../../../SheetTab/SheetDialogs";
import { activateSheetTab } from "../../../SheetTab/activate";
import { ProtectSheetDialog, useUnprotect } from "../../../Protection";
import type { RibbonCommandProps } from "../../registry";
import { shortcutText } from "../helpers";
import { ColorPanel } from "./ColorPanel";
import { Home, useHome } from "./shared";

type Range = { row: number[]; column: number[] };

function lastRange(ctx: Context) {
  const sel = ctx.luckysheet_select_save;
  return sel?.[sel.length - 1];
}

/** What a selection spans: whole rows, whole columns or cells. */
function selectionKind(ctx: Context): "row" | "column" | "cells" {
  const last = lastRange(ctx);
  if (last?.row_select && !last.column_select) return "row";
  if (last?.column_select && !last.row_select) return "column";
  return "cells";
}

function rangeOf(ctx: Context): Range | null {
  const last = lastRange(ctx);
  return last ? { row: last.row, column: last.column } : null;
}

const indexes = (range: Range, type: "row" | "column") => {
  const [a, b] = type === "row" ? range.row : range.column;
  return _.range(Math.min(a, b), Math.max(a, b) + 1);
};

/** Insert Sheet: a new sheet before the active one, made active (Excel). */
function insertSheet(home: Home) {
  const { settings, refs } = home.h;
  home.run(
    (ctx) => {
      const before = ctx.currentSheetId;
      const count = ctx.luckysheetfile.length;
      addSheet(ctx, settings);
      if (ctx.luckysheetfile.length === count) return;
      const added = ctx.luckysheetfile[ctx.luckysheetfile.length - 1];
      if (!added?.id) return;
      moveSheet(ctx, added.id, before);
      activateSheetTab(ctx, added.id, refs.globalCache);
    },
    { addSheetOp: true }
  );
}

function deleteActiveSheet(home: Home) {
  const visible = home.context.luckysheetfile.filter((s) => s.hide !== 1);
  if (visible.length <= 1) return;
  const id = home.context.currentSheetId;
  home.run(
    (ctx) => {
      deleteSheet(ctx, id);
    },
    { deleteSheetOp: { id } }
  );
}

function useInsertDelete(mode: "insert" | "delete") {
  const home = useHome();
  const { showModal } = useContext(ModalContext);
  const runner = useInsertDeleteRunner();
  const run = (
    choice:
      | "entireRow"
      | "entireColumn"
      | "shiftDown"
      | "shiftRight"
      | "shiftUp"
      | "shiftLeft"
  ) => {
    const range = rangeOf(home.context);
    if (!range) return;
    home.h.focusSheet();
    runner(mode, choice, range);
  };
  const dialog = () => {
    const range = rangeOf(home.context);
    if (!range) return;
    showModal(<InsertDeleteDialog mode={mode} range={range} />);
  };
  /** The main button: rows / columns when they are selected, else cells. */
  const main = () => {
    const kind = selectionKind(home.context);
    if (kind === "row") run("entireRow");
    else if (kind === "column") run("entireColumn");
    else run(mode === "insert" ? "shiftDown" : "shiftUp");
  };
  return { home, run, dialog, main };
}

export const InsertCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { home, run, dialog, main } = useInsertDelete("insert");
  const { t } = home;
  const multi = (home.context.luckysheet_select_save?.length ?? 0) > 1;
  const menu: MenuItem[] = [
    {
      id: "insert-cells",
      label: t.insertCells,
      icon: Grid2x2Plus,
      shortcut: shortcutText("Ctrl+Shift+="),
      disabled: multi,
      onSelect: dialog,
    },
    {
      id: "insert-rows",
      label: t.insertRows,
      icon: BetweenHorizontalStart,
      disabled: multi,
      onSelect: () => run("entireRow"),
    },
    {
      id: "insert-columns",
      label: t.insertColumns,
      icon: BetweenVerticalStart,
      disabled: multi,
      onSelect: () => run("entireColumn"),
    },
    { type: "separator" },
    {
      id: "insert-sheet",
      label: t.insertSheet,
      icon: FilePlus2,
      shortcut: shortcutText("Shift+F11"),
      onSelect: () => insertSheet(home),
    },
  ];
  const Comp = size === "small" ? SplitButton : LargeButton;
  return (
    <Comp
      icon={Grid2x2Plus}
      label={t.insert}
      description={t.insertDescription}
      disabled={!home.editable}
      onClick={main}
      menu={menu}
    />
  );
};

export const DeleteCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { home, run, dialog, main } = useInsertDelete("delete");
  const { t } = home;
  const multi = (home.context.luckysheet_select_save?.length ?? 0) > 1;
  const visible = home.context.luckysheetfile.filter((s) => s.hide !== 1);
  const menu: MenuItem[] = [
    {
      id: "delete-cells",
      label: t.deleteCells,
      icon: Grid2x2X,
      shortcut: shortcutText("Ctrl+-"),
      disabled: multi,
      onSelect: dialog,
    },
    {
      id: "delete-rows",
      label: t.deleteRows,
      icon: Rows3,
      disabled: multi,
      onSelect: () => run("entireRow"),
    },
    {
      id: "delete-columns",
      label: t.deleteColumns,
      icon: Columns3,
      disabled: multi,
      onSelect: () => run("entireColumn"),
    },
    { type: "separator" },
    {
      id: "delete-sheet",
      label: t.deleteSheet,
      icon: FileX,
      disabled: visible.length <= 1,
      onSelect: () => deleteActiveSheet(home),
    },
  ];
  const Comp = size === "small" ? SplitButton : LargeButton;
  return (
    <Comp
      icon={Grid2x2X}
      label={t.delete}
      description={t.deleteDescription}
      disabled={!home.editable}
      onClick={main}
      menu={menu}
    />
  );
};

/** Rename Sheet when the sheet tab cannot be edited in place. */
const RenameSheetDialog: React.FC<{ sheetId: string; name: string }> = ({
  sheetId,
  name,
}) => {
  const home = useHome();
  const { hideModal } = useContext(ModalContext);
  const { t } = home;
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const error = validateSheetName(home.context, value, sheetId);
  const close = () => {
    hideModal();
    home.h.focusSheet();
  };
  const ok = () => {
    if (error) return;
    close();
    home.run((ctx) => {
      renameSheet(ctx, sheetId, value);
    });
  };
  return (
    <DialogShell
      title={t.renameSheetTitle}
      width={340}
      onClose={close}
      onConfirm={ok}
      footer={
        <>
          <Button onClick={close}>{t.cancel}</Button>
          <Button variant="primary" disabled={!!error} onClick={ok}>
            {t.ok}
          </Button>
        </>
      }
    >
      <Input
        ref={ref}
        aria-label={t.sheetName}
        value={value}
        invalid={!!error}
        maxLength={31}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && value !== name && (
        <div className="ts-home-error" role="alert">
          {sheetNameErrorMessage(home.context, error)}
        </div>
      )}
    </DialogShell>
  );
};

export const FormatCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const home = useHome();
  const { t, h, context } = home;
  const { showModal } = useContext(ModalContext);
  const unprotect = useUnprotect();
  const sheetIndex = getSheetIndex(context, context.currentSheetId);
  const sheet = sheetIndex == null ? null : context.luckysheetfile[sheetIndex];
  const protectedSheet = isSheetProtected(context);
  const visible = context.luckysheetfile.filter((s) => s.hide !== 1);
  const hiddenSheets = context.luckysheetfile.length - visible.length;
  const range = rangeOf(context);
  const locked = `${home.cell?.lo ?? 1}` !== "0";

  const size_ = (type: "row" | "column") => () => {
    if (!range) return;
    const targets = indexes(range, type);
    const cfg = sheet?.config || {};
    const sizes = _.uniq(
      targets.map((i) =>
        type === "row"
          ? (cfg.rowlen?.[i] ?? context.defaultrowlen)
          : (cfg.columnlen?.[i] ?? context.defaultcollen)
      )
    );
    showModal(
      <SizeDialog
        type={type}
        targets={targets}
        initial={sizes.length === 1 ? Math.round(sizes[0]) : ""}
      />
    );
  };
  const autofit = (type: "row" | "column") => () => {
    if (!range) return;
    const targets = indexes(range, type);
    home.run((ctx) =>
      (type === "row" ? autofitRows : autofitColumns)(ctx, targets)
    );
  };
  const hide = (type: "row" | "column", on: boolean) => () =>
    home.run((ctx) => {
      if (on) hideSelected(ctx, type);
      else showSelected(ctx, type);
    });
  const rename = () => {
    if (!sheet?.id) return;
    const tab = h.refs.workbookContainer.current?.querySelector<HTMLElement>(
      `[data-sheet-id="${sheet.id}"]`
    );
    if (tab) {
      // the tab's own in-place editor, like Excel
      tab.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
      return;
    }
    showModal(<RenameSheetDialog sheetId={sheet.id} name={sheet.name} />);
  };

  const menu: MenuItem[] = [
    { type: "header", label: t.cellSize },
    {
      id: "format-row-height",
      label: t.rowHeight,
      icon: MoveVertical,
      disabled: !range,
      onSelect: size_("row"),
    },
    {
      id: "format-autofit-rows",
      label: t.autofitRowHeight,
      disabled: !range,
      onSelect: autofit("row"),
    },
    {
      id: "format-column-width",
      label: t.columnWidth,
      icon: MoveHorizontal,
      disabled: !range,
      onSelect: size_("column"),
    },
    {
      id: "format-autofit-columns",
      label: t.autofitColumnWidth,
      disabled: !range,
      onSelect: autofit("column"),
    },
    { type: "header", label: t.visibility },
    {
      id: "format-hide-unhide",
      label: t.hideUnhide,
      icon: Eye,
      children: [
        { id: "hide-rows", label: t.hideRows, onSelect: hide("row", true) },
        {
          id: "hide-columns",
          label: t.hideColumns,
          onSelect: hide("column", true),
        },
        {
          id: "hide-sheet",
          label: t.hideSheet,
          disabled: visible.length <= 1,
          onSelect: () =>
            home.run((ctx) => {
              hideSheets(ctx, [ctx.currentSheetId]);
            }),
        },
        { type: "separator" },
        {
          id: "unhide-rows",
          label: t.unhideRows,
          onSelect: hide("row", false),
        },
        {
          id: "unhide-columns",
          label: t.unhideColumns,
          onSelect: hide("column", false),
        },
        {
          id: "unhide-sheet",
          label: t.unhideSheet,
          disabled: hiddenSheets === 0,
          onSelect: () => h.showDialog(<UnhideDialog />),
        },
      ],
    },
    { type: "header", label: t.organizeSheets },
    {
      id: "format-rename-sheet",
      label: t.renameSheet,
      icon: Pencil,
      onSelect: rename,
    },
    {
      id: "format-move-sheet",
      label: t.moveCopySheet,
      icon: ArrowRightLeft,
      disabled: !sheet,
      onSelect: () => sheet && h.showDialog(<MoveOrCopyDialog sheet={sheet} />),
    },
    {
      id: "format-tab-color",
      label: t.tabColor,
      icon: Palette,
      children: [
        {
          type: "custom",
          id: "tab-color-panel",
          render: (close) => (
            <ColorPanel
              t={t}
              value={sheet?.color}
              reset={{ label: t.noColor, kind: "none" }}
              onPick={(color) =>
                home.run((ctx) =>
                  setSheetTabColor(
                    ctx,
                    [ctx.currentSheetId],
                    color ?? undefined
                  )
                )
              }
              close={close}
            />
          ),
        },
      ],
    },
    { type: "header", label: t.protection },
    {
      id: "format-protect-sheet",
      label: protectedSheet ? t.unprotectSheet : t.protectSheet,
      icon: ShieldCheck,
      onSelect: () => {
        if (protectedSheet) unprotect("sheet");
        else h.showDialog(<ProtectSheetDialog />);
      },
    },
    {
      id: "format-lock-cell",
      label: t.lockCell,
      checked: locked,
      onSelect: () =>
        home.run((ctx) => applyFormatCells(ctx, { locked: !locked })),
    },
    {
      id: "format-cells",
      label: t.formatCells,
      icon: Settings2,
      shortcut: shortcutText(t.formatCellsShortcut),
      onSelect: () =>
        home.run((ctx) => openFormatCells(ctx, "number"), { noHistory: true }),
    },
  ];
  const Comp = size === "small" ? MenuButton : LargeButton;
  return (
    <Comp
      icon={Settings2}
      label={t.format}
      description={t.formatDescription}
      disabled={!home.editable}
      menu={menu}
    />
  );
};
