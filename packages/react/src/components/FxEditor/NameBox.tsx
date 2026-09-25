import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import { ChevronDown, EllipsisVertical, Table2, Tag } from "lucide-react";
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
import { DropdownMenu, Icon, MenuItem } from "../ui";
import { useNameBoxWidth } from "./useNameBoxWidth";

/**
 * The Name Box left of the formula bar: shows the active cell / selection
 * (or the name that refers to exactly the selection); typing a reference,
 * a name or a table jumps to it, typing a new name defines it for the
 * selection. The drop-down lists the defined names and tables; the grip on
 * its right edge drags its width (like Excel).
 */
const NameBox: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { definedNames: t, formulaMore } = locale(context);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const size = useNameBoxWidth(boxRef);

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
    setTimeout(() => refs.cellInput.current?.focus({ preventScroll: true }));
  }, [refs.cellInput]);

  const items = useMemo((): MenuItem[] => {
    if (!open) return [];
    const names = getDefinedNames(context)
      .filter(
        (d) =>
          !d.hidden && (d.scope == null || d.scope === context.currentSheetId)
      )
      .filter((d) => resolveNameRange(context, d.name, context.currentSheetId))
      .map((d) => ({ name: d.name, table: false }));
    const tables = getTables(context).map((x) => ({
      name: x.table.name,
      table: true,
    }));
    const all = _.uniqBy([...names, ...tables], (n) =>
      n.name.toUpperCase()
    ).sort((a, b) => a.name.localeCompare(b.name));
    if (all.length === 0) {
      return [
        {
          type: "custom",
          id: "empty",
          render: () => <div className="fortune-name-box-empty">{t.empty}</div>,
        },
      ];
    }
    return all.map(({ name, table }) => ({
      id: name,
      label: name,
      icon: table ? Table2 : Tag,
      checked: name === rangeText ? true : undefined,
      onSelect: () => {
        goTo(name);
        finish();
      },
    }));
  }, [open, context, t.empty, rangeText, goTo, finish]);

  const toggleList = (keyboard: boolean) => {
    setByKeyboard(keyboard);
    setOpen((o) => !o);
  };

  return (
    <div className="fortune-name-box-container">
      <div
        ref={boxRef}
        className={`fortune-name-box-field${
          open ? " fortune-name-box-field-open" : ""
        }`}
        style={{ width: size.width }}
      >
        <input
          ref={inputRef}
          className="fortune-name-box"
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
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
            } else if (e.key === "ArrowDown" && e.altKey) {
              // Alt+Down opens the list, like a combo box
              e.preventDefault();
              toggleList(true);
            }
          }}
        />
        <button
          type="button"
          className="fortune-name-box-arrow"
          tabIndex={-1}
          aria-label={t.nameBoxList}
          aria-haspopup="menu"
          aria-expanded={open}
          title={t.nameBoxList}
          // the input keeps its text (and the grid its focus) until a pick
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => toggleList(e.detail === 0)}
        >
          <Icon icon={ChevronDown} size={14} />
        </button>
      </div>
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={boxRef}
        items={items}
        autoFocus={byKeyboard}
        minWidth={Math.max(160, size.width)}
        aria-label={t.nameBoxList}
        className="fortune-name-box-menu"
      />
      {/* a focusable separator is a window splitter (interactive) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="fortune-name-box-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label={formulaMore.nameBoxResize}
        aria-valuemin={size.min}
        aria-valuemax={size.max}
        aria-valuenow={size.width}
        title={formulaMore.nameBoxResize}
        tabIndex={0}
        onPointerDown={size.onResizeStart}
        onKeyDown={size.onResizeKey}
        onDoubleClick={size.reset}
      >
        <Icon icon={EllipsisVertical} size={14} />
      </div>
    </div>
  );
};

export default NameBox;
