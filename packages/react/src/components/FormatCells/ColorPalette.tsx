import React, { useContext, useMemo } from "react";
import { locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/** Office theme colours (first row), as in Excel's colour pickers. */
const THEME_BASE = [
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

/** Excel's standard colours. */
const STANDARD = [
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFFF00",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0",
];

function hex(n: number) {
  return Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Lighten (p > 0) or darken (p < 0) a colour by a fraction. */
function tint(color: string, p: number) {
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const out = rgb.map((c) => (p > 0 ? c + (255 - c) * p : c * (1 + p)));
  return `#${out.map(hex).join("")}`;
}

/** Tint/shade steps Excel shows under each theme colour. */
function themeColumn(base: string, index: number) {
  let steps = [0.8, 0.6, 0.4, -0.25, -0.5];
  if (index === 0) steps = [-0.05, -0.15, -0.25, -0.35, -0.5];
  if (index === 1) steps = [0.5, 0.35, 0.25, 0.15, 0.05];
  if (index === 2) steps = [-0.1, -0.25, -0.5, -0.75, -0.9];
  return steps.map((p) => tint(base, p));
}

type Props = {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  /** Prefix for element ids (unique per palette on the page). */
  idPrefix: string;
  /** Label of the "no colour" choice (Automatic / No Color). */
  nullLabel: string;
  label?: string;
};

/** Theme and standard colour grid with a "no colour" and custom choice. */
const ColorPalette: React.FC<Props> = ({
  value,
  onChange,
  nullLabel,
  label,
  idPrefix,
}) => {
  const { context } = useContext(WorkbookContext);
  const { formatCells } = locale(context);
  const columns = useMemo(
    () => THEME_BASE.map((c, i) => [c, ...themeColumn(c, i)]),
    []
  );
  const selected = value?.toUpperCase();
  const swatch = (color: string) => (
    <button
      type="button"
      key={color}
      className={`fortune-fc-swatch${
        selected === color.toUpperCase() ? " selected" : ""
      }`}
      style={{ backgroundColor: color }}
      title={color}
      aria-label={color}
      aria-pressed={selected === color.toUpperCase()}
      onClick={() => onChange(color)}
    />
  );
  return (
    <div className="fortune-fc-palette" role="group" aria-label={label}>
      <button
        type="button"
        className={`fortune-fc-palette-none${value ? "" : " selected"}`}
        aria-pressed={!value}
        onClick={() => onChange(null)}
      >
        {nullLabel}
      </button>
      <div className="fortune-fc-palette-title">{formatCells.themeColors}</div>
      <div className="fortune-fc-palette-grid">
        {columns.map((col, i) => (
          <div className="fortune-fc-palette-col" key={i}>
            {col.map(swatch)}
          </div>
        ))}
      </div>
      <div className="fortune-fc-palette-title">
        {formatCells.standardColors}
      </div>
      <div className="fortune-fc-palette-row">{STANDARD.map(swatch)}</div>
      <label className="fortune-fc-palette-more" htmlFor={`${idPrefix}-more`}>
        <span>{formatCells.moreColors}</span>
        <input
          id={`${idPrefix}-more`}
          type="color"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
};

export default ColorPalette;
