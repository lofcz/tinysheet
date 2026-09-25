/**
 * Home › Styles: Conditional Formatting (Highlight Cells Rules, Top/Bottom
 * Rules, Data Bars, Color Scales, Icon Sets, New / Clear / Manage Rules),
 * Format as Table (the style gallery) and Cell Styles (the style gallery).
 * The galleries are the feature's own components in a ribbon drop-down.
 */
import React, { useContext } from "react";
import {
  Highlighter,
  ListOrdered,
  SwatchBook,
  Table,
  ChartBarBig,
  Shapes,
  Blend,
} from "lucide-react";
import {
  addColorScaleRule,
  addDataBarRule,
  addIconSetRule,
  CF_COLOR_SCALE_PRESETS,
  CF_DATA_BAR_COLORS,
  CF_ICON_SET_GROUPS,
  CFRule,
  clearCFRules,
  cleanCFRanges,
  colorScaleFromPreset,
  locale,
  makeDataBar,
  makeIconSet,
  addCFRule,
  setTableOptions,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { useDialog } from "../../../../hooks/useDialog";
import { LargeButton, MenuButton, MenuItem } from "../../../ui";
import CellStyles from "../../../CellStyles";
import ConditionRules from "../../../ConditionFormat/ConditionRules";
import ManageRules from "../../../ConditionFormat/ManageRules";
import RuleEditor from "../../../ConditionFormat/RuleEditor";
import {
  CFText,
  ColorScaleSwatch,
  DataBarSwatch,
  IconSetPreview,
} from "../../../ConditionFormat/previews";
import {
  activeTable,
  CreateTableDialog,
  StyleGallery,
  TableDesignDialog,
} from "../../../Tables";
import { useInsertSlicer } from "../../../Tables/Slicers";
import type { RibbonCommandProps } from "../../registry";
import { useHome } from "./shared";

/** New Formatting Rule as a dialog; stores the rule on OK. */
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

const DEFAULT_FORMAT = { cellColor: "#FFC7CE", textColor: "#9C0006" };

/** A gallery of swatches inside a submenu (Data Bars, Color Scales, …). */
const Gallery: React.FC<{
  items: {
    key: string;
    label: string;
    node: React.ReactNode;
    run: () => void;
  }[];
  close: () => void;
  wide?: boolean;
}> = ({ items, close, wide }) => (
  <div
    className={`ts-home-gallery${wide ? " ts-home-gallery--wide" : ""}`}
    role="group"
  >
    {items.map((it) => (
      <button
        key={it.key}
        type="button"
        className="ts-home-gallery-item"
        aria-label={it.label}
        title={it.label}
        onClick={() => {
          close();
          it.run();
        }}
      >
        {it.node}
      </button>
    ))}
  </div>
);

export const ConditionalFormattingCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const home = useHome();
  const { t, h } = home;
  const text = locale(home.context).conditionformat as unknown as CFText;
  const selection = () => cleanCFRanges(home.context.luckysheet_select_save);
  const rules = (type: string) => () =>
    h.showDialog(<ConditionRules type={type} />);
  const newRule = (rule: Omit<CFRule, "cellrange">) => () =>
    h.showDialog(
      <NewRuleDialog rule={{ ...rule, cellrange: selection() } as CFRule} />
    );
  const run = (fn: (ctx: any) => void) => home.run(fn);
  const quick = (types: string[]): MenuItem[] =>
    types.map((type) => ({
      id: `cf-${type}`,
      label: text[`qt_${type}`],
      onSelect: rules(type),
    }));
  const more = (rule: Omit<CFRule, "cellrange">): MenuItem[] => [
    { type: "separator" },
    { id: "cf-more", label: t.cfMoreRules, onSelect: newRule(rule) },
  ];
  const menu: MenuItem[] = [
    {
      id: "cf-highlight",
      label: t.cfHighlight,
      icon: Highlighter,
      children: [
        ...quick([
          "greaterThan",
          "lessThan",
          "between",
          "equal",
          "textContains",
          "occurrenceDate",
          "duplicateValue",
        ]),
        ...more({
          type: "default",
          conditionName: "between",
          conditionValue: ["", ""],
          format: DEFAULT_FORMAT,
        } as any),
      ],
    },
    {
      id: "cf-top-bottom",
      label: t.cfTopBottom,
      icon: ListOrdered,
      children: [
        ...quick([
          "top10",
          "top10_percent",
          "last10",
          "last10_percent",
          "aboveAverage",
          "belowAverage",
        ]),
        ...more({
          type: "default",
          conditionName: "top10",
          conditionValue: [10],
          format: DEFAULT_FORMAT,
        } as any),
      ],
    },
    { type: "separator" },
    {
      id: "cf-data-bars",
      label: t.cfDataBars,
      icon: ChartBarBig,
      children: [
        { type: "header", label: t.cfGradientFill },
        ...[true, false].flatMap((gradient): MenuItem[] => [
          ...(gradient
            ? []
            : [{ type: "header", label: t.cfSolidFill } as MenuItem]),
          {
            type: "custom",
            id: `cf-bars-${gradient}`,
            render: (close) => (
              <Gallery
                close={close}
                items={CF_DATA_BAR_COLORS.map((color: string, i: number) => ({
                  key: color,
                  label:
                    text[
                      `${gradient ? "gradient" : "solidColor"}DataBar_${i + 1}`
                    ] ?? color,
                  node: <DataBarSwatch color={color} gradient={gradient} />,
                  run: () =>
                    run((ctx) =>
                      addDataBarRule(ctx, makeDataBar(color, gradient))
                    ),
                }))}
              />
            ),
          },
        ]),
        ...more({
          type: "dataBar",
          dataBar: makeDataBar(CF_DATA_BAR_COLORS[0], true),
        } as any),
      ],
    },
    {
      id: "cf-color-scales",
      label: t.cfColorScales,
      icon: Blend,
      children: [
        {
          type: "custom",
          id: "cf-scales",
          render: (close) => (
            <Gallery
              close={close}
              items={CF_COLOR_SCALE_PRESETS.map(
                (colors: string[], i: number) => ({
                  key: colors.join(),
                  label: text[`colorGradation_${i + 1}`] ?? colors.join(),
                  node: <ColorScaleSwatch colors={colors} />,
                  run: () =>
                    run((ctx) =>
                      addColorScaleRule(ctx, colorScaleFromPreset(colors))
                    ),
                })
              )}
            />
          ),
        },
        ...more({
          type: "colorGradation",
          colorScale: {
            stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]),
          },
        } as any),
      ],
    },
    {
      id: "cf-icon-sets",
      label: t.cfIconSets,
      icon: Shapes,
      children: [
        ...CF_ICON_SET_GROUPS.flatMap((g): MenuItem[] => [
          { type: "header", label: text[`isGroup_${g.key}`] ?? g.key },
          {
            type: "custom",
            id: `cf-icons-${g.key}`,
            render: (close) => (
              <Gallery
                wide
                close={close}
                items={g.sets.map((set) => ({
                  key: set,
                  label: text[`is_${set}`] ?? set,
                  node: <IconSetPreview name={set} size={14} />,
                  run: () =>
                    run((ctx) => addIconSetRule(ctx, makeIconSet(set))),
                }))}
              />
            ),
          },
        ]),
        ...more({
          type: "icons",
          iconSet: makeIconSet("3TrafficLights1"),
        } as any),
      ],
    },
    { type: "separator" },
    {
      id: "cf-new-rule",
      label: t.cfNewRule,
      onSelect: newRule({
        type: "default",
        conditionName: "between",
        conditionValue: ["", ""],
        format: DEFAULT_FORMAT,
      } as any),
    },
    {
      id: "cf-clear",
      label: t.cfClearRules,
      children: [
        {
          id: "cf-clear-selection",
          label: t.cfClearSelection,
          onSelect: () => run((ctx) => clearCFRules(ctx, "selection")),
        },
        {
          id: "cf-clear-sheet",
          label: t.cfClearSheet,
          onSelect: () => run((ctx) => clearCFRules(ctx, "sheet")),
        },
      ],
    },
    {
      id: "cf-manage",
      label: t.cfManageRules,
      onSelect: () => h.showDialog(<ManageRules />),
    },
  ];
  if (size === "small") {
    return (
      <MenuButton
        icon={Highlighter}
        label={t.conditionalFormatting}
        description={t.conditionalFormattingDescription}
        disabled={!home.editable}
        menu={menu}
      />
    );
  }
  return (
    <LargeButton
      icon={Highlighter}
      label={t.conditionalFormatting}
      description={t.conditionalFormattingDescription}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

const TableGallery: React.FC<{ close: () => void }> = ({ close }) => {
  const home = useHome();
  const { t, h } = home;
  const inTable = activeTable(home.context);
  const insertSlicer = useInsertSlicer();
  return (
    <div className="ts-home-table-gallery fortune-table-menu">
      <StyleGallery
        selected={inTable?.table.style}
        onPick={(key) => {
          close();
          if (!home.editable) return;
          if (inTable) {
            home.run((ctx) => {
              setTableOptions(ctx, inTable.table.name, { style: key });
            });
          } else {
            h.showDialog(<CreateTableDialog styleKey={key} />);
          }
        }}
      />
      {inTable && (
        <div className="ts-home-gallery-footer">
          <button
            type="button"
            className="ts-home-footer-item"
            onClick={() => {
              close();
              h.showDialog(
                <TableDesignDialog tableName={inTable.table.name} />
              );
            }}
          >
            {t.tableDesign}
          </button>
          {inTable.table.headerRow && (
            <button
              type="button"
              className="ts-home-footer-item"
              onClick={() => {
                close();
                insertSlicer();
              }}
            >
              {t.insertSlicer}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const FormatAsTableCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const home = useHome();
  const { t } = home;
  const popover = (close: () => void) => <TableGallery close={close} />;
  if (size === "small") {
    return (
      <MenuButton
        icon={Table}
        label={t.formatAsTable}
        description={t.formatAsTableDescription}
        disabled={!home.editable}
        popover={popover}
      />
    );
  }
  return (
    <LargeButton
      icon={Table}
      label={t.formatAsTable}
      description={t.formatAsTableDescription}
      disabled={!home.editable}
      popover={popover}
    />
  );
};

export const CellStylesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const home = useHome();
  const { t } = home;
  const popover = (close: () => void) => (
    <div className="ts-home-cell-styles">
      <CellStyles
        onApplied={() => {
          close();
          home.h.focusSheet();
        }}
      />
    </div>
  );
  if (size === "small") {
    return (
      <MenuButton
        icon={SwatchBook}
        label={t.cellStyles}
        description={t.cellStylesDescription}
        disabled={!home.editable}
        popover={popover}
      />
    );
  }
  return (
    <LargeButton
      icon={SwatchBook}
      label={t.cellStyles}
      description={t.cellStylesDescription}
      disabled={!home.editable}
      popover={popover}
    />
  );
};
