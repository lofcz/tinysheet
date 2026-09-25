import React, { useCallback, useContext } from "react";
import {
  applyFunctionCandidate,
  applyReferenceCycle,
  closeFormulaParens,
  getCaretOffset,
  handleFormulaInput,
  lineIndentAt,
  moveFunctionCandidate,
  rangeHightlightselected,
  refreshFormulaEditorState,
  selectCallArgument,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";

/**
 * Alt+Enter in the cell editor or the formula bar: a line break. In a
 * formula the new line starts with the indentation of the current one.
 */
export function insertEditorLineBreak(el: HTMLElement | null | undefined) {
  const text = el?.textContent ?? "";
  const caret = el ? (getCaretOffset(el) ?? text.length) : text.length;
  const indent = text.startsWith("=") ? lineIndentAt(text, caret) : "";
  if (indent) {
    // (insertText would start a new block element instead)
    document.execCommand("insertHTML", false, `\n${indent}`);
    return;
  }
  // the space forces the browser to show the new (last) line; the delete
  // removes it again
  document.execCommand("insertHTML", false, "\n ");
  document.execCommand("delete", false);
}

const CARET_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/**
 * Keyboard and caret handling shared by the in-cell editor and the formula
 * bar: function autocomplete navigation (Up/Down, Tab/Enter to accept, Esc to
 * close), F4 reference cycling, auto-closing parentheses on commit and
 * refreshing the argument hint / bracket highlight when the caret moves.
 *
 * `getEditor` returns the element being edited, `getCopyTo` the other editor
 * that mirrors it.
 */
export function useFormulaEditorKeys(
  getEditor: () => HTMLDivElement | null | undefined,
  getCopyTo: () => HTMLDivElement | null | undefined
) {
  const { context, setContext } = useContext(WorkbookContext);
  const editing = context.luckysheetCellUpdate.length > 0;
  const candidates = context.functionCandidates;
  const candidateIndex = context.functionCandidateIndex ?? 0;

  const rerender = useCallback(
    (el: HTMLDivElement) => {
      setContext((ctx) => {
        handleFormulaInput(ctx, getCopyTo(), el, 0);
      });
    },
    [getCopyTo, setContext]
  );

  const acceptCandidate = useCallback(
    (name: string) => {
      const el = getEditor();
      if (!el) return;
      el.focus();
      applyFunctionCandidate(el, name);
      rerender(el);
    },
    [getEditor, rerender]
  );

  /** Argument hint: selects argument `index` of the call at the caret. */
  const selectArgument = useCallback(
    (index: number) => {
      const el = getEditor();
      if (!el) return;
      el.focus();
      if (!selectCallArgument(el, index)) return;
      setContext((ctx) => {
        refreshFormulaEditorState(ctx, el);
      });
    },
    [getEditor, setContext]
  );

  /** Returns true when the key was consumed by the formula editor. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!editing) return false;
      const el = getEditor();
      if (!el) return false;
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
        return true;
      };

      if (candidates.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          setContext((ctx) => {
            moveFunctionCandidate(ctx, e.key === "ArrowDown" ? 1 : -1);
          });
          return consume();
        }
        if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey) {
          const item =
            candidates[Math.min(candidateIndex, candidates.length - 1)];
          if (item) {
            acceptCandidate(item.n);
            return consume();
          }
        }
        if (e.key === "Escape") {
          setContext((ctx) => {
            ctx.functionCandidates = [];
          });
          return consume();
        }
      }

      const isFormula = (el.textContent || "").startsWith("=");
      if (e.key === "F4" && isFormula) {
        if (applyReferenceCycle(el)) rerender(el);
        return consume();
      }
      if (
        isFormula &&
        ((e.key === "Enter" && !e.altKey && !e.metaKey) || e.key === "Tab")
      ) {
        // Excel adds the missing closing parentheses on commit
        closeFormulaParens(el);
      }
      return false;
    },
    [
      acceptCandidate,
      candidateIndex,
      candidates,
      editing,
      getEditor,
      rerender,
      setContext,
    ]
  );

  const onCaretMove = useCallback(() => {
    const el = getEditor();
    if (!el || !editing || !(el.textContent || "").startsWith("=")) return;
    setContext((ctx) => {
      rangeHightlightselected(ctx, el);
    });
  }, [editing, getEditor, setContext]);

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (CARET_KEYS.has(e.key) && candidates.length === 0) onCaretMove();
    },
    [candidates.length, onCaretMove]
  );

  return {
    onKeyDown,
    onKeyUp,
    onMouseUp: onCaretMove,
    acceptCandidate,
    selectArgument,
  };
}
