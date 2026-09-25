import React, { useContext } from "react";
import {
  ArrowUpNarrowWide,
  Blend,
  Brackets,
  CalendarDays,
  ChartBarBig,
  ChevronLeft,
  ChevronRight,
  CopyCheck,
  Equal,
  Eraser,
  Highlighter,
  ListChecks,
  Plus,
  Signal,
  TextSearch,
} from "lucide-react";
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
import type { CFIconSetName, CFRule } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import ConditionRules from "./ConditionRules";
import ManageRules from "./ManageRules";
import RuleEditor from "./RuleEditor";
import { Gallery, GalleryItem, MenuItem } from "../ui";
import {
  CFText,
  ColorScaleSwatch,
  DataBarSwatch,
  IconSetPreview,
} from "./previews";

/** New Formatting Rule as a standalone dialog; stores the rule on OK. */
const NewRuleDialog: React.FC<{ rule: CFRule }> = ({ rule }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const loc = locale(context);
  return (
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
  );
};

/** The default items of the Conditional Formatting menu (Excel's order). */
export const CONDITIONAL_FORMAT_ITEMS = [
  "highlightCellRules",
  "itemSelectionRules",
  "-",
  "dataBar",
  "colorGradation",
  "icons",
  "-",
  "newFormatRule",
  "deleteRule",
  "manageRules",
];

/**
 * Excel's Conditional Formatting menu as ui `MenuItem`s: Highlight Cells
 * Rules ▸, Top/Bottom Rules ▸, Data Bars ▸ / Color Scales ▸ / Icon Sets ▸
 * (preset galleries), New Rule…, Clear Rules ▸, Manage Rules…. `close`
 * closes the drop-down it is in (called before a dialog opens).
 *
 *   const items = useConditionalFormatMenu(() => setOpen(false));
 *   <LargeButton icon="conditionFormat" label="Conditional Formatting"
 *     menu={items} />
 */
export function useConditionalFormatMenu(
  close: () => void,
  names: string[] = CONDITIONAL_FORMAT_ITEMS
): MenuItem[] {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const text = locale(context).conditionformat as unknown as CFText;

  const selection = () => cleanCFRanges(context.luckysheet_select_save);

  const openEditor = (rule: Omit<CFRule, "cellrange">) => {
    close();
    showDialog(
      <NewRuleDialog rule={{ ...rule, cellrange: selection() } as CFRule} />
    );
  };

  const run = (fn: (ctx: any) => void) => {
    close();
    setContext((ctx) => {
      fn(ctx);
    });
  };

  const moreRules = (rule: Omit<CFRule, "cellrange">): MenuItem[] => [
    { type: "separator" },
    {
      id: "more-rules",
      label: text.moreRules,
      onSelect: () => openEditor(rule),
    },
  ];

  const gallery = (
    id: string,
    items: GalleryItem[],
    apply: (id: string) => void,
    columns: number,
    size: [number, number] = [40, 40]
  ): MenuItem => ({
    type: "custom",
    id,
    render: (closeMenu) => (
      <Gallery
        items={items}
        columns={columns}
        itemWidth={size[0]}
        itemHeight={size[1]}
        className="fortune-cf-preset-gallery"
        onPick={(picked) => {
          closeMenu();
          apply(picked);
        }}
      />
    ),
  });

  const item = (name: string): MenuItem[] => {
    if (name === "-") return [{ type: "separator" }];
    if (name === "highlightCellRules") {
      return [
        {
          id: name,
          label: text.highlightCellRules,
          icon: Highlighter,
          children: [
            ...[
              { type: "greaterThan", icon: ChevronRight },
              { type: "lessThan", icon: ChevronLeft },
              { type: "between", icon: Brackets },
              { type: "equal", icon: Equal },
              { type: "textContains", icon: TextSearch },
              { type: "occurrenceDate", icon: CalendarDays },
              { type: "duplicateValue", icon: CopyCheck },
            ].map((v): MenuItem => ({
              id: v.type,
              label: text[`qt_${v.type}`],
              icon: v.icon,
              onSelect: () => {
                close();
                showDialog(<ConditionRules type={v.type} />);
              },
            })),
            ...moreRules({
              type: "default",
              conditionName: "between",
              conditionValue: ["", ""],
              format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
            }),
          ],
        },
      ];
    }
    if (name === "itemSelectionRules") {
      return [
        {
          id: name,
          label: text.itemSelectionRules,
          icon: ArrowUpNarrowWide,
          children: [
            ...[
              "top10",
              "top10_percent",
              "last10",
              "last10_percent",
              "aboveAverage",
              "belowAverage",
            ].map((type): MenuItem => ({
              id: type,
              label: text[`qt_${type}`],
              onSelect: () => {
                close();
                showDialog(<ConditionRules type={type} />);
              },
            })),
            ...moreRules({
              type: "default",
              conditionName: "top10",
              conditionValue: [10],
              format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
            }),
          ],
        },
      ];
    }
    if (name === "dataBar") {
      const bars = (gradient: boolean): GalleryItem[] =>
        CF_DATA_BAR_COLORS.map((color, i) => ({
          id: `${gradient ? "g" : "s"}:${color}`,
          label:
            text[`${gradient ? "gradient" : "solidColor"}DataBar_${i + 1}`],
          group: gradient ? text.gradientFill : text.solidFill,
          preview: <DataBarSwatch color={color} gradient={gradient} />,
        }));
      return [
        {
          id: name,
          label: text.dataBar,
          icon: ChartBarBig,
          children: [
            gallery(
              "data-bar-gallery",
              [...bars(true), ...bars(false)],
              (picked) => {
                const [kind, color] = picked.split(":");
                run((ctx) =>
                  addDataBarRule(ctx, makeDataBar(color, kind === "g"))
                );
              },
              3
            ),
            ...moreRules({
              type: "dataBar",
              dataBar: makeDataBar(CF_DATA_BAR_COLORS[0], true),
            }),
          ],
        },
      ];
    }
    if (name === "colorGradation") {
      return [
        {
          id: name,
          label: text.colorGradation,
          icon: Blend,
          children: [
            gallery(
              "color-scale-gallery",
              CF_COLOR_SCALE_PRESETS.map((colors, i) => ({
                id: String(i),
                label: text[`colorGradation_${i + 1}`],
                preview: <ColorScaleSwatch colors={colors} />,
              })),
              (picked) =>
                run((ctx) =>
                  addColorScaleRule(
                    ctx,
                    colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[Number(picked)])
                  )
                ),
              4
            ),
            ...moreRules({
              type: "colorGradation",
              colorScale: {
                stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]),
              },
            }),
          ],
        },
      ];
    }
    if (name === "icons") {
      return [
        {
          id: name,
          label: text.icons,
          icon: Signal,
          children: [
            gallery(
              "icon-set-gallery",
              CF_ICON_SET_GROUPS.flatMap((g) =>
                g.sets.map((set) => ({
                  id: set,
                  label: text[`is_${set}`] ?? set,
                  group: text[`isGroup_${g.key}`],
                  preview: <IconSetPreview name={set} size={14} />,
                }))
              ),
              (set) =>
                run((ctx) =>
                  addIconSetRule(ctx, makeIconSet(set as CFIconSetName))
                ),
              2,
              [96, 28]
            ),
            ...moreRules({
              type: "icons",
              iconSet: makeIconSet("3TrafficLights1"),
            }),
          ],
        },
      ];
    }
    if (name === "newFormatRule") {
      return [
        {
          id: name,
          label: text.newRule,
          icon: Plus,
          onSelect: () =>
            openEditor({
              type: "default",
              conditionName: "between",
              conditionValue: ["", ""],
              format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
            }),
        },
      ];
    }
    if (name === "deleteRule") {
      return [
        {
          id: name,
          label: text.clearRules,
          icon: Eraser,
          children: [
            {
              id: "clear-selection",
              label: text.clearRulesSelection,
              onSelect: () => run((ctx) => clearCFRules(ctx, "selection")),
            },
            {
              id: "clear-sheet",
              label: text.clearRulesSheet,
              onSelect: () => run((ctx) => clearCFRules(ctx, "sheet")),
            },
          ],
        },
      ];
    }
    if (name === "manageRules") {
      return [
        {
          id: name,
          label: text.manageRules,
          icon: ListChecks,
          onSelect: () => {
            close();
            showDialog(<ManageRules />);
          },
        },
      ];
    }
    return [];
  };

  return names.flatMap(item);
}
