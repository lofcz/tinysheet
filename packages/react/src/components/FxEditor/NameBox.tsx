import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import {
  defineNameForSelection,
  getDefinedNames,
  getRangetxt,
  getTables,
  goToNameRange,
  locale,
  nameOfRange,
  resolveNameBoxInput,
  resolveNameRange,
  scrollToHighlightCell,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import SVGIcon from "../SVGIcon";

/**
 * The Name Box left of the formula bar: shows the active cell / selection
 * (or the name that refers to exactly the selection); typing a reference,
 * a name or a table jumps to it, typing a new name defines it for the
 * selection. The dropdown lists the defined names and tables.
 */
const NameBox: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { definedNames: t } = locale(context);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useOutsideClick(containerRef, () => setOpen(false));

  const rangeText = useMemo(() => {
    const lastSelection = _.last(context.luckysheet_select_save);
    if (
      !(
        lastSelection &&
        lastSelection.row_focus != null &&
        lastSelection.column_focus != null
      )
    )
      return "";
    const named = nameOfRange(context, {
      sheetId: context.currentSheetId,
      row: [lastSelection.row[0], lastSelection.row[1]],
      column: [lastSelection.column[0], lastSelection.column[1]],
    });
    if (named) return named;
    const rf = lastSelection.row_focus;
    const cf = lastSelection.column_focus;
    if (context.config.merge != null && `${rf}_${cf}` in context.config.merge) {
      return getRangetxt(context, context.currentSheetId, {
        column: [cf, cf],
        row: [rf, rf],
      });
    }
    return getRangetxt(context, context.currentSheetId, lastSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.currentSheetId,
    context.luckysheet_select_save,
    context.luckysheetfile,
  ]);

  useEffect(() => {
    if (!editing) setText(rangeText);
  }, [rangeText, editing]);

  const items = useMemo(() => {
    if (!open) return [];
    const names = getDefinedNames(context)
      .filter(
        (d) =>
          !d.hidden && (d.scope == null || d.scope === context.currentSheetId)
      )
      .filter((d) => resolveNameRange(context, d.name, context.currentSheetId))
      .map((d) => d.name);
    const tables = getTables(context).map((x) => x.table.name);
    return _.uniqBy([...names, ...tables], (n) => n.toUpperCase()).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [open, context]);

  const goTo = useCallback(
    (value: string) => {
      const res = resolveNameBoxInput(context, value);
      if (res.kind === "error") {
        showDialog(t.invalidReference, "ok");
        return;
      }
      if (res.kind === "define") {
        setContext((ctx) => {
          defineNameForSelection(ctx, res.name);
        });
        return;
      }
      const { range } = res;
      setContext((ctx) => {
        goToNameRange(ctx, range);
      });
      if (range.sheetId !== context.currentSheetId) {
        // scroll again once the other sheet is laid out
        setTimeout(() => {
          setContext((ctx) =>
            scrollToHighlightCell(ctx, range.row[0], range.column[0])
          );
        });
      }
    },
    [context, setContext, showDialog, t.invalidReference]
  );

  const finish = useCallback(() => {
    setEditing(false);
    inputRef.current?.blur();
    // back to the grid, like Excel
    setTimeout(() => refs.cellInput.current?.focus());
  }, [refs.cellInput]);

  return (
    <div className="fortune-name-box-container" ref={containerRef}>
      <input
        ref={inputRef}
        className="fortune-name-box"
        dir="ltr"
        spellCheck={false}
        aria-label={t.nameBox}
        value={editing ? text : rangeText}
        onFocus={(e) => {
          setEditing(true);
          setText(rangeText);
          e.currentTarget.select();
        }}
        onBlur={() => setEditing(false)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            const value = text;
            finish();
            if (value.trim() && value.trim() !== rangeText) goTo(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setText(rangeText);
            finish();
          }
        }}
      />
      <div
        className="fortune-name-box-arrow"
        role="button"
        tabIndex={0}
        aria-label={t.nameBoxList}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <SVGIcon name="combo-arrow" width={10} />
      </div>
      {open && (
        <div className="fortune-name-box-list" role="listbox">
          {items.length === 0 ? (
            <div className="fortune-name-box-list-empty">{t.empty}</div>
          ) : (
            items.map((name) => (
              <div
                key={name}
                role="option"
                aria-selected={name === rangeText}
                tabIndex={0}
                className="fortune-name-box-list-item"
                onClick={() => {
                  setOpen(false);
                  goTo(name);
                  finish();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setOpen(false);
                    goTo(name);
                    finish();
                  }
                }}
              >
                {name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NameBox;
