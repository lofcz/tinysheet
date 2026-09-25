import React, { useContext } from "react";
import { locale } from "@lofcz/tinysheet-core";
import type { FormatCellsState } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

export type AlignmentState = Pick<
  FormatCellsState,
  "ht" | "vt" | "wrap" | "shrink" | "indent" | "rotation" | "merge"
>;

type Props = {
  state: AlignmentState;
  onChange: (patch: Partial<AlignmentState>) => void;
};

const AlignmentTab: React.FC<Props> = ({ state, onChange }) => {
  const { context } = useContext(WorkbookContext);
  const { formatCells } = locale(context);
  const vertical = state.rotation === "vertical";
  const degrees = vertical ? 0 : (state.rotation as number);
  const indentable = state.ht === "1" || state.ht === "2";

  return (
    <div className="fortune-fc-alignment">
      <div className="fortune-fc-column">
        <fieldset className="fortune-fc-fieldset">
          <legend>{formatCells.textAlignment}</legend>
          <label className="fortune-fc-field" htmlFor="fortune-fc-align-1">
            <span>{formatCells.horizontal}:</span>
            <select
              id="fortune-fc-align-1"
              value={state.ht}
              onChange={(e) => {
                const ht = e.target.value as AlignmentState["ht"];
                onChange({
                  ht,
                  indent: ht === "1" || ht === "2" ? state.indent : 0,
                });
              }}
            >
              <option value="general">{formatCells.alignGeneral}</option>
              <option value="1">{formatCells.alignLeft}</option>
              <option value="0">{formatCells.alignCenter}</option>
              <option value="2">{formatCells.alignRight}</option>
            </select>
          </label>
          <label className="fortune-fc-field" htmlFor="fortune-fc-align-2">
            <span>{formatCells.indent}:</span>
            <input
              id="fortune-fc-align-2"
              type="number"
              min={0}
              max={15}
              value={state.indent}
              onChange={(e) => {
                const n = Math.max(
                  0,
                  Math.min(15, parseInt(e.target.value, 10) || 0)
                );
                // like Excel, indenting General text aligns it left
                onChange({
                  indent: n,
                  ht: n > 0 && !indentable ? "1" : state.ht,
                });
              }}
            />
          </label>
          <label className="fortune-fc-field" htmlFor="fortune-fc-align-3">
            <span>{formatCells.vertical}:</span>
            <select
              id="fortune-fc-align-3"
              value={state.vt}
              onChange={(e) =>
                onChange({ vt: e.target.value as AlignmentState["vt"] })
              }
            >
              <option value="1">{formatCells.alignTop}</option>
              <option value="0">{formatCells.alignMiddle}</option>
              <option value="2">{formatCells.alignBottom}</option>
            </select>
          </label>
        </fieldset>
        <fieldset className="fortune-fc-fieldset">
          <legend>{formatCells.textControl}</legend>
          <label className="fortune-fc-check" htmlFor="fortune-fc-align-4">
            <input
              id="fortune-fc-align-4"
              type="checkbox"
              checked={state.wrap}
              onChange={(e) =>
                onChange({
                  wrap: e.target.checked,
                  shrink: e.target.checked ? false : state.shrink,
                })
              }
            />
            {formatCells.wrapText}
          </label>
          <label className="fortune-fc-check" htmlFor="fortune-fc-align-5">
            <input
              id="fortune-fc-align-5"
              type="checkbox"
              checked={state.shrink}
              disabled={state.wrap}
              onChange={(e) => onChange({ shrink: e.target.checked })}
            />
            {formatCells.shrinkToFit}
          </label>
          <label className="fortune-fc-check" htmlFor="fortune-fc-align-6">
            <input
              id="fortune-fc-align-6"
              type="checkbox"
              checked={state.merge}
              onChange={(e) => onChange({ merge: e.target.checked })}
            />
            {formatCells.mergeCells}
          </label>
        </fieldset>
      </div>
      <fieldset className="fortune-fc-fieldset fortune-fc-orientation">
        <legend>{formatCells.orientation}</legend>
        <div className="fortune-fc-orientation-dial" aria-hidden="true">
          <span
            className="fortune-fc-orientation-text"
            style={{
              transform: vertical ? undefined : `rotate(${-degrees}deg)`,
              writingMode: vertical ? "vertical-rl" : undefined,
              textOrientation: vertical ? "upright" : undefined,
            }}
          >
            {formatCells.categories.text}
          </span>
        </div>
        <input
          type="range"
          min={-90}
          max={90}
          step={1}
          value={degrees}
          disabled={vertical}
          aria-label={formatCells.degrees}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
        />
        <label className="fortune-fc-field" htmlFor="fortune-fc-align-7">
          <input
            id="fortune-fc-align-7"
            type="number"
            min={-90}
            max={90}
            value={degrees}
            disabled={vertical}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10) || 0;
              onChange({ rotation: Math.max(-90, Math.min(90, n)) });
            }}
          />
          <span>{formatCells.degrees}</span>
        </label>
        <label className="fortune-fc-check" htmlFor="fortune-fc-align-8">
          <input
            id="fortune-fc-align-8"
            type="checkbox"
            checked={vertical}
            onChange={(e) =>
              onChange({ rotation: e.target.checked ? "vertical" : 0 })
            }
          />
          {formatCells.verticalText}
        </label>
      </fieldset>
    </div>
  );
};

export default AlignmentTab;
