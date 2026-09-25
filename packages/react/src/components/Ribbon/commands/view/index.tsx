/**
 * View tab commands (docs/DESIGN.md, Excel's View ribbon): Workbook Views
 * (Normal, Page Break Preview, Page Layout), Show (Gridlines, Formula Bar,
 * Headings), Zoom (Zoom…, 100%, Zoom to Selection), Window (Freeze Panes,
 * Split) and Appearance (the Light / Dark / System theme).
 */
import React, { useContext } from "react";
import {
  FileText,
  Grid2x2,
  Grid3x3,
  Monitor,
  Moon,
  PanelLeft,
  PanelTop,
  ScanSearch,
  Snowflake,
  Sun,
  ZoomIn,
} from "lucide-react";
import {
  freezePanes,
  getPaneState,
  getSheetIndex,
  getWorkbookView,
  handleFreeze,
  locale,
  scrollSelectionIntoCorner,
  setShowFormulaBar,
  setShowGridLines,
  setShowHeadings,
  setWorkbookView,
  sheetShowsGridLines,
  sheetShowsHeadings,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  ThemeSetting,
  WorkbookView,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { ModalContext } from "../../../../context/modal";
import { useDialog } from "../../../../hooks/useDialog";
import { Checkbox, MenuItem, Tooltip } from "../../../ui";
import type { LucideIcon } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { registerRibbonCommand } from "../../registry";
import {
  checkHint,
  Cmd,
  fill,
  PageBreakIcon,
  RichLabel,
  useTabsText,
  Zoom100Icon,
} from "../tabsCommon";
import { relayout } from "../pageLayout";
import { setZoom, ZoomDialog } from "./ZoomDialog";

// ------------------------------------------------------------ Workbook Views

const VIEWS: {
  id: string;
  view: WorkbookView;
  icon: LucideIcon;
  label: "normal" | "pageBreakPreview" | "pageLayout";
  tip: "normalTip" | "pageBreakPreviewTip" | "pageLayoutTip";
}[] = [
  {
    id: "view-normal",
    view: "normal",
    icon: Grid3x3,
    label: "normal",
    tip: "normalTip",
  },
  {
    id: "view-page-break",
    view: "pageBreakPreview",
    icon: PageBreakIcon,
    label: "pageBreakPreview",
    tip: "pageBreakPreviewTip",
  },
  {
    id: "view-page-layout",
    view: "pageLayout",
    icon: FileText,
    label: "pageLayout",
    tip: "pageLayoutTip",
  },
];

const viewCommands = VIEWS.map((v) => {
  const C: React.FC<RibbonCommandProps> = ({ size }) => {
    const { context, setContext } = useContext(WorkbookContext);
    const t = useTabsText().view;
    const current = getWorkbookView(context);
    return (
      <Cmd
        size={size}
        icon={v.icon}
        label={t[v.label]}
        description={t[v.tip]}
        pressed={current === v.view}
        onClick={() =>
          setContext((ctx) => setWorkbookView(ctx, v.view), {
            noHistory: true,
          })
        }
      />
    );
  };
  C.displayName = `WorkbookView(${v.view})`;
  return { id: v.id, Component: C };
});

// ------------------------------------------------------------------ Show

function currentSheet(context: Context) {
  const i = getSheetIndex(context, context.currentSheetId);
  return i == null ? null : context.luckysheetfile[i];
}

type ShowKind = "gridlines" | "formulaBar" | "headings";

const ShowOption: React.FC<{ kind: ShowKind }> = ({ kind }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().view;
  const sheet = currentSheet(context);
  const checked =
    kind === "gridlines"
      ? sheetShowsGridLines(sheet)
      : kind === "headings"
        ? sheetShowsHeadings(sheet)
        : !context.hideFormulaBar;
  const label = t[kind];
  const tip =
    kind === "gridlines"
      ? t.gridlinesTip
      : kind === "headings"
        ? t.headingsTip
        : t.formulaBarTip;
  return (
    <Tooltip label={label} description={tip}>
      <Checkbox
        className="ts-show-option"
        checked={checked}
        label={label}
        aria-label={label}
        onChange={(on) => {
          setContext(
            (ctx) => {
              if (kind === "gridlines") setShowGridLines(ctx, on);
              else if (kind === "headings") setShowHeadings(ctx, on);
              else setShowFormulaBar(ctx, on);
            },
            kind === "formulaBar" ? { noHistory: true } : undefined
          );
          if (kind !== "gridlines") relayout();
        }}
      />
    </Tooltip>
  );
};

const showCommands: { id: string; kind: ShowKind }[] = [
  { id: "show-gridlines", kind: "gridlines" },
  { id: "show-formula-bar", kind: "formulaBar" },
  { id: "show-headings", kind: "headings" },
];

// ------------------------------------------------------------------ Zoom

const ZoomCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { showModal, hideModal } = useContext(ModalContext);
  const t = useTabsText().view;
  return (
    <Cmd
      size={size}
      icon={ZoomIn}
      label={t.zoom}
      description={t.zoomTip}
      onClick={() => showModal(<ZoomDialog onClose={hideModal} />)}
    />
  );
};

const Zoom100Command: React.FC<RibbonCommandProps> = ({ size }) => {
  const { setContext } = useContext(WorkbookContext);
  const t = useTabsText().view;
  return (
    <Cmd
      size={size}
      icon={Zoom100Icon}
      label={t.zoom100}
      description={t.zoom100Tip}
      onClick={() => setZoom(setContext, 1)}
    />
  );
};

/** Zoom to Selection, then scroll the selection to the window's corner. */
export function useZoomToSelection() {
  const { setContext } = useContext(WorkbookContext);
  return () => {
    setContext((ctx) => {
      zoomToSelection(ctx);
    });
    // scroll again once the grid is laid out at the new zoom
    setTimeout(
      () =>
        setContext(
          (ctx) => {
            scrollSelectionIntoCorner(ctx);
          },
          { noHistory: true }
        ),
      80
    );
  };
}

const ZoomToSelectionCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const t = useTabsText().view;
  const zoom = useZoomToSelection();
  return (
    <Cmd
      size={size}
      icon={ScanSearch}
      label={t.zoomToSelection}
      description={t.zoomToSelectionTip}
      onClick={zoom}
    />
  );
};

// ---------------------------------------------------------------- Window

/**
 * Freeze Panes: the top freezes at the selection (or unfreezes), the
 * arrow opens Excel's menu with Freeze Top Row / First Column.
 */
const FreezePanesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = useTabsText().view;
  const { freezen } = locale(context);
  const frozen = getPaneState(context) === "frozen";
  const run = (value: string) => {
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
  const menu: MenuItem[] = [
    frozen
      ? {
          id: "unfreeze",
          label: (
            <RichLabel title={t.unfreezePanes} detail={t.unfreezePanesItem} />
          ),
          icon: Snowflake,
          onSelect: () => run("unfreeze"),
        }
      : {
          id: "freeze-panes",
          label: <RichLabel title={t.freezePanes} detail={t.freezePanesItem} />,
          icon: Snowflake,
          onSelect: () => run("freeze-panes"),
        },
    {
      id: "freeze-top-row",
      label: <RichLabel title={t.freezeTopRow} detail={t.freezeTopRowItem} />,
      icon: PanelTop,
      onSelect: () => run("freeze-top-row"),
    },
    {
      id: "freeze-first-column",
      label: (
        <RichLabel
          title={t.freezeFirstColumn}
          detail={t.freezeFirstColumnItem}
        />
      ),
      icon: PanelLeft,
      onSelect: () => run("freeze-first-column"),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={Snowflake}
      label={t.freezePanes}
      description={frozen ? t.unfreezePanesItem : t.freezePanesTip}
      pressed={frozen}
      onClick={() => run(frozen ? "unfreeze" : "freeze-panes")}
      menu={menu}
    />
  );
};

const SplitCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().view;
  const split = getPaneState(context) === "split";
  return (
    <Cmd
      size={size}
      icon={Grid2x2}
      label={t.split}
      description={t.splitTip}
      pressed={split}
      onClick={() =>
        setContext((ctx) => {
          handleFreeze(ctx, "split");
        })
      }
    />
  );
};

// ------------------------------------------------------------ Appearance

const THEME_ICONS: Record<ThemeSetting, LucideIcon> = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
};

/** Theme ▾: Light, Dark or System (follows the OS), checked as chosen. */
const ThemeCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { settings, setTheme } = useContext(WorkbookContext);
  const t = useTabsText().view;
  const current: ThemeSetting = settings.theme ?? "light";
  const names: Record<ThemeSetting, string> = {
    light: t.light,
    dark: t.dark,
    auto: t.system,
  };
  const menu: MenuItem[] = (["light", "dark", "auto"] as ThemeSetting[]).map(
    (value) => ({
      id: `theme-${value}`,
      label: names[value],
      icon: THEME_ICONS[value],
      hint: checkHint(value === current),
      checked: value === current,
      radio: true,
      onSelect: () => setTheme?.(value),
    })
  );
  return (
    <Cmd
      size={size}
      icon={THEME_ICONS[current] ?? Sun}
      label={t.theme}
      description={
        <>
          {t.themeTip}
          <br />
          {fill(t.themeCurrent, { theme: names[current] })}
        </>
      }
      menu={menu}
    />
  );
};

/** Register the View tab's commands. */
export function registerViewCommands() {
  viewCommands.forEach(({ id, Component }) =>
    registerRibbonCommand(id, Component, { aliases: ["pageLayout"] })
  );
  showCommands.forEach(({ id, kind }) => {
    const C: React.FC<RibbonCommandProps> = () => <ShowOption kind={kind} />;
    C.displayName = `Show(${kind})`;
    registerRibbonCommand(id, C, { aliases: ["view-options"] });
  });
  registerRibbonCommand("zoom", ZoomCommand, { aliases: ["view-options"] });
  registerRibbonCommand("zoom-100", Zoom100Command, {
    aliases: ["view-options"],
  });
  registerRibbonCommand("zoom-to-selection", ZoomToSelectionCommand, {
    aliases: ["view-options"],
  });
  registerRibbonCommand("freeze", FreezePanesCommand);
  registerRibbonCommand("split", SplitCommand, { aliases: ["freeze"] });
  registerRibbonCommand("theme", ThemeCommand);
}
