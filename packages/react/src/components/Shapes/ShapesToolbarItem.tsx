import React, { useContext } from "react";
import {
  arrowHeadPath,
  clearShapeSelection,
  insertShape,
  locale,
  presetOutline,
  SHAPE_GALLERY,
  ShapeGalleryItem,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Combo from "../Toolbar/Combo";

export const SHAPES_TOOLBAR_ICON = "fortune-insert-shapes";

const CATEGORIES: ShapeGalleryItem["category"][] = [
  "text",
  "lines",
  "basic",
  "arrows",
  "callouts",
  "stars",
];

/** Small picture of a gallery item. */
export const ShapePresetIcon: React.FC<{ item: ShapeGalleryItem }> = ({
  item,
}) => {
  if (item.textBox) {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect
          x="2.5"
          y="3.5"
          width="17"
          height="15"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M7 15 L11 6 L15 15 M8.6 12 H13.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    );
  }
  const line = item.category === "lines";
  const w = 16;
  const h = line ? 16 : 13;
  const outline = presetOutline(item.prst, w, h);
  const heads: string[] = [];
  if (outline.ends) {
    if (item.head) heads.push(arrowHeadPath(outline.ends.start, 1));
    if (item.tail) heads.push(arrowHeadPath(outline.ends.end, 1));
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <g transform={`translate(3,${line ? 3 : 4.5})`}>
        <path
          d={outline.d}
          fill={outline.open ? "none" : "currentColor"}
          fillOpacity={outline.open ? undefined : 0.18}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {heads.map((d) => (
          <path key={d} d={d} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
};

/**
 * Toolbar "Shapes" (Insert › Shapes): a gallery of preset shapes and the
 * text box. Picking one arms the draw mode (drag on the sheet to draw it,
 * Shift keeps the proportions); Enter on an item inserts it at the
 * selected cell with the default size instead.
 */
const ShapesToolbarItem: React.FC<{ tooltip?: string }> = ({ tooltip }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = locale(context).shape as Record<string, string>;
  const readonly = context.allowEdit === false;

  const arm = (key: string) => {
    if (readonly) return;
    setContext((ctx) => {
      clearShapeSelection(ctx);
      ctx.shapeDrawKind = key;
    });
  };

  const insertNow = (key: string) => {
    if (readonly) return;
    setContext((ctx) => {
      const shape = insertShape(ctx, key);
      if (shape?.textBox) ctx.editingShape = shape.id;
    });
  };

  return (
    <>
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden="true"
      >
        <defs>
          <symbol id={SHAPES_TOOLBAR_ICON} viewBox="0 0 24 24" fill="none">
            <circle
              cx="9"
              cy="9"
              r="4.75"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="10.75"
              y="10.75"
              width="8.5"
              height="8.5"
              fill="currentColor"
              fillOpacity="0.25"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </symbol>
        </defs>
      </svg>
      <Combo iconId={SHAPES_TOOLBAR_ICON} tooltip={tooltip || t.shapes}>
        {(setOpen) => (
          <div
            className="fortune-shape-gallery"
            role="menu"
            aria-label={t.insertShapes}
          >
            {CATEGORIES.map((category) => (
              <div key={category} className="fortune-shape-gallery-group">
                <div className="fortune-shape-gallery-title">{t[category]}</div>
                <div className="fortune-shape-gallery-items">
                  {SHAPE_GALLERY.filter((g) => g.category === category).map(
                    (item) => (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        className={`fortune-shape-gallery-item${
                          context.shapeDrawKind === item.key
                            ? " fortune-shape-gallery-item-active"
                            : ""
                        }`}
                        title={t[item.key]}
                        aria-label={t[item.key]}
                        data-shape-key={item.key}
                        disabled={readonly}
                        onClick={(e) => {
                          // keyboard activation (detail 0) inserts at once
                          if (e.detail === 0) insertNow(item.key);
                          else arm(item.key);
                          setOpen(false);
                        }}
                      >
                        <ShapePresetIcon item={item} />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Combo>
    </>
  );
};

export default ShapesToolbarItem;
