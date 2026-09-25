/**
 * Page Layout tab commands (docs/DESIGN.md, Excel's Page Layout ribbon):
 * Page Setup (Margins, Orientation, Size, Print Area, Breaks, Print Titles,
 * the Page Setup dialog and Print Preview), Scale to Fit and Sheet Options,
 * all on the sheet's page setup model (core modules/pageSetup.ts).
 */
import React, { useContext } from "react";
import _ from "lodash";
import {
  ArrowLeftRight,
  ArrowUpDown,
  PanelsTopLeft,
  Printer,
  RectangleHorizontal,
  RectangleVertical,
  RulerDimensionLine,
  Scaling,
  SeparatorHorizontal,
  Settings2,
} from "lucide-react";
import {
  addToPrintArea,
  clearPrintArea,
  getPageSetup,
  getSheetIndex,
  hasPageBreakAt,
  insertPageBreak,
  MARGIN_PRESETS,
  PAPER_SIZES,
  pageLayoutLocale,
  removePageBreak,
  resetAllPageBreaks,
  resolvePageSetup,
  setPrintArea,
  setShowGridLines,
  setShowHeadings,
  setShowPageBreaks,
  sheetShowsGridLines,
  sheetShowsHeadings,
  updatePageSetup,
} from "@lofcz/tinysheet-core";
import type { Context, PageSetup } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import {
  Checkbox,
  Icon,
  MenuItem,
  NumberInput,
  Select,
  Tooltip,
} from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { registerRibbonCommand } from "../../registry";
import { shortcutText } from "../helpers";
import {
  checkHint,
  Cmd,
  fill,
  MarginsIcon,
  PrintAreaIcon,
  RichLabel,
  useTabsText,
} from "../tabsCommon";
import { usePageLayoutDialogs } from "../../../PageLayout/dialogs";

/** The grid needs a new layout (headings shown / hidden). */
export function relayout() {
  setTimeout(() => window.dispatchEvent(new Event("resize")));
}

function usePageSetup() {
  const { context, setContext } = useContext(WorkbookContext);
  const stored = getPageSetup(context);
  const setup = resolvePageSetup(stored);
  const editable = context.allowEdit !== false;
  const update = (patch: Partial<PageSetup>) =>
    setContext((ctx) => updatePageSetup(ctx, patch));
  return { context, setContext, stored, setup, editable, update };
}

const inches = (v: number) => `${Number(v.toFixed(2))}"`;

/** Paper names as Excel lists them. */
const PAPER_NAMES: Record<string, string> = {
  letter: "Letter",
  tabloid: "Tabloid",
  ledger: "Ledger",
  legal: "Legal",
  statement: "Statement",
  executive: "Executive",
  a3: "A3",
  a4: "A4",
  a5: "A5",
  b4: "B4 (JIS)",
  b5: "B5 (JIS)",
  folio: "Folio",
  envelope10: "Envelope #10",
  envelopeDL: "Envelope DL",
  envelopeC5: "Envelope C5",
};

// ------------------------------------------------------------ Page Setup

const MarginsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { setup, editable, update, context } = usePageSetup();
  const t = useTabsText().pageLayout;
  const pl = pageLayoutLocale(context);
  const { openPageSetup } = usePageLayoutDialogs();
  const keys = Object.keys(MARGIN_PRESETS) as (keyof typeof MARGIN_PRESETS)[];
  const menu: MenuItem[] = [
    ...keys.map<MenuItem>((k) => {
      const m = MARGIN_PRESETS[k];
      return {
        id: `margins-${k}`,
        label: (
          <RichLabel
            title={pl.marginPresets[k]}
            detail={fill(t.marginDetails, {
              top: inches(m.top),
              bottom: inches(m.bottom),
              left: inches(m.left),
              right: inches(m.right),
            })}
          />
        ),
        icon: MarginsIcon,
        hint: checkHint(_.isEqual(setup.margins, m)),
        checked: _.isEqual(setup.margins, m),
        radio: true,
        disabled: !editable,
        onSelect: () => update({ margins: { ...m } }),
      };
    }),
    { type: "separator" },
    {
      id: "margins-custom",
      label: t.customMargins,
      onSelect: () => openPageSetup("margins"),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={MarginsIcon}
      label={t.margins}
      description={t.marginsTip}
      menu={menu}
    />
  );
};

const OrientationCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { setup, editable, update, context } = usePageSetup();
  const t = useTabsText().pageLayout;
  const pl = pageLayoutLocale(context);
  const landscape = setup.orientation === "landscape";
  const menu: MenuItem[] = [
    {
      id: "orientation-portrait",
      label: pl.portrait,
      icon: RectangleVertical,
      hint: checkHint(!landscape),
      checked: !landscape,
      radio: true,
      disabled: !editable,
      onSelect: () => update({ orientation: "portrait" }),
    },
    {
      id: "orientation-landscape",
      label: pl.landscape,
      icon: RectangleHorizontal,
      hint: checkHint(landscape),
      checked: landscape,
      radio: true,
      disabled: !editable,
      onSelect: () => update({ orientation: "landscape" }),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={landscape ? RectangleHorizontal : RectangleVertical}
      label={t.orientation}
      description={t.orientationTip}
      menu={menu}
    />
  );
};

const SizeCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { setup, editable, update } = usePageSetup();
  const t = useTabsText().pageLayout;
  const { openPageSetup } = usePageLayoutDialogs();
  const name = (id: string) => PAPER_NAMES[id] ?? _.upperFirst(id);
  const menu: MenuItem[] = [
    ...PAPER_SIZES.map<MenuItem>((p) => ({
      id: `size-${p.id}`,
      label: name(p.id),
      hint: p.label,
      checked: setup.paperSize === p.id,
      radio: true,
      disabled: !editable,
      onSelect: () => update({ paperSize: p.id }),
    })),
    { type: "separator" },
    {
      id: "size-more",
      label: t.moreSizes,
      onSelect: () => openPageSetup("page"),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={RulerDimensionLine}
      label={t.size}
      description={t.sizeTip}
      menu={menu}
    />
  );
};

const PrintAreaCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { stored, editable, setContext, context } = usePageSetup();
  const t = useTabsText().pageLayout;
  const pl = pageLayoutLocale(context);
  const hasArea = !!stored.printArea?.length;
  const menu: MenuItem[] = [
    {
      id: "print-area-set",
      label: pl.setPrintArea,
      disabled: !editable,
      onSelect: () => setContext((ctx) => setPrintArea(ctx)),
    },
    {
      id: "print-area-add",
      label: pl.addToPrintArea,
      disabled: !editable || !hasArea,
      onSelect: () => setContext((ctx) => addToPrintArea(ctx)),
    },
    {
      id: "print-area-clear",
      label: pl.clearPrintArea,
      disabled: !editable || !hasArea,
      onSelect: () => setContext((ctx) => clearPrintArea(ctx)),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={PrintAreaIcon}
      label={t.printArea}
      description={t.printAreaTip}
      menu={menu}
    />
  );
};

const BreaksCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { setup, editable, setContext, context } = usePageSetup();
  const { settings } = useContext(WorkbookContext);
  const t = useTabsText().pageLayout;
  const pl = pageLayoutLocale(context);
  const hasBreak = hasPageBreakAt(context);
  const any = setup.rowBreaks.length > 0 || setup.colBreaks.length > 0;
  const menu: MenuItem[] = [
    {
      id: "breaks-insert",
      label: pl.insertPageBreak,
      disabled: !editable,
      onSelect: () =>
        setContext((ctx) => {
          insertPageBreak(ctx);
          if (settings.showPageBreaksAfterPrint !== false) {
            setShowPageBreaks(ctx, true);
          }
        }),
    },
    {
      id: "breaks-remove",
      label: pl.removePageBreak,
      disabled: !editable || !hasBreak,
      onSelect: () => setContext((ctx) => removePageBreak(ctx)),
    },
    {
      id: "breaks-reset",
      label: pl.resetPageBreaks,
      disabled: !editable || !any,
      onSelect: () => setContext((ctx) => resetAllPageBreaks(ctx)),
    },
  ];
  return (
    <Cmd
      size={size}
      icon={SeparatorHorizontal}
      label={t.breaks}
      description={t.breaksTip}
      menu={menu}
    />
  );
};

const PrintTitlesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const t = useTabsText().pageLayout;
  const { openPageSetup } = usePageLayoutDialogs();
  return (
    <Cmd
      size={size}
      icon={PanelsTopLeft}
      label={t.printTitles}
      description={t.printTitlesTip}
      onClick={() => openPageSetup("sheet")}
    />
  );
};

const PageSetupCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const t = useTabsText().pageLayout;
  const { openPageSetup } = usePageLayoutDialogs();
  return (
    <Cmd
      size={size}
      icon={Settings2}
      label={t.pageSetup}
      text={size === "small" ? t.pageSetup : undefined}
      description={t.pageSetupTip}
      onClick={() => openPageSetup("page")}
    />
  );
};

const PrintPreviewCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const t = useTabsText().pageLayout;
  const { openPrintPreview } = usePageLayoutDialogs();
  return (
    <Cmd
      size={size}
      icon={Printer}
      label={t.printPreview}
      text={size === "small" ? t.printPreview : undefined}
      shortcut={shortcutText("Ctrl+P")}
      description={t.printPreviewTip}
      onClick={openPrintPreview}
    />
  );
};

// ------------------------------------------------------------ Scale to Fit

const PAGE_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Scale to Fit: Width and Height (Automatic or 1–9 pages) and Scale
 * (10–400%, only while both are Automatic), as three compact rows.
 */
const ScaleToFitCommand: React.FC<RibbonCommandProps> = () => {
  const { setup, editable, update } = usePageSetup();
  const t = useTabsText().pageLayout;
  const width = setup.fitToPage ? setup.fitToWidth : 0;
  const height = setup.fitToPage ? setup.fitToHeight : 0;
  const options = PAGE_COUNTS.map((n) => ({
    value: String(n),
    label: n === 0 ? t.automatic : n === 1 ? t.onePage : fill(t.pages, { n }),
  }));
  const setFit = (w: number, h: number) =>
    update({ fitToPage: w > 0 || h > 0, fitToWidth: w, fitToHeight: h });
  const row = (
    key: string,
    icon: typeof Scaling,
    label: string,
    tip: string,
    control: React.ReactNode
  ) => (
    <Tooltip label={label} description={tip}>
      <div className="ts-scale-fit-row" data-scale-fit={key}>
        <Icon icon={icon} size={14} />
        <span className="ts-scale-fit-label">{label}:</span>
        {control}
      </div>
    </Tooltip>
  );
  return (
    <div className="ts-scale-fit">
      {row(
        "width",
        ArrowLeftRight,
        t.width,
        t.widthTip,
        <Select
          aria-label={t.width}
          size="sm"
          width={96}
          value={String(width)}
          options={options}
          disabled={!editable}
          onChange={(v) => setFit(Number(v), height)}
        />
      )}
      {row(
        "height",
        ArrowUpDown,
        t.height,
        t.heightTip,
        <Select
          aria-label={t.height}
          size="sm"
          width={96}
          value={String(height)}
          options={options}
          disabled={!editable}
          onChange={(v) => setFit(width, Number(v))}
        />
      )}
      {row(
        "scale",
        Scaling,
        t.scale,
        t.scaleTip,
        <NumberInput
          aria-label={t.scale}
          size="sm"
          width={96}
          min={10}
          max={400}
          step={5}
          suffix="%"
          value={setup.scale}
          disabled={!editable || setup.fitToPage}
          onChange={(v) => update({ scale: v })}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------ Sheet Options

function currentSheet(context: Context) {
  const i = getSheetIndex(context, context.currentSheetId);
  return i == null ? null : context.luckysheetfile[i];
}

/** Gridlines / Headings: View and Print checkboxes under a caption. */
const SheetOption: React.FC<{ kind: "gridlines" | "headings" }> = ({
  kind,
}) => {
  const { setup, editable, update, context, setContext } = usePageSetup();
  const t = useTabsText().pageLayout;
  const sheet = currentSheet(context);
  const caption = kind === "gridlines" ? t.gridlines : t.headings;
  const shown =
    kind === "gridlines"
      ? sheetShowsGridLines(sheet)
      : sheetShowsHeadings(sheet);
  const printed = kind === "gridlines" ? setup.gridLines : setup.headings;
  return (
    <div
      className="ts-sheet-option"
      role="group"
      aria-label={caption}
      data-sheet-option={kind}
    >
      <div className="ts-sheet-option-caption">{caption}</div>
      <Tooltip
        label={`${caption}: ${t.view}`}
        description={
          kind === "gridlines" ? t.gridlinesViewTip : t.headingsViewTip
        }
      >
        <Checkbox
          checked={shown}
          label={t.view}
          aria-label={`${caption}: ${t.view}`}
          onChange={(on) => {
            setContext((ctx) => {
              if (kind === "gridlines") setShowGridLines(ctx, on);
              else setShowHeadings(ctx, on);
            });
            if (kind === "headings") relayout();
          }}
        />
      </Tooltip>
      <Tooltip
        label={`${caption}: ${t.print}`}
        description={
          kind === "gridlines" ? t.gridlinesPrintTip : t.headingsPrintTip
        }
      >
        <Checkbox
          checked={printed}
          label={t.print}
          aria-label={`${caption}: ${t.print}`}
          disabled={!editable}
          onChange={(on) =>
            update(kind === "gridlines" ? { gridLines: on } : { headings: on })
          }
        />
      </Tooltip>
    </div>
  );
};

const GridlinesOptionCommand: React.FC<RibbonCommandProps> = () => (
  <SheetOption kind="gridlines" />
);
const HeadingsOptionCommand: React.FC<RibbonCommandProps> = () => (
  <SheetOption kind="headings" />
);

/** Register the Page Layout tab's commands. */
export function registerPageLayoutCommands() {
  const legacy = { aliases: ["pageLayout"] };
  registerRibbonCommand("margins", MarginsCommand, legacy);
  registerRibbonCommand("orientation", OrientationCommand, legacy);
  registerRibbonCommand("paper-size", SizeCommand, legacy);
  registerRibbonCommand("print-area", PrintAreaCommand, legacy);
  registerRibbonCommand("breaks", BreaksCommand, legacy);
  registerRibbonCommand("print-titles", PrintTitlesCommand, legacy);
  registerRibbonCommand("page-setup", PageSetupCommand, legacy);
  registerRibbonCommand("print", PrintPreviewCommand);
  registerRibbonCommand("scale-to-fit", ScaleToFitCommand, legacy);
  registerRibbonCommand("sheet-gridlines", GridlinesOptionCommand, {
    aliases: ["view-options"],
  });
  registerRibbonCommand("sheet-headings", HeadingsOptionCommand, {
    aliases: ["view-options"],
  });
}
