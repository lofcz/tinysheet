import React, {
  useContext,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  toolbarItemClickHandler,
  handleTextBackground,
  handleTextColor,
  handleTextSize,
  normalizedCellAttr,
  getFlowdata,
  newComment,
  editComment,
  deleteComment,
  showHideComment,
  showHideAllComments,
  autoSelectionFormula,
  handleSum,
  locale,
  handleMerge,
  handleBorder,
  toolbarItemSelectedFunc,
  handleFreeze,
  freezePanes,
  getPaneState,
  insertImage,
  showImgChooser,
  updateFormat,
  handleHorizontalAlign,
  handleVerticalAlign,
  handleScreenShot,
  applyLocation,
  buildFormatCode,
  formatValue,
  getFormatCategory,
  handleFormatPainter,
  openFormatCells,
  startFormatPainter,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { getToolbarItemRenderer } from "../../extensions";
import WorkbookContext from "../../context";
import "./index.css";
import Button from "./Button";
import Divider, { MenuDivider } from "./Divider";
import Combo from "./Combo";
import Select, { Option } from "./Select";
import SVGIcon from "../SVGIcon";
import { useDialog } from "../../hooks/useDialog";
import { FormulaSearch } from "../FormulaSearch";
import { SplitColumn } from "../SplitColumn";
import { LocationCondition } from "../LocationCondition";
import DataVerificationCombo from "../DataVerification/ToolbarCombo";
import SortFilterCombo from "../CustomSort/SortFilterCombo";
import ConditionalFormat from "../ConditionFormat";
import CustomButton from "./CustomButton";
import { CustomColor } from "./CustomColor";
import CustomBorder from "./CustomBorder";
import { NameManagerButton } from "../NameManager";
import { FormatAsTableButton } from "../Tables";
import ChartToolbarItem from "../Chart/ChartToolbarItem";
import CellStyles from "../CellStyles";
import ThemeSwitch from "./ThemeSwitch";
import MoreItemsContainer from "./MoreItemsContainer";
import { useToolbarPopup } from "./usePopup";

const toolbarTooltipAliases: Record<string, string> = {
  link: "insertLink",
  image: "insertImage",
  conditionFormat: "conditionalFormat",
  "horizontal-align": "horizontalAlign",
  "vertical-align": "verticalAlign",
  "text-wrap": "textWrap",
  "text-rotation": "textRotate",
  search: "findAndReplace",
};

const Toolbar: React.FC = () => {
  const { context, setContext, refs, settings, handleUndo, handleRedo } =
    useContext(WorkbookContext);
  // "More": the items that do not fit the toolbar's width
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const { onTriggerClick: onMoreClick } = useToolbarPopup(
    moreOpen,
    setMoreOpen,
    {
      containerRef: moreRef,
      popupRef: morePanelRef,
      triggerRef: moreButtonRef,
      exclusive: false,
    }
  );
  const contextRef = useRef(context);
  const containerRef = useRef<HTMLDivElement>(null);
  // how many of settings.toolbarItems fit the bar (null: all shown, to be
  // measured); the rest go to "More"
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const { showDialog, hideDialog } = useDialog();
  const firstSelection = context.luckysheet_select_save?.[0];
  const flowdata = getFlowdata(context);
  contextRef.current = context;
  const row = firstSelection?.row_focus;

  const col = firstSelection?.column_focus;
  const cell =
    flowdata && row != null && col != null ? flowdata?.[row]?.[col] : undefined;
  const {
    toolbar,
    merge,
    border,
    freezen,
    formula,
    align,
    textWrap,
    rotation,
    screenshot,
    splitText,
    findAndReplace,
    comment,
    fontarray,
  } = locale(context);
  const { numberFormatMenu, formatCells, cellStyles } = locale(context);
  const currency = context.currency || settings.currency || "$";
  // Excel's Number Format list (Home > Number)
  const numberFormatItems = useMemo(
    () =>
      [
        { key: "general", value: "General" },
        { key: "number", value: "0.00" },
        {
          key: "currency",
          value: buildFormatCode("currency", { decimals: 2, symbol: currency }),
        },
        {
          key: "accounting",
          value: buildFormatCode("accounting", {
            decimals: 2,
            symbol: currency,
          }),
        },
        { key: "shortDate", value: "m/d/yyyy" },
        { key: "longDate", value: "dddd, mmmm d, yyyy" },
        { key: "time", value: "h:mm:ss AM/PM" },
        { key: "percentage", value: "0.00%" },
        { key: "fraction", value: "# ?/?" },
        { key: "scientific", value: "0.00E+00" },
        { key: "text", value: "@" },
      ].map((item) => ({
        ...item,
        text: numberFormatMenu[item.key as keyof typeof numberFormatMenu],
      })),
    [currency, numberFormatMenu]
  );

  const [customColor, setcustomColor] = useState("#000000");
  const [customStyle, setcustomStyle] = useState("1");

  // The toolbar re-renders when the window (and with it the sheet) resizes;
  // a ResizeObserver also catches a container resized by the host page.
  const [, setContainerWidth] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() =>
      setContainerWidth(container.clientWidth)
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Which items fit. Measured after every render, because items change
  // width with the selection (font name, number format, ...): the widths
  // of the items shown are measured, those in "More" are remembered from
  // when they were last shown (all are shown at first).
  const itemWidths = useRef<number[]>([]);
  const measuredItems = useRef<unknown[] | null>(null);
  const toolbarItemCount = settings.toolbarItems.length;
  // every render (no dependency list); it only sets state when the number
  // of items that fit changed, so it settles after one extra render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // a changed item list is measured from scratch (all items shown)
    const list = [settings.toolbarItems, settings.customToolbarItems];
    if (
      measuredItems.current &&
      (measuredItems.current[0] !== list[0] ||
        measuredItems.current[1] !== list[1])
    ) {
      measuredItems.current = list;
      itemWidths.current = [];
      if (visibleCount !== null) {
        setVisibleCount(null);
        return;
      }
    }
    measuredItems.current = list;
    const shown = Math.min(visibleCount ?? toolbarItemCount, toolbarItemCount);
    const els = Array.from(
      container.querySelectorAll<HTMLElement>(".fortune-toolbar-item")
    ).filter((el) => !el.closest(".fortune-toolbar-more"));
    const customCount = els.length - shown;
    if (customCount < 0) return;
    const containerRect = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const rightOf = (el: HTMLElement) =>
      el.getBoundingClientRect().right - containerRect.left;
    const start = customCount > 0 ? rightOf(els[customCount - 1]) : padLeft;
    let prev = start;
    for (let i = 0; i < shown; i += 1) {
      const right = rightOf(els[customCount + i]);
      itemWidths.current[i] = Math.max(0, right - prev);
      prev = right;
    }
    const available = container.clientWidth - padRight;
    // the More button (and the gap before it)
    const moreWidth =
      (container
        .querySelector<HTMLElement>(".fortune-toolbar-more")
        ?.getBoundingClientRect().width || 36) + 2;
    let pos = start;
    let fit = 0; // items that fit next to the More button
    let all = true;
    for (let i = 0; i < toolbarItemCount; i += 1) {
      pos += itemWidths.current[i] ?? 0;
      if (pos > available) {
        all = false;
        break;
      }
      if (pos + moreWidth <= available) fit = i + 1;
    }
    // no separator right before the More button
    while (!all && fit > 0 && settings.toolbarItems[fit - 1] === "|") {
      fit -= 1;
    }
    const next = all ? toolbarItemCount : fit;
    if (next !== visibleCount) setVisibleCount(next);
  });

  const getToolbarItem = useCallback(
    (name: string, i: number) => {
      // Items whose locale key differs from the toolbar item name.
      const tooltipKey = toolbarTooltipAliases[name] ?? name;
      // @ts-ignore
      const tooltip: string = toolbar[tooltipKey] ?? "";
      if (name === "|") {
        return <Divider key={i} />;
      }
      // items registered by features (extensions.tsx)
      const registered = getToolbarItemRenderer(name);
      if (registered) {
        return (
          <React.Fragment key={name}>
            {registered({ name, tooltip })}
          </React.Fragment>
        );
      }
      if (["font-color", "background"].includes(name)) {
        const pick = (color: string | undefined) => {
          setContext((draftCtx) =>
            (name === "font-color" ? handleTextColor : handleTextBackground)(
              draftCtx,
              refs.cellInput.current!,
              color as string
            )
          );
          // "Reset color" does not change what the button applies
          if (!color) return;
          if (name === "font-color") {
            refs.globalCache.recentTextColor = color;
          } else {
            refs.globalCache.recentBackgroundColor = color;
          }
        };
        // Excel's defaults until a colour is picked: red text, yellow fill
        const recent =
          (name === "font-color"
            ? refs.globalCache.recentTextColor
            : refs.globalCache.recentBackgroundColor) ??
          (name === "font-color" ? "#ff0000" : "#ffff00");
        return (
          <div style={{ position: "relative" }} key={name}>
            <div
              style={{
                width: 17,
                height: 2,
                backgroundColor: recent,
                position: "absolute",
                bottom: 8,
                left: 9,
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <Combo iconId={name} tooltip={tooltip} onClick={() => pick(recent)}>
              {(setOpen) => (
                <CustomColor
                  onCustomPick={(color) => {
                    pick(color);
                    setOpen(false);
                  }}
                  onColorPick={pick}
                />
              )}
            </Combo>
          </div>
        );
      }
      if (name === "format") {
        const fa = cell?.ct?.fa;
        const category = getFormatCategory(fa);
        let currentFmt: string =
          numberFormatMenu[category as keyof typeof numberFormatMenu] ??
          formatCells.categories[category];
        if (category === "date") {
          const hit = numberFormatItems.find(
            (item) => item.value === fa && item.key.endsWith("Date")
          );
          if (hit) currentFmt = hit.text;
        } else if (category === "custom") {
          currentFmt = numberFormatMenu.custom;
        }
        const raw = cell?.v;
        const hasValue = raw != null && raw !== "";
        const numeric =
          hasValue && typeof raw !== "boolean" && Number.isFinite(Number(raw));
        const preview = (code: string, key: string) => {
          if (!hasValue) {
            return key === "general" ? numberFormatMenu.noSpecificFormat : "";
          }
          if (key === "text" || !numeric) return `${raw}`;
          return formatValue(code, Number(raw));
        };
        return (
          <Combo text={currentFmt} key={name} tooltip={tooltip}>
            {(setOpen) => (
              <Select>
                {numberFormatItems.map(({ key, text, value }) => (
                  <Option
                    key={key}
                    onClick={() => {
                      setOpen(false);
                      setContext((ctx) => {
                        const d = getFlowdata(ctx);
                        if (d == null) return;
                        updateFormat(
                          ctx,
                          refs.cellInput.current!,
                          d,
                          "ct",
                          value
                        );
                      });
                    }}
                  >
                    <div
                      className="fortune-toolbar-menu-line fortune-number-format-item"
                      data-format={key}
                    >
                      <div>{text}</div>
                      <div className="fortune-toolbar-subtext">
                        {preview(value, key)}
                      </div>
                    </div>
                  </Option>
                ))}
                <MenuDivider />
                <Option
                  onClick={() => {
                    setOpen(false);
                    setContext((ctx) => openFormatCells(ctx, "number"), {
                      noHistory: true,
                    });
                  }}
                >
                  <div className="fortune-toolbar-menu-line">
                    <div>{numberFormatMenu.moreFormats}</div>
                  </div>
                </Option>
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "cell-styles") {
        return (
          <Combo text={cellStyles.title} key={name} tooltip={cellStyles.title}>
            {(setOpen) => <CellStyles onApplied={() => setOpen(false)} />}
          </Combo>
        );
      }
      if (name === "format-painter") {
        return (
          <Button
            iconId={name}
            tooltip={tooltip}
            key={name}
            selected={!!context.luckysheetPaintModelOn}
            onClick={() =>
              setContext((draftCtx) => handleFormatPainter(draftCtx))
            }
            onDoubleClick={() =>
              setContext((draftCtx) => startFormatPainter(draftCtx, true))
            }
          />
        );
      }
      if (name === "font") {
        let current = fontarray[0];
        if (cell?.ff != null && cell.ff !== "") {
          // an index into the font list (as the canvas reads it) or a name
          current = /^\d+$/.test(String(cell.ff))
            ? (fontarray[Number(cell.ff)] ?? fontarray[0])
            : String(cell.ff);
        }
        return (
          <Combo text={current} key={name} tooltip={tooltip}>
            {(setOpen) => (
              <Select>
                {fontarray.map((o) => (
                  <Option
                    key={o}
                    checked={o.toLowerCase() === current.toLowerCase()}
                    onClick={() => {
                      setContext((ctx) => {
                        const d = getFlowdata(ctx);
                        if (!d) return;
                        updateFormat(ctx, refs.cellInput.current!, d, "ff", o);
                      });
                      setOpen(false);
                    }}
                  >
                    {/* each name in its own typeface, as in Excel */}
                    <span style={{ fontFamily: `"${o}"` }}>{o}</span>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "font-size") {
        const size = String(
          cell
            ? normalizedCellAttr(cell, "fs", context.defaultFontSize)
            : context.defaultFontSize
        );
        const applySize = (num: number) =>
          setContext((draftContext) =>
            handleTextSize(
              draftContext,
              refs.cellInput.current!,
              num,
              refs.canvas.current!.getContext("2d")!
            )
          );
        return (
          <Combo
            text={size}
            key={name}
            tooltip={tooltip}
            // a typed size, as in Excel (1 to 409 points, halves allowed)
            onCommit={(typed) => {
              const num = Math.round(Number(typed.trim()) * 2) / 2;
              if (Number.isFinite(num) && num >= 1 && num <= 409) {
                applySize(num);
              }
            }}
          >
            {(setOpen) => (
              <Select>
                {/* Excel's list */}
                {[
                  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
                ].map((num) => (
                  <Option
                    key={num}
                    checked={String(num) === size}
                    onClick={() => {
                      applySize(num);
                      setOpen(false);
                    }}
                  >
                    {num}
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "horizontal-align") {
        const items = [
          {
            title: "align-left",
            text: align.left,
            value: 1,
          },
          {
            title: "align-center",
            text: align.center,
            value: 0,
          },
          {
            title: "align-right",
            text: align.right,
            value: 2,
          },
        ];
        return (
          <Combo
            iconId={
              _.find(items, (item) => `${item.value}` === `${cell?.ht}`)
                ?.title || "align-left"
            }
            key={name}
            tooltip={toolbar.horizontalAlign}
          >
            {(setOpen) => (
              <Select>
                {items.map(({ text, title }) => (
                  <Option
                    key={title}
                    onClick={() => {
                      setContext((ctx) => {
                        handleHorizontalAlign(
                          ctx,
                          refs.cellInput.current!,
                          title.replace("align-", "")
                        );
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      {text}
                      <SVGIcon name={title} />
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "vertical-align") {
        const items = [
          {
            title: "align-top",
            text: align.top,
            value: 1,
          },
          {
            title: "align-middle",
            text: align.middle,
            value: 0,
          },
          {
            title: "align-bottom",
            text: align.bottom,
            value: 2,
          },
        ];
        return (
          <Combo
            iconId={
              _.find(items, (item) => `${item.value}` === `${cell?.vt}`)
                ?.title || "align-top"
            }
            key={name}
            tooltip={toolbar.verticalAlign}
          >
            {(setOpen) => (
              <Select>
                {items.map(({ text, title }) => (
                  <Option
                    key={title}
                    onClick={() => {
                      setContext((ctx) => {
                        handleVerticalAlign(
                          ctx,
                          refs.cellInput.current!,
                          title.replace("align-", "")
                        );
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      {text}
                      <SVGIcon name={title} />
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "undo") {
        return (
          <Button
            iconId={name}
            tooltip={tooltip}
            key={name}
            disabled={refs.globalCache.undoList.length === 0}
            onClick={() => handleUndo()}
          />
        );
      }
      if (name === "redo") {
        return (
          <Button
            iconId={name}
            tooltip={tooltip}
            key={name}
            disabled={refs.globalCache.redoList.length === 0}
            onClick={() => handleRedo()}
          />
        );
      }
      if (name === "screenshot") {
        return (
          <Button
            iconId={name}
            tooltip={tooltip}
            key={name}
            onClick={() => {
              const imgsrc = handleScreenShot(contextRef.current);
              if (imgsrc) {
                showDialog(
                  <div>
                    <div>{screenshot.screenshotTipSuccess}</div>
                    <img
                      src={imgsrc}
                      alt=""
                      style={{ maxWidth: "100%", maxHeight: "100%" }}
                    />
                  </div>
                );
              }
            }}
          />
        );
      }
      if (name === "splitColumn") {
        return (
          <Button
            iconId={name}
            tooltip={tooltip}
            key={name}
            onClick={() => {
              if (context.allowEdit === false) return;
              if (_.isUndefined(context.luckysheet_select_save)) {
                showDialog(splitText.tipNoSelect, "ok");
              } else {
                const currentColumn =
                  context.luckysheet_select_save[
                    context.luckysheet_select_save.length - 1
                  ].column;
                if (context.luckysheet_select_save.length > 1) {
                  showDialog(splitText.tipNoMulti, "ok");
                } else if (currentColumn[0] !== currentColumn[1]) {
                  showDialog(splitText.tipNoMultiColumn, "ok");
                } else {
                  showDialog(<SplitColumn />);
                }
              }
            }}
          />
        );
      }
      if (name === "formatAsTable") return <FormatAsTableButton key={name} />;
      if (name === "nameManager") return <NameManagerButton key={name} />;
      if (name === "dataVerification") {
        return <DataVerificationCombo tooltip={tooltip} key={name} />;
      }
      if (name === "locationCondition") {
        const items = [
          {
            text: findAndReplace.location,
            value: "location",
          },
          {
            text: findAndReplace.locationFormula,
            value: "locationFormula",
          },
          {
            text: findAndReplace.locationDate,
            value: "locationDate",
          },
          {
            text: findAndReplace.locationDigital,
            value: "locationDigital",
          },
          {
            text: findAndReplace.locationString,
            value: "locationString",
          },
          {
            text: findAndReplace.locationError,
            value: "locationError",
          },
          // TODO 条件格式
          // {
          //   text: findAndReplace.locationCondition,
          //   value: "locationCondition",
          // },
          {
            text: findAndReplace.locationRowSpan,
            value: "locationRowSpan",
          },
          {
            text: findAndReplace.columnSpan,
            value: "locationColumnSpan",
          },
        ];
        return (
          <Combo
            iconId="locationCondition"
            key={name}
            tooltip={findAndReplace.gotoSpecialTitle}
          >
            {(setOpen) => (
              <Select>
                {items.map(({ text, value }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      if (context.luckysheet_select_save == null) {
                        showDialog(freezen.noSeletionError, "ok");
                        return;
                      }
                      const last = context.luckysheet_select_save[0];
                      let range: { row: any[]; column: any[] }[];
                      let rangeArr = [];
                      if (
                        context.luckysheet_select_save?.length === 0 ||
                        (context.luckysheet_select_save?.length === 1 &&
                          last.row[0] === last.row[1] &&
                          last.column[0] === last.column[1])
                      ) {
                        // 当选中的是一个单元格，则变为全选
                        range = [
                          {
                            row: [0, flowdata!.length - 1],
                            column: [0, flowdata![0].length - 1],
                          },
                        ];
                      } else {
                        range = _.assignIn([], context.luckysheet_select_save);
                      }
                      if (value === "location") {
                        showDialog(<LocationCondition />);
                      } else if (value === "locationFormula") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationFormula",
                            "all",
                            ctx
                          );
                        });
                      } else if (value === "locationDate") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationConstant",
                            "d",
                            ctx
                          );
                        });
                      } else if (value === "locationDigital") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationConstant",
                            "n",
                            ctx
                          );
                        });
                      } else if (value === "locationString") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationConstant",
                            "s,g",
                            ctx
                          );
                        });
                      } else if (value === "locationError") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationConstant",
                            "e",
                            ctx
                          );
                        });
                      } else if (value === "locationCondition") {
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationCF",
                            undefined,
                            ctx
                          );
                        });
                      } else if (value === "locationRowSpan") {
                        if (
                          context.luckysheet_select_save?.length === 0 ||
                          (context.luckysheet_select_save?.length === 1 &&
                            context.luckysheet_select_save[0].row[0] ===
                              context.luckysheet_select_save[0].row[1])
                        ) {
                          showDialog(
                            findAndReplace.locationTiplessTwoRow,
                            "ok"
                          );
                          return;
                        }
                        range = _.assignIn([], context.luckysheet_select_save);
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationRowSpan",
                            undefined,
                            ctx
                          );
                        });
                      } else if (value === "locationColumnSpan") {
                        if (
                          context.luckysheet_select_save?.length === 0 ||
                          (context.luckysheet_select_save?.length === 1 &&
                            context.luckysheet_select_save[0].column[0] ===
                              context.luckysheet_select_save[0].column[1])
                        ) {
                          showDialog(
                            findAndReplace.locationTiplessTwoColumn,
                            "ok"
                          );
                          return;
                        }
                        range = _.assignIn([], context.luckysheet_select_save);
                        setContext((ctx) => {
                          rangeArr = applyLocation(
                            range,
                            "locationColumnSpan",
                            undefined,
                            ctx
                          );
                        });
                      }
                      if (rangeArr.length === 0 && value !== "location")
                        showDialog(findAndReplace.locationTipNotFindCell, "ok");
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">{text}</div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "conditionFormat") {
        const items = [
          "highlightCellRules",
          "itemSelectionRules",
          "dataBar",
          "colorGradation",
          "icons",
          "-",
          "newFormatRule",
          "deleteRule",
          "manageRules",
        ];
        return (
          <Combo
            iconId="conditionFormat"
            key={name}
            tooltip={toolbar.conditionalFormat}
          >
            {(setOpen) => <ConditionalFormat items={items} setOpen={setOpen} />}
          </Combo>
        );
      }
      if (name === "image") {
        return (
          <Button
            iconId={name}
            tooltip={toolbar.insertImage}
            key={name}
            onClick={() => {
              if (context.allowEdit === false) return;
              showImgChooser();
            }}
          >
            <input
              id="fortune-img-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;

                const render = new FileReader();
                render.readAsDataURL(file);
                render.onload = (event) => {
                  if (event.target == null) return;
                  const src = event.target?.result;
                  const image = new Image();
                  image.onload = () => {
                    setContext((draftCtx) => {
                      insertImage(draftCtx, image);
                    });
                  };
                  image.src = src as string;
                };
                e.currentTarget.value = "";
              }}
            />
          </Button>
        );
      }
      if (name === "chart") {
        return <ChartToolbarItem key={name} />;
      }
      if (name === "comment") {
        const last =
          context.luckysheet_select_save?.[
            context.luckysheet_select_save.length - 1
          ];
        let row_index = last?.row_focus;
        let col_index = last?.column_focus;
        if (!last) {
          row_index = 0;
          col_index = 0;
        } else {
          if (row_index == null) {
            [row_index] = last.row;
          }
          if (col_index == null) {
            [col_index] = last.column;
          }
        }
        let itemData: { key: any; text: any; onClick: any }[];
        if (flowdata?.[row_index]?.[col_index]?.ps != null) {
          itemData = [
            { key: "edit", text: comment.edit, onClick: editComment },
            { key: "delete", text: comment.delete, onClick: deleteComment },
            {
              key: "showOrHide",
              text: comment.showOne,
              onClick: showHideComment,
            },
            {
              key: "showOrHideAll",
              text: comment.showAll,
              onClick: showHideAllComments,
            },
          ];
        } else {
          itemData = [
            { key: "new", text: comment.insert, onClick: newComment },
            {
              key: "showOrHideAll",
              text: comment.showAll,
              onClick: showHideAllComments,
            },
          ];
        }
        return (
          <Combo iconId={name} key={name} tooltip={tooltip}>
            {(setOpen) => (
              <Select>
                {itemData.map(({ key, text, onClick }) => (
                  <Option
                    key={key}
                    onClick={() => {
                      setContext((draftContext) =>
                        onClick(
                          draftContext,
                          refs.globalCache,
                          row_index,
                          col_index
                        )
                      );
                      setOpen(false);
                    }}
                  >
                    {text}
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }

      if (name === "quick-formula") {
        const itemData = [
          { text: formula.sum, value: "SUM" },
          { text: formula.average, value: "AVERAGE" },
          { text: formula.count, value: "COUNT" },
          { text: formula.max, value: "MAX" },
          { text: formula.min, value: "MIN" },
        ];
        return (
          <Combo
            iconId="formula-sum"
            key={name}
            tooltip={toolbar.autoSum}
            onClick={() =>
              setContext((ctx) => {
                handleSum(
                  ctx,
                  refs.cellInput.current!,
                  refs.fxInput.current,
                  refs.globalCache!
                );
              })
            }
          >
            {(setOpen) => (
              <Select>
                {itemData.map(({ value, text }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      setContext((ctx) => {
                        autoSelectionFormula(
                          ctx,
                          refs.cellInput.current!,
                          refs.fxInput.current,
                          value,
                          refs.globalCache
                        );
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      <div>{text}</div>
                      <div className="fortune-toolbar-subtext">{value}</div>
                    </div>
                  </Option>
                ))}
                <MenuDivider />
                <Option
                  key="formula"
                  onClick={() => {
                    showDialog(<FormulaSearch onCancel={hideDialog} />);
                    setOpen(false);
                  }}
                >{`${formula.find}...`}</Option>
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "merge-cell") {
        const itemdata = [
          { text: merge.mergeAll, value: "merge-all" },
          { text: merge.mergeV, value: "merge-vertical" },
          { text: merge.mergeH, value: "merge-horizontal" },
          { text: merge.mergeCancel, value: "merge-cancel" },
        ];
        return (
          <Combo
            iconId="merge-all"
            key={name}
            tooltip={tooltip}
            text={merge.mergeAll}
            onClick={() =>
              setContext((ctx) => {
                handleMerge(ctx, "merge-all");
              })
            }
          >
            {(setOpen) => (
              <Select>
                {itemdata.map(({ text, value }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      setContext((ctx) => {
                        handleMerge(ctx, value);
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      <SVGIcon name={value} style={{ marginRight: 4 }} />
                      {text}
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "border") {
        const items = [
          {
            text: border.borderTop,
            value: "border-top",
          },
          {
            text: border.borderBottom,
            value: "border-bottom",
          },
          {
            text: border.borderLeft,
            value: "border-left",
          },
          {
            text: border.borderRight,
            value: "border-right",
          },
          { text: "", value: "divider" },
          {
            text: border.borderNone,
            value: "border-none",
          },
          {
            text: border.borderAll,
            value: "border-all",
          },
          {
            text: border.borderOutside,
            value: "border-outside",
          },
          { text: "", value: "divider" },
          {
            text: border.borderInside,
            value: "border-inside",
          },
          {
            text: border.borderHorizontal,
            value: "border-horizontal",
          },
          {
            text: border.borderVertical,
            value: "border-vertical",
          },
          {
            text: border.borderSlash,
            value: "border-slash",
          },
          { text: "", value: "divider" },
        ];
        return (
          <Combo
            iconId="border-all"
            key={name}
            tooltip={tooltip}
            text={border.borderAll}
            onClick={() =>
              setContext((ctx) => {
                handleBorder(ctx, "border-all", customColor, customStyle);
              })
            }
          >
            {(setOpen) => (
              <Select>
                {items.map(({ text, value }, ii) =>
                  value !== "divider" ? (
                    <Option
                      key={value}
                      onClick={() => {
                        setContext((ctx) => {
                          handleBorder(ctx, value, customColor, customStyle);
                        });
                        setOpen(false);
                      }}
                    >
                      <div className="fortune-toolbar-menu-line">
                        {text}
                        <SVGIcon name={value} />
                      </div>
                    </Option>
                  ) : (
                    <MenuDivider key={ii} />
                  )
                )}
                <CustomBorder
                  color={customColor}
                  style={customStyle}
                  onPick={(color, style) => {
                    setcustomColor(color);
                    setcustomStyle(style);
                  }}
                />
              </Select>
            )}
          </Combo>
        );
      }

      if (name === "freeze") {
        // Excel's View > Freeze Panes menu, plus Split
        const panes = getPaneState(context);
        const items = [
          panes === "frozen"
            ? {
                text: freezen.unfreezePanes,
                value: "unfreeze",
                icon: "freeze-cancel",
              }
            : {
                text: freezen.freezePanes,
                value: "freeze-panes",
                icon: "freeze-row-col",
              },
          {
            text: freezen.freezeTopRow,
            value: "freeze-top-row",
            icon: "freeze-row",
          },
          {
            text: freezen.freezeFirstColumn,
            value: "freeze-first-column",
            icon: "freeze-col",
          },
          {
            text: panes === "split" ? freezen.removeSplit : freezen.splitPanes,
            value: "split",
            icon: "freeze-row-col",
          },
        ];
        const runFreeze = (value: string) => {
          if (
            value === "freeze-panes" &&
            freezePanes(context, "panes", { dryRun: true }) === "tooLarge"
          ) {
            showDialog(freezen.rangeRCOverError, "ok");
            return;
          }
          setContext((ctx) => {
            handleFreeze(ctx, value);
          });
        };
        return (
          <Combo
            iconId="freeze-row-col"
            key={name}
            tooltip={tooltip}
            onClick={() =>
              runFreeze(panes === "frozen" ? "unfreeze" : "freeze-panes")
            }
          >
            {(setOpen) => (
              <Select>
                {items.map(({ text, value, icon }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      runFreeze(value);
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      {text}
                      <SVGIcon name={icon} />
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "text-wrap") {
        const items = [
          {
            text: textWrap.clip,
            iconId: "text-clip",
            value: "clip",
          },
          {
            text: textWrap.overflow,
            iconId: "text-overflow",
            value: "overflow",
          },
          {
            text: textWrap.wrap,
            iconId: "text-wrap",
            value: "wrap",
          },
        ];
        let curr = items[0];
        if (cell?.tb != null) {
          curr = _.get(items, cell.tb);
        }
        return (
          <Combo iconId={curr.iconId} key={name} tooltip={toolbar.textWrap}>
            {(setOpen) => (
              <Select>
                {items.map(({ text, iconId, value }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      setContext((ctx) => {
                        const d = getFlowdata(ctx);
                        if (d == null) return;
                        updateFormat(
                          ctx,
                          refs.cellInput.current!,
                          d,
                          "tb",
                          value
                        );
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      {text}
                      <SVGIcon name={iconId} />
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "text-rotation") {
        const items = [
          { text: rotation.none, iconId: "text-rotation-none", value: "none" },
          {
            text: rotation.angleup,
            iconId: "text-rotation-angleup",
            value: "angleup",
          },
          {
            text: rotation.angledown,
            iconId: "text-rotation-angledown",
            value: "angledown",
          },
          {
            text: rotation.vertical,
            iconId: "text-rotation-vertical",
            value: "vertical",
          },
          {
            text: rotation.rotationUp,
            iconId: "text-rotation-up",
            value: "rotation-up",
          },
          {
            text: rotation.rotationDown,
            iconId: "text-rotation-down",
            value: "rotation-down",
          },
        ];
        let curr = items[0];
        if (cell?.tr != null) {
          curr = _.get(items, cell.tr);
        }
        return (
          <Combo iconId={curr.iconId} key={name} tooltip={toolbar.textRotate}>
            {(setOpen) => (
              <Select>
                {items.map(({ text, iconId, value }) => (
                  <Option
                    key={value}
                    onClick={() => {
                      setContext((ctx) => {
                        const d = getFlowdata(ctx);
                        if (d == null) return;
                        updateFormat(
                          ctx,
                          refs.cellInput.current!,
                          d,
                          "tr",
                          value
                        );
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="fortune-toolbar-menu-line">
                      {text}
                      <SVGIcon name={iconId} />
                    </div>
                  </Option>
                ))}
              </Select>
            )}
          </Combo>
        );
      }
      if (name === "filter") {
        return <SortFilterCombo tooltip={toolbar.sortAndFilter} key={name} />;
      }
      if (name === "theme") {
        return <ThemeSwitch key={name} />;
      }
      return (
        <Button
          iconId={name}
          tooltip={tooltip}
          key={name}
          selected={toolbarItemSelectedFunc(name)?.(cell)}
          onClick={() =>
            setContext((draftCtx) => {
              toolbarItemClickHandler(name)?.(
                draftCtx,
                refs.cellInput.current!,
                refs.globalCache
              );
            })
          }
        />
      );
    },
    [
      toolbar,
      cell,
      setContext,
      refs.cellInput,
      refs.fxInput,
      refs.globalCache,
      numberFormatItems,
      numberFormatMenu,
      formatCells,
      cellStyles,
      context.luckysheetPaintModelOn,
      align,
      handleUndo,
      handleRedo,
      flowdata,
      formula,
      showDialog,
      hideDialog,
      merge,
      border,
      freezen,
      screenshot,
      textWrap,
      rotation,
      splitText,
      findAndReplace,
      context.luckysheet_select_save,
      context.defaultFontSize,
      context.allowEdit,
      comment,
      fontarray,
      refs.canvas,
      customColor,
      customStyle,
    ]
  );

  // Left / Right / Home / End move between the buttons of the bar (as in a
  // toolbar); inside menus and the More panel the keys stay theirs
  const onToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (
      target.getAttribute("role") !== "button" ||
      target.closest(
        ".fortune-toolbar-combo-popup, .fortune-toolbar-more-container"
      )
    ) {
      return;
    }
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="button"]')
    ).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest(
          ".fortune-toolbar-combo-popup, .fortune-toolbar-more-container"
        )
    );
    const index = buttons.indexOf(target);
    if (index < 0) return;
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % buttons.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else next = buttons.length - 1;
    e.preventDefault();
    e.stopPropagation();
    buttons[next].focus();
  };

  const shownCount = Math.min(
    visibleCount ?? settings.toolbarItems.length,
    settings.toolbarItems.length
  );

  return (
    <header>
      <div
        ref={containerRef}
        className="fortune-toolbar"
        role="toolbar"
        aria-label={toolbar.toolbar}
        onKeyDown={onToolbarKeyDown}
      >
        {settings.customToolbarItems.map((n) => {
          return (
            <CustomButton
              tooltip={n.tooltip}
              onClick={n.onClick}
              key={n.key}
              icon={n.icon}
              iconName={n.iconName}
            >
              {n.children}
            </CustomButton>
          );
        })}
        {settings.customToolbarItems?.length > 0 ? (
          <Divider key="customDivider" />
        ) : null}
        {settings.toolbarItems
          .slice(0, shownCount)
          .map((name, i) => getToolbarItem(name, i))}
        {shownCount < settings.toolbarItems.length ? (
          <div ref={moreRef} className="fortune-toolbar-more">
            <Button
              iconId="more"
              tooltip={toolbar.toolMore}
              expanded={moreOpen}
              buttonRef={moreButtonRef}
              onClick={(e) => onMoreClick(e, () => setMoreOpen((o) => !o))}
            />
            {moreOpen && (
              // rendered with the toolbar, so the overflow items show the
              // current state (bold, font size, undo, ...) like the bar
              <MoreItemsContainer
                ref={morePanelRef}
                label={toolbar.toolMoreTip}
              >
                {settings.toolbarItems
                  .slice(shownCount)
                  .map((name, i) => getToolbarItem(name, i + shownCount))}
              </MoreItemsContainer>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Toolbar;
