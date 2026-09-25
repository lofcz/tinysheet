import React, { useId } from "react";
import "./ui.css";

export type CheckboxProps = {
  checked: boolean | "mixed";
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Checkbox: a native input (so forms, labels and keyboard work) drawn as
 * Fika's ink box with a check (or a dash when `mixed`).
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
  ...rest
}) => {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      className={[
        "ts-checkbox",
        checked === "mixed" ? "ts-checkbox--mixed" : "",
        disabled ? "ts-checkbox--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked === true}
        ref={(el) => {
          if (el) el.indeterminate = checked === "mixed";
        }}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ts-checkbox-box" aria-hidden="true" />
      {label != null && <span className="ts-checkbox-label">{label}</span>}
    </label>
  );
};

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** On / off switch (role="switch"), ink when on. */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled,
  className,
  ...rest
}) => (
  <label
    className={[
      "ts-switch",
      checked ? "ts-switch--on" : "",
      disabled ? "ts-switch--disabled" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      className="ts-switch-track"
      onClick={() => onChange(!checked)}
    >
      <span className="ts-switch-thumb" />
    </button>
    {label != null && <span className="ts-switch-label">{label}</span>}
  </label>
);

/** A 1px divider: between menu sections, toolbar clusters, pane blocks. */
export const Separator: React.FC<{
  orientation?: "horizontal" | "vertical";
  className?: string;
}> = ({ orientation = "horizontal", className }) => (
  <div
    role="separator"
    aria-orientation={orientation}
    className={`ts-separator ts-separator--${orientation}${
      className ? ` ${className}` : ""
    }`}
  />
);
