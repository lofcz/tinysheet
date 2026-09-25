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
import produce from "immer";
import WorkbookContext from "../../context";
import Divider from "./Divider";
import Menu from "./Menu";
import SVGIcon from "../SVGIcon";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import {
  CustomFilterDialog,
  Top10Dialog,
} from "../FilterOption/ConditionDialogs";
import "../FilterOption/index.css";

const SelectItem: React.FC<{
  item: FilterValue;
  isChecked: (key: string) => boolean;
  onChange: (item: FilterValue, checked: boolean) => void;
  isItemVisible: (item: FilterValue) => boolean;
}> = ({ item, isChecked, onChange, isItemVisible }) => {
  const checked = useMemo(() => isChecked(item.key), [isChecked, item.key]);
  return isItemVisible(item) ? (
    <div className="select-item">
      <input
        className="filter-checkbox"
        type="checkbox"
        checked={checked}
        onChange={() => {
          onChange(item, !checked);
        }}
      />
      <div>{item.text}</div>
      <span className="count">{`( ${item.rows.length} )`}</span>
    </div>
  ) : null;
};

const DateSelectTreeItem: React.FC<{
  item: FilterDate;
  depth?: number;
  initialExpand: (key: string) => boolean;
  onExpand?: (key: string, expand: boolean) => void;
  isChecked: (key: string) => boolean;
  onChange: (data: FilterDate, checked: boolean) => void;
  isItemVisible: (item: FilterDate) => boolean;
}> = ({
  item,
  depth = 0,
  initialExpand,
  onExpand,
  isChecked,
  onChange,
  isItemVisible,
}) => {
  const [expand, setExpand] = useState(initialExpand(item.key));
  const checked = useMemo(() => isChecked(item.key), [isChecked, item.key]);

  return isItemVisible(item) ? (
    <div>
      <div
        className="select-item"
        style={{ marginLeft: -2 + depth * 20 }}
        onClick={() => {
          onExpand?.(item.key, !expand);
          setExpand(!expand);
        }}
        tabIndex={0}
      >
        {_.isEmpty(item.children) ? (
          <div style={{ width: 10 }} />
        ) : (
          <div
            className={`filter-caret ${expand ? "down" : "right"}`}
            style={{ cursor: "pointer" }}
          />
        )}
        <input
          className="filter-checkbox"
          type="checkbox"
          checked={checked}
          onChange={() => {
            onChange(item, !checked);
          }}
          onClick={(e) => e.stopPropagation()}
          tabIndex={0}
        />
        <div>{item.text}</div>
        <span className="count">{`( ${item.rows.length} )`}</span>
      </div>
      {expand &&
        item.children.map((v) => (
          <DateSelectTreeItem
            key={v.key}
            item={v}
            depth={depth + 1}
            {...{ initialExpand, onExpand, isChecked, onChange, isItemVisible }}
          />
        ))}
    </div>
  ) : null;
};

const DateSelectTree: React.FC<{
  dates: FilterDate[];
  initialExpand: (key: string) => boolean;
  onExpand?: (key: string, expand: boolean) => void;
  isChecked: (key: string) => boolean;
  onChange: (item: FilterDate, checked: boolean) => void;
  isItemVisible: (item: FilterDate) => boolean;
}> = ({
  dates,
  initialExpand,
  onExpand,
  isChecked,
  onChange,
  isItemVisible,
}) => {
  return (
    <>
      {dates.map((v) => (
        <DateSelectTreeItem
          key={v.key}
          item={v}
          {...{ initialExpand, onExpand, isChecked, onChange, isItemVisible }}
        />
      ))}
    </>
  );
};

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
  const [datesUncheck, setDatesUncheck] = useState<string[]>([]);
  const [valuesUncheck, setValuesUncheck] = useState<string[]>([]);
  const dateTreeExpandState = useRef<Record<string, boolean>>({});
  const hiddenRows = useRef<number[]>([]);
  const [showValues, setShowValues] = useState<string[]>([]);
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

  // clicks in the menu or its submenus (rendered beside it) keep it open
  useEffect(() => {
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
  }, [close]);

  const initialExpand = useCallback((key: string) => {
    const expand = dateTreeExpandState.current[key];
    if (expand == null) {
      dateTreeExpandState.current[key] = true;
      return true;
    }
    return expand;
  }, []);

  const onExpand = useCallback((key: string, expand: boolean) => {
    dateTreeExpandState.current[key] = expand;
  }, []);

  const searchValues = useMemo(
    () =>
      _.debounce((text: string) => {
        setShowValues(
          _.filter(
            data.flattenValues,
            (v) => v.toLowerCase().indexOf(text.toLowerCase()) > -1
          )
        );
      }, 300),
    [data.flattenValues]
  );

  const selectAll = useCallback(() => {
    setDatesUncheck([]);
    setValuesUncheck([]);
    hiddenRows.current = [];
  }, []);

  const clearAll = useCallback(() => {
    setDatesUncheck(_.keys(data.dateRowMap));
    setValuesUncheck(_.keys(data.valueRowMap));
    hiddenRows.current = data.visibleRows;
  }, [data.dateRowMap, data.valueRowMap, data.visibleRows]);

  const inverseSelect = useCallback(() => {
    setDatesUncheck(produce((draft) => _.xor(draft, _.keys(data.dateRowMap))));
    setValuesUncheck(
      produce((draft) => _.xor(draft, _.keys(data.valueRowMap)))
    );
    hiddenRows.current = _.xor(hiddenRows.current, data.visibleRows);
  }, [data.dateRowMap, data.valueRowMap, data.visibleRows]);

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
    let top = filterContextMenu.y;
    let left = filterContextMenu.x;

    let hasOverflow = false;
    if (workbookRect.left + left + menuW > winW) {
      left -= menuW;
      hasOverflow = true;
    }
    if (workbookRect.top + top + menuH > winH) {
      top -= menuH;
      hasOverflow = true;
    }
    if (top < 0) {
      top = 0;
      hasOverflow = true;
    }
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
    dateTreeExpandState.current = {};
    hiddenRows.current = filterContextMenu?.hiddenRows || [];
    const res = getFilterColumnValues(
      contextRef.current,
      col,
      startRow,
      endRow,
      startCol
    );
    setData(_.omit(res, ["datesUncheck", "valuesUncheck"]));
    setDatesUncheck(res.datesUncheck);
    setValuesUncheck(res.valuesUncheck);
    setShowValues(res.flattenValues);
  }, [
    col,
    endRow,
    startRow,
    startCol,
    hiddenRows,
    filterContextMenu?.hiddenRows,
  ]);

  useEffect(() => {
    if (col == null) return;
    setFilterColors(
      getFilterColumnColors(contextRef.current, col, startRow, endRow)
    );
  }, [col, endRow, startRow]);

  if (filterContextMenu == null) return null;

  return (
    <>
      <div
        role="menu"
        className="fortune-context-menu luckysheet-cols-menu fortune-filter-menu"
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
                {filter.sortByAsc}
              </Menu>
            );
          }
          if (name === "sort-by-desc") {
            return (
              <Menu key={name} onClick={() => sortData(false)}>
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
                    {filter.filterByColor}
                    <div className="filter-caret right" />
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
                      {activeCondition != null &&
                        activeCondition.type !== "values" && (
                          <span className="fortune-filter-active-dot" />
                        )}
                      {label}
                    </span>
                    <div className="filter-caret right" />
                  </div>
                </Menu>
              </div>
            );
          }
          if (name === "filter-by-value") {
            return (
              <div key={name}>
                <Menu onClick={() => {}}>
                  <div className="filter-caret right" />
                  {filter.filterByValues}
                </Menu>
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
                    <div className="byvalue-filter-icon">
                      <SVGIcon
                        name="filter-fill"
                        style={{ width: 20, height: 20 }}
                      />
                    </div>
                  </div>
                  <div className="filtermenu-input-container">
                    <input
                      type="text"
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={filter.filterValueByTip}
                      className="luckysheet-mousedown-cancel"
                      id="luckysheet-\${menuid}-byvalue-input"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        searchValues(e.target.value);
                      }}
                    />
                  </div>
                  <div
                    id="luckysheet-filter-byvalue-select"
                    style={{ maxHeight: listBoxMaxHeight }}
                  >
                    <DateSelectTree
                      dates={data.dates}
                      onExpand={onExpand}
                      initialExpand={initialExpand}
                      isChecked={(key: string) =>
                        _.find(
                          datesUncheck,
                          (v: string) => v.match(key) != null
                        ) == null
                      }
                      onChange={(item: FilterDate, checked: boolean) => {
                        const rows = hiddenRows.current;
                        hiddenRows.current = checked
                          ? _.without(rows, ...item.rows)
                          : _.union(rows, item.rows);
                        setDatesUncheck(
                          produce((draft) => {
                            return checked
                              ? _.without(draft, ...item.dateValues)
                              : _.union(draft, item.dateValues);
                          })
                        );
                      }}
                      isItemVisible={(item) => {
                        return showValues.length === data.flattenValues.length
                          ? true
                          : _.findIndex(
                              showValues,
                              (v) => v.match(item.key) != null
                            ) > -1;
                      }}
                    />
                    {data.values.map((v) => (
                      <SelectItem
                        key={v.key}
                        item={v}
                        isChecked={(key: string) =>
                          !_.includes(valuesUncheck, key)
                        }
                        onChange={(item: FilterValue, checked: boolean) => {
                          const rows = hiddenRows.current;
                          hiddenRows.current = checked
                            ? _.without(rows, ...item.rows)
                            : _.concat(rows, item.rows);
                          setValuesUncheck(
                            produce((draft) => {
                              if (checked) {
                                _.pull(draft, item.key);
                              } else {
                                draft.push(item.key);
                              }
                            })
                          );
                        }}
                        isItemVisible={(item) => {
                          return showValues.length === data.flattenValues.length
                            ? true
                            : _.includes(showValues, item.text);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
        <Divider />
        <div className="fortune-menuitem-row">
          <div
            className="button-basic button-primary"
            onClick={() => {
              if (col == null) return;
              setContext((draftCtx) => {
                const rowHidden = _.reduce(
                  hiddenRows.current,
                  (pre, curr) => {
                    pre[curr] = 0;
                    return pre;
                  },
                  {} as Record<string, number>
                );
                saveFilter(
                  draftCtx,
                  hiddenRows.current.length > 0,
                  rowHidden,
                  { type: "values" },
                  startRow,
                  endRow,
                  col,
                  startCol,
                  endCol
                );
                hiddenRows.current = [];
                draftCtx.filterContextMenu = undefined;
              });
            }}
            tabIndex={0}
          >
            {filter.filterConform}
          </div>
          <div
            className="button-basic button-default"
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
            className="button-basic button-danger"
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
                className="button-basic button-primary"
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
                    hiddenRows.current = [];
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

export default FilterMenu;
