import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ColorPicker, ICON_STROKE, Popover } from "../ui";

/**
 * A colour row of the Format pane: the label, a swatch that opens the
 * colour picker (Automatic resets to the chart style) and, for fills and
 * outlines, a "No Fill" / "No Outline" check box.
 * `onChange`: a colour, `undefined` (automatic) or `null` (none).
 */
export const ColorField: React.FC<{
  label: string;
  value?: string;
  none?: boolean;
  noneLabel?: string;
  autoLabel: string;
  disabled?: boolean;
  onChange: (value: string | null | undefined) => void;
}> = ({ label, value, none, noneLabel, autoLabel, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div className="fortune-chart-color-field">
      <span className="fortune-chart-color-label">{label}</span>
      <button
        ref={anchor}
        type="button"
        className="fortune-chart-color-button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`fortune-chart-color-swatch${
            none || !value ? " fortune-chart-color-swatch--empty" : ""
          }`}
          style={none || !value ? undefined : { background: value }}
        />
        <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
      {noneLabel && (
        <label className="fortune-chart-editor-check">
          <input
            type="checkbox"
            checked={!!none}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? null : undefined)}
          />
          {noneLabel}
        </label>
      )}
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchor}
        placement="bottom-start"
      >
        <ColorPicker
          aria-label={label}
          value={value ?? null}
          automaticLabel={autoLabel}
          moreColors
          onChange={(color) => {
            onChange(color ?? undefined);
            setOpen(false);
          }}
        />
      </Popover>
    </div>
  );
};

export default ColorField;
