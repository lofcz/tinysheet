import React, { useId } from "react";
import "./ui.css";
import "./form.css";

export type RadioProps = {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  name?: string;
  value?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Radio button: a native input (arrow keys move within its `name` group)
 * drawn as Fika's ink dot.
 */
export const Radio: React.FC<RadioProps> = ({
  checked,
  onChange,
  label,
  name,
  value,
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
        "ts-radio",
        disabled ? "ts-radio--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        onChange={() => onChange()}
      />
      {label != null && <span className="ts-radio-label">{label}</span>}
    </label>
  );
};

export type FieldProps = {
  label: React.ReactNode;
  /** The control's id (the label's `for`). */
  htmlFor?: string;
  /** Label above the control instead of left of it. */
  stacked?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * A labelled form row (Fika's `.field`): a 12px muted label left of the
 * control (42% wide), or above it when `stacked`.
 */
export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  stacked,
  className,
  children,
}) => (
  <div
    className={["ts-field", stacked ? "ts-field--stacked" : "", className ?? ""]
      .filter(Boolean)
      .join(" ")}
  >
    {htmlFor ? (
      <label className="ts-field-label" htmlFor={htmlFor}>
        {label}
      </label>
    ) : (
      <span className="ts-field-label">{label}</span>
    )}
    <div className="ts-field-control">{children}</div>
  </div>
);

export type SectionProps = {
  /** Small-caps heading ("THEMES", "BACKGROUND", ...). */
  label?: React.ReactNode;
  /** Right side of the heading (a link, a reset button). */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  /** role="group" labelled by the heading (a group box of a dialog). */
  group?: boolean;
};

/**
 * A pane / dialog section (Fika's PanelSection): an 11px uppercase muted
 * heading and a column of rows; consecutive sections are divided by a line.
 */
export const Section: React.FC<SectionProps> = ({
  label,
  action,
  className,
  children,
  group = true,
}) => {
  const id = useId();
  return (
    <section
      className={`ts-section${className ? ` ${className}` : ""}`}
      role={group && label ? "group" : undefined}
      aria-labelledby={group && label ? id : undefined}
    >
      {(label != null || action != null) && (
        <div className="ts-section-header">
          {label != null && (
            <div className="ts-section-label" id={id}>
              {label}
            </div>
          )}
          {action != null && <div className="ts-section-action">{action}</div>}
        </div>
      )}
      <div className="ts-section-body">{children}</div>
    </section>
  );
};

export type SwatchProps = {
  color: string | null | undefined;
  selected?: boolean;
  onClick?: () => void;
  label: string;
  size?: number;
};

/** Office theme colours: the default row of a SwatchRow. */
export const THEME_SWATCHES = [
  "#FFFFFF",
  "#000000",
  "#E7E6E6",
  "#44546A",
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];

export type SwatchRowProps = {
  /** The current colour (#RRGGBB, any case), or null for none. */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  colors?: string[];
  /** Adds a "no colour" chip first. */
  noneLabel?: string;
  /** Label of the custom colour chip (a native colour picker). */
  customLabel: string;
  "aria-label": string;
  disabled?: boolean;
};

/**
 * A row of colour chips (Fika's swatch row) with a custom colour chip at
 * the end; the chosen colour has the ink ring. Colours are reported as
 * upper-case #RRGGBB.
 */
export const SwatchRow: React.FC<SwatchRowProps> = ({
  value,
  onChange,
  colors = THEME_SWATCHES,
  noneLabel,
  customLabel,
  disabled,
  ...rest
}) => {
  const current = value ? value.toUpperCase() : null;
  const known = current == null || colors.includes(current);
  return (
    <div
      className={`ts-swatch-row${disabled ? " ts-swatch-row--disabled" : ""}`}
      role="group"
      aria-label={rest["aria-label"]}
    >
      {noneLabel != null && (
        <Swatch
          color={null}
          label={noneLabel}
          selected={current == null}
          onClick={() => onChange(null)}
        />
      )}
      {colors.map((c) => (
        <Swatch
          key={c}
          color={c}
          label={c}
          selected={current === c}
          onClick={() => onChange(c)}
        />
      ))}
      <label
        className={`ts-swatch ts-swatch--custom${
          !known ? " ts-swatch--selected" : ""
        }`}
        title={customLabel}
        style={
          !known && current
            ? { width: 20, height: 20, background: current }
            : { width: 20, height: 20 }
        }
      >
        <input
          type="color"
          aria-label={customLabel}
          value={(current ?? "#000000").toLowerCase()}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </label>
    </div>
  );
};

/** A colour chip (Fika's swatch): ink ring when selected. */
export const Swatch: React.FC<SwatchProps> = ({
  color,
  selected,
  onClick,
  label,
  size = 20,
}) => (
  <button
    type="button"
    className={`ts-swatch${selected ? " ts-swatch--selected" : ""}${
      color ? "" : " ts-swatch--none"
    }`}
    style={{ width: size, height: size, background: color || undefined }}
    aria-label={label}
    aria-pressed={selected}
    title={label}
    onClick={onClick}
  />
);
