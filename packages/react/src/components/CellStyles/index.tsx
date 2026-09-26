import React, { useContext, useMemo } from "react";
import { locale, applyCellStyle, getCellStyles } from "@lofcz/tinysheet-core";
import type {
  BorderLine,
  CellStyleDef,
  CellStyleId,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { Gallery, GalleryItem } from "../ui";
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

/** The Cell Styles gallery items (id = the style id), grouped like Excel. */
export function useCellStyleItems(): GalleryItem[] {
  const { context } = useContext(WorkbookContext);
  const { cellStyles } = locale(context);
  const currency = context.currency || "$";
  return useMemo(() => {
    const styles = getCellStyles(currency);
    return GROUPS.flatMap((group) =>
      styles
        .filter((s) => s.group === group)
        .map((s) => ({
          id: s.id,
          label: cellStyles.names[s.id],
          group: cellStyles.groups[group],
          preview: (
            <span
              className={`fortune-cell-style${s.fill ? " has-fill" : ""}${
                s.font?.fc ? " has-color" : ""
              }`}
              data-style={s.id}
              style={swatchStyle(s)}
            >
              {cellStyles.names[s.id]}
            </span>
          ),
        }))
    );
  }, [cellStyles, currency]);
}

/**
 * Excel's Cell Styles gallery (Home › Styles): a click applies the style to
 * the selection (one undo step). `bare` drops the panel chrome, for use
 * inside a ui `Popover`:
 *
 *   <SplitButton … popover={(close) => <CellStyles bare onApplied={close} />} />
 */
const CellStyles: React.FC<{ onApplied?: () => void; bare?: boolean }> = ({
  onApplied,
  bare,
}) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { cellStyles } = locale(context);
  const currency = context.currency || "$";
  const items = useCellStyleItems();

  const apply = (id: string) => {
    const canvas = refs.canvas.current?.getContext("2d") || undefined;
    setContext((ctx) =>
      applyCellStyle(ctx, id as CellStyleId, currency, canvas)
    );
    onApplied?.();
  };

  return (
    <div
      className={`fortune-cell-styles${bare ? " fortune-cell-styles--bare" : ""}`}
    >
      <Gallery
        items={items}
        onPick={apply}
        columns={4}
        itemWidth={104}
        itemHeight={30}
        maxHeight={380}
        autoFocus
        aria-label={cellStyles.title}
      />
    </div>
  );
};

export default CellStyles;
