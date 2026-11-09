import {
  applyFilterCondition,
  clearColumnFilter,
  clearFilter,
  dataToolsLocale,
  DATE_PERIODS,
  FilterCondition,
  FilterOperator,
  formatLocaleText,
  getColumnFilterCondition,
  getFilterColumnKind,
  getFlowdata,
  locale,
  getFilterColumnValues,
  getFilterColumnColors,
  orderbydatafiler,
  saveFilter,
  FilterValue,
  FilterDate,
  FilterColor,
  Context,
} from "@lofcz/tinysheet-core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import { produce } from "immer";
import WorkbookContext from "../../context";
import Divider from "./Divider";
import FilterValueList from "./FilterValueList";
import Menu from "./Menu";
import {
  ArrowDownAZ,
  ArrowDownZA,
  ChevronRight,
  FunnelX,
  ListFilter,
  PaintBucket,
  Search,
} from "lucide-react";
import { Icon, LucideIcon } from "../ui";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import {
  CustomFilterDialog,
  Top10Dialog,
} from "../FilterOption/ConditionDialogs";
import "../FilterOption/index.css";

/** 16px lucide icon in the icon column of a filter menu row. */
const FilterMenuIcon: React.FC<{ icon: LucideIcon }> = ({ icon }) => (
  <span className="fortune-filter-menu-icon">
    <Icon icon={icon} />
  </span>
);

const FilterMenuChevron: React.FC = () => (
  <ChevronRight
    className="fortune-filter-menu-chevron"
    size={14}
    strokeWidth={1.75}
    aria-hidden
  />
);

const FilterMenu: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<Context>(context);
  const byColorMenuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const condMenuRef = useRef<HTMLDivElement>(null);
  const { filterContextMenu } = context;
  const { startRow, startCol, endRow, endCol, col, listBoxMaxHeight } =
    filterContextMenu || {
      startRow: null,
      startCol: null,
      endRow: null,
      endCol: null,
      col: null,
      listBoxMaxHeight: 400,
    };
  const { filter } = locale(context);
  const [data, setData] = useState<{
    dates: FilterDate[];
    dateRowMap: Record<string, number[]>;
    values: FilterValue[];
    valueRowMap: Record<string, number[]>;
    visibleRows: number[];
    flattenValues: string[];
  }>({
    dates: [],
    dateRowMap: {},
    values: [],
    valueRowMap: {},
    visibleRows: [],
    flattenValues: [],
  });
  const [datesUncheck, setDatesUncheck] = useState<Set<string>>(
    () => new Set()
  );
  const [valuesUncheck, setValuesUncheck] = useState<Set<string>>(
    () => new Set()
  );
  const hiddenRows = useRef<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [subMenuPos, setSubMenuPos] = useState<{
    left?: number;
    top: number;
    right?: number;
  }>();
  const [filterColors, setFilterColors] = useState<{
    bgColors: FilterColor[];
    fcColors: FilterColor[];
  }>({ bgColors: [], fcColors: [] });
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showCondMenu, setShowCondMenu] = useState(false);
  const [condMenuPos, setCondMenuPos] = useState<{
    left?: number;
    top: number;
  }>();
  const byCondMenuRef = useRef<HTMLDivElement>(null);
  const mouseHoverCondMenu = useRef<boolean>(false);
  const { showDialog } = useDialog();
  const tools = dataToolsLocale(context).filter;
  const { showAlert } = useAlert();
  const mouseHoverSubMenu = useRef<boolean>(false);
  contextRef.current = context;

  // 点击其他区域的时候关闭FilterMenu
  const close = useCallback(() => {
    setContext((ctx) => {
      ctx.filterContextMenu = undefined;
    });
  }, [setContext]);

  // clicks in the menu or its submenus (rendered beside it) keep it open;
  // Escape and a resized window close it
  const filterMenuOpen = context.filterContextMenu != null;
  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // a dialog opened from the menu (Custom Filter…) closes first
      if ((e.target as Element | null)?.closest?.('[role="dialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      close();
      refs.cellInput.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", close);
    };
  }, [filterMenuOpen, close, refs.cellInput]);

  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        subMenuRef.current?.contains(target) ||
        condMenuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [close, filterMenuOpen]);

  const selectAll = useCallback(() => {
    setDatesUncheck(new Set());
    setValuesUncheck(new Set());
    hiddenRows.current = new Set();
  }, []);

  const clearAll = useCallback(() => {
    setDatesUncheck(new Set(Object.keys(data.dateRowMap)));
    setValuesUncheck(new Set(Object.keys(data.valueRowMap)));
    hiddenRows.current = new Set(data.visibleRows);
  }, [data]);

  const inverseSelect = useCallback(() => {
    setDatesUncheck(
      (prev) =>
        new Set(Object.keys(data.dateRowMap).filter((key) => !prev.has(key)))
    );
    setValuesUncheck(
      (prev) =>
        new Set(Object.keys(data.valueRowMap).filter((key) => !prev.has(key)))
    );
    // Rows hidden by this column but excluded by another column stay excluded.
    const next = new Set(hiddenRows.current);
    data.visibleRows.forEach((row) => {
      if (next.has(row)) next.delete(row);
      else next.add(row);
    });
    hiddenRows.current = next;
  }, [data]);

  const onValueChange = useCallback(
    (item: FilterDate | FilterValue, checked: boolean, date: boolean) => {
      item.rows.forEach((row) => {
        if (checked) hiddenRows.current.delete(row);
        else hiddenRows.current.add(row);
      });
      const keys = date ? (item as FilterDate).dateValues : [item.key];
      const setUnchecked = date ? setDatesUncheck : setValuesUncheck;
      setUnchecked((prev) => {
        const next = new Set(prev);
        keys.forEach((key) => {
          if (checked) next.delete(key);
          else next.add(key);
        });
        return next;
      });
    },
    []
  );

  const onColorSelectChange = useCallback(
    (key: string, color: string, checked: boolean) => {
      setFilterColors(
        produce((draft) => {
          const colorData = _.find(_.get(draft, key), (v) => v.color === color);
          colorData.checked = checked;
        })
      );
    },
    []
  );

  const delayHideSubMenu = useMemo(
    () =>
      _.debounce(() => {
        if (mouseHoverSubMenu.current) return;
        setShowSubMenu(false);
      }, 200),
    []
  );

  const delayHideCondMenu = useMemo(
    () =>
      _.debounce(() => {
        if (mouseHoverCondMenu.current) return;
        setShowCondMenu(false);
      }, 200),
    []
  );

  const columnKind = useMemo(
    () =>
      col == null
        ? "text"
        : getFilterColumnKind(contextRef.current, col, startRow, endRow),
    [col, startRow, endRow]
  );

  const activeCondition =
    col == null ? null : getColumnFilterCondition(context, col);

  const columnTitle = useMemo(() => {
    if (col == null) return "";
    const cell = getFlowdata(contextRef.current)?.[startRow]?.[col];
    const text = cell?.m ?? cell?.v;
    return text == null ? "" : `${text}`;
  }, [col, startRow]);

  const applyCondition = useCallback(
    (condition: FilterCondition) => {
      if (col == null) return;
      setContext((draftCtx) => {
        applyFilterCondition(draftCtx, col, condition);
        draftCtx.filterContextMenu = undefined;
      });
    },
    [col, setContext]
  );

  const openCustomFilter = useCallback(
    (op1?: FilterOperator, op2?: FilterOperator) => {
      if (col == null) return;
      setContext((draftCtx) => {
        draftCtx.filterContextMenu = undefined;
      });
      showDialog(
        <CustomFilterDialog
          col={col}
          startRow={startRow}
          endRow={endRow}
          kind={columnKind}
          op1={op1}
          op2={op2}
        />
      );
    },
    [col, columnKind, endRow, setContext, showDialog, startRow]
  );

  const openTop10 = useCallback(() => {
    if (col == null) return;
    setContext((draftCtx) => {
      draftCtx.filterContextMenu = undefined;
    });
    showDialog(<Top10Dialog col={col} />);
  }, [col, setContext, showDialog]);

  const conditionItems = useMemo(() => {
    type Entry =
      | { key: string; text: string; onClick: () => void; active?: boolean }
      | { key: string; divider: true }
      | {
          key: string;
          grid: {
            key: string;
            text: string;
            onClick: () => void;
            active?: boolean;
          }[];
        };
    const m = tools.menu;
    const custom = (
      key: string,
      op1?: FilterOperator,
      op2?: FilterOperator
    ) => ({
      key,
      text: m[key],
      onClick: () => openCustomFilter(op1, op2),
    });
    const isActive = (cond: Partial<FilterCondition>) =>
      activeCondition != null && _.isMatch(activeCondition, cond);
    const entries: Entry[] = [];
    if (columnKind === "text") {
      entries.push(
        custom("equals", "equals"),
        custom("notEquals", "notEquals"),
        { key: "d1", divider: true },
        custom("beginsWith", "beginsWith"),
        custom("endsWith", "endsWith"),
        { key: "d2", divider: true },
        custom("contains", "contains"),
        custom("notContains", "notContains")
      );
    } else if (columnKind === "number") {
      entries.push(
        custom("equals", "equals"),
        custom("notEquals", "notEquals"),
        { key: "d1", divider: true },
        custom("greaterThan", "greaterThan"),
        custom("greaterOrEqual", "greaterOrEqual"),
        custom("lessThan", "lessThan"),
        custom("lessOrEqual", "lessOrEqual"),
        custom("between", "greaterOrEqual", "lessOrEqual"),
        { key: "d2", divider: true },
        {
          key: "top10",
          text: m.top10,
          onClick: openTop10,
          active: isActive({ type: "top10" }),
        },
        {
          key: "aboveAverage",
          text: m.aboveAverage,
          onClick: () => applyCondition({ type: "average" }),
          active: isActive({ type: "average", below: undefined }),
        },
        {
          key: "belowAverage",
          text: m.belowAverage,
          onClick: () => applyCondition({ type: "average", below: true }),
          active: isActive({ type: "average", below: true }),
        }
      );
    } else {
      entries.push(
        custom("equals", "equals"),
        custom("before", "lessThan"),
        custom("after", "greaterThan"),
        custom("between", "greaterOrEqual", "lessOrEqual"),
        { key: "d1", divider: true },
        ...DATE_PERIODS.map((period) => ({
          key: period,
          text: tools.periods[period],
          onClick: () => applyCondition({ type: "datePeriod", period }),
          active: isActive({ type: "datePeriod", period }),
        })),
        { key: "d2", divider: true },
        { key: "allDates", text: m.allDatesInPeriod, onClick: () => {} },
        {
          key: "periods",
          grid: [
            ...[1, 2, 3, 4].map((n) => ({
              key: `Q${n}`,
              text: formatLocaleText(tools.quarter, { n }),
              onClick: () =>
                applyCondition({ type: "datePeriod", period: `Q${n}` as any }),
              active: isActive({ type: "datePeriod", period: `Q${n}` as any }),
            })),
            ...tools.months.map((name, i) => ({
              key: `M${i + 1}`,
              text: name,
              onClick: () =>
                applyCondition({
                  type: "datePeriod",
                  period: `M${i + 1}` as any,
                }),
              active: isActive({
                type: "datePeriod",
                period: `M${i + 1}` as any,
              }),
            })),
          ],
        }
      );
    }
    entries.push({ key: "d9", divider: true }, custom("customFilter"));
    return entries;
  }, [
    activeCondition,
    applyCondition,
    columnKind,
    openCustomFilter,
    openTop10,
    tools,
  ]);

  const sortData = useCallback(
    (asc: boolean) => {
      if (col == null) return;
      setContext((draftCtx) => {
        const errMsg = orderbydatafiler(
          draftCtx,
          startRow,
          startCol,
          endRow,
          endCol,
          col,
          asc
        );
        if (errMsg != null) showAlert(errMsg);
      });
    },
    [col, setContext, startRow, startCol, endRow, endCol, showAlert]
  );

  const renderColorList = useCallback(
    (
      key: string,
      title: string,
      colors: FilterColor[],
      onSelectChange: (datakey: string, color: string, checked: boolean) => void
    ) =>
      colors.length > 1 ? (
        <div key={key}>
          <div className="title">{title}</div>
          <div className="color-list">
            {colors.map((v) => (
              <div
                key={v.color}
                className="item"
                onClick={() => onSelectChange(key, v.color, !v.checked)}
                tabIndex={0}
              >
                <div
                  className="color-label"
                  style={{ backgroundColor: v.color }}
                />
                <input
                  className="luckysheet-mousedown-cancel"
                  type="checkbox"
                  checked={v.checked}
                  onChange={() => {}}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null,
    []
  );

  useLayoutEffect(() => {
    // re-position the filterContextMenu if it overflows the window
    if (!containerRef.current || !filterContextMenu) {
      return;
    }
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const rect = containerRef.current.getBoundingClientRect();
    const workbookRect =
      refs.workbookContainer.current?.getBoundingClientRect();
    if (!workbookRect) {
      return;
    }
    const menuW = rect.width;
    // menu最小高度
    const menuH = 350;
    // below / right of the filter button; flipped when it does not fit, and
    // kept against the window edge when neither side fits
    const place = (at: number, size: number, offset: number, win: number) => {
      if (offset + at + size <= win) return at;
      if (offset + at - size >= 0) return at - size;
      return Math.max(-offset, win - size - offset);
    };
    const left = place(filterContextMenu.x, menuW, workbookRect.left, winW);
    const top = place(filterContextMenu.y, menuH, workbookRect.top, winH);
    const hasOverflow =
      left !== filterContextMenu.x || top !== filterContextMenu.y;
    // 适配小屏
    let containerH = winH - rect.top - 350;
    if (containerH < 0) {
      containerH = 100;
    }
    // 防止Maximum update depth exceeded错误，如果当前值和前一个filterContextMenu值一样则不进行赋值
    if (
      filterContextMenu.x === left &&
      filterContextMenu.y === top &&
      filterContextMenu.listBoxMaxHeight === containerH
    ) {
      return;
    }
    setContext((draftCtx) => {
      if (hasOverflow) {
        _.set(draftCtx, "filterContextMenu.x", left);
        _.set(draftCtx, "filterContextMenu.y", top);
      }
      _.set(draftCtx, "filterContextMenu.listBoxMaxHeight", containerH);
    });
  }, [filterContextMenu, refs.workbookContainer, setContext]);

  useLayoutEffect(() => {
    if (!subMenuPos) return;
    // re-position the subMenu if it overflows the window
    const rect = byColorMenuRef.current?.getBoundingClientRect();
    const subMenuRect = subMenuRef.current?.getBoundingClientRect();
    if (rect == null || subMenuRect == null) return;

    const winW = window.innerWidth;
    const pos = _.cloneDeep(subMenuPos);
    if (subMenuRect.left + subMenuRect.width > winW) {
      pos.left! -= subMenuRect.width;
      setSubMenuPos(pos);
    }
  }, [subMenuPos]);

  useEffect(() => {
    if (col == null) return;
    setSearchText("");
    setShowSubMenu(false);
    hiddenRows.current = new Set(filterContextMenu?.hiddenRows);
    const res = getFilterColumnValues(
      contextRef.current,
      col,
      startRow,
      endRow,
      startCol
    );
    setData(_.omit(res, ["datesUncheck", "valuesUncheck"]));
    setDatesUncheck(new Set(res.datesUncheck));
    setValuesUncheck(new Set(res.valuesUncheck));
  }, [
    col,
    endRow,
    startRow,
    startCol,
    hiddenRows,
    filterContextMenu?.hiddenRows,
  ]);

  useEffect(() => {
    if (col == null || !showSubMenu) return;
    setFilterColors(
      getFilterColumnColors(contextRef.current, col, startRow, endRow)
    );
  }, [col, endRow, startRow, showSubMenu]);

  if (filterContextMenu == null) return null;

  return (
    <>
      <div
        role="menu"
        className="fortune-context-menu luckysheet-cols-menu fortune-filter-menu ts-filter-menu"
        id="luckysheet-\${menuid}-menu"
        ref={containerRef}
        style={{ left: filterContextMenu.x, top: filterContextMenu.y }}
      >
        {settings.filterContextMenu?.map((name, i) => {
          if (name === "|") {
            return <Divider key={`divider-${i}`} />;
          }
          if (name === "sort-by-asc") {
            return (
              <Menu key={name} onClick={() => sortData(true)}>
                <FilterMenuIcon icon={ArrowDownAZ} />
                {filter.sortByAsc}
              </Menu>
            );
          }
          if (name === "sort-by-desc") {
            return (
              <Menu key={name} onClick={() => sortData(false)}>
                <FilterMenuIcon icon={ArrowDownZA} />
                {filter.sortByDesc}
              </Menu>
            );
          }
          if (name === "filter-by-color") {
            return (
              <div
                key={name}
                ref={byColorMenuRef}
                onMouseEnter={() => {
                  if (!containerRef.current || !filterContextMenu) {
                    return;
                  }
                  setShowCondMenu(false);
                  setShowSubMenu(true);
                  const rect = byColorMenuRef.current?.getBoundingClientRect();
                  if (rect == null) return;
                  setSubMenuPos({ top: rect.top - 5, left: rect.right });
                }}
                onMouseLeave={delayHideSubMenu}
              >
                <Menu onClick={() => {}}>
                  <div className="filter-bycolor-container">
                    <span>
                      <FilterMenuIcon icon={PaintBucket} />
                      {filter.filterByColor}
                    </span>
                    <FilterMenuChevron />
                  </div>
                </Menu>
              </div>
            );
          }
          if (name === "clear-column-filter") {
            const enabled = activeCondition != null;
            return (
              <div
                key={name}
                className={enabled ? undefined : "fortune-filter-menu-disabled"}
              >
                <Menu
                  onClick={() => {
                    if (!enabled || col == null) return;
                    setContext((draftCtx) => {
                      clearColumnFilter(draftCtx, col);
                      draftCtx.filterContextMenu = undefined;
                    });
                  }}
                >
                  <FilterMenuIcon icon={FunnelX} />
                  {formatLocaleText(tools.clearFilterFrom, {
                    column: columnTitle,
                  })}
                </Menu>
              </div>
            );
          }
          if (name === "filter-by-condition") {
            let label = tools.textFilters;
            if (columnKind === "number") label = tools.numberFilters;
            if (columnKind === "date") label = tools.dateFilters;
            return (
              <div
                key={name}
                ref={byCondMenuRef}
                onMouseEnter={() => {
                  setShowSubMenu(false);
                  setShowCondMenu(true);
                  const rect = byCondMenuRef.current?.getBoundingClientRect();
                  if (rect == null) return;
                  setCondMenuPos({ top: rect.top - 5, left: rect.right });
                }}
                onMouseLeave={delayHideCondMenu}
              >
                <Menu
                  onClick={() => {
                    setShowCondMenu(true);
                    const rect = byCondMenuRef.current?.getBoundingClientRect();
                    if (rect == null) return;
                    setCondMenuPos({ top: rect.top - 5, left: rect.right });
                  }}
                >
                  <div className="filter-bycolor-container">
                    <span>
                      <FilterMenuIcon icon={ListFilter} />
                      {activeCondition != null &&
                        activeCondition.type !== "values" && (
                          <span className="fortune-filter-active-dot" />
                        )}
                      {label}
                    </span>
                    <FilterMenuChevron />
                  </div>
                </Menu>
              </div>
            );
          }
          if (name === "filter-by-value") {
            return (
              <div key={name}>
                <div className="fortune-filter-byvalue-title">
                  {filter.filterByValues}
                </div>
                <div className="luckysheet-filter-byvalue">
                  <div className="fortune-menuitem-row byvalue-btn-row">
                    <div>
                      <span
                        className="fortune-byvalue-btn"
                        onClick={selectAll}
                        tabIndex={0}
                      >
                        {filter.filterValueByAllBtn}
                      </span>
                      {" - "}
                      <span
                        className="fortune-byvalue-btn"
                        onClick={clearAll}
                        tabIndex={0}
                      >
                        {filter.filterValueByClearBtn}
                      </span>
                      {" - "}
                      <span
                        className="fortune-byvalue-btn"
                        onClick={inverseSelect}
                        tabIndex={0}
                      >
                        {filter.filterValueByInverseBtn}
                      </span>
                    </div>
                  </div>
                  <div className="filtermenu-input-container">
                    <Search
                      className="fortune-filter-search-icon"
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <input
                      aria-label={filter.filterValueByTip}
                      type="text"
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={filter.filterValueByTip}
                      className="luckysheet-mousedown-cancel"
                      id="luckysheet-\${menuid}-byvalue-input"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                      }}
                    />
                  </div>
                  <FilterValueList
                    dates={data.dates}
                    values={data.values}
                    datesUncheck={datesUncheck}
                    valuesUncheck={valuesUncheck}
                    search={searchText}
                    maxHeight={listBoxMaxHeight}
                    onChange={onValueChange}
                  />
                </div>
              </div>
            );
          }
          return null;
        })}
        <Divider />
        <div className="fortune-menuitem-row">
          <div
            className="button-basic button-primary ts-btn ts-btn--primary ts-btn--sm"
            role="button"
            onClick={() => {
              if (col == null) return;
              setContext((draftCtx) => {
                const rowHidden = _.reduce(
                  Array.from(hiddenRows.current),
                  (pre, curr) => {
                    pre[curr] = 0;
                    return pre;
                  },
                  {} as Record<string, number>
                );
                saveFilter(
                  draftCtx,
                  hiddenRows.current.size > 0,
                  rowHidden,
                  { type: "values" },
                  startRow,
                  endRow,
                  col,
                  startCol,
                  endCol
                );
                hiddenRows.current = new Set();
                draftCtx.filterContextMenu = undefined;
              });
            }}
            tabIndex={0}
          >
            {filter.filterConform}
          </div>
          <div
            className="button-basic button-default ts-btn ts-btn--secondary ts-btn--sm"
            role="button"
            onClick={() => {
              setContext((draftCtx) => {
                draftCtx.filterContextMenu = undefined;
              });
            }}
            tabIndex={0}
          >
            {filter.filterCancel}
          </div>
          <div
            className="button-basic button-danger ts-btn ts-btn--ghost ts-btn--sm"
            role="button"
            onClick={() => {
              setContext((draftCtx) => {
                clearFilter(draftCtx);
              });
            }}
            tabIndex={0}
          >
            {filter.clearFilter}
          </div>
        </div>
      </div>
      {showCondMenu && filterContextMenu != null && (
        <div
          ref={condMenuRef}
          className="luckysheet-filter-bycolor-submenu fortune-filter-condition-submenu"
          role="menu"
          style={condMenuPos}
          onMouseEnter={() => {
            mouseHoverCondMenu.current = true;
          }}
          onMouseLeave={() => {
            mouseHoverCondMenu.current = false;
            setShowCondMenu(false);
          }}
        >
          {conditionItems.map((item) => {
            if ("divider" in item) return <Divider key={item.key} />;
            if ("grid" in item) {
              return (
                <div key={item.key} className="fortune-filter-period-grid">
                  {item.grid.map((g) => (
                    <div
                      key={g.key}
                      role="menuitem"
                      tabIndex={0}
                      className={`fortune-filter-period${
                        g.active ? " active" : ""
                      }`}
                      onClick={g.onClick}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") g.onClick();
                      }}
                    >
                      {g.text}
                    </div>
                  ))}
                </div>
              );
            }
            if (item.key === "allDates") {
              return (
                <div key={item.key} className="fortune-filter-submenu-header">
                  {item.text}
                </div>
              );
            }
            return (
              <Menu key={item.key} onClick={item.onClick}>
                <span
                  className={
                    item.active ? "fortune-filter-condition-active" : undefined
                  }
                >
                  {item.text}
                </span>
              </Menu>
            );
          })}
        </div>
      )}
      {showSubMenu && (
        <div
          ref={subMenuRef}
          className="luckysheet-filter-bycolor-submenu"
          style={subMenuPos}
          onMouseEnter={() => {
            mouseHoverSubMenu.current = true;
          }}
          onMouseLeave={() => {
            mouseHoverSubMenu.current = false;
            setShowSubMenu(false);
          }}
        >
          {filterColors.bgColors.length < 2 &&
          filterColors.fcColors.length < 2 ? (
            <div className="one-color-tip">
              {filter.filterContainerOneColorTip}
            </div>
          ) : (
            <>
              {[
                {
                  key: "bgColors",
                  title: filter.filiterByColorTip,
                  colors: filterColors.bgColors,
                },
                {
                  key: "fcColors",
                  title: filter.filiterByTextColorTip,
                  colors: filterColors.fcColors,
                },
              ].map((v) =>
                renderColorList(v.key, v.title, v.colors, onColorSelectChange)
              )}
              <div
                className="button-basic button-primary ts-btn ts-btn--primary ts-btn--sm"
                role="button"
                onClick={() => {
                  if (col == null) return;
                  setContext((draftCtx) => {
                    const rowHidden = _.reduce(
                      _(filterColors)
                        .values()
                        .flatten()
                        .map((v) => (v.checked ? [] : v.rows))
                        .flatten()
                        .valueOf(),
                      (pre, curr) => {
                        pre[curr] = 0;
                        return pre;
                      },
                      {} as Record<string, number>
                    );
                    saveFilter(
                      draftCtx,
                      !_.isEmpty(rowHidden),
                      rowHidden,
                      { type: "values" },
                      startRow,
                      endRow,
                      col,
                      startCol,
                      endCol
                    );
                    hiddenRows.current = new Set();
                    draftCtx.filterContextMenu = undefined;
                  });
                }}
                tabIndex={0}
              >
                {filter.filterConform}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

/** Each opening owns its draft selection and submenu state. */
export default function FilterMenuHost() {
  const { context } = useContext(WorkbookContext);
  return context.filterContextMenu ? <FilterMenu /> : null;
}
