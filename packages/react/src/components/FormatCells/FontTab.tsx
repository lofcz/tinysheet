import React, { useContext } from "react";
import { locale } from "@lofcz/tinysheet-core";
import type { FormatCellsState } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import ColorPalette from "./ColorPalette";

export type FontState = Pick<
  FormatCellsState,
  "ff" | "fs" | "bl" | "it" | "un" | "cl" | "fc"
>;

const EXTRA_FONTS = [
  "Calibri",
  "Cambria",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Segoe UI",
  "Trebuchet MS",
];

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

type Props = {
  state: FontState;
  onChange: (patch: Partial<FontState>) => void;
};

const FontTab: React.FC<Props> = ({ state, onChange }) => {
  const { context } = useContext(WorkbookContext);
  const { formatCells, fontarray } = locale(context);
  const fonts = Array.from(new Set([...fontarray, ...EXTRA_FONTS]));
  if (state.ff && !fonts.includes(state.ff)) fonts.unshift(state.ff);
  const styleValue = `${state.bl ? "b" : ""}${state.it ? "i" : ""}` || "r";

  return (
    <div className="fortune-fc-font">
      <div className="fortune-fc-font-row">
        <label
          className="fortune-fc-field fortune-fc-grow"
          htmlFor="fortune-fc-font-1"
        >
          <span>{formatCells.fontName}:</span>
          <select
            id="fortune-fc-font-1"
            value={state.ff}
            onChange={(e) => onChange({ ff: e.target.value })}
          >
            <option value="">{formatCells.automatic}</option>
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="fortune-fc-field" htmlFor="fortune-fc-font-2">
          <span>{formatCells.fontStyle}:</span>
          <select
            id="fortune-fc-font-2"
            value={styleValue}
            onChange={(e) =>
              onChange({
                bl: e.target.value.includes("b"),
                it: e.target.value.includes("i"),
              })
            }
          >
            <option value="r">{formatCells.regular}</option>
            <option value="i">{formatCells.italic}</option>
            <option value="b">{formatCells.bold}</option>
            <option value="bi">{formatCells.boldItalic}</option>
          </select>
        </label>
        <label className="fortune-fc-field" htmlFor="fortune-fc-font-3">
          <span>{formatCells.size}:</span>
          <input
            id="fortune-fc-font-3"
            type="number"
            min={1}
            max={409}
            list="fortune-fc-font-sizes"
            value={state.fs}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (n > 0 && n <= 409) onChange({ fs: n });
            }}
          />
          <datalist id="fortune-fc-font-sizes">
            {SIZES.map((s) => (
              <option key={s} value={s} aria-label={`${s}`} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="fortune-fc-font-row">
        <div className="fortune-fc-column">
          <label className="fortune-fc-field" htmlFor="fortune-fc-font-4">
            <span>{formatCells.underline}:</span>
            <select
              id="fortune-fc-font-4"
              value={state.un}
              onChange={(e) => onChange({ un: Number(e.target.value) })}
            >
              <option value={0}>{formatCells.none}</option>
              <option value={1}>{formatCells.underlineSingle}</option>
              <option value={2}>{formatCells.underlineDouble}</option>
            </select>
          </label>
          <fieldset className="fortune-fc-fieldset">
            <legend>{formatCells.effects}</legend>
            <label className="fortune-fc-check" htmlFor="fortune-fc-font-5">
              <input
                id="fortune-fc-font-5"
                type="checkbox"
                checked={state.cl}
                onChange={(e) => onChange({ cl: e.target.checked })}
              />
              {formatCells.strikethrough}
            </label>
          </fieldset>
          <fieldset className="fortune-fc-fieldset">
            <legend>{formatCells.preview}</legend>
            <div
              className="fortune-fc-font-preview"
              style={{
                fontFamily: state.ff || undefined,
                fontSize: `${Math.min(state.fs, 28)}pt`,
                fontWeight: state.bl ? 700 : 400,
                fontStyle: state.it ? "italic" : "normal",
                textDecoration:
                  [state.un ? "underline" : "", state.cl ? "line-through" : ""]
                    .filter(Boolean)
                    .join(" ") || undefined,
                textDecorationStyle: state.un === 2 ? "double" : undefined,
                color: state.fc || undefined,
              }}
            >
              AaBbCcYyZz
            </div>
          </fieldset>
        </div>
        <div className="fortune-fc-column">
          <div className="fortune-fc-label">{formatCells.color}</div>
          <ColorPalette
            idPrefix="fortune-fc-font-color"
            label={formatCells.color}
            value={state.fc}
            nullLabel={formatCells.automatic}
            onChange={(fc) => onChange({ fc })}
          />
        </div>
      </div>
    </div>
  );
};

export default FontTab;
