import React, { useCallback, useContext, useEffect, useRef } from "react";
import {
  applyFunctionCandidate,
  clickIntoEditor,
  closeFormulaParens,
  cycleEditorReference,
  EditorHistory,
  getCaretOffset,
  handleFormulaInput,
  lineIndentAt,
  moveFunctionCandidate,
  rangeHightlightselected,
  recordEditorState,
  redoEditorState,
  refreshFormulaEditorState,
  selectCallArgument,
  undoEditorState,
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
  const { context, setContext, refs } = useContext(WorkbookContext);
  const editing = context.luckysheetCellUpdate.length > 0;
  const candidates = context.functionCandidates;
  const candidateIndex = context.functionCandidateIndex ?? 0;

  // undo steps of the edit session, shared by the cell editor and the
  // formula bar (which mirror each other); forgotten when the edit ends
  useEffect(() => {
    if (!editing) delete refs.globalCache.editorHistory;
  }, [editing, refs.globalCache]);
  const history = useCallback((): EditorHistory => {
    refs.globalCache.editorHistory ??= { undo: [], redo: [] };
    return refs.globalCache.editorHistory;
  }, [refs.globalCache]);

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
      const el = getEditor();
      if (!el) return false;
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
        return true;
      };
      const key = e.key.toLowerCase();
      if (
        editing &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (key === "z" || key === "y")
      ) {
        // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) undo and redo the typing, not the
        // sheet (the markup is regenerated as it is typed, so the browser's
        // own undo cannot)
        const before = el.textContent ?? "";
        const changed =
          key === "y" || e.shiftKey
            ? redoEditorState(history(), el)
            : undoEditorState(history(), el);
        if (changed) {
          setContext((ctx) => {
            handleFormulaInput(ctx, getCopyTo(), el, 0, before);
          });
        }
        return consume();
      }
      // the text before this key: an undo step
      recordEditorState(history(), el);
      if (!editing) return false;

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
        setContext((ctx) => {
          cycleEditorReference(ctx, el, getCopyTo());
        });
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
      getCopyTo,
      getEditor,
      history,
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

  // a click into the text (pressed there, not a drag from the grid)
  const pressed = useRef(false);
  const onMouseDown = useCallback(() => {
    pressed.current = true;
  }, []);
  const onMouseUp = useCallback(() => {
    const el = getEditor();
    if (pressed.current && el && editing) {
      setContext((ctx) => {
        clickIntoEditor(ctx, el);
      });
    }
    pressed.current = false;
    onCaretMove();
  }, [editing, getEditor, onCaretMove, setContext]);

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = getEditor();
      // the text after typing: an undo step
      if (el && editing) recordEditorState(history(), el);
      if (CARET_KEYS.has(e.key) && candidates.length === 0) onCaretMove();
    },
    [candidates.length, editing, getEditor, history, onCaretMove]
  );

  return {
    onKeyDown,
    onKeyUp,
    onMouseDown,
    onMouseUp,
    acceptCandidate,
    selectArgument,
  };
}
