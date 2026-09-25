import React, { useContext, useState, useMemo, useCallback } from "react";
import {
  cancelNormalSelected,
  FUNCTION_CATEGORIES,
  functionHTMLGenerate,
  getFunctionListMap,
  dialogsLocale,
  locale,
  rankFunctions,
  setCaretOffset,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import { Search } from "lucide-react";
import { Button, DialogShell, ICON_STROKE, Input } from "../ui";
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

  const current = filteredFunctionList[selectedFuncIndex];
  const signature = current
    ? `${current.n}(${current.p
        .map((p) => (p.require === "o" ? `[${p.name}]` : p.name))
        .join(", ")})`
    : "";

  return (
    <DialogShell
      title={dialogsLocale(context).titles.insertFunction}
      className="fortune-insert-function"
      id="luckysheet-search-formula"
      onClose={onCancel}
      onConfirm={() => current && onConfirm()}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {button.cancel}
          </Button>
          <Button variant="primary" disabled={!current} onClick={onConfirm}>
            {button.confirm}
          </Button>
        </>
      }
    >
      <div className="inpbox">
        <label htmlFor="searchFormulaListInput">
          {formulaMore.findFunctionTitle}
        </label>
        <Input
          className="formulaInputFocus"
          id="searchFormulaListInput"
          prefix={<Search size={14} strokeWidth={ICON_STROKE} aria-hidden />}
          placeholder={formulaMore.tipInputFunctionName}
          spellCheck="false"
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => {
            setSearchText(e.target.value);
            setSelectedFuncIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedFuncIndex((i) =>
                Math.max(
                  0,
                  Math.min(
                    filteredFunctionList.length - 1,
                    i + (e.key === "ArrowDown" ? 1 : -1)
                  )
                )
              );
            }
          }}
        />
      </div>
      <div className="selbox">
        <label htmlFor="formulaTypeSelect">{formulaMore.selectCategory}</label>
        <select
          id="formulaTypeSelect"
          disabled={!!searchText}
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
      <div className="listbox">
        <div className="fortune-insert-function-label">
          {formulaMore.selectFunctionTitle}
        </div>
        <div
          className="formulaList"
          role="listbox"
          aria-label={formulaMore.selectFunctionTitle}
        >
          {filteredFunctionList.map((v, index) => (
            <div
              className={`listBox${index === selectedFuncIndex ? " on" : ""}`}
              key={v.n}
              role="option"
              aria-selected={index === selectedFuncIndex}
              onClick={() => setSelectedFuncIndex(index)}
              onDoubleClick={() => {
                setSelectedFuncIndex(index);
                onConfirm();
              }}
              ref={(el) => {
                if (el && index === selectedFuncIndex)
                  el.scrollIntoView?.({ block: "nearest" });
              }}
              tabIndex={index === selectedFuncIndex ? 0 : -1}
            >
              {v.n}
            </div>
          ))}
        </div>
      </div>
      {current && (
        <div className="fortune-insert-function-info" aria-live="polite">
          <div className="fortune-insert-function-signature">{signature}</div>
          <div className="fortune-insert-function-desc">
            {current.d || current.a}
          </div>
        </div>
      )}
    </DialogShell>
  );
};

/** Excel's Insert Function dialog (Shift+F3): the same component. */
export const InsertFunctionDialog = FormulaSearch;
