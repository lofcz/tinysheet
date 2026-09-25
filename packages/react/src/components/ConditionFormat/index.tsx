import React, { useCallback, useContext } from "react";
import "./index.css";
import {
  locale,
  addCFRule,
  addColorScaleRule,
  addDataBarRule,
  addIconSetRule,
  clearCFRules,
  cleanCFRanges,
  colorScaleFromPreset,
  makeDataBar,
  makeIconSet,
  CF_COLOR_SCALE_PRESETS,
  CF_DATA_BAR_COLORS,
  CF_ICON_SET_GROUPS,
} from "@lofcz/tinysheet-core";
import type { CFRule } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Select, { Option } from "../Toolbar/Select";
import SVGIcon from "../SVGIcon";
import { useDialog } from "../../hooks/useDialog";
import ConditionRules from "./ConditionRules";
import ManageRules from "./ManageRules";
import RuleEditor from "./RuleEditor";
import { MenuDivider } from "../Toolbar/Divider";
import {
  CFText,
  ColorScaleSwatch,
  DataBarSwatch,
  IconSetPreview,
} from "./previews";

function activate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }
  };
}

/** New Formatting Rule as a standalone dialog; stores the rule on OK. */
const NewRuleDialog: React.FC<{ rule: CFRule }> = ({ rule }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const loc = locale(context);
  return (
    <div className="fortune-cf-dialog">
      <RuleEditor
        rule={rule}
        isNew
        text={loc.conditionformat as unknown as CFText}
        buttons={{ confirm: loc.button.confirm, cancel: loc.button.cancel }}
        onCancel={hideDialog}
        onOk={(r) => {
          setContext((ctx) => {
            addCFRule(ctx, r);
          });
          hideDialog();
        }}
      />
    </div>
  );
};

const ConditionalFormat: React.FC<{
  items: string[];
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ items, setOpen }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const text = locale(context).conditionformat as unknown as CFText;

  // 子菜单溢出屏幕时，重新定位子菜单位置
  // re-position the subMenu if it overflows the window
  const showSubMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const menuItem = e.currentTarget;
      const line = menuItem.querySelector(
        ".fortune-toolbar-menu-line"
      ) as HTMLDivElement | null;
      const subMenu = menuItem.querySelector(
        ".condition-format-sub-menu"
      ) as HTMLDivElement | null;
      if (!subMenu || !line) return;
      const menuItemRect = menuItem.getBoundingClientRect();
      const lineRect = line.getBoundingClientRect();
      const containerRect =
        refs.workbookContainer.current!.getBoundingClientRect();
      const width = parseFloat(subMenu.style.width);
      subMenu.style.display = "block";
      if (containerRect.right - menuItemRect.right < width) {
        // open to the left of the menu
        subMenu.style.left = `${menuItemRect.left - lineRect.left - width}px`;
      } else {
        subMenu.style.left = `${menuItemRect.right - lineRect.left}px`;
      }
      subMenu.style.right = "auto";
    },
    [refs.workbookContainer]
  );

  const hideSubMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const subMenu = e.currentTarget.querySelector(
        ".condition-format-sub-menu"
      ) as HTMLDivElement | null;
      if (subMenu) subMenu.style.display = "none";
    },
    []
  );

  const selection = useCallback(
    () => cleanCFRanges(context.luckysheet_select_save),
    [context.luckysheet_select_save]
  );

  const openEditor = useCallback(
    (rule: Omit<CFRule, "cellrange">) => {
      setOpen(false);
      showDialog(
        <NewRuleDialog rule={{ ...rule, cellrange: selection() } as CFRule} />
      );
    },
    [selection, setOpen, showDialog]
  );

  const run = useCallback(
    (fn: (ctx: any) => void) => {
      setOpen(false);
      setContext((ctx) => {
        fn(ctx);
      });
    },
    [setContext, setOpen]
  );

  const subMenu = (
    name: string,
    width: number,
    children: React.ReactNode
  ): React.ReactNode => (
    <Option key={name} onMouseEnter={showSubMenu} onMouseLeave={hideSubMenu}>
      <div className="fortune-toolbar-menu-line">
        {text[name]}
        <SVGIcon name="rightArrow" width={18} />
        <div
          className="condition-format-sub-menu"
          role="menu"
          style={{ display: "none", width }}
        >
          {children}
        </div>
      </div>
    </Option>
  );

  const menuItem = (
    key: string,
    label: React.ReactNode,
    onClick: () => void,
    hint?: React.ReactNode
  ) => (
    <div
      className="condition-format-item"
      key={key}
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={activate(onClick)}
      tabIndex={0}
    >
      {label}
      {hint !== undefined && <span>{hint}</span>}
    </div>
  );

  const moreRules = (rule: Omit<CFRule, "cellrange">) => [
    <div className="horizontal-line" key="more-line" />,
    menuItem("moreRules", text.moreRules, () => openEditor(rule)),
  ];

  const getConditionFormatItem = (name: string): React.ReactNode => {
    if (name === "-") {
      return <MenuDivider key={name} />;
    }
    if (name === "highlightCellRules") {
      return subMenu(name, 190, [
        ...[
          { type: "greaterThan", hint: ">" },
          { type: "lessThan", hint: "<" },
          { type: "between", hint: "[ ]" },
          { type: "equal", hint: "=" },
          { type: "textContains", hint: "ab" },
          { type: "occurrenceDate", hint: "" },
          { type: "duplicateValue", hint: "" },
        ].map((v) =>
          menuItem(
            v.type,
            text[`qt_${v.type}`],
            () => {
              setOpen(false);
              showDialog(<ConditionRules type={v.type} />);
            },
            v.hint
          )
        ),
        ...moreRules({
          type: "default",
          conditionName: "between",
          conditionValue: ["", ""],
          format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
        }),
      ]);
    }
    if (name === "itemSelectionRules") {
      return subMenu(name, 190, [
        ...[
          "top10",
          "top10_percent",
          "last10",
          "last10_percent",
          "aboveAverage",
          "belowAverage",
        ].map((type) =>
          menuItem(type, text[`qt_${type}`], () => {
            setOpen(false);
            showDialog(<ConditionRules type={type} />);
          })
        ),
        ...moreRules({
          type: "default",
          conditionName: "top10",
          conditionValue: [10],
          format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
        }),
      ]);
    }
    if (name === "dataBar") {
      const gallery = (gradient: boolean) => (
        <div className="fortune-cf-gallery">
          {CF_DATA_BAR_COLORS.map((color, i) => {
            const label =
              text[`${gradient ? "gradient" : "solidColor"}DataBar_${i + 1}`];
            return (
              <div
                key={color}
                className="fortune-cf-gallery-item"
                role="menuitem"
                tabIndex={0}
                title={label}
                aria-label={label}
                onClick={(e) => {
                  e.stopPropagation();
                  run((ctx) =>
                    addDataBarRule(ctx, makeDataBar(color, gradient))
                  );
                }}
                onKeyDown={activate(() =>
                  run((ctx) =>
                    addDataBarRule(ctx, makeDataBar(color, gradient))
                  )
                )}
              >
                <DataBarSwatch color={color} gradient={gradient} />
              </div>
            );
          })}
        </div>
      );
      return subMenu(name, 176, [
        <div className="fortune-cf-gallery-title" key="g">
          {text.gradientFill}
        </div>,
        <React.Fragment key="gg">{gallery(true)}</React.Fragment>,
        <div className="fortune-cf-gallery-title" key="s">
          {text.solidFill}
        </div>,
        <React.Fragment key="sg">{gallery(false)}</React.Fragment>,
        ...moreRules({
          type: "dataBar",
          dataBar: makeDataBar(CF_DATA_BAR_COLORS[0], true),
        }),
      ]);
    }
    if (name === "colorGradation") {
      return subMenu(name, 176, [
        <div className="fortune-cf-gallery" key="gallery">
          {CF_COLOR_SCALE_PRESETS.map((colors, i) => {
            const label = text[`colorGradation_${i + 1}`];
            const apply = () =>
              run((ctx) =>
                addColorScaleRule(ctx, colorScaleFromPreset(colors))
              );
            return (
              <div
                key={colors.join()}
                className="fortune-cf-gallery-item"
                role="menuitem"
                tabIndex={0}
                title={label}
                aria-label={label}
                onClick={(e) => {
                  e.stopPropagation();
                  apply();
                }}
                onKeyDown={activate(apply)}
              >
                <ColorScaleSwatch colors={colors} />
              </div>
            );
          })}
        </div>,
        ...moreRules({
          type: "colorGradation",
          colorScale: {
            stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]),
          },
        }),
      ]);
    }
    if (name === "icons") {
      return subMenu(name, 250, [
        ...CF_ICON_SET_GROUPS.map((g) => (
          <React.Fragment key={g.key}>
            <div className="fortune-cf-gallery-title">
              {text[`isGroup_${g.key}`]}
            </div>
            <div className="fortune-cf-gallery fortune-cf-gallery-icons">
              {g.sets.map((set) => {
                const label = text[`is_${set}`] ?? set;
                const apply = () =>
                  run((ctx) => addIconSetRule(ctx, makeIconSet(set)));
                return (
                  <div
                    key={set}
                    className="fortune-cf-gallery-item"
                    role="menuitem"
                    tabIndex={0}
                    title={label}
                    aria-label={label}
                    onClick={(e) => {
                      e.stopPropagation();
                      apply();
                    }}
                    onKeyDown={activate(apply)}
                  >
                    <IconSetPreview name={set} size={14} />
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        )),
        ...moreRules({
          type: "icons",
          iconSet: makeIconSet("3TrafficLights1"),
        }),
      ]);
    }
    if (name === "newFormatRule") {
      return (
        <Option
          key={name}
          onClick={() =>
            openEditor({
              type: "default",
              conditionName: "between",
              conditionValue: ["", ""],
              format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
            })
          }
        >
          <div className="fortune-toolbar-menu-line">{text.newRule}</div>
        </Option>
      );
    }
    if (name === "deleteRule") {
      return subMenu("clearRules", 230, [
        menuItem("selection", text.clearRulesSelection, () =>
          run((ctx) => clearCFRules(ctx, "selection"))
        ),
        menuItem("sheet", text.clearRulesSheet, () =>
          run((ctx) => clearCFRules(ctx, "sheet"))
        ),
      ]);
    }
    if (name === "manageRules") {
      return (
        <Option
          key={name}
          onClick={() => {
            setOpen(false);
            showDialog(<ManageRules />);
          }}
        >
          <div className="fortune-toolbar-menu-line">{text.manageRules}</div>
        </Option>
      );
    }
    return <div key={name} />;
  };

  return (
    <div className="condition-format">
      <Select style={{ overflow: "visible" }}>
        {items.map((v) => (
          <div key={`option${v}`}>{getConditionFormatItem(v)}</div>
        ))}
      </Select>
    </div>
  );
};

export default ConditionalFormat;
