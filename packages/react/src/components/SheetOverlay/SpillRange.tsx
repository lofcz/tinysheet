import React, { useContext, useEffect, useState } from "react";
import _ from "lodash";
import {
  getSpillRange,
  getSpillObstructingCells,
  normalizeSelection,
  fixRowStyleOverflowInFreeze,
  fixColumnStyleOverflowInFreeze,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import "./SpillRange.css";

// Excel's texts for a blocked spill (#SPILL!).
const SPILL_NOT_BLANK = "Spill range isn't blank";
const SPILL_NOT_BLANK_DETAIL =
  "The formula's results can't spill because cells in the way aren't empty.";
const SELECT_OBSTRUCTING = "Select Obstructing Cells";
const BADGE_SIZE = 18;

/**
 * Excel's spill UI in the cell overlay: a thin blue border around the spill
 * range while a cell of it is selected (dashed while the spill is blocked),
 * and for a #SPILL! anchor a warning badge whose tooltip and menu say why
 * and can select the obstructing cells.
 */
const SpillRange: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const selection = _.last(context.luckysheet_select_save);
  const rf = selection?.row_focus;
  const cf = selection?.column_focus;
  const range =
    rf == null || cf == null ? null : getSpillRange(context, rf, cf);
  const isBlockedAnchor = !!range?.blocked && range.r === rf && range.c === cf;

  useEffect(() => {
    setMenuOpen(false);
  }, [rf, cf, isBlockedAnchor]);

  if (!range || context.luckysheetCellUpdate.length > 0) return null;
  const { visibledatarow: rows, visibledatacolumn: cols } = context;
  if (rows.length === 0 || cols.length === 0) return null;
  const r2 = Math.min(range.r + range.rs - 1, rows.length - 1);
  const c2 = Math.min(range.c + range.cs - 1, cols.length - 1);
  const top = range.r === 0 ? 0 : rows[range.r - 1];
  const left = range.c === 0 ? 0 : cols[range.c - 1];
  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  const style = _.assign(
    {
      left,
      top,
      width: cols[c2] - left - 1,
      height: rows[r2] - top - 1,
    },
    fixRowStyleOverflowInFreeze(context, range.r, r2, freeze),
    fixColumnStyleOverflowInFreeze(context, range.c, c2, freeze)
  );

  const selectObstructingCells = () => {
    setMenuOpen(false);
    setContext((draftCtx) => {
      const cells = getSpillObstructingCells(draftCtx, range.r, range.c);
      if (cells.length === 0) return;
      draftCtx.luckysheet_select_save = normalizeSelection(
        draftCtx,
        cells.map(({ r, c }) => ({
          row: [r, r],
          column: [c, c],
          row_focus: r,
          column_focus: c,
        }))
      );
    });
    // the menu is gone: give the keyboard back to the sheet
    setTimeout(() => refs.cellInput.current?.focus());
  };

  // the badge sits left of the anchor, or right of it in column A
  const anchorRight = cols[range.c];
  const badgeLeft =
    left >= BADGE_SIZE + 2 ? left - BADGE_SIZE - 2 : anchorRight + 2;

  return (
    <>
      <div
        className={`fortune-spill-range${
          range.blocked ? " fortune-spill-range-blocked" : ""
        }`}
        style={style}
        data-testid="spill-range"
      />
      {isBlockedAnchor && (
        <div
          className="fortune-spill-error"
          style={{ left: badgeLeft, top: top + 1 }}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="fortune-spill-error-badge"
            aria-label={SPILL_NOT_BLANK}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && menuOpen) {
                e.stopPropagation();
                setMenuOpen(false);
              }
            }}
          >
            !
          </button>
          {!menuOpen && (
            <div className="fortune-spill-error-tip" role="tooltip">
              {SPILL_NOT_BLANK}
            </div>
          )}
          {menuOpen && (
            <div className="fortune-spill-error-menu" role="menu">
              <div className="fortune-spill-error-title">{SPILL_NOT_BLANK}</div>
              <div className="fortune-spill-error-detail">
                {SPILL_NOT_BLANK_DETAIL}
              </div>
              <button
                type="button"
                role="menuitem"
                className="fortune-spill-error-item"
                onClick={selectObstructingCells}
              >
                {SELECT_OBSTRUCTING}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SpillRange;
