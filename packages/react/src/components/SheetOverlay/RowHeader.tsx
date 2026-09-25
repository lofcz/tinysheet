import {
  rowLocation,
  rowLocationByIndex,
  selectTitlesMap,
  selectTitlesRange,
  handleContextMenu,
  handleRowHeaderMouseDown,
  handleRowSizeHandleMouseDown,
  fixRowStyleOverflowInFreeze,
  handleRowFreezeHandleMouseDown,
  getSheetIndex,
  getGridPoint,
  borderIndexAt,
  isAllowEdit,
  autofitRows,
  getAutofitTargets,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import WorkbookContext from "../../context";

const RowHeader: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const rowChangeSizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverLocation, setHoverLocation] = useState({
    row: -1,
    row_pre: -1,
    row_index: -1,
  });
  // the row border under the pointer (either side of it): what the resize
  // handle drags
  const [border, setBorder] = useState({ index: -1, inFreeze: false });
  const [selectedLocation, setSelectedLocation] = useState<
    { row: number; row_pre: number; r1: number; r2: number }[]
  >([]);
  const sheetIndex = getSheetIndex(context, context.currentSheetId);
  const sheet = sheetIndex == null ? null : context.luckysheetfile[sheetIndex];
  const freezeHandleTop = useMemo(() => {
    if (
      sheet?.frozen?.type === "row" ||
      sheet?.frozen?.type === "rangeRow" ||
      sheet?.frozen?.type === "rangeBoth" ||
      sheet?.frozen?.type === "both"
    ) {
      return (
        rowLocationByIndex(
          sheet?.frozen?.range?.row_focus || 0,
          context.visibledatarow
        )[1] + context.scrollTop
      );
    }
    return context.scrollTop;
  }, [context.visibledatarow, sheet?.frozen, context.scrollTop]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (context.luckysheet_rows_change_size) {
        return;
      }
      // rows are where the cells are (the header is offset by its padding)
      const { y, inHorizontalFreeze } = getGridPoint(
        context,
        refs.globalCache.freezen?.[context.currentSheetId],
        e,
        refs.cellArea.current!
      );
      const row_location = rowLocation(y, context.visibledatarow);
      const [row_pre, row, row_index] = row_location;
      if (row_pre !== hoverLocation.row_pre || row !== hoverLocation.row) {
        setHoverLocation({ row_pre, row, row_index });
      }
      const index = borderIndexAt(context.visibledatarow, y);
      if (index !== border.index || inHorizontalFreeze !== border.inFreeze) {
        setBorder({ index, inFreeze: inHorizontalFreeze });
      }
    },
    [
      context,
      hoverLocation.row,
      hoverLocation.row_pre,
      border,
      refs.globalCache.freezen,
      refs.cellArea,
    ]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const { nativeEvent } = e;
      setContext((draftCtx) => {
        handleRowHeaderMouseDown(
          draftCtx,
          refs.globalCache,
          nativeEvent,
          // hit-tested against the cells' rows
          refs.cellArea.current!,
          refs.cellInput.current!,
          refs.fxInput.current!
        );
      });
    },
    [refs.globalCache, refs.cellArea, refs.cellInput, refs.fxInput, setContext]
  );

  const onMouseLeave = useCallback(() => {
    if (context.luckysheet_rows_change_size) {
      return;
    }
    setHoverLocation({ row: -1, row_pre: -1, row_index: -1 });
    setBorder({ index: -1, inFreeze: false });
  }, [context.luckysheet_rows_change_size]);

  const onRowSizeHandleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const { nativeEvent } = e;
      const { index } = border;
      setContext((draftCtx) => {
        handleRowSizeHandleMouseDown(
          draftCtx,
          refs.globalCache,
          nativeEvent,
          containerRef.current!,
          refs.workbookContainer.current!,
          refs.cellArea.current!,
          index
        );
      });
      e.stopPropagation();
    },
    [
      border,
      refs.cellArea,
      refs.globalCache,
      refs.workbookContainer,
      setContext,
    ]
  );

  // double-click a row border: autofit (every selected row when the
  // border belongs to the selection)
  const onRowSizeHandleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      const { index } = border;
      if (index < 0) return;
      setContext((draftCtx) => {
        if (!isAllowEdit(draftCtx)) return;
        autofitRows(draftCtx, getAutofitTargets(draftCtx, "row", index));
      });
    },
    [border, setContext]
  );

  const onRowFreezeHandleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const { nativeEvent } = e;
      setContext((draftCtx) => {
        handleRowFreezeHandleMouseDown(
          draftCtx,
          refs.globalCache,
          nativeEvent,
          containerRef.current!,
          refs.workbookContainer.current!,
          refs.cellArea.current!
        );
      });
      e.stopPropagation();
    },
    [refs.cellArea, refs.globalCache, refs.workbookContainer, setContext]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const { nativeEvent } = e;
      setContext((draftCtx) => {
        handleContextMenu(
          draftCtx,
          settings,
          nativeEvent,
          refs.workbookContainer.current!,
          refs.cellArea.current!,
          "rowHeader"
        );
      });
    },
    [refs.workbookContainer, setContext, settings, refs.cellArea]
  );

  useEffect(() => {
    const s = context.luckysheet_select_save || [];
    let rowTitleMap: Record<number, number> = {};
    for (let i = 0; i < s.length; i += 1) {
      const r1 = s[i].row[0];
      const r2 = s[i].row[1];
      rowTitleMap = selectTitlesMap(rowTitleMap, r1, r2);
    }
    const rowTitleRange = selectTitlesRange(rowTitleMap);
    const selects: { row: number; row_pre: number; r1: number; r2: number }[] =
      [];
    for (let i = 0; i < rowTitleRange.length; i += 1) {
      const r1 = rowTitleRange[i][0];
      const r2 = rowTitleRange[i][rowTitleRange[i].length - 1];
      const row = rowLocationByIndex(r2, context.visibledatarow)[1];
      const row_pre = rowLocationByIndex(r1, context.visibledatarow)[0];
      if (_.isNumber(row_pre) && _.isNumber(row)) {
        selects.push({ row, row_pre, r1, r2 });
      }
    }
    setSelectedLocation(selects);
  }, [context.luckysheet_select_save, context.visibledatarow]);

  useEffect(() => {
    containerRef.current!.scrollTop = context.scrollTop;
  }, [context.scrollTop]);

  return (
    <div
      ref={containerRef}
      className="fortune-row-header"
      style={{
        width: context.rowHeaderWidth - 1.5,
        height: context.cellmainHeight,
      }}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      <div
        className="fortune-rows-freeze-handle"
        onMouseDown={onRowFreezeHandleMouseDown}
        style={{
          top: freezeHandleTop || 0,
        }}
      />
      <div
        className="fortune-rows-change-size"
        ref={rowChangeSizeRef}
        onMouseDown={onRowSizeHandleMouseDown}
        onDoubleClick={onRowSizeHandleDoubleClick}
        style={{
          // straddles the border (the header's padding puts row 0 at 2px)
          top:
            (context.visibledatarow[border.index] ?? 0) -
            1 +
            (border.inFreeze ? context.scrollTop : 0),
          display:
            border.index >= 0 || context.luckysheet_rows_change_size
              ? "block"
              : "none",
          opacity: context.luckysheet_rows_change_size ? 1 : 0,
        }}
      />
      {!context.luckysheet_rows_change_size && hoverLocation.row_index >= 0 ? (
        <div
          className="fortune-row-header-hover"
          style={_.assign(
            {
              top: hoverLocation.row_pre,
              height: hoverLocation.row - hoverLocation.row_pre - 1,
              display: "block",
            },
            fixRowStyleOverflowInFreeze(
              context,
              hoverLocation.row_index,
              hoverLocation.row_index,
              refs.globalCache.freezen?.[context.currentSheetId]
            )
          )}
        />
      ) : null}
      {selectedLocation.map(({ row, row_pre, r1, r2 }, i) => (
        <div
          className="fortune-row-header-selected"
          key={i}
          style={_.assign(
            {
              top: row_pre,
              height: row - row_pre - 1,
              display: "block",
              backgroundColor: "rgba(76, 76, 76, 0.1)",
            },
            fixRowStyleOverflowInFreeze(
              context,
              r1,
              r2,
              refs.globalCache.freezen?.[context.currentSheetId]
            )
          )}
        />
      ))}
      {/* placeholder to overflow the container, making the container scrollable */}
      <div
        style={{ height: context.rh_height, width: 1 }}
        id="luckysheetrowHeader_0"
        className="luckysheetsheetchange"
      />
    </div>
  );
};

export default RowHeader;
