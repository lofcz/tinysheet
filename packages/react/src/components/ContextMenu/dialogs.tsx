import {
  api,
  deleteCells,
  deleteRowCol,
  insertCells,
  insertRowCol,
  locale,
  Context,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext, { SetContextOptions } from "../../context";
import { ModalContext } from "../../context/modal";
import { useAlert } from "../../hooks/useAlert";
import Dialog from "../Dialog";

export type InsertDeleteChoice =
  | "shiftRight"
  | "shiftDown"
  | "shiftLeft"
  | "shiftUp"
  | "entireRow"
  | "entireColumn";

type Range = { row: number[]; column: number[] };

/**
 * Runs Insert / Delete for `range`. Entire rows / columns go through the
 * row-column ops so undo and collaboration see a structural change.
 * Returns an error key when the operation was refused.
 */
export function runInsertDelete(
  draftCtx: Context,
  mode: "insert" | "delete",
  choice: InsertDeleteChoice,
  range: Range
): string | null {
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  const id = draftCtx.currentSheetId;
  try {
    if (choice === "entireRow" || choice === "entireColumn") {
      const type = choice === "entireRow" ? "row" : "column";
      const [start, end] = type === "row" ? [r1, r2] : [c1, c2];
      if (mode === "insert") {
        insertRowCol(draftCtx, {
          type,
          index: start,
          count: end - start + 1,
          direction: "lefttop",
          id,
        });
      } else {
        deleteRowCol(draftCtx, { type, start, end, id });
      }
    } else if (mode === "insert") {
      insertCells(draftCtx, range, choice === "shiftRight" ? "right" : "down");
    } else {
      deleteCells(draftCtx, range, choice === "shiftLeft" ? "left" : "up");
    }
  } catch (e: any) {
    return e?.message || "error";
  }
  return null;
}

/** The SetContext options that make a row/column change undoable. */
export function insertDeleteOptions(
  ctx: Context,
  mode: "insert" | "delete",
  choice: InsertDeleteChoice,
  range: Range
): SetContextOptions {
  if (choice !== "entireRow" && choice !== "entireColumn") return {};
  const type = choice === "entireRow" ? "row" : "column";
  const [start, end] = type === "row" ? range.row : range.column;
  const id = ctx.currentSheetId;
  if (mode === "insert") {
    return {
      insertRowColOp: {
        type,
        index: start,
        count: end - start + 1,
        direction: "lefttop",
        id,
      },
    };
  }
  return { deleteRowColOp: { type, start, end, id } };
}

export function useInsertDeleteRunner() {
  const { setContext, context } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const { cellMenu, rightclick } = locale(context);
  return (
    mode: "insert" | "delete",
    choice: InsertDeleteChoice,
    range: Range
  ) => {
    let error: string | null = null;
    setContext((draftCtx) => {
      error = runInsertDelete(draftCtx, mode, choice, range);
      draftCtx.contextMenu = {};
    }, insertDeleteOptions(context, mode, choice, range));
    // setContext runs the recipe synchronously in event handlers; report
    // refusals once it has
    window.setTimeout(() => {
      if (!error) return;
      const messages: Record<string, string> = {
        partMC: cellMenu.partMC,
        maxExceeded: cellMenu.overLimit,
        readOnly:
          choice === "entireColumn"
            ? rightclick.cannotInsertOnColumnReadOnly
            : rightclick.cannotInsertOnRowReadOnly,
      };
      if (messages[error]) showAlert(messages[error], "ok");
    });
  };
}

/** Excel's Insert… / Delete… dialog. */
export const InsertDeleteDialog: React.FC<{
  mode: "insert" | "delete";
  range: Range;
}> = ({ mode, range }) => {
  const { context } = useContext(WorkbookContext);
  const { hideModal } = useContext(ModalContext);
  const { cellMenu } = locale(context);
  const run = useInsertDeleteRunner();
  const rows = range.row[1] - range.row[0] + 1;
  const cols = range.column[1] - range.column[0] + 1;
  const choices: InsertDeleteChoice[] =
    mode === "insert"
      ? ["shiftRight", "shiftDown", "entireRow", "entireColumn"]
      : ["shiftLeft", "shiftUp", "entireRow", "entireColumn"];
  // Excel shifts along the selection's short side by default
  const [choice, setChoice] = useState<InsertDeleteChoice>(
    rows > cols ? choices[0] : choices[1]
  );
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const submit = () => {
    hideModal();
    run(mode, choice, range);
  };

  return (
    <Dialog type="yesno" onOk={submit} onCancel={hideModal}>
      <div
        className="fortune-cellmenu-dialog"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            hideModal();
          }
        }}
      >
        <div className="title">
          {mode === "insert" ? cellMenu.insertTitle : cellMenu.deleteTitle}
        </div>
        <div
          className="fortune-cellmenu-dialog-options"
          role="radiogroup"
          aria-label={
            mode === "insert" ? cellMenu.insertTitle : cellMenu.deleteTitle
          }
        >
          {choices.map((c) => (
            <label
              key={c}
              className="fortune-cellmenu-dialog-option"
              htmlFor={`fortune-${mode}-cells-${c}`}
            >
              <input
                id={`fortune-${mode}-cells-${c}`}
                ref={c === choice ? firstRef : undefined}
                type="radio"
                name={`fortune-${mode}-cells`}
                value={c}
                checked={choice === c}
                onChange={() => setChoice(c)}
              />
              <span>{cellMenu[c]}</span>
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  );
};

/** Row Height… / Column Width… dialog. */
export const SizeDialog: React.FC<{
  type: "row" | "column";
  initial: number | "";
  targets: number[];
}> = ({ type, initial, targets }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideModal } = useContext(ModalContext);
  const { showAlert } = useAlert();
  const { cellMenu, info } = locale(context);
  const [value, setValue] = useState(initial === "" ? "" : String(initial));
  const inputRef = useRef<HTMLInputElement>(null);
  const max = type === "row" ? 545 : 2038;
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n <= 0 || n > max) {
      showAlert(
        type === "row" ? info.tipRowHeightLimit : info.tipColumnWidthLimit,
        "ok"
      );
      return;
    }
    hideModal();
    const size = Math.round(n);
    const list: Record<string, number> = {};
    targets.forEach((i) => {
      list[i] = size;
    });
    setContext((draftCtx) => {
      if (type === "row") api.setRowHeight(draftCtx, list, {}, true);
      else api.setColumnWidth(draftCtx, list, {}, true);
      draftCtx.contextMenu = {};
    });
  };

  const label =
    type === "row" ? cellMenu.rowHeightLabel : cellMenu.columnWidthLabel;
  return (
    <Dialog type="yesno" onOk={submit} onCancel={hideModal}>
      <div className="fortune-cellmenu-dialog">
        <div className="title">
          {type === "row" ? cellMenu.rowHeightTitle : cellMenu.columnWidthTitle}
        </div>
        <label
          className="fortune-cellmenu-dialog-field"
          htmlFor={`fortune-${type}-size-input`}
        >
          <span>{label}</span>
          <input
            id={`fortune-${type}-size-input`}
            ref={inputRef}
            type="number"
            min={1}
            max={max}
            className="fortune-cellmenu-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                hideModal();
              }
            }}
          />
        </label>
      </div>
    </Dialog>
  );
};
