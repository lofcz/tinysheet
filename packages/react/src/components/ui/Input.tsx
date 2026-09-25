import React, { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ICON_STROKE } from "./icons";
import "./ui.css";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "prefix"
> & {
  /** Leading adornment (an icon, a unit). */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: "sm" | "md";
  /** Marks the value invalid (aria-invalid, danger ring). */
  invalid?: boolean;
};

/**
 * Text input: surface fill, 8px radius, no border until focused (then a
 * ring), optional prefix / suffix inside the field.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, size = "md", invalid, className, ...rest }, ref) => (
    <div
      className={[
        "ts-input",
        size === "sm" ? "ts-input--sm" : "",
        invalid ? "ts-input--invalid" : "",
        rest.disabled ? "ts-input--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {prefix != null && <span className="ts-input-affix">{prefix}</span>}
      <input ref={ref} aria-invalid={invalid || undefined} {...rest} />
      {suffix != null && <span className="ts-input-affix">{suffix}</span>}
    </div>
  )
);
Input.displayName = "Input";

export type NumberInputProps = {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimals kept when stepping (defaults to the step's). */
  precision?: number;
  suffix?: React.ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
  id?: string;
  className?: string;
  /** Width of the field (px). */
  width?: number;
};

const clamp = (v: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

/**
 * Number field with − / + steppers (Fika's NumberInput): ArrowUp / Down
 * step, Enter / blur commit the typed value (clamped), Escape reverts.
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
  suffix,
  disabled,
  size = "md",
  className,
  width,
  id,
  ...rest
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);
  const decimals =
    precision ??
    (String(step).includes(".") ? String(step).split(".")[1].length : 0);
  const round = (v: number) => Number(v.toFixed(decimals));
  const commit = (text: string) => {
    const n = Number(text.trim().replace(",", "."));
    if (text.trim() !== "" && Number.isFinite(n))
      onChange(round(clamp(n, min, max)));
    setDraft(null);
  };
  const stepBy = (dir: 1 | -1) => {
    const base = draft != null ? Number(draft) : (value ?? 0);
    onChange(
      round(clamp((Number.isFinite(base) ? base : 0) + dir * step, min, max))
    );
    setDraft(null);
  };
  return (
    <div
      className={[
        "ts-input",
        "ts-number",
        size === "sm" ? "ts-input--sm" : "",
        disabled ? "ts-input--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={width ? { width } : undefined}
    >
      <button
        type="button"
        className="ts-number-step"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || (min != null && value != null && value <= min)}
        onClick={() => stepBy(-1)}
      >
        <Minus size={14} strokeWidth={ICON_STROKE} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={rest["aria-label"]}
        aria-valuenow={value ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        disabled={disabled}
        value={draft ?? (value == null ? "" : String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft != null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            stepBy(e.key === "ArrowUp" ? 1 : -1);
          } else if (e.key === "Enter") {
            if (draft != null) commit(draft);
          } else if (e.key === "Escape" && draft != null) {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {suffix != null && <span className="ts-input-affix">{suffix}</span>}
      <button
        type="button"
        className="ts-number-step"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || (max != null && value != null && value >= max)}
        onClick={() => stepBy(1)}
      >
        <Plus size={14} strokeWidth={ICON_STROKE} />
      </button>
    </div>
  );
};

export default Input;
