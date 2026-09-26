/**
 * Excel's reference box ("RefEdit"): a text field for a reference or a
 * literal, the collapse button that shrinks the dialog to this one field
 * while cells are picked on the sheet, and the `= 120, 135, …` preview of
 * what it refers to.
 */
import React, { useId } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { ICON_STROKE } from "../../ui";

export type RefEditProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** The field takes the sheet's selection (focused / last focused). */
  onActivate: () => void;
  /** Collapse (or, when `collapsed`, expand) the dialog. */
  onToggleCollapse: () => void;
  collapsed?: boolean;
  /** `= 120, 135, …` (Excel shows it right of the field). */
  preview?: string;
  invalid?: boolean;
  collapseLabel: string;
  expandLabel: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  testId?: string;
  disabled?: boolean;
};

export const RefEdit: React.FC<RefEditProps> = ({
  label,
  value,
  onChange,
  onActivate,
  onToggleCollapse,
  collapsed,
  preview,
  invalid,
  collapseLabel,
  expandLabel,
  inputRef,
  autoFocus,
  testId,
  disabled,
}) => {
  const id = useId();
  const Toggle = collapsed ? ArrowDownToLine : ArrowUpFromLine;
  const toggleLabel = collapsed ? expandLabel : collapseLabel;
  return (
    <div className="ts-refedit-field" data-testid={testId}>
      {!collapsed && (
        <label className="ts-refedit-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="ts-refedit-row">
        <div className={`ts-refedit${invalid ? " ts-refedit--invalid" : ""}`}>
          <input
            id={id}
            ref={inputRef}
            className="ts-refedit-input"
            value={value}
            spellCheck={false}
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            disabled={disabled}
            aria-label={collapsed ? label : undefined}
            aria-invalid={invalid || undefined}
            onFocus={onActivate}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="ts-refedit-toggle"
            aria-label={toggleLabel}
            title={toggleLabel}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onActivate();
              onToggleCollapse();
            }}
          >
            <Toggle size={14} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>
        {!collapsed && preview != null && (
          <span className="ts-refedit-preview" title={preview}>
            {preview}
          </span>
        )}
      </div>
    </div>
  );
};

export default RefEdit;
