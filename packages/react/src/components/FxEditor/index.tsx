import {
  locale,
  getFlowdata,
  cancelNormalSelected,
  getCellValue,
  getInlineStringNoStyle,
  isInlineStringCell,
  escapeScriptTag,
  moveHighlightCell,
  handleFormulaInput,
  valueShowEs,
  isShowHidenCR,
  escapeHTMLTag,
  isAllowEdit,
  getSpilledCellFormula,
  getFunctionListMap,
  setEditMode,
  isCellContentHidden,
  FORMULA_BAR_COLLAPSED_HEIGHT,
  returnToEditSheet,
  clearEditMode,
  finishFormulaEdit,
  updateCell,
  setCaretOffset,
  getCaretOffset,
} from "@lofcz/tinysheet-core";
import React, {
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import "./index.css";
import _ from "lodash";
import WorkbookContext from "../../context";
import { Check, ChevronDown, X } from "lucide-react";
import { ModalContext } from "../../context/modal";
import { Icon, Tooltip } from "../ui";
import ContentEditable from "../SheetOverlay/ContentEditable";
import FormulaSearch from "../SheetOverlay/FormulaSearch";
import FormulaHint from "../SheetOverlay/FormulaHint";
import NameBox from "./NameBox";
import { SeriesFormulaBar, useSelectedSeries } from "../Chart/SeriesFormulaBar";
import usePrevious from "../../hooks/usePrevious";
import { FxPictureChip } from "../CellImages";
import {
  insertEditorLineBreak,
  useFormulaEditorKeys,
} from "../SheetOverlay/FormulaSearch/useFormulaEditorKeys";
import { useFormulaBarSize } from "./useFormulaBarSize";
import { getInsertFunction } from "./insertFunction";

/**
 * The functions the fx button lists when no Insert Function dialog is
 * registered: Excel's "Most Recently Used" category of a new workbook.
 */
const COMMON_FUNCTIONS = [
  "SUM",
  "AVERAGE",
  "IF",
  "COUNT",
  "MAX",
  "MIN",
  "SUMIF",
  "COUNTIF",
  "XLOOKUP",
  "VLOOKUP",
  "HYPERLINK",
  "PMT",
];

const FxEditor: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [focused, setFocused] = useState(false);
  const lastKeyDownEventRef = useRef<KeyboardEvent>(undefined);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isHidenRC, setIsHidenRC] = useState<boolean>(false);
  // a spilled cell shows its anchor's formula, greyed out (like Excel)
  const [spilledFormula, setSpilledFormula] = useState<string | null>(null);
  const firstSelection = context.luckysheet_select_save?.[0];
  const prevFirstSelection = usePrevious(firstSelection);
  const prevSheetId = usePrevious(context.currentSheetId);
  const prevEditOrigin = usePrevious(context.formulaEditOrigin);
  const recentText = useRef("");
  const { info, formulaMore } = locale(context);
  const bar = useFormulaBarSize();
  const formulaKeys = useFormulaEditorKeys(
    useCallback(() => refs.fxInput.current, [refs.fxInput]),
    useCallback(() => refs.cellInput.current, [refs.cellInput])
  );

  useEffect(() => {
    // 当选中行列是处于隐藏状态的话则不允许编辑
    setIsHidenRC(isShowHidenCR(context));
    if (
      context.luckysheetCellUpdate.length > 0 &&
      ((_.isEqual(prevFirstSelection, firstSelection) &&
        context.currentSheetId === prevSheetId) ||
        // Point mode across sheets shows another sheet: the edit goes on
        context.formulaEditOrigin ||
        prevEditOrigin)
    ) {
      // a data change (collaboration, undo) must not overwrite the text
      // being edited; outside editing the bar follows the cell
      return;
    }
    const d = getFlowdata(context);
    let value = "";
    if (firstSelection) {
      const r = firstSelection.row_focus;
      const c = firstSelection.column_focus;
      if (_.isNil(r) || _.isNil(c)) return;

      const cell = d?.[r]?.[c];
      const spilled = getSpilledCellFormula(context, r, c);
      setSpilledFormula(spilled);
      if (spilled) {
        value = spilled;
      } else if (cell && isCellContentHidden(context, r, c)) {
        // Format Cells > Protection > Hidden on a protected sheet
        value = "";
      } else if (cell) {
        if (isInlineStringCell(cell)) {
          value = getInlineStringNoStyle(r, c, d);
        } else if (cell.f) {
          value = getCellValue(r, c, d, "f");
        } else {
          value = valueShowEs(r, c, d);
        }
      }
      refs.fxInput.current!.innerHTML = escapeHTMLTag(escapeScriptTag(value));
    } else {
      refs.fxInput.current!.innerHTML = "";
      setSpilledFormula(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.luckysheetfile,
    context.currentSheetId,
    context.luckysheet_select_save,
    // a cancelled edit (Esc, ✕) shows the cell's content again
    context.luckysheetCellUpdate.length > 0,
  ]);

  const onFocus = useCallback(() => {
    if (context.allowEdit === false) {
      return;
    }
    // the anchor's formula is not this cell's: start from an empty cell
    if (spilledFormula) refs.fxInput.current!.innerHTML = "";
    if (
      (context.luckysheet_select_save?.length ?? 0) > 0 &&
      !context.luckysheet_cell_selected_move &&
      isAllowEdit(context, context.luckysheet_select_save)
    ) {
      setFocused(true);
      setContext((draftCtx) => {
        const last =
          draftCtx.luckysheet_select_save![
            draftCtx.luckysheet_select_save!.length - 1
          ];

        const row_index = last.row_focus;
        const col_index = last.column_focus;

        draftCtx.luckysheetCellUpdate = [row_index, col_index];
        // the formula bar edits in Edit mode (arrows move the caret)
        setEditMode(draftCtx, "edit");
        refs.globalCache.doNotFocus = true;
        // formula.rangeResizeTo = $("#luckysheet-functionbox-cell");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.config,
    context.luckysheet_select_save,
    context.luckysheetfile,
    context.currentSheetId,
    refs.globalCache,
    setContext,
    spilledFormula,
  ]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (context.allowEdit === false) {
        return;
      }
      lastKeyDownEventRef.current = new KeyboardEvent(e.type, e.nativeEvent);
      const { key } = e;
      recentText.current = refs.fxInput.current!.innerText;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        e.stopPropagation();
      }
      if (formulaKeys.onKeyDown(e)) return;
      if (context.luckysheetCellUpdate.length === 0) return;
      if (key === "Enter") {
        if (e.altKey || e.metaKey) {
          // Alt+Enter: a line break inside the cell
          insertEditorLineBreak(refs.fxInput.current);
          e.stopPropagation();
        }
        // Enter / Shift+Enter / Ctrl+Enter commit in the global key handler
        // (moving within a multi-cell selection like the cell editor)
        e.preventDefault();
      } else if (key === "Tab") {
        // committed by the global key handler; keep the focus in the sheet
        e.preventDefault();
      } else if (key === "Escape") {
        setContext((draftCtx) => {
          // Point mode across sheets: back to the edited cell's sheet
          returnToEditSheet(draftCtx, refs.fxInput.current);
          cancelNormalSelected(draftCtx);
          moveHighlightCell(draftCtx, "down", 0, "rangeOfSelect");
        });
        e.preventDefault();
        e.stopPropagation();
        // the grid takes the keys again, like Excel
        refs.cellInput.current?.focus({ preventScroll: true });
      }
    },
    [
      context.allowEdit,
      context.luckysheetCellUpdate.length,
      formulaKeys,
      refs.cellInput,
      refs.fxInput,
      setContext,
    ]
  );

  const onChange = useCallback(
    (__: string, isBlur?: boolean) => {
      // leaving the bar changes nothing: its text was handled as it was typed
      // (or written by Point mode / the cell editor)
      if (isBlur) return;
      const e = lastKeyDownEventRef.current;
      if (!e) return;
      const kcode = e.keyCode;
      if (!kcode) return;

      if (
        !(
          (kcode >= 112 && kcode <= 123) ||
          kcode <= 46 ||
          kcode === 144 ||
          kcode === 108 ||
          e.ctrlKey ||
          e.altKey ||
          (e.shiftKey &&
            (kcode === 37 || kcode === 38 || kcode === 39 || kcode === 40))
        ) ||
        kcode === 8 ||
        kcode === 32 ||
        kcode === 46 ||
        (e.ctrlKey && kcode === 86)
      ) {
        setContext((draftCtx) => {
          handleFormulaInput(
            draftCtx,
            refs.cellInput.current!,
            refs.fxInput.current!,
            kcode,
            recentText.current
          );
        });
      }
    },
    [refs.cellInput, refs.fxInput, setContext]
  );

  const allowEdit = useMemo(() => {
    if (context.allowEdit === false) {
      return false;
    }
    if (isHidenRC) {
      return false;
    }
    if (!isAllowEdit(context, context.luckysheet_select_save)) {
      return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.config,
    context.luckysheet_select_save,
    context.luckysheetfile,
    context.currentSheetId,
    isHidenRC,
  ]);

  const { showModal, hideModal } = useContext(ModalContext);
  const editing = context.luckysheetCellUpdate.length > 0;

  /** The editor holding the text being edited: the bar or the cell. */
  const activeEditor = useCallback((): HTMLDivElement | null => {
    const fx = refs.fxInput.current;
    const cell = refs.cellInput.current;
    const active = document.activeElement;
    if (fx && active && fx.contains(active)) return fx;
    if (cell && active === cell) return cell;
    return (focused ? fx : cell) ?? null;
  }, [focused, refs.cellInput, refs.fxInput]);

  const backToGrid = useCallback(() => {
    refs.cellInput.current?.focus({ preventScroll: true });
  }, [refs.cellInput]);

  /** ✕: cancels the edit, like Esc. */
  const cancelEdit = useCallback(() => {
    const editor = activeEditor();
    setContext((ctx) => {
      if (ctx.luckysheetCellUpdate.length === 0) return;
      // Point mode across sheets: back to the edited cell's sheet
      returnToEditSheet(ctx, editor);
      cancelNormalSelected(ctx);
      clearEditMode(ctx);
      moveHighlightCell(ctx, "down", 0, "rangeOfSelect");
    });
    backToGrid();
  }, [activeEditor, backToGrid, setContext]);

  /** ✓: commits the edit like Enter, but the active cell stays (Excel). */
  const commitEdit = useCallback(() => {
    const editor = activeEditor();
    if (!editor) return;
    const canvas = refs.canvas.current?.getContext("2d") ?? undefined;
    setContext((ctx) => {
      if (ctx.luckysheetCellUpdate.length < 2 || !isAllowEdit(ctx)) return;
      returnToEditSheet(ctx, editor);
      const [r, c] = ctx.luckysheetCellUpdate as [number, number];
      finishFormulaEdit(ctx, editor);
      updateCell(ctx, r, c, editor, undefined, canvas);
      clearEditMode(ctx);
    });
    backToGrid();
  }, [activeEditor, backToGrid, refs.canvas, setContext]);

  /**
   * The built-in function picker: starts a formula ("=") in `el` if it
   * holds none and opens the autocomplete with the common functions; a
   * picked one is inserted at the caret.
   */
  const openFunctionList = useCallback(
    (el: HTMLDivElement) => {
      const text = el.textContent ?? "";
      if (!text.startsWith("=")) {
        el.textContent = "=";
        setCaretOffset(el, 1);
      } else if (getCaretOffset(el) == null) {
        setCaretOffset(el, text.length);
      }
      const other =
        el === refs.fxInput.current
          ? refs.cellInput.current
          : refs.fxInput.current;
      setContext((ctx) => {
        handleFormulaInput(ctx, other, el, 0);
        const map = getFunctionListMap(ctx);
        const list = COMMON_FUNCTIONS.map((n) => map[n]).filter(Boolean);
        if (list.length === 0) return;
        ctx.functionCandidates = list.map((f: any) => ({
          n: f.n,
          d: f.d,
          a: f.a,
        }));
        ctx.functionCandidateIndex = 0;
        ctx.functionHint = null;
      });
    },
    [refs.cellInput, refs.fxInput, setContext]
  );

  /** fx (Shift+F3): the Insert Function dialog, or the function list. */
  const insertFunction = useCallback(() => {
    if (!allowEdit) return;
    const handler = getInsertFunction();
    if (
      handler &&
      handler({
        context,
        setContext,
        refs,
        showModal,
        hideModal,
        editor: editing ? activeEditor() : null,
      }) !== false
    ) {
      return;
    }
    if (editing) {
      const el = activeEditor();
      if (el) openFunctionList(el);
      return;
    }
    // start editing in the formula bar (its focus starts the edit), then
    // open the list once the edit session is set up
    const fx = refs.fxInput.current;
    if (!fx) return;
    fx.focus();
    setTimeout(() => {
      if (document.activeElement === fx) openFunctionList(fx);
    });
  }, [
    activeEditor,
    allowEdit,
    context,
    editing,
    hideModal,
    openFunctionList,
    refs,
    setContext,
    showModal,
  ]);

  // Shift+F3 anywhere in the workbook opens Insert Function, like Excel
  useEffect(() => {
    const container = refs.workbookContainer.current;
    if (!container) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F3" &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        // not from the Name Box or a dialog's fields
        const target = e.target as HTMLElement | null;
        if (
          target?.closest?.(
            "input, textarea, select, [role=dialog], .fortune-modal-container"
          )
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        insertFunction();
      }
    };
    container.addEventListener("keydown", onKeyDown, true);
    return () => container.removeEventListener("keydown", onKeyDown, true);
  }, [insertFunction, refs.workbookContainer]);

  const selectedSeries = useSelectedSeries();

  // the buttons keep the caret in the formula being edited
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const toggleLabel = bar.expanded
    ? formulaMore.collapseFormulaBar
    : formulaMore.expandFormulaBar;

  return (
    // View > Formula Bar unchecked: hidden but mounted (keys use it)
    <aside className="fortune-fx-editor-wrap" hidden={!!context.hideFormulaBar}>
      <div
        className={`fortune-fx-editor${
          bar.expanded ? " fortune-fx-editor-expanded" : ""
        }${editing ? " fortune-fx-editor-editing" : ""}`}
        style={bar.height != null ? { height: bar.height } : undefined}
      >
        <NameBox />
        <div className="fortune-fx-buttons">
          <Tooltip label={formulaMore.formulaBarCancel} shortcut="Esc">
            <button
              type="button"
              className="fortune-fx-button fortune-fx-cancel"
              aria-label={formulaMore.formulaBarCancel}
              disabled={!editing}
              onMouseDown={keepFocus}
              onClick={cancelEdit}
            >
              <Icon icon={X} size={16} />
            </button>
          </Tooltip>
          <Tooltip label={formulaMore.formulaBarEnter} shortcut="Enter">
            <button
              type="button"
              className="fortune-fx-button fortune-fx-enter"
              aria-label={formulaMore.formulaBarEnter}
              disabled={!editing || !allowEdit}
              onMouseDown={keepFocus}
              onClick={commitEdit}
            >
              <Icon icon={Check} size={16} />
            </button>
          </Tooltip>
          <Tooltip
            label={formulaMore.formulaBarInsertFunction}
            shortcut="Shift+F3"
          >
            <button
              type="button"
              className="fortune-fx-button fortune-fx-insert"
              aria-label={formulaMore.formulaBarInsertFunction}
              disabled={!allowEdit}
              onMouseDown={keepFocus}
              onClick={insertFunction}
            >
              <span className="fortune-fx-glyph" aria-hidden="true">
                fx
              </span>
            </button>
          </Tooltip>
        </div>
        <div
          ref={inputContainerRef}
          className={`fortune-fx-input-container${
            focused ? " fortune-fx-input-container-focused" : ""
          }`}
        >
          <ContentEditable
            innerRef={(e) => {
              refs.fxInput.current = e;
            }}
            className={
              spilledFormula && !focused
                ? "fortune-fx-input fortune-fx-input-spilled"
                : "fortune-fx-input"
            }
            role="textbox"
            id="luckysheet-functionbox-cell"
            aria-label={info.currentCellInput}
            aria-multiline="true"
            spellCheck={false}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onKeyUp={formulaKeys.onKeyUp}
            onMouseDown={formulaKeys.onMouseDown}
            onMouseUp={formulaKeys.onMouseUp}
            onChange={onChange}
            onBlur={() => setFocused(false)}
            tabIndex={0}
            allowEdit={allowEdit}
          />
          {/* a selected chart series shows its =SERIES() formula (Excel) */}
          {selectedSeries && (
            <SeriesFormulaBar
              key={`${selectedSeries.chartId}:${selectedSeries.index}`}
              {...selectedSeries}
            />
          )}
          {/* a placed picture shows as a chip until the bar is focused */}
          {!focused && <FxPictureChip />}
          {focused && (
            <>
              <FormulaSearch
                style={{
                  top: inputContainerRef.current!.offsetHeight + 4,
                }}
                onSelectCandidate={formulaKeys.acceptCandidate}
              />
              <FormulaHint
                style={{
                  top: inputContainerRef.current!.offsetHeight + 4,
                }}
                onSelectArgument={formulaKeys.selectArgument}
              />
            </>
          )}
          <Tooltip label={toggleLabel}>
            <button
              type="button"
              className="fortune-fx-toggle"
              aria-expanded={bar.expanded}
              aria-label={toggleLabel}
              onMouseDown={keepFocus}
              onClick={bar.toggle}
            >
              <Icon icon={ChevronDown} size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
      {/* a focusable separator is a window splitter (interactive) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="fortune-fx-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label={formulaMore.resizeFormulaBar}
        aria-valuemin={FORMULA_BAR_COLLAPSED_HEIGHT}
        aria-valuenow={bar.height ?? FORMULA_BAR_COLLAPSED_HEIGHT}
        title={formulaMore.resizeFormulaBar}
        tabIndex={0}
        onPointerDown={bar.onResizeStart}
        onKeyDown={bar.onResizeKey}
        onDoubleClick={bar.toggle}
      />
    </aside>
  );
};

export default FxEditor;
