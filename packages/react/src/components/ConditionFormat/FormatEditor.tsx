import React, { useId } from "react";
import type { CFStyle } from "@lofcz/tinysheet-core";
import { CFText, RuleFormatPreview } from "./previews";

/** Excel's ready-made highlight formats. */
export const FORMAT_PRESETS: { key: string; style: CFStyle }[] = [
  {
    key: "presetLightRed",
    style: { cellColor: "#FFC7CE", textColor: "#9C0006" },
  },
  {
    key: "presetYellow",
    style: { cellColor: "#FFEB9C", textColor: "#9C5700" },
  },
  {
    key: "presetGreen",
    style: { cellColor: "#C6EFCE", textColor: "#006100" },
  },
  { key: "presetLightRedFill", style: { cellColor: "#FFC7CE" } },
  { key: "presetRedText", style: { textColor: "#9C0006" } },
  { key: "presetRedBorder", style: { borderColor: "#9C0006" } },
];

const COLOR_FIELDS: {
  key: "textColor" | "cellColor" | "borderColor";
  label: string;
  fallback: string;
}[] = [
  { key: "textColor", label: "fontColor", fallback: "#9C0006" },
  { key: "cellColor", label: "fillColor", fallback: "#FFC7CE" },
  { key: "borderColor", label: "borderColorLabel", fallback: "#9C0006" },
];

const FLAGS: {
  key: "bold" | "italic" | "underline" | "strikethrough";
  label: string;
}[] = [
  { key: "bold", label: "boldLabel" },
  { key: "italic", label: "italicLabel" },
  { key: "underline", label: "underlineLabel" },
  { key: "strikethrough", label: "strikethroughLabel" },
];

function toHexColor(c: string | null | undefined, fallback: string) {
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return c;
  return fallback;
}

/** The "Format..." part of a highlight rule: colours, font, border, number format. */
const FormatEditor: React.FC<{
  value: CFStyle;
  onChange: (style: CFStyle) => void;
  text: CFText;
}> = ({ value, onChange, text }) => {
  const id = useId();
  const set = (patch: Partial<CFStyle>) => {
    const next: any = { ...value, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === undefined || next[k] === false) {
        delete next[k];
      }
    });
    onChange(next);
  };
  return (
    <div className="fortune-cf-format">
      <div className="fortune-cf-format-grid">
        {COLOR_FIELDS.map((f) => {
          const on = !!value[f.key];
          return (
            <div className="fortune-cf-format-row" key={f.key}>
              <input
                id={`${id}-${f.key}`}
                type="checkbox"
                checked={on}
                onChange={(e) =>
                  set({ [f.key]: e.target.checked ? f.fallback : null })
                }
              />
              <label htmlFor={`${id}-${f.key}`}>{text[f.label]}</label>
              <input
                type="color"
                className="fortune-cf-color"
                aria-label={text[f.label]}
                disabled={!on}
                value={toHexColor(value[f.key], f.fallback)}
                onChange={(e) => set({ [f.key]: e.target.value })}
              />
            </div>
          );
        })}
        <div className="fortune-cf-format-flags">
          {FLAGS.map((f) => (
            <label
              key={f.key}
              className="fortune-cf-check"
              htmlFor={`${id}-${f.key}`}
            >
              <input
                id={`${id}-${f.key}`}
                type="checkbox"
                checked={!!value[f.key]}
                onChange={(e) => set({ [f.key]: e.target.checked })}
              />
              <span
                style={{
                  fontWeight: f.key === "bold" ? 700 : undefined,
                  fontStyle: f.key === "italic" ? "italic" : undefined,
                  textDecoration:
                    // eslint-disable-next-line no-nested-ternary
                    f.key === "underline"
                      ? "underline"
                      : f.key === "strikethrough"
                      ? "line-through"
                      : undefined,
                }}
              >
                {text[f.label]}
              </span>
            </label>
          ))}
        </div>
        <div className="fortune-cf-format-row">
          <label htmlFor={`${id}-numfmt`}>{text.numberFormatLabel}</label>
          <input
            id={`${id}-numfmt`}
            className="fortune-cf-input"
            type="text"
            placeholder="0.00"
            value={value.numberFormat ?? ""}
            onChange={(e) => set({ numberFormat: e.target.value || null })}
          />
        </div>
      </div>
      <div className="fortune-cf-format-preview">
        <span className="fortune-cf-label">{text.previewLabel}</span>
        <RuleFormatPreview
          rule={{ type: "default", cellrange: [], format: value }}
          text={text}
        />
      </div>
    </div>
  );
};

export default FormatEditor;
