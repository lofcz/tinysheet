import React, { useContext, useEffect, useState, useRef } from "react";
import {
  collectColumnValues,
  getFlowdata,
  getSheetIndex,
  matchColumnValues,
  setCaretOffset,
  updateCell,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/**
 * Excel-style AutoComplete for plain values: while typing text into a cell,
 * offers the values of the contiguous block of cells above/below in the same
 * column that start with the typed text (case-insensitive).
 *
 * - column values are collected once per edit session;
 * - nothing is offered for formulas, numbers or cells with data validation;
 * - with a single match it is preselected and Enter/Tab accept it (like
 *   Excel's inline completion); with several, Up/Down pick one;
 * - Esc closes the list and keeps editing.
 */
const AutocompleteList: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [typed, setTyped] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<{ key: string; values: string[] } | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const stateRef = useRef({ suggestions, activeIndex });
  stateRef.current = { suggestions, activeIndex };

  const [editRow, editCol] = context.luckysheetCellUpdate;
  const editing = context.luckysheetCellUpdate.length > 0;

  // a new edit session starts with a fresh cache and no list
  useEffect(() => {
    cacheRef.current = null;
    setSuggestions([]);
    setActiveIndex(-1);
  }, [editing, editRow, editCol, context.currentSheetId]);

  useEffect(() => {
    const input = refs.cellInput.current;
    if (!input) return undefined;

    const close = () => {
      if (stateRef.current.suggestions.length > 0) setSuggestions([]);
    };

    const onInput = () => {
      const ctx = contextRef.current;
      const [r, c] = ctx.luckysheetCellUpdate;
      if (r == null || c == null) {
        close();
        return;
      }
      const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
      const dv =
        sheetIndex != null
          ? ctx.luckysheetfile[sheetIndex]?.dataVerification
          : null;
      // cells with data validation have their own dropdown
      if (dv?.[`${r}_${c}`]) {
        close();
        return;
      }
      let text = input.innerText || "";
      if (text.endsWith("\n")) text = text.slice(0, -1);
      if (!text || text.startsWith("=") || text.includes("\n")) {
        close();
        return;
      }
      const key = `${ctx.currentSheetId}_${r}_${c}`;
      if (cacheRef.current?.key !== key) {
        const flowdata = getFlowdata(ctx);
        cacheRef.current = {
          key,
          values: flowdata ? collectColumnValues(flowdata, r, c) : [],
        };
      }
      const matches = matchColumnValues(cacheRef.current.values, text);
      setTyped(text);
      setSuggestions(matches);
      setActiveIndex(matches.length === 1 ? 0 : -1);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const { suggestions: list, activeIndex: idx } = stateRef.current;
      if (list.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((prev) => {
          if (prev < 0) return delta > 0 ? 0 : list.length - 1;
          return (prev + delta + list.length) % list.length;
        });
        e.preventDefault();
        e.stopPropagation();
      } else if (
        (e.key === "Enter" || e.key === "Tab") &&
        !e.altKey &&
        !e.metaKey
      ) {
        // put the accepted value in the editor and let the normal
        // Enter/Tab handling commit it
        if (idx >= 0 && list[idx]) input.textContent = list[idx];
        setSuggestions([]);
      } else if (e.key === "Escape") {
        setSuggestions([]);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeyDown);
    return () => {
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
    };
  }, [refs.cellInput]);

  // keep the highlighted item visible without scrolling the sheet
  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (
      el.offsetTop + el.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [activeIndex]);

  if (!editing || suggestions.length === 0) return null;

  const selectSuggestion = (value: string) => {
    const input = refs.cellInput.current;
    if (!input) return;
    input.textContent = value;
    setCaretOffset(input, value.length);
    setSuggestions([]);
    setContext((ctx) => {
      const [r, c] = ctx.luckysheetCellUpdate;
      if (r == null || c == null) return;
      updateCell(ctx, r, c, input);
      ctx.luckysheet_select_save = [
        { row: [r, r], column: [c, c], row_focus: r, column_focus: c },
      ];
    });
  };

  const col = context.visibledatacolumn[editCol];
  const colPre = editCol === 0 ? 0 : context.visibledatacolumn[editCol - 1];
  const row = context.visibledatarow[editRow];
  if (col == null || row == null) return null;

  return (
    <div
      ref={listRef}
      className="fortune-autocomplete-list"
      role="listbox"
      onMouseDown={(e) => {
        // keep focus in the cell editor
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "absolute",
        left: colPre,
        top: row,
        minWidth: Math.max(col - colPre, 120),
        maxHeight: 200,
        overflowY: "auto",
        backgroundColor: "white",
        border: "1px solid #ccc",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1001,
        fontSize: 13,
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion}
          data-index={index}
          role="option"
          aria-selected={index === activeIndex}
          onClick={() => selectSuggestion(suggestion)}
          style={{
            padding: "4px 8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            backgroundColor: index === activeIndex ? "#e6f7ff" : "white",
          }}
          onMouseEnter={() => setActiveIndex(index)}
        >
          <b>{suggestion.slice(0, typed.length)}</b>
          {suggestion.slice(typed.length)}
        </div>
      ))}
    </div>
  );
};

export default AutocompleteList;
