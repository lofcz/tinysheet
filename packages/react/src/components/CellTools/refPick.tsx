import {
  cellToolsLocale,
  locale,
  refText,
  Selection,
} from "@lofcz/tinysheet-core";
import React, { useContext, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import WorkbookContext from "../../context";
import { SquareDashedMousePointer, X } from "lucide-react";
import { Button, IconButton, ICON_STROKE } from "../ui";
import { activateOnKey } from "../Toolbar/Button";

/*
 * Excel's collapsible reference fields: the dialog steps aside while the
 * user selects a range on the sheet, a small bar shows the reference, and
 * the dialog comes back with the field filled.
 */

type Pick = {
  label: string;
  /** Called with the picked reference, or null when cancelled. */
  onDone: (ref: string | null) => void;
};

let current: Pick | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startRefPick(pick: Pick) {
  current = pick;
  emit();
}

function endRefPick(ref: string | null) {
  const pick = current;
  current = null;
  emit();
  pick?.onDone(ref);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;

/** The reference of the current selection ("$A$1:$C$9"). */
export function selectionRefText(
  context: Parameters<typeof refText>[0],
  sel?: Selection
) {
  const s =
    sel ??
    context.luckysheet_select_save?.[
      (context.luckysheet_select_save?.length ?? 1) - 1
    ];
  if (!s) return "";
  return refText(context, { row: s.row, column: s.column });
}

/** The bar shown while picking (a sheet overlay). */
export const RefPickBar: React.FC = () => {
  const pick = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { context, refs } = useContext(WorkbookContext);
  const { button } = locale(context);
  const container = refs.workbookContainer.current;
  if (!pick || !container) return null;
  const ref = selectionRefText(context);
  const t = cellToolsLocale(context);
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-cell-tools-pick"
      role="dialog"
      aria-label={pick.label}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="fortune-cell-tools-pick-label">{pick.label}</span>
      <span className="fortune-cell-tools-pick-ref" aria-live="polite">
        {ref}
      </span>
      <Button size="sm" variant="primary" onClick={() => endRefPick(ref)}>
        {t.goalSeek.ok}
      </Button>
      <IconButton
        size="sm"
        icon={X}
        label={button.cancel}
        className="fortune-cell-tools-pick-close"
        onClick={() => endRefPick(null)}
      />
    </div>,
    container
  );
};

/** A labelled reference input with a "select on the sheet" button. */
export const RefField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Collapse the dialog and pick on the sheet; `resume` reopens it. */
  onPick?: () => void;
  disabled?: boolean;
  id: string;
}> = ({ label, value, onChange, onPick, disabled, id }) => (
  <div className="fortune-dt-field">
    <label className="fortune-dt-label" htmlFor={id}>
      {label}
    </label>
    <div className="fortune-dt-input-group">
      <input
        id={id}
        className="fortune-dt-input"
        value={value}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      {onPick && !disabled && (
        <div
          className="fortune-dt-picker"
          role="button"
          tabIndex={0}
          aria-label={label}
          title={label}
          onKeyDown={activateOnKey}
          onClick={onPick}
        >
          <SquareDashedMousePointer size={16} strokeWidth={ICON_STROKE} />
        </div>
      )}
    </div>
  </div>
);
