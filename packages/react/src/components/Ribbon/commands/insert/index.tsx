/**
 * Insert tab commands (docs/DESIGN.md, Excel's Insert ribbon): Tables,
 * Illustrations, Charts, Sparklines, Filters, Links, Comments, Text and
 * Controls. Each wires a ribbon button to the existing feature.
 */
import React, { useContext, useRef } from "react";
import {
  Camera,
  Images,
  ImageUp,
  Link,
  ListFilter,
  MessageSquarePlus,
  PanelTopBottomDashed,
  Shapes,
  SquareCheck,
  SquareDashedText,
  StickyNote,
  Table,
  TableProperties,
  Activity,
  ChartNoAxesColumnIncreasing,
  Globe,
} from "lucide-react";
import {
  clearShapeSelection,
  editComment,
  getFlowdata,
  handleLink,
  handleScreenShot,
  insertImage,
  insertShape,
  locale,
  newComment,
  placeImageInCell,
  registerShortcut,
  SHAPE_GALLERY,
  selectionHasCheckboxes,
  startThreadedComment,
  toggleCheckboxFormat,
} from "@lofcz/tinysheet-core";
import type { ShapeGalleryItem, SparklineType } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { ModalContext } from "../../../../context/modal";
import { MenuItem, Tooltip } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { registerRibbonCommand } from "../../registry";
import { shortcutText, useRibbonCommandHelpers } from "../helpers";
import { Cmd, useTabsText, WinLossIcon } from "../tabsCommon";
import CreatePivotDialog from "../../../PivotTable/CreatePivotDialog";
import { CreateTableDialog } from "../../../Tables";
import { useInsertSlicer } from "../../../Tables/Slicers";
import { activePictureTarget } from "../../../CellImages";
import { InsertPictureDialog } from "../../../CellImages/dialogs";
import { readPictureFile } from "../../../CellImages/readImage";
import { ShapePresetIcon } from "../../../Shapes/ShapesToolbarItem";
import { openInsertDialog } from "../../../Sparkline/commands";
import { usePageLayoutDialogs } from "../../../PageLayout/dialogs";
import { chartFamilyCommands, RecommendedChartsCommand } from "./charts";

/** Excel's default table style (Insert › Table, Ctrl+T). */
const DEFAULT_TABLE_STYLE = "TableStyleMedium2";

const readonly = (ctx: { allowEdit?: boolean }) => ctx.allowEdit === false;

/** The active cell (a merge's top-left cell). */
function activeCell(ctx: Parameters<typeof activePictureTarget>[0]) {
  const at = activePictureTarget(ctx);
  return at ? { r: at.r, c: at.c } : { r: 0, c: 0 };
}

// ---------------------------------------------------------------- Tables

const PivotTableCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  return (
    <Cmd
      size={size}
      icon={TableProperties}
      label={t.pivotTable}
      description={t.pivotTableTip}
      disabled={readonly(h.context)}
      onClick={() => h.showDialog(<CreatePivotDialog />)}
    />
  );
};

const TableCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  return (
    <Cmd
      size={size}
      icon={Table}
      label={t.table}
      description={t.tableTip}
      disabled={readonly(h.context)}
      onClick={() =>
        h.showDialog(<CreateTableDialog styleKey={DEFAULT_TABLE_STYLE} />)
      }
    />
  );
};

// --------------------------------------------------------- Illustrations

/**
 * Pictures ▾: Place in Cell (this device, a web address) and Place over
 * Cells (this device), as in Excel 365.
 */
const PicturesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showModal } = useContext(ModalContext);
  const t = useTabsText().insert;
  const inCellRef = useRef<HTMLInputElement>(null);
  const overRef = useRef<HTMLInputElement>(null);
  const editable = !readonly(context);

  const onInCell = (file: File | undefined) => {
    if (!file) return;
    const { r, c } = activeCell(context);
    readPictureFile(file).then(
      (src) =>
        setContext((ctx) => {
          placeImageInCell(ctx, r, c, { src });
        }),
      () => {}
    );
  };
  const onOver = (file: File | undefined) => {
    if (!file) return;
    readPictureFile(file).then(
      (src) => {
        const image = new Image();
        image.onload = () =>
          setContext((ctx) => {
            insertImage(ctx, image);
          });
        image.src = src;
      },
      () => {}
    );
  };

  const menu: MenuItem[] = [
    {
      id: "place-in-cell",
      label: t.placeInCell,
      icon: ImageUp,
      disabled: !editable,
      children: [
        {
          id: "in-cell-device",
          label: t.thisDevice,
          onSelect: () => inCellRef.current?.click(),
        },
        {
          id: "in-cell-web",
          label: t.fromWeb,
          icon: Globe,
          onSelect: () => {
            const { r, c } = activeCell(context);
            showModal(<InsertPictureDialog r={r} c={c} />);
          },
        },
      ],
    },
    {
      id: "place-over-cells",
      label: t.placeOverCells,
      icon: Images,
      disabled: !editable,
      children: [
        {
          id: "over-cells-device",
          label: t.thisDevice,
          onSelect: () => overRef.current?.click(),
        },
      ],
    },
  ];
  return (
    <>
      <Cmd
        size={size}
        icon={Images}
        label={t.pictures}
        description={t.picturesTip}
        disabled={!editable}
        menu={menu}
      />
      {[
        { ref: inCellRef, on: onInCell, id: "in-cell" },
        { ref: overRef, on: onOver, id: "over-cells" },
      ].map(({ ref, on, id }) => (
        <input
          key={id}
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          data-picture-input={id}
          onChange={(e) => {
            on(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      ))}
    </>
  );
};

const SHAPE_CATEGORIES: ShapeGalleryItem["category"][] = [
  "lines",
  "basic",
  "arrows",
  "callouts",
  "stars",
  "text",
];

/**
 * Shapes ▾: the preset gallery. A click arms drawing (drag on the sheet,
 * Shift keeps the proportions); Enter / Space inserts at the active cell.
 */
const ShapesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().insert;
  const st = locale(context).shape as Record<string, string>;
  const editable = !readonly(context);
  const pick = (key: string, byKeyboard: boolean) => {
    if (!editable) return;
    setContext((ctx) => {
      if (byKeyboard) {
        const shape = insertShape(ctx, key);
        if (shape?.textBox) ctx.editingShape = shape.id;
        return;
      }
      clearShapeSelection(ctx);
      ctx.shapeDrawKind = key;
    });
  };
  return (
    <Cmd
      size={size}
      icon={Shapes}
      label={t.shapes}
      description={t.shapesTip}
      disabled={!editable}
      pressed={!!context.shapeDrawKind && context.shapeDrawKind !== "textBox"}
      popover={(close) => (
        <div
          className="ts-shape-gallery"
          role="menu"
          aria-label={st.insertShapes ?? t.shapes}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const tiles = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")
            );
            const i = tiles.indexOf(e.target as HTMLElement);
            if (i < 0) return;
            e.preventDefault();
            const next = e.key === "ArrowRight" ? i + 1 : i - 1;
            tiles[(next + tiles.length) % tiles.length]?.focus();
          }}
        >
          {SHAPE_CATEGORIES.map((category) => (
            <div key={category} className="ts-shape-gallery-section">
              <div className="ts-chart-gallery-title">{st[category]}</div>
              <div className="ts-shape-gallery-tiles">
                {SHAPE_GALLERY.filter((g) => g.category === category).map(
                  (item) => (
                    <Tooltip key={item.key} label={st[item.key] ?? item.key}>
                      <button
                        type="button"
                        role="menuitem"
                        className={`ts-shape-gallery-tile${
                          context.shapeDrawKind === item.key
                            ? " ts-pressed"
                            : ""
                        }`}
                        aria-label={st[item.key] ?? item.key}
                        data-shape-key={item.key}
                        onClick={(e) => {
                          close();
                          pick(item.key, e.detail === 0);
                        }}
                      >
                        <ShapePresetIcon item={item} />
                      </button>
                    </Tooltip>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    />
  );
};

/** Screenshot: a picture of the selected cells. */
const ScreenshotCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  const { screenshot } = locale(h.context);
  return (
    <Cmd
      size={size}
      icon={Camera}
      label={t.screenshot}
      description={t.screenshotTip}
      onClick={() => {
        const src = handleScreenShot(h.context);
        if (!src) return;
        h.showDialog(
          <div className="ts-screenshot-result">
            <div>{screenshot.screenshotTipSuccess}</div>
            <img src={src} alt={t.screenshot} />
          </div>
        );
      }}
    />
  );
};

// ------------------------------------------------------------ Sparklines

const SPARKLINES: {
  id: string;
  type: SparklineType;
  icon: typeof Activity;
  label: "sparkLine" | "sparkColumn" | "sparkWinLoss";
  tip: "sparkLineTip" | "sparkColumnTip" | "sparkWinLossTip";
}[] = [
  {
    id: "sparkline-line",
    type: "line",
    icon: Activity,
    label: "sparkLine",
    tip: "sparkLineTip",
  },
  {
    id: "sparkline-column",
    type: "column",
    icon: ChartNoAxesColumnIncreasing,
    label: "sparkColumn",
    tip: "sparkColumnTip",
  },
  {
    id: "sparkline-winloss",
    type: "winloss",
    icon: WinLossIcon,
    label: "sparkWinLoss",
    tip: "sparkWinLossTip",
  },
];

const sparklineCommands = SPARKLINES.map((s) => {
  const C: React.FC<RibbonCommandProps> = ({ size }) => {
    const h = useRibbonCommandHelpers();
    const t = useTabsText().insert;
    return (
      <Cmd
        size={size}
        icon={s.icon}
        label={t[s.label]}
        description={t[s.tip]}
        disabled={readonly(h.context)}
        onClick={() => openInsertDialog(h, s.type)}
      />
    );
  };
  C.displayName = `Sparkline(${s.type})`;
  return { id: s.id, Component: C };
});

// ------------------------------------------------ Filters, Links, Comments

const SlicerCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context } = useContext(WorkbookContext);
  const t = useTabsText().insert;
  const insert = useInsertSlicer();
  return (
    <Cmd
      size={size}
      icon={ListFilter}
      label={t.slicer}
      description={t.slicerTip}
      disabled={readonly(context)}
      onClick={insert}
    />
  );
};

const LinkCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  return (
    <Cmd
      size={size}
      icon={Link}
      label={t.link}
      shortcut={shortcutText("Ctrl+K")}
      description={t.linkTip}
      disabled={readonly(h.context)}
      onClick={() => h.setContext((ctx) => handleLink(ctx))}
    />
  );
};

const CommentCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  return (
    <Cmd
      size={size}
      icon={MessageSquarePlus}
      label={t.comment}
      shortcut={shortcutText("Ctrl+Shift+F2")}
      description={t.commentTip}
      disabled={readonly(h.context)}
      onClick={() =>
        h.setContext(
          (ctx) => {
            startThreadedComment(ctx);
          },
          { noHistory: true }
        )
      }
    />
  );
};

const NoteCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useTabsText().insert;
  const { r, c } = activeCell(h.context);
  const hasNote = getFlowdata(h.context)?.[r]?.[c]?.ps != null;
  return (
    <Cmd
      size={size}
      icon={StickyNote}
      label={hasNote ? t.editNote : t.note}
      description={t.noteTip}
      disabled={readonly(h.context)}
      onClick={() =>
        h.setContext((ctx) => {
          const at = activeCell(ctx);
          if (getFlowdata(ctx)?.[at.r]?.[at.c]?.ps != null)
            editComment(ctx, h.refs.globalCache, at.r, at.c);
          else newComment(ctx, h.refs.globalCache, at.r, at.c);
        })
      }
    />
  );
};

// ------------------------------------------------------ Text, Controls

const TextBoxCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().insert;
  const armed = context.shapeDrawKind === "textBox";
  return (
    <Cmd
      size={size}
      icon={SquareDashedText}
      label={t.textBox}
      description={t.textBoxTip}
      pressed={armed}
      disabled={readonly(context)}
      onClick={() =>
        setContext((ctx) => {
          if (ctx.shapeDrawKind === "textBox") {
            ctx.shapeDrawKind = undefined;
            return;
          }
          clearShapeSelection(ctx);
          ctx.shapeDrawKind = "textBox";
        })
      }
    />
  );
};

const HeaderFooterCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const t = useTabsText().insert;
  const { openPageSetup } = usePageLayoutDialogs();
  return (
    <Cmd
      size={size}
      icon={PanelTopBottomDashed}
      label={t.headerFooter}
      description={t.headerFooterTip}
      onClick={() => openPageSetup("headerFooter")}
    />
  );
};

const CheckboxCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().insert;
  const on = selectionHasCheckboxes(
    getFlowdata(context),
    context.luckysheet_select_save
  );
  return (
    <Cmd
      size={size}
      icon={SquareCheck}
      label={t.checkbox}
      description={on ? t.removeCheckbox : t.checkboxTip}
      pressed={on}
      disabled={readonly(context)}
      onClick={() =>
        setContext((ctx) => {
          toggleCheckboxFormat(ctx);
        })
      }
    />
  );
};

/** Register the Insert tab's commands (and Ctrl+K). */
export function registerInsertCommands() {
  registerRibbonCommand("pivotTable", PivotTableCommand);
  registerRibbonCommand("insert-table", TableCommand);
  registerRibbonCommand("pictures", PicturesCommand, {
    aliases: ["image", "picture-in-cell"],
  });
  registerRibbonCommand("shapes", ShapesCommand);
  registerRibbonCommand("screenshot", ScreenshotCommand);
  registerRibbonCommand("recommended-charts", RecommendedChartsCommand, {
    aliases: ["chart"],
  });
  chartFamilyCommands.forEach(({ id, Component }) =>
    registerRibbonCommand(id, Component, { aliases: ["chart"] })
  );
  sparklineCommands.forEach(({ id, Component }) =>
    registerRibbonCommand(id, Component, { aliases: ["sparkline"] })
  );
  registerRibbonCommand("slicer", SlicerCommand);
  registerRibbonCommand("link", LinkCommand);
  registerRibbonCommand("insert-comment", CommentCommand, {
    aliases: ["threaded-comment"],
  });
  registerRibbonCommand("insert-note", NoteCommand, { aliases: ["comment"] });
  registerRibbonCommand("text-box", TextBoxCommand, { aliases: ["shapes"] });
  registerRibbonCommand("header-footer", HeaderFooterCommand, {
    aliases: ["pageLayout"],
  });
  registerRibbonCommand("checkbox", CheckboxCommand);
  // Excel: Ctrl+K inserts a link
  registerShortcut("ribbon.insertLink", {
    key: "k",
    mod: true,
    handler: (ctx) => {
      handleLink(ctx);
    },
  });
}
