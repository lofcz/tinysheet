import React, { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ICON_STROKE } from "./icons";
import { DropdownMenu, MenuItem } from "./Menu";
import { Tooltip } from "./Tooltip";
import "./ui.css";

export type SelectOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  /** Text shown in the closed field when `label` is not plain text. */
  text?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  /** Render the option in its own style (font names in their typeface). */
  style?: React.CSSProperties;
};

export type SelectProps<T extends string = string> = {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name (also the tooltip when `tooltip` is set). */
  "aria-label": string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Width of the field (px); the list may be wider. */
  width?: number;
  tooltip?: boolean;
  className?: string;
  /** Items after the options (e.g. "More Number Formats…"). */
  footer?: MenuItem[];
};

/**
 * A select: a surface field showing the value and a chevron, opening a
 * menu of radio items (the chosen one checked and focused).
 */
export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  size = "md",
  width,
  tooltip,
  className,
  footer,
  ...rest
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);
  const label = rest["aria-label"];
  const items: MenuItem[] = options.map((o) => ({
    id: o.value,
    label: <span style={o.style}>{o.label}</span>,
    hint: o.hint,
    disabled: o.disabled,
    checked: o.value === value,
    radio: true,
    onSelect: () => onChange(o.value),
  }));
  if (footer?.length) items.push({ type: "separator" }, ...footer);
  const field = (
    <button
      ref={anchorRef}
      type="button"
      className={[
        "ts-select",
        size === "sm" ? "ts-select--sm" : "",
        open ? "ts-open" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={width ? { width } : undefined}
      aria-label={
        current ? `${label}: ${current.text ?? current.value}` : label
      }
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      <span className="ts-select-value">
        {current ? (
          (current.text ?? current.label)
        ) : (
          <span className="ts-select-placeholder">{placeholder}</span>
        )}
      </span>
      <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  );
  return (
    <>
      {tooltip ? (
        <Tooltip label={label} disabled={open}>
          {field}
        </Tooltip>
      ) : (
        field
      )}
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        items={items}
        // the chosen option gets the focus, as in a native select
        autoFocus
        minWidth={width}
        aria-label={label}
        className="ts-select-menu"
      />
    </>
  );
}

export type ComboProps = {
  /** The current value (shown when not typing). */
  value: string;
  /** Suggestions in the list. */
  options: SelectOption[];
  /** A picked option or typed text (Enter / blur with a changed draft). */
  onCommit: (value: string) => void;
  "aria-label": string;
  width?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  tooltip?: boolean;
  className?: string;
  /** Called after committing (e.g. give the keyboard back to the sheet). */
  onDone?: () => void;
};

/**
 * Editable combo box (Excel's font size / zoom box): type a value and press
 * Enter, or open the list with the arrow / Alt+ArrowDown. Escape reverts.
 */
export const Combo: React.FC<ComboProps> = ({
  value,
  options,
  onCommit,
  width,
  size = "md",
  disabled,
  tooltip,
  className,
  onDone,
  ...rest
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const label = rest["aria-label"];
  const items: MenuItem[] = options.map((o) => ({
    id: o.value,
    label: <span style={o.style}>{o.label}</span>,
    hint: o.hint,
    checked: o.value === value,
    radio: true,
    onSelect: () => {
      onCommit(o.value);
      onDone?.();
    },
  }));
  const field = (
    <div
      ref={anchorRef}
      className={[
        "ts-combo",
        size === "sm" ? "ts-select--sm" : "",
        open ? "ts-open" : "",
        disabled ? "ts-input--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={width ? { width } : undefined}
    >
      <input
        role="combobox"
        aria-label={label}
        aria-controls={listId}
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        value={draft ?? value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (draft != null && draft !== value) onCommit(draft);
            setDraft(null);
            onDone?.();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
            onDone?.();
          } else if (e.key === "ArrowDown" && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <button
        type="button"
        className="ts-combo-arrow"
        tabIndex={-1}
        aria-label={`${label}: open list`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </div>
  );
  return (
    <>
      {tooltip ? (
        <Tooltip label={label} disabled={open}>
          {field}
        </Tooltip>
      ) : (
        field
      )}
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        items={items}
        minWidth={width}
        id={listId}
        aria-label={label}
        className="ts-select-menu"
      />
    </>
  );
};

export default Select;
