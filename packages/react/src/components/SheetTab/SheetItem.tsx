import {
  Sheet,
  locale,
  getGroupedSheetIds,
  renameSheet,
  selectSheetRange,
  sheetNameErrorMessage,
  toggleSheetInGroup,
  checkWorkbookStructure,
  isWorkbookStructureProtected,
  isEditingFormula,
  switchSheetWhileEditing,
  validateSheetName,
} from "@lofcz/tinysheet-core";
import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { ChevronDown } from "lucide-react";
import { Icon } from "../ui/icons";
import { activateOnKey } from "../Toolbar/Button";
import { activateSheetTab } from "./activate";

type Props = {
  sheet: Sheet;
  /** the tab is being dragged to another position */
  dragging?: boolean;
};

const SheetItem: React.FC<Props> = ({ sheet, dragging }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  // remounts the name after editing: the browser edited its text node
  const [nameKey, setNameKey] = useState(0);
  const editable = useRef<HTMLSpanElement>(null);
  const { showAlert } = useAlert();
  const { info } = locale(context);
  const isGrouped = getGroupedSheetIds(context).includes(sheet.id!);
  const isActive = context.currentSheetId === sheet.id;
  /** The editor with the formula being edited (cell editor or formula bar). */
  const formulaEditor = useCallback(
    () =>
      document.activeElement === refs.fxInput.current
        ? refs.fxInput.current
        : refs.cellInput.current,
    [refs.cellInput, refs.fxInput]
  );

  useEffect(() => {
    const el = editable.current;
    if (!el || !editing) return;
    // select the whole name when renaming starts
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  const startRename = useCallback(() => {
    if (context.allowEdit === false) return;
    if (isWorkbookStructureProtected(context)) {
      setContext((ctx) => {
        checkWorkbookStructure(ctx);
      });
      return;
    }
    setEditing(true);
  }, [context, setContext]);

  /**
   * Ends renaming: commits the typed name, or with `cancel` drops it. From
   * the keyboard (Enter, Esc) the grid gets the focus back.
   */
  const finishRename = useCallback(
    (cancel: boolean, fromKeyboard = false) => {
      if (!editingRef.current) return;
      editingRef.current = false;
      const text = (editable.current?.innerText ?? "").replace(/[\r\n]+/g, "");
      setEditing(false);
      // (right away: a delayed focus could end the next rename)
      if (fromKeyboard) refs.cellInput.current?.focus({ preventScroll: true });
      setNameKey((k) => k + 1);
      window.getSelection()?.removeAllRanges();
      if (cancel || text === sheet.name) return;
      const error = validateSheetName(context, text, sheet.id);
      if (error) {
        showAlert(sheetNameErrorMessage(context, error));
        return;
      }
      setContext((draftCtx) => {
        renameSheet(draftCtx, sheet.id!, text);
      });
    },
    [context, refs.cellInput, setContext, sheet.id, sheet.name, showAlert]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        finishRename(false, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishRename(true, true);
      }
    },
    [finishRename]
  );

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      const rect = refs.workbookContainer.current!.getBoundingClientRect();
      const { clientX, clientY } = e;
      setContext((ctx) => {
        // the sheet is shown first (a right-click inside a group keeps it)
        if (!getGroupedSheetIds(ctx).includes(sheet.id!)) {
          activateSheetTab(
            ctx,
            sheet.id!,
            refs.globalCache,
            refs.cellInput.current
          );
        }
        ctx.showSheetList = undefined;
        ctx.sheetTabContextMenu = {
          x: clientX - rect.left,
          y: clientY - rect.top,
          sheet,
          onRename: () => setEditing(true),
        };
      });
    },
    [
      refs.cellInput,
      refs.globalCache,
      refs.workbookContainer,
      setContext,
      sheet,
    ]
  );

  return (
    <div
      role="tab"
      aria-selected={isActive || isGrouped}
      data-sheet-id={sheet.id}
      onKeyDown={(e) => {
        if (editing) return;
        activateOnKey(e);
      }}
      className={`luckysheet-sheets-item${
        isActive ? " luckysheet-sheets-item-active" : ""
      }${isGrouped ? " luckysheet-sheets-item-grouped" : ""}${
        dragging ? " luckysheet-sheets-item-dragging" : ""
      }${sheet.color ? " luckysheet-sheets-item-colored" : ""}${
        editing ? " luckysheet-sheets-item-editing" : ""
      }`}
      onMouseDown={(e) => {
        // Point mode across sheets: the formula keeps the focus
        if (isEditingFormula(context, formulaEditor())) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (editing) return;
        // editing a formula: show the sheet to pick references on it
        const editor = formulaEditor();
        if (isEditingFormula(context, editor)) {
          setContext((draftCtx) => {
            switchSheetWhileEditing(draftCtx, sheet.id!, editor);
          });
          return;
        }
        // Ctrl/Cmd+click and Shift+click group sheets (Excel)
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          setContext((draftCtx) => {
            if (e.shiftKey) selectSheetRange(draftCtx, sheet.id!);
            else toggleSheetInGroup(draftCtx, sheet.id!);
          });
          return;
        }
        setContext((draftCtx) => {
          activateSheetTab(
            draftCtx,
            sheet.id!,
            refs.globalCache,
            refs.cellInput.current
          );
        });
        // clicked with the mouse: keys go to the grid again (Excel), so
        // Ctrl+PageDown or typing work right away
        if (e.detail > 0)
          refs.cellInput.current?.focus({ preventScroll: true });
      }}
      onDoubleClick={(e) => {
        if (
          editing ||
          (e.target as HTMLElement).closest(".luckysheet-sheets-item-function")
        ) {
          return;
        }
        e.preventDefault();
        startRename();
      }}
      tabIndex={0}
      onContextMenu={(e) => {
        if (editing) return;
        openMenu(e);
      }}
      style={
        {
          display: sheet.hide === 1 ? "none" : "",
          // the tab colour: a stripe under the name and a light tint
          "--ts-tab-color": sheet.color || undefined,
        } as React.CSSProperties
      }
    >
      <span
        key={nameKey}
        className="luckysheet-sheets-item-name"
        spellCheck="false"
        suppressContentEditableWarning
        contentEditable={editing ? "plaintext-only" : false}
        onBlur={() => finishRename(false)}
        onKeyDown={editing ? onKeyDown : undefined}
        onPaste={(e) => {
          if (!editing) return;
          // one line of plain text
          e.preventDefault();
          const text = e.clipboardData
            .getData("text/plain")
            .replace(/[\r\n]+/g, " ");
          document.execCommand("insertText", false, text);
        }}
        ref={editable}
      >
        {sheet.name}
      </span>
      <span
        className="luckysheet-sheets-item-function"
        onClick={(e) => {
          e.stopPropagation();
          if (context.allowEdit === false) return;
          openMenu(e);
        }}
        onKeyDown={activateOnKey}
        tabIndex={0}
        role="button"
        aria-label={info.sheetOptions}
        aria-haspopup="menu"
      >
        <Icon icon={ChevronDown} size={12} strokeWidth={2} />
      </span>
      {!!sheet.color && (
        <div
          className="luckysheet-sheets-item-color"
          style={{ background: sheet.color }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default SheetItem;
