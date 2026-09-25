import {
  formatLocaleText,
  getOutlineGroups,
  getOutlineGutterSize,
  indexToColumnChar,
  outlineLocale,
  OUTLINE_LEVEL_SIZE,
  OutlineAxis,
  OutlineGroup,
  setOutlineGroupCollapsed,
  showOutlineLevel,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useMemo } from "react";
import WorkbookContext from "../../context";
import "./index.css";

const S = OUTLINE_LEVEL_SIZE;
/** Side of the +/− and level buttons. */
const BUTTON = 13;

type Layer = {
  /** Screen offset of the layer inside the gutter body. */
  at: number;
  size: number;
  /** Content coordinate drawn at the layer's start. */
  scroll: number;
};

/** Extent [start, end) of row / column `i` in content pixels. */
function extent(positions: number[], i: number): [number, number] | null {
  if (i < 0 || i >= positions.length) return null;
  return [i === 0 ? 0 : positions[i - 1], positions[i]];
}

/**
 * The panes of an axis, like the canvas draws them: a frozen pane (its own
 * scroll offset) followed by the scrolling pane.
 */
function layersOf(
  frozen: number[] | undefined,
  scroll: number,
  size: number
): Layer[] {
  if (!frozen || !Number.isFinite(frozen[0]) || !Number.isFinite(frozen[2])) {
    return [{ at: 0, size, scroll }];
  }
  const frozenSize = Math.max(0, Math.min(size, frozen[0] - frozen[2]));
  return [
    { at: 0, size: frozenSize, scroll: frozen[2] },
    // the scrolling pane shows content y at y - scroll
    { at: frozenSize, size: size - frozenSize, scroll: scroll + frozenSize },
  ];
}

const Toggle: React.FC<{
  axis: OutlineAxis;
  group: OutlineGroup;
  center: number;
  cross: number;
  label: string;
  onToggle: (group: OutlineGroup) => void;
}> = ({ axis, group, center, cross, label, onToggle }) => {
  const style: React.CSSProperties =
    axis === "row"
      ? { top: center - BUTTON / 2, left: cross - BUTTON / 2 }
      : { left: center - BUTTON / 2, top: cross - BUTTON / 2 };
  return (
    <button
      type="button"
      className="fortune-outline-button fortune-outline-toggle"
      style={style}
      aria-label={label}
      title={label}
      aria-expanded={!group.collapsed}
      data-level={group.level}
      data-start={group.start}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onToggle(group)}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
        <path d="M1 4.5h7" />
        {group.collapsed && <path d="M4.5 1v7" />}
      </svg>
    </button>
  );
};

/** The lines and +/− buttons of one axis, for the visible part of a layer. */
function renderGroups(
  axis: OutlineAxis,
  groups: OutlineGroup[],
  positions: number[],
  layer: Layer,
  labels: (g: OutlineGroup) => string,
  onToggle: (g: OutlineGroup) => void
) {
  const from = layer.scroll;
  const to = layer.scroll + layer.size;
  const items: React.ReactNode[] = [];
  groups.forEach((g) => {
    const first = extent(positions, g.start);
    const last = extent(positions, g.end);
    if (!first || !last) return;
    const summary = extent(positions, g.summary);
    const after = g.summary > g.end;
    const lo = Math.min(first[0], summary?.[0] ?? first[0]);
    const hi = Math.max(last[1], summary?.[1] ?? last[1]);
    if (hi < from || lo > to) return;
    const cross = (g.level - 1) * S + S / 2;
    const key = `${g.level}_${g.start}`;
    const shown = summary != null && summary[1] - summary[0] > 1;
    const mid = shown ? (summary![0] + summary![1]) / 2 : null;
    if (!g.collapsed) {
      // bracket from the group's far end to its button
      // (summary after: from the first row down to the button; before: from
      // the button down to the last row)
      let a = first[0] + 2;
      let b = last[1] - 2;
      if (mid != null && after) b = mid - 7;
      if (mid != null && !after) a = mid + 7;
      if (b > a) {
        const tickAt = after ? a : b - 1;
        items.push(
          <div
            key={`l${key}`}
            className="fortune-outline-line"
            style={
              axis === "row"
                ? { top: a, height: b - a, left: cross, width: 0 }
                : { left: a, width: b - a, top: cross, height: 0 }
            }
          />,
          <div
            key={`t${key}`}
            className="fortune-outline-line"
            style={
              axis === "row"
                ? { top: tickAt, height: 0, left: cross, width: 5 }
                : { left: tickAt, width: 0, top: cross, height: 5 }
            }
          />
        );
      }
    }
    if (mid != null) {
      items.push(
        <Toggle
          key={`b${key}`}
          axis={axis}
          group={g}
          center={mid}
          cross={cross}
          label={labels(g)}
          onToggle={onToggle}
        />
      );
    }
  });
  return items;
}

/**
 * The outline gutters: left of the row headers and above the column
 * headers, with the level buttons (1, 2, 3, …) and a +/− button per group.
 * Rendered by the sheet only while the sheet has an outline; the sheet
 * makes room for it with padding.
 */
const OutlineGutter: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { config } = context;
  const t = outlineLocale(context).gutter;
  const size = getOutlineGutterSize(context);
  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  const [width, height] = context.luckysheetTableContentHW;

  const rowGroups = useMemo(
    () => getOutlineGroups(config, "row"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config?.rowOutlineLevel,
      config?.rowOutlineCollapsed,
      config?.outlineSummaryBelow,
    ]
  );
  const colGroups = useMemo(
    () => getOutlineGroups(config, "column"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config?.colOutlineLevel,
      config?.colOutlineCollapsed,
      config?.outlineSummaryRight,
    ]
  );

  // the buttons keep the keyboard on the grid (Ctrl+Z, arrows, ...)
  const focusGrid = useCallback(
    () => refs.cellInput.current?.focus(),
    [refs.cellInput]
  );
  const onToggle = useCallback(
    (g: OutlineGroup) => {
      setContext((ctx) => {
        setOutlineGroupCollapsed(ctx, g.axis, g, !g.collapsed);
      });
      focusGrid();
    },
    [setContext, focusGrid]
  );
  const onLevel = useCallback(
    (axis: OutlineAxis, level: number) => {
      setContext((ctx) => {
        showOutlineLevel(ctx, axis, level);
      });
      focusGrid();
    },
    [setContext, focusGrid]
  );

  const rowLabel = (g: OutlineGroup) =>
    formatLocaleText(g.collapsed ? t.expand : t.collapse, {
      from: g.start + 1,
      to: g.end + 1,
    });
  const colLabel = (g: OutlineGroup) =>
    formatLocaleText(g.collapsed ? t.expandColumns : t.collapseColumns, {
      from: indexToColumnChar(g.start),
      to: indexToColumnChar(g.end),
    });

  // The sheet tracks every mousemove on the document (hover, drag
  // selection). A move over the gutter just before a click would leave
  // that lower-priority update pending, and React would then replay the
  // button's update on top of it, recording the step twice for undo.
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 0) e.stopPropagation();
  }, []);

  const levelButtons = (axis: OutlineAxis, count: number) =>
    Array.from({ length: count + 1 }, (_v, i) => {
      const level = i + 1;
      const label = formatLocaleText(t.level, { level });
      const offset = i * S + (S - BUTTON) / 2;
      return (
        <button
          type="button"
          key={level}
          className="fortune-outline-button fortune-outline-level"
          style={
            axis === "row"
              ? { left: offset, top: (context.columnHeaderHeight - BUTTON) / 2 }
              : { top: offset, left: (context.rowHeaderWidth - BUTTON) / 2 }
          }
          aria-label={label}
          title={label}
          data-axis={axis}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onLevel(axis, level)}
        >
          {level}
        </button>
      );
    });

  const renderLayers = (
    axis: OutlineAxis,
    layers: Layer[],
    groups: OutlineGroup[],
    positions: number[],
    labels: (g: OutlineGroup) => string
  ) =>
    layers.map((layer, i) => (
      <div
        // eslint-disable-next-line react/no-array-index-key
        key={i}
        className="fortune-outline-layer"
        style={
          axis === "row"
            ? { top: layer.at, height: layer.size, left: 0, right: 0 }
            : { left: layer.at, width: layer.size, top: 0, bottom: 0 }
        }
      >
        <div
          className="fortune-outline-layer-content"
          style={
            axis === "row"
              ? { top: -layer.scroll, left: 0, right: 0 }
              : { left: -layer.scroll, top: 0, bottom: 0 }
          }
        >
          {renderGroups(axis, groups, positions, layer, labels, onToggle)}
        </div>
      </div>
    ));

  return (
    <>
      {size.left > 0 && size.top > 0 && (
        <div
          className="fortune-outline-corner"
          style={{ width: size.left, height: size.top }}
          onMouseMove={onMouseMove}
        />
      )}
      {size.left > 0 && (
        <div
          className="fortune-outline-gutter fortune-outline-rows"
          role="group"
          aria-label={outlineLocale(context).toolbar.outline}
          style={{ top: size.top, width: size.left, height }}
          onMouseMove={onMouseMove}
        >
          <div
            className="fortune-outline-levels"
            style={{ height: context.columnHeaderHeight }}
          >
            {levelButtons("row", size.rowLevels)}
          </div>
          <div
            className="fortune-outline-body"
            style={{
              top: context.columnHeaderHeight,
              height: Math.max(0, height - context.columnHeaderHeight),
            }}
          >
            {renderLayers(
              "row",
              layersOf(
                freeze?.horizontal?.freezenhorizontaldata as
                  | number[]
                  | undefined,
                context.scrollTop,
                Math.max(0, height - context.columnHeaderHeight)
              ),
              rowGroups,
              context.visibledatarow,
              rowLabel
            )}
          </div>
        </div>
      )}
      {size.top > 0 && (
        <div
          className="fortune-outline-gutter fortune-outline-cols"
          role="group"
          aria-label={outlineLocale(context).toolbar.outline}
          style={{ left: size.left, height: size.top, width }}
          onMouseMove={onMouseMove}
        >
          <div
            className="fortune-outline-levels"
            style={{ width: context.rowHeaderWidth }}
          >
            {levelButtons("column", size.colLevels)}
          </div>
          <div
            className="fortune-outline-body"
            style={{
              left: context.rowHeaderWidth,
              width: Math.max(0, width - context.rowHeaderWidth),
            }}
          >
            {renderLayers(
              "column",
              layersOf(
                freeze?.vertical?.freezenverticaldata as number[] | undefined,
                context.scrollLeft,
                Math.max(0, width - context.rowHeaderWidth)
              ),
              colGroups,
              context.visibledatacolumn,
              colLabel
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default OutlineGutter;
