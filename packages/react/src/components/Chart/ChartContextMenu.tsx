import React, { useContext } from "react";
import {
  Chart,
  chartToolsLocale,
  deleteChart,
  findChart,
  getChartDisplayBox,
  locale,
  renderChartToSvg,
  reorderChart,
  resetChartElementFormat,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { setChartClipboard } from "./chartClipboard";
import { copyChartImage, saveChartPng, saveChartSvg } from "./chartImage";
import { ContextMenuPopup, MenuItem } from "../ui";
import { menuIcon } from "../ContextMenu/icons";
import { chartElementLabel } from "./chartTools";
import { openChartDialog } from "./dialogs/store";
import { useChangeChartTypeDialog } from "./dialogs";

const CHART_MENU_ICONS: Record<string, string> = {
  cut: "cut",
  copy: "copy",
  copyAsImage: "copy-image",
  exportPng: "export",
  exportSvg: "export",
  edit: "edit",
  delete: "delete",
};

// Excel's chart menu entries without an icon
const NO_ICON = new Set([
  "resetStyle",
  "changeType",
  "selectData",
  "moveChart",
  "bringToFront",
  "sendToBack",
]);

const CHART_MENU_SHORTCUTS: Record<string, string | undefined> = {
  cut: "Ctrl+X",
  copy: "Ctrl+C",
  delete: "Del",
};

export type ChartMenuState = { chartId: string; x: number; y: number };

type Props = {
  menu: ChartMenuState;
  onClose: () => void;
};

/** Right-click menu of a chart object. */
const ChartContextMenu: React.FC<Props> = ({ menu, onClose }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { chart: t } = locale(context);
  const tt = chartToolsLocale(context);
  const { showAlert } = useAlert();
  const changeType = useChangeChartTypeDialog();
  const readonly = context.allowEdit === false;
  const found = findChart(context, menu.chartId);

  const container = refs.workbookContainer.current;
  if (!found || !container) return null;
  const { chart } = found;
  const element =
    context.activeChart === chart.id
      ? (context.chartElement ?? "chartArea")
      : "chartArea";

  const picture = (c: Chart) => {
    const box = getChartDisplayBox(context, c.id) ?? c;
    const size = {
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    };
    const svg = renderChartToSvg(
      {
        luckysheetfile: context.luckysheetfile,
        lang: context.lang,
      },
      c,
      context.theme || "light",
      size
    );
    return { svg, ...size };
  };

  const copy = (cut: boolean) => {
    const marker = setChartClipboard(chart);
    navigator.clipboard?.writeText?.(marker).catch(() => {});
    if (cut && !readonly) {
      setContext((ctx) => deleteChart(ctx, chart.id));
      refs.cellInput.current?.focus();
    }
  };

  const items: {
    key: string;
    label: string;
    run: () => void;
    hidden?: boolean;
    divider?: boolean;
  }[] = [
    { key: "cut", label: t.cut, run: () => copy(true), hidden: readonly },
    { key: "copy", label: t.copy, run: () => copy(false) },
    {
      key: "copyAsImage",
      label: t.copyAsImage,
      run: () => {
        const p = picture(chart);
        copyChartImage(p.svg, p.width, p.height).then((ok) => {
          if (!ok) showAlert(t.copyImageFailed, "ok");
        });
      },
    },
    {
      key: "exportPng",
      label: t.exportPng,
      run: () => {
        const p = picture(chart);
        saveChartPng(p.svg, p.width, p.height, chart.title).catch(() => {});
      },
    },
    {
      key: "exportSvg",
      label: t.exportSvg,
      run: () => saveChartSvg(picture(chart).svg, chart.title),
    },
    {
      key: "resetStyle",
      label: tt.format.resetToMatchStyle,
      divider: true,
      hidden: readonly,
      run: () =>
        setContext((ctx) => {
          const f = findChart(ctx, chart.id);
          if (f) resetChartElementFormat(f.chart, element);
        }),
    },
    {
      key: "changeType",
      label: `${tt.design.changeChartType}…`,
      hidden: readonly,
      run: () => changeType(chart.id),
    },
    {
      key: "selectData",
      label: `${tt.design.selectData}…`,
      hidden: readonly,
      run: () => openChartDialog({ kind: "selectData", chartId: chart.id }),
    },
    {
      key: "moveChart",
      label: `${tt.design.moveChart}…`,
      hidden: readonly,
      run: () => openChartDialog({ kind: "moveChart", chartId: chart.id }),
    },
    {
      key: "bringToFront",
      label: tt.format.bringToFront,
      divider: true,
      hidden: readonly,
      run: () => setContext((ctx) => reorderChart(ctx, chart.id, "front")),
    },
    {
      key: "sendToBack",
      label: tt.format.sendToBack,
      hidden: readonly,
      run: () => setContext((ctx) => reorderChart(ctx, chart.id, "back")),
    },
    {
      key: "edit",
      label: `${tt.names.format.replace(
        "{element}",
        chartElementLabel(context, chart, element, tt)
      )}…`,
      divider: true,
      hidden: readonly,
      run: () =>
        setContext((ctx) => {
          ctx.activeChart = chart.id;
          ctx.chartElement = element;
          ctx.chartEditorOpen = true;
        }),
    },
    {
      key: "delete",
      label: t.deleteChart,
      hidden: readonly,
      run: () => {
        setContext((ctx) => deleteChart(ctx, chart.id));
        refs.cellInput.current?.focus();
      },
    },
  ];

  const visible = items.filter((it) => !it.hidden);
  const menuItems: MenuItem[] = [];
  visible.forEach((it, i) => {
    if (it.divider && i > 0) {
      menuItems.push({ type: "separator", id: `sep-${it.key}` });
    }
    menuItems.push({
      id: it.key,
      label: it.label,
      icon: NO_ICON.has(it.key)
        ? undefined
        : menuIcon(CHART_MENU_ICONS[it.key]),
      shortcut: CHART_MENU_SHORTCUTS[it.key],
      onSelect: it.run,
    });
  });
  return (
    <ContextMenuPopup
      x={menu.x}
      y={menu.y}
      items={menuItems}
      within={container}
      className="fortune-chart-menu"
      minWidth={200}
      aria-label={t.chartMenu}
      onClose={() => onClose()}
    />
  );
};

export default ChartContextMenu;
