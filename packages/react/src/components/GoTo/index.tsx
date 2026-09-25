import {
  formatGoToTarget,
  goToReference,
  locale,
  parseGoToReference,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useCallback, useContext, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { LocationCondition } from "../LocationCondition";
import SVGIcon from "../SVGIcon";
import { activateOnKey } from "../Toolbar/Button";
import "./index.css";

const RECENT_KEY = "goTo.recent";
const PREVIOUS_KEY = "goTo.previous";
const MAX_RECENT = 12;

/**
 * Go To (Ctrl+G / F5): a reference box (A1, ranges, Sheet!refs, several
 * areas) with the list of places gone to before; Special... opens Go To
 * Special. The box starts with the place the last jump came from, so
 * F5, Enter goes back (Excel).
 */
const GoTo: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { findAndReplace, button } = locale(context);
  const { showDialog } = useDialog();
  const [recent] = useState<string[]>(
    () => _.get(refs.globalCache, RECENT_KEY) ?? []
  );
  const [reference, setReference] = useState<string>(
    _.get(refs.globalCache, PREVIOUS_KEY) ?? ""
  );
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // give the keyboard back to the sheet once the dialog is gone
  const refocusSheet = useCallback(() => {
    setTimeout(() => refs.cellInput.current?.focus());
  }, [refs.cellInput]);

  const close = useCallback(() => {
    setContext((ctx) => {
      ctx.showGoTo = false;
    });
    refocusSheet();
  }, [refocusSheet, setContext]);

  const go = useCallback(
    (text: string) => {
      const target = parseGoToReference(context, text);
      if (!target) {
        setError(findAndReplace.gotoInvalid);
        inputRef.current?.focus();
        return;
      }
      const last = _.last(context.luckysheet_select_save);
      if (last) {
        const r = last.row_focus ?? last.row[0];
        const c = last.column_focus ?? last.column[0];
        _.set(
          refs.globalCache,
          PREVIOUS_KEY,
          formatGoToTarget(context, {
            sheetId: context.currentSheetId,
            ranges: [{ row: [r, r], column: [c, c] }],
          })
        );
      }
      const label = formatGoToTarget(context, target);
      _.set(
        refs.globalCache,
        RECENT_KEY,
        [label, ...recent.filter((x) => x !== label)].slice(0, MAX_RECENT)
      );
      setContext((ctx) => {
        goToReference(ctx, text);
        ctx.showGoTo = false;
      });
      refocusSheet();
    },
    [
      context,
      findAndReplace.gotoInvalid,
      recent,
      refocusSheet,
      refs.globalCache,
      setContext,
    ]
  );

  const openSpecial = useCallback(() => {
    close();
    showDialog(<LocationCondition />);
  }, [close, showDialog]);

  return (
    <div
      className="fortune-goto-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        id="fortune-goto"
        className="fortune-dialog"
        role="dialog"
        aria-label={findAndReplace.gotoTitle}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") close();
        }}
      >
        <div className="goto-header">
          <div className="title">{findAndReplace.gotoTitle}</div>
          <div
            className="fortune-modal-dialog-icon-close"
            onClick={close}
            onKeyDown={activateOnKey}
            role="button"
            aria-label={button.close}
            tabIndex={0}
          >
            <SVGIcon name="close" />
          </div>
        </div>
        <div
          className="goto-list"
          role="listbox"
          aria-label={findAndReplace.goto}
        >
          {recent.map((item) => (
            <div
              key={item}
              role="option"
              aria-selected={item === reference}
              className={item === reference ? "on" : ""}
              onClick={() => {
                setReference(item);
                setError("");
              }}
              onDoubleClick={() => go(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter") go(item);
              }}
              tabIndex={0}
            >
              {item}
            </div>
          ))}
        </div>
        <label className="goto-field" htmlFor="fortune-goto-reference">
          <span>{findAndReplace.gotoReference}</span>
          <input
            id="fortune-goto-reference"
            ref={inputRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            spellCheck="false"
            value={reference}
            aria-invalid={!!error}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setReference(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go(reference);
              }
            }}
          />
        </label>
        <div className="goto-error" role="alert">
          {error}
        </div>
        <div className="goto-buttons">
          <div
            className="button-basic button-default"
            onClick={openSpecial}
            onKeyDown={activateOnKey}
            role="button"
            tabIndex={0}
          >
            {findAndReplace.gotoSpecialBtn}
          </div>
          <div className="spacer" />
          <div
            className="button-basic button-primary"
            onClick={() => go(reference)}
            onKeyDown={activateOnKey}
            role="button"
            tabIndex={0}
          >
            {button.confirm}
          </div>
          <div
            className="button-basic button-default"
            onClick={close}
            onKeyDown={activateOnKey}
            role="button"
            tabIndex={0}
          >
            {button.cancel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoTo;
