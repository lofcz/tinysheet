import React, { useContext, useState, useMemo, useCallback } from "react";
import {
  cancelNormalSelected,
  FUNCTION_CATEGORIES,
  functionHTMLGenerate,
  getFunctionListMap,
  locale,
  rankFunctions,
  setCaretOffset,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import "./index.css";

export const FormulaSearch: React.FC<{ onCancel: () => void }> = ({
  onCancel: _onCancel,
}) => {
  const {
    context,
    setContext,
    refs: { cellInput, globalCache },
  } = useContext(WorkbookContext);
  const [selectedType, setSelectedType] = useState(0);
  const [selectedFuncIndex, setSelectedFuncIndex] = useState(0);
  const [searchText, setSearchText] = useState("");
  const { formulaMore, functionlist, button } = locale(context);

  // categories come from the catalog so that every function is reachable;
  // functions of a category the catalog does not list end up in "other"
  const typeList = useMemo(() => {
    const known = new Set<number>(FUNCTION_CATEGORIES.map((c) => c.t));
    const list: { t: number; n: string }[] = FUNCTION_CATEGORIES.map((c) => ({
      t: c.t,
      n: (formulaMore as Record<string, string>)[c.key] || c.key,
    }));
    if (functionlist.some((f) => !known.has(f.t))) {
      list.push({ t: -1, n: formulaMore.other });
    }
    return list;
  }, [formulaMore, functionlist]);

  const filteredFunctionList = useMemo(() => {
    if (searchText) {
      const text = searchText.trim().toUpperCase();
      // function names: ranked like the in-cell autocomplete
      if (/^[A-Z0-9._]+$/.test(text)) {
        return rankFunctions(functionlist, text, functionlist.length).map(
          (r) => r.item
        );
      }
      // anything else: search the descriptions
      return functionlist.filter(
        (f) =>
          (f.a || "").toUpperCase().indexOf(text) !== -1 ||
          (f.d || "").toUpperCase().indexOf(text) !== -1
      );
    }
    if (selectedType === -1) {
      const known = new Set<number>(FUNCTION_CATEGORIES.map((c) => c.t));
      return _.filter(functionlist, (v) => !known.has(v.t));
    }
    return _.filter(functionlist, (v) => v.t === selectedType);
  }, [functionlist, selectedType, searchText]);

  const onConfirm = useCallback(() => {
    const last =
      context.luckysheet_select_save?.[
        context.luckysheet_select_save.length - 1
      ];
    let row_index = last?.row_focus;
    let col_index = last?.column_focus;
    if (!last) {
      row_index = 0;
      col_index = 0;
    } else {
      if (row_index == null) {
        [row_index] = last.row;
      }
      if (col_index == null) {
        [col_index] = last.column;
      }
    }
    const formulaTxt = functionHTMLGenerate(
      `=${filteredFunctionList[selectedFuncIndex].n.toUpperCase()}(`
    );
    setContext((ctx) => {
      if (cellInput.current != null) {
        ctx.luckysheetCellUpdate = [row_index, col_index];
        globalCache.doNotUpdateCell = true;
        cellInput.current.innerHTML = formulaTxt;
        cellInput.current.focus();
        setCaretOffset(
          cellInput.current,
          cellInput.current.textContent?.length ?? 0
        );
        ctx.functionHint =
          filteredFunctionList[selectedFuncIndex].n.toUpperCase();
        ctx.functionHintArgIndex = 0;
        ctx.functionCandidates = [];
        getFunctionListMap(ctx);
        _onCancel();
      }
    });
  }, [
    cellInput,
    context.luckysheet_select_save,
    filteredFunctionList,
    globalCache,
    selectedFuncIndex,
    setContext,
    _onCancel,
  ]);

  const onCancel = useCallback(() => {
    setContext((ctx) => {
      cancelNormalSelected(ctx);
      if (cellInput.current) {
        cellInput.current.innerHTML = "";
      }
    });
    _onCancel();
  }, [_onCancel, cellInput, setContext]);

  return (
    <div id="luckysheet-search-formula">
      <div className="inpbox">
        <div>{formulaMore.findFunctionTitle}：</div>
        <input
          className="formulaInputFocus"
          id="searchFormulaListInput"
          placeholder={formulaMore.tipInputFunctionName}
          spellCheck="false"
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>
      <div className="selbox">
        <span>{formulaMore.selectCategory}：</span>
        <select
          id="formulaTypeSelect"
          onChange={(e) => {
            setSelectedType(parseInt(e.target.value, 10));
            setSelectedFuncIndex(0);
          }}
        >
          {typeList.map((v) => (
            <option key={v.t} value={v.t}>
              {v.n}
            </option>
          ))}
        </select>
      </div>
      <div className="listbox" style={{ height: 200 }}>
        <div>{formulaMore.selectFunctionTitle}：</div>
        <div className="formulaList">
          {filteredFunctionList.map((v, index) => (
            <div
              className={`listBox${index === selectedFuncIndex ? " on" : ""}`}
              key={v.n}
              onClick={() => setSelectedFuncIndex(index)}
              tabIndex={0}
            >
              <div>{v.n}</div>
              <div>{v.a}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="fortune-dialog-box-button-container">
        <div
          className="fortune-message-box-button button-primary"
          onClick={onConfirm}
          tabIndex={0}
        >
          {button.confirm}
        </div>
        <div
          className="fortune-message-box-button button-default"
          onClick={onCancel}
          tabIndex={0}
        >
          {button.cancel}
        </div>
      </div>
    </div>
  );
};
