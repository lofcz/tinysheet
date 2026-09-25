import React, { useContext, useMemo } from "react";
import { locale, applyCellStyle, getCellStyles } from "@lofcz/tinysheet-core";
import type {
  BorderLine,
  CellStyleDef,
  CellStyleId,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import "./index.css";

const GROUPS: CellStyleDef["group"][] = ["goodBad", "data", "titles", "number"];

function cssBorder(line: BorderLine | null | undefined) {
  if (!line) return undefined;
  if (line.style === "7") return `3px double ${line.color}`;
  const width = { "8": 2, "13": 3 }[line.style] ?? 1;
  return `${width}px solid ${line.color}`;
}

/** How a style's swatch looks: the style applied to its name. */
function swatchStyle(style: CellStyleDef): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.fill) css.backgroundColor = style.fill;
  if (style.font?.fc) css.color = style.font.fc;
  if (style.font?.bl) css.fontWeight = 700;
  if (style.font?.it) css.fontStyle = "italic";
  if (style.font?.fs) css.fontSize = `${Math.min(style.font.fs, 12)}pt`;
  if (style.border) {
    css.borderTop = cssBorder(style.border.top);
    css.borderBottom = cssBorder(style.border.bottom);
    css.borderLeft = cssBorder(style.border.left);
    css.borderRight = cssBorder(style.border.right);
  }
  return css;
}

/**
 * Excel's Cell Styles gallery: a click applies the style to the selection
 * (one undo step).
 */
const CellStyles: React.FC<{ onApplied?: () => void }> = ({ onApplied }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { cellStyles } = locale(context);
  const currency = context.currency || "$";
  const styles = useMemo(() => getCellStyles(currency), [currency]);

  const apply = (id: CellStyleId) => {
    const canvas = refs.canvas.current?.getContext("2d") || undefined;
    setContext((ctx) => applyCellStyle(ctx, id, currency, canvas));
    onApplied?.();
  };

  return (
    <div
      className="fortune-cell-styles"
      role="menu"
      aria-label={cellStyles.title}
    >
      {GROUPS.map((group) => (
        <div key={group} className="fortune-cell-styles-group">
          <div className="fortune-cell-styles-heading">
            {cellStyles.groups[group]}
          </div>
          <div className="fortune-cell-styles-grid">
            {styles
              .filter((s) => s.group === group)
              .map((s) => (
                <button
                  type="button"
                  key={s.id}
                  role="menuitem"
                  data-style={s.id}
                  className={`fortune-cell-style${s.fill ? " has-fill" : ""}${
                    s.font?.fc ? " has-color" : ""
                  }`}
                  style={swatchStyle(s)}
                  title={cellStyles.names[s.id]}
                  onClick={() => apply(s.id)}
                >
                  {cellStyles.names[s.id]}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CellStyles;
