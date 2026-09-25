import {
  duplicateSheet,
  locale,
  moveSheet,
  Sheet,
  unhideSheets,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useContext, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import { activateSheetTab } from "./activate";

const END = "__end__";

const DialogButtons: React.FC<{
  onOk: () => void;
  onCancel: () => void;
}> = ({ onOk, onCancel }) => {
  const { context } = useContext(WorkbookContext);
  const { button } = locale(context);
  return (
    <div className="fortune-sheet-dialog-buttons">
      <div
        className="button-basic button-primary"
        onClick={onOk}
        onKeyDown={activateOnKey}
        role="button"
        tabIndex={0}
      >
        {button.confirm}
      </div>
      <div
        className="button-basic button-default"
        onClick={onCancel}
        onKeyDown={activateOnKey}
        role="button"
        tabIndex={0}
      >
        {button.cancel}
      </div>
    </div>
  );
};

/**
 * Excel's Move or Copy dialog: put the sheet before another sheet (or at
 * the end), optionally as a copy ("Name (2)", references to the original
 * pointing at the copy). The moved or copied sheet becomes active.
 */
export const MoveOrCopyDialog: React.FC<{ sheet: Sheet }> = ({ sheet }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { sheetconfig } = locale(context);
  const sheets = _.sortBy(context.luckysheetfile, (s) => Number(s.order));
  const [before, setBefore] = useState<string>(() => {
    const i = sheets.findIndex((s) => s.id === sheet.id);
    return sheets[i + 1]?.id ?? END;
  });
  const [copy, setCopy] = useState(false);

  const onOk = () => {
    hideDialog();
    refs.cellInput.current?.focus({ preventScroll: true });
    const beforeId = before === END ? null : before;
    if (copy) {
      setContext(
        (ctx) => {
          const id = duplicateSheet(ctx, sheet.id!, {
            beforeSheetId: beforeId,
          });
          if (id) {
            ctx.groupedSheetIds = undefined;
            activateSheetTab(ctx, id, refs.globalCache);
          }
        },
        { addSheetOp: true }
      );
    } else {
      setContext((ctx) => {
        moveSheet(ctx, sheet.id!, beforeId);
      });
    }
  };

  return (
    <div className="fortune-sheet-dialog" id="fortune-move-copy-dialog">
      <div className="title">{sheetconfig.moveOrCopyTitle}</div>
      <div className="fortune-sheet-dialog-label">
        {sheetconfig.beforeSheet}
      </div>
      <div className="fortune-sheet-dialog-list" role="listbox">
        {[...sheets, null].map((s) => {
          const id = s?.id ?? END;
          return (
            <div
              key={id}
              role="option"
              aria-selected={before === id}
              className={before === id ? "on" : ""}
              onClick={() => setBefore(id)}
              onDoubleClick={() => {
                setBefore(id);
              }}
              onKeyDown={activateOnKey}
              tabIndex={0}
            >
              {s ? s.name : sheetconfig.moveToEnd}
            </div>
          );
        })}
      </div>
      <label className="fortune-sheet-dialog-check" htmlFor="fortune-move-copy">
        <input
          id="fortune-move-copy"
          type="checkbox"
          checked={copy}
          onChange={(e) => setCopy(e.target.checked)}
        />
        {sheetconfig.createCopy}
      </label>
      <DialogButtons onOk={onOk} onCancel={hideDialog} />
    </div>
  );
};

/** Excel's Unhide dialog, with several sheets selectable at once. */
export const UnhideDialog: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { sheetconfig } = locale(context);
  const hidden = _.sortBy(
    context.luckysheetfile.filter((s) => s.hide === 1),
    (s) => Number(s.order)
  );
  const [picked, setPicked] = useState<string[]>(
    hidden[0]?.id ? [hidden[0].id] : []
  );

  const toggle = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setPicked((p) =>
        p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
      );
    } else {
      setPicked([id]);
    }
  };

  const onOk = () => {
    hideDialog();
    refs.cellInput.current?.focus({ preventScroll: true });
    if (picked.length === 0) return;
    setContext((ctx) => {
      unhideSheets(ctx, picked);
    });
  };

  return (
    <div className="fortune-sheet-dialog" id="fortune-unhide-dialog">
      <div className="title">{sheetconfig.unhideTitle}</div>
      <div className="fortune-sheet-dialog-label">
        {sheetconfig.unhideSheets}
      </div>
      <div
        className="fortune-sheet-dialog-list"
        role="listbox"
        aria-multiselectable="true"
      >
        {hidden.map((s) => (
          <div
            key={s.id}
            role="option"
            aria-selected={picked.includes(s.id!)}
            className={picked.includes(s.id!) ? "on" : ""}
            onClick={(e) => toggle(s.id!, e)}
            onDoubleClick={() => {
              hideDialog();
              setContext((ctx) => {
                unhideSheets(ctx, [s.id!]);
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle(s.id!, e);
              }
            }}
            tabIndex={0}
          >
            <input
              type="checkbox"
              tabIndex={-1}
              readOnly
              checked={picked.includes(s.id!)}
              onClick={(e) => {
                e.stopPropagation();
                setPicked((p) =>
                  p.includes(s.id!)
                    ? p.filter((x) => x !== s.id)
                    : [...p, s.id!]
                );
              }}
            />
            {s.name}
          </div>
        ))}
      </div>
      <DialogButtons onOk={onOk} onCancel={hideDialog} />
    </div>
  );
};
