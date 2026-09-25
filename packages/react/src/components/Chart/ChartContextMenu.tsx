import React, { useContext, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Chart,
  deleteChart,
  findChart,
  getChartDisplayBox,
  locale,
  renderChartToSvg,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { setChartClipboard } from "./chartClipboard";
import { copyChartImage, saveChartPng, saveChartSvg } from "./chartImage";

export type ChartMenuState = { chartId: string; x: number; y: number };

type Props = {
  menu: ChartMenuState;
  onClose: () => void;
};

/** Right-click menu of a chart object. */
const ChartContextMenu: React.FC<Props> = ({ menu, onClose }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { chart: t } = locale(context);
  const { showAlert } = useAlert();
  const rootRef = useRef<HTMLDivElement>(null);
  const readonly = context.allowEdit === false;
  const found = findChart(context, menu.chartId);

  // Close on any outside press, Escape or scroll.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onClose, true);
    };
  }, [onClose]);

  // Keep the menu on screen and focus its first entry.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      el.style.left = `${Math.max(0, window.innerWidth - rect.width - 4)}px`;
    if (rect.bottom > window.innerHeight)
      el.style.top = `${Math.max(0, window.innerHeight - rect.height - 4)}px`;
    el.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, []);

  const container = refs.workbookContainer.current;
  if (!found || !container) return null;
  const { chart } = found;

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
      key: "edit",
      label: t.editChart,
      divider: true,
      hidden: readonly,
      run: () =>
        setContext((ctx) => {
          ctx.activeChart = chart.id;
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
  return createPortal(
    <div
      ref={rootRef}
      className="fortune-context-menu luckysheet-cols-menu fortune-chart-menu"
      role="menu"
      aria-label={t.chartMenu}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const entries = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ??
            []
        );
        const i = entries.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const d = e.key === "ArrowDown" ? 1 : -1;
          entries[(i + d + entries.length) % entries.length]?.focus();
        }
        e.stopPropagation();
      }}
    >
      {visible.map((it, i) => (
        <React.Fragment key={it.key}>
          {it.divider && i > 0 && (
            <div className="fortune-context-menu-divider" role="separator" />
          )}
          <div
            className="luckysheet-cols-menuitem"
            role="menuitem"
            tabIndex={-1}
            data-chart-menu={it.key}
            onClick={() => {
              onClose();
              it.run();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClose();
                it.run();
              }
            }}
          >
            <div className="luckysheet-cols-menuitem-content">{it.label}</div>
          </div>
        </React.Fragment>
      ))}
    </div>,
    container
  );
};

export default ChartContextMenu;
