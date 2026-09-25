import {
  applyGoToSpecial,
  getGoToSpecialRanges,
  GoToSpecialType,
  locale,
  ValueKind,
} from "@lofcz/tinysheet-core";
import React, { useContext, useState, useCallback } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import "./index.css";

const LEFT: GoToSpecialType[] = [
  "notes",
  "constants",
  "formulas",
  "blanks",
  "currentRegion",
  "currentArray",
];

const RIGHT: GoToSpecialType[] = [
  "rowDifferences",
  "columnDifferences",
  "precedents",
  "dependents",
  "lastCell",
  "visibleCells",
  "conditionalFormats",
  "dataValidation",
];

const LABEL_KEYS: Record<GoToSpecialType, string> = {
  notes: "specialNotes",
  constants: "specialConstants",
  formulas: "specialFormulas",
  blanks: "specialBlanks",
  currentRegion: "specialCurrentRegion",
  currentArray: "specialCurrentArray",
  rowDifferences: "specialRowDifferences",
  columnDifferences: "specialColumnDifferences",
  precedents: "specialPrecedents",
  dependents: "specialDependents",
  lastCell: "specialLastCell",
  visibleCells: "specialVisibleCells",
  conditionalFormats: "specialConditionalFormats",
  dataValidation: "specialDataValidation",
};

const KINDS: { kind: ValueKind; label: string }[] = [
  { kind: "numbers", label: "specialNumbers" },
  { kind: "text", label: "specialText" },
  { kind: "logicals", label: "specialLogicals" },
  { kind: "errors", label: "specialErrors" },
];

/**
 * Go To Special (Excel: Home > Find & Select > Go To Special, or Special...
 * in the Go To dialog). Kept under its FortuneSheet name for the toolbar.
 */
export const LocationCondition: React.FC<{}> = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const { findAndReplace, button } = locale(context);
  const text = findAndReplace as unknown as Record<string, string>;
  const [type, setType] = useState<GoToSpecialType>("constants");
  const [kinds, setKinds] = useState<Record<ValueKind, boolean>>({
    numbers: true,
    text: true,
    logicals: true,
    errors: true,
  });
  const [sameOnly, setSameOnly] = useState(false);

  const onConfirm = useCallback(() => {
    const options = { valueTypes: kinds, sameOnly };
    const found = getGoToSpecialRanges(context, type, options);
    hideDialog();
    if (found.length === 0) {
      showDialog(findAndReplace.locationTipNotFindCell, "ok");
      return;
    }
    setContext((ctx) => {
      applyGoToSpecial(ctx, type, options);
    });
  }, [
    context,
    findAndReplace.locationTipNotFindCell,
    hideDialog,
    kinds,
    sameOnly,
    setContext,
    showDialog,
    type,
  ]);

  const radio = (t: GoToSpecialType) => (
    <label className="listItem" key={t} htmlFor={`fortune-goto-special-${t}`}>
      <input
        type="radio"
        name="fortune-goto-special"
        id={`fortune-goto-special-${t}`}
        checked={type === t}
        onChange={() => setType(t)}
      />
      {text[LABEL_KEYS[t]]}
    </label>
  );

  const kindsEnabled = type === "constants" || type === "formulas";
  const sameEnabled =
    type === "conditionalFormats" || type === "dataValidation";

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      id="fortune-location-condition"
      role="group"
      aria-label={findAndReplace.gotoSpecialTitle}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm();
        }
      }}
    >
      <div className="title">{findAndReplace.gotoSpecialTitle}</div>
      <div className="listbox">
        <div className="column">
          {LEFT.map((t) => (
            <React.Fragment key={t}>
              {radio(t)}
              {t === "formulas" && (
                <div className="subbox">
                  {KINDS.map(({ kind, label }) => (
                    <label
                      className="subItem"
                      key={kind}
                      htmlFor={`fortune-goto-kind-${kind}`}
                      aria-disabled={!kindsEnabled}
                    >
                      <input
                        type="checkbox"
                        id={`fortune-goto-kind-${kind}`}
                        disabled={!kindsEnabled}
                        checked={kinds[kind]}
                        onChange={() =>
                          setKinds((k) => ({ ...k, [kind]: !k[kind] }))
                        }
                      />
                      {text[label]}
                    </label>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="column">
          {RIGHT.map((t) => radio(t))}
          <div className="subbox">
            {[false, true].map((same) => (
              <label
                className="subItem"
                key={String(same)}
                htmlFor={`fortune-goto-same-${same}`}
                aria-disabled={!sameEnabled}
              >
                <input
                  type="radio"
                  name="fortune-goto-same"
                  id={`fortune-goto-same-${same}`}
                  disabled={!sameEnabled}
                  checked={sameOnly === same}
                  onChange={() => setSameOnly(same)}
                />
                {same ? findAndReplace.specialSame : findAndReplace.specialAll}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="buttons">
        <div
          className="button-basic button-primary"
          onClick={onConfirm}
          onKeyDown={activateOnKey}
          role="button"
          tabIndex={0}
        >
          {button.confirm}
        </div>
        <div
          className="button-basic button-default"
          onClick={() => hideDialog()}
          onKeyDown={activateOnKey}
          role="button"
          tabIndex={0}
        >
          {button.cancel}
        </div>
      </div>
    </div>
  );
};
