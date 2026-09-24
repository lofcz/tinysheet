import {
  locale,
  getFlowdata,
  cancelNormalSelected,
  getCellValue,
  updateCell,
  getInlineStringNoStyle,
  isInlineStringCell,
  escapeScriptTag,
  moveHighlightCell,
  handleFormulaInput,
  valueShowEs,
  isShowHidenCR,
  escapeHTMLTag,
  isAllowEdit,
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
import SVGIcon from "../SVGIcon";
import ContentEditable from "../SheetOverlay/ContentEditable";
import FormulaSearch from "../SheetOverlay/FormulaSearch";
import FormulaHint from "../SheetOverlay/FormulaHint";
import NameBox from "./NameBox";
import usePrevious from "../../hooks/usePrevious";
import { useFormulaEditorKeys } from "../SheetOverlay/FormulaSearch/useFormulaEditorKeys";

const FxEditor: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [focused, setFocused] = useState(false);
  const lastKeyDownEventRef = useRef<KeyboardEvent>(undefined);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isHidenRC, setIsHidenRC] = useState<boolean>(false);
  const firstSelection = context.luckysheet_select_save?.[0];
  const prevFirstSelection = usePrevious(firstSelection);
  const prevSheetId = usePrevious(context.currentSheetId);
  const recentText = useRef("");
  const { info } = locale(context);
  const formulaKeys = useFormulaEditorKeys(
    useCallback(() => refs.fxInput.current, [refs.fxInput]),
    useCallback(() => refs.cellInput.current, [refs.cellInput])
  );

  useEffect(() => {
    // 当选中行列是处于隐藏状态的话则不允许编辑
    setIsHidenRC(isShowHidenCR(context));
    if (
      _.isEqual(prevFirstSelection, firstSelection) &&
      context.currentSheetId === prevSheetId
    ) {
      // data change by a collabrative update should not trigger this effect
      return;
    }
    const d = getFlowdata(context);
    let value = "";
    if (firstSelection) {
      const r = firstSelection.row_focus;
      const c = firstSelection.column_focus;
      if (_.isNil(r) || _.isNil(c)) return;

      const cell = d?.[r]?.[c];
      if (cell) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.luckysheetfile,
    context.currentSheetId,
    context.luckysheet_select_save,
  ]);

  const onFocus = useCallback(() => {
    if (context.allowEdit === false) {
      return;
    }
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
        setContext((draftCtx) => {
          const lastCellUpdate = _.clone(draftCtx.luckysheetCellUpdate);
          updateCell(
            draftCtx,
            draftCtx.luckysheetCellUpdate[0],
            draftCtx.luckysheetCellUpdate[1],
            refs.fxInput.current!
          );
          draftCtx.luckysheet_select_save = [
            {
              row: [lastCellUpdate[0], lastCellUpdate[0]],
              column: [lastCellUpdate[1], lastCellUpdate[1]],
              row_focus: lastCellUpdate[0],
              column_focus: lastCellUpdate[1],
            },
          ];
          moveHighlightCell(draftCtx, "down", 1, "rangeOfSelect");
        });
        e.preventDefault();
        e.stopPropagation();
      } else if (key === "Escape") {
        setContext((draftCtx) => {
          cancelNormalSelected(draftCtx);
          moveHighlightCell(draftCtx, "down", 0, "rangeOfSelect");
        });
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [
      context.allowEdit,
      context.luckysheetCellUpdate.length,
      formulaKeys,
      refs.fxInput,
      setContext,
    ]
  );

  const onChange = useCallback(() => {
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
  }, [refs.cellInput, refs.fxInput, setContext]);

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

  return (
    <aside>
      <div className="fortune-fx-editor">
        <NameBox />
        <div className="fortune-fx-icon">
          <SVGIcon name="fx" width={18} height={18} />
        </div>
        <div ref={inputContainerRef} className="fortune-fx-input-container">
          <ContentEditable
            innerRef={(e) => {
              refs.fxInput.current = e;
            }}
            className="fortune-fx-input"
            role="textbox"
            id="luckysheet-functionbox-cell"
            aria-label={info.currentCellInput}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onKeyUp={formulaKeys.onKeyUp}
            onMouseUp={formulaKeys.onMouseUp}
            onChange={onChange}
            onBlur={() => setFocused(false)}
            tabIndex={0}
            allowEdit={allowEdit}
          />
          {focused && (
            <>
              <FormulaSearch
                style={{
                  top: inputContainerRef.current!.clientHeight,
                }}
                onSelectCandidate={formulaKeys.acceptCandidate}
              />
              <FormulaHint
                style={{
                  top: inputContainerRef.current!.clientHeight,
                }}
              />
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default FxEditor;
