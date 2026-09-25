import {
  handlePasteSpecial,
  locale,
  PasteSpecialMode,
  PasteSpecialOperation,
  PasteSpecialOptions,
} from "@lofcz/tinysheet-core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import WorkbookContext from "../../context";
import { activateOnKey } from "../Toolbar/Button";
import "./index.css";

const MODES: PasteSpecialMode[] = [
  "all",
  "allUsingSourceColumnWidths",
  "formulas",
  "values",
  "formats",
  "comments",
  "validation",
  "allExceptBorders",
  "columnWidths",
  "formulasAndNumberFormats",
  "valuesAndNumberFormats",
];

const OPERATIONS: PasteSpecialOperation[] = [
  "none",
  "add",
  "subtract",
  "multiply",
  "divide",
];

/** modes that paste content, so an arithmetic operation applies */
const WITH_CONTENT = new Set<PasteSpecialMode>([
  "all",
  "allUsingSourceColumnWidths",
  "formulas",
  "values",
  "allExceptBorders",
  "formulasAndNumberFormats",
  "valuesAndNumberFormats",
]);

/**
 * Excel's Paste Special dialog (Ctrl+Alt+V / Ctrl+Shift+V): pastes the last
 * copy of the workbook with the chosen parts, an optional arithmetic
 * operation, skip blanks and transpose, or as links.
 */
const PasteSpecial: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { pasteSpecial: labels } = locale(context);
  const [mode, setMode] = useState<PasteSpecialMode>("all");
  const [operation, setOperation] = useState<PasteSpecialOperation>("none");
  const [skipBlanks, setSkipBlanks] = useState(false);
  const [transpose, setTranspose] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const operationEnabled = WITH_CONTENT.has(mode);

  const close = useCallback(() => {
    setContext((draftCtx) => {
      draftCtx.showPasteSpecial = false;
    });
  }, [setContext]);

  const apply = useCallback(
    (options: PasteSpecialOptions) => {
      setContext((draftCtx) => {
        draftCtx.showPasteSpecial = false;
        handlePasteSpecial(draftCtx, options);
      });
    },
    [setContext]
  );

  const onOk = useCallback(() => {
    apply({
      paste: mode,
      operation: operationEnabled ? operation : "none",
      skipBlanks,
      transpose,
    });
  }, [apply, mode, operation, operationEnabled, skipBlanks, transpose]);

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onOk();
      }
    },
    [close, onOk]
  );

  return (
    <div
      className="fortune-paste-special-mask"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* keyboard handling for the whole dialog: Enter = OK, Esc = cancel */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="fortune-dialog fortune-paste-special"
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        onKeyDown={onKeyDown}
      >
        <div className="fortune-paste-special-title">{labels.title}</div>
        <fieldset className="fortune-paste-special-group">
          <legend>{labels.paste}</legend>
          <div className="fortune-paste-special-grid">
            {MODES.map((m) => (
              <label
                key={m}
                className="fortune-paste-special-option"
                htmlFor={`fortune-paste-special-${m}`}
              >
                <input
                  id={`fortune-paste-special-${m}`}
                  type="radio"
                  name="fortune-paste-special-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                <span>{labels[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset
          className="fortune-paste-special-group"
          disabled={!operationEnabled}
        >
          <legend>{labels.operation}</legend>
          <div className="fortune-paste-special-grid">
            {OPERATIONS.map((op) => (
              <label
                key={op}
                className="fortune-paste-special-option"
                htmlFor={`fortune-paste-special-op-${op}`}
              >
                <input
                  id={`fortune-paste-special-op-${op}`}
                  type="radio"
                  name="fortune-paste-special-operation"
                  checked={operation === op}
                  onChange={() => setOperation(op)}
                />
                <span>{labels[op]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="fortune-paste-special-checks">
          <label
            className="fortune-paste-special-option"
            htmlFor="fortune-paste-special-skip-blanks"
          >
            <input
              id="fortune-paste-special-skip-blanks"
              type="checkbox"
              checked={skipBlanks}
              onChange={(e) => setSkipBlanks(e.target.checked)}
            />
            <span>{labels.skipBlanks}</span>
          </label>
          <label
            className="fortune-paste-special-option"
            htmlFor="fortune-paste-special-transpose"
          >
            <input
              id="fortune-paste-special-transpose"
              type="checkbox"
              checked={transpose}
              onChange={(e) => setTranspose(e.target.checked)}
            />
            <span>{labels.transpose}</span>
          </label>
        </div>
        <div className="fortune-paste-special-buttons">
          <div
            className="fortune-message-box-button button-basic button-default fortune-paste-special-link"
            role="button"
            tabIndex={0}
            onClick={() => apply({ pasteLink: true })}
            onKeyDown={activateOnKey}
          >
            {labels.pasteLink}
          </div>
          <div
            className="fortune-message-box-button button-basic button-primary"
            role="button"
            tabIndex={0}
            onClick={onOk}
            onKeyDown={activateOnKey}
          >
            {labels.ok}
          </div>
          <div
            className="fortune-message-box-button button-basic button-default"
            role="button"
            tabIndex={0}
            onClick={close}
            onKeyDown={activateOnKey}
          >
            {labels.cancel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteSpecial;
