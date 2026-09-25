/**
 * Pictures in cells, React side: the Picture in Cell toolbar item, the
 * Place in Cell / Place over Cells / Alt Text menu entries, a sheet overlay
 * that redraws the grid when pictures finish loading, shows a picture's alt
 * text on hover and pastes clipboard pictures into the active cell, and the
 * formula bar's picture chip. The model and drawing live in core
 * (modules/cellImage*.ts).
 */
import {
  Context,
  colLocation,
  convertCellImageToFloating,
  convertFloatingImageToCell,
  fixPositionOnFrozenCells,
  getFlowdata,
  installCellImages,
  isAllowedImageSource,
  isPlacedImageCell,
  locale,
  onCellImageLoad,
  placeImageInCell,
  removeActiveImage,
  rowLocation,
  selectionCache,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { ModalContext } from "../../context/modal";
import { WorkbookStoreContext } from "../../context/store";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import { registerContextMenuItem } from "../ContextMenu/actions";
import { activateOnKey } from "../Toolbar/Button";
import { AltTextDialog, InsertPictureDialog } from "./dialogs";
import { isPictureFile, readPictureFile } from "./readImage";
import "./index.css";

/** The active cell (a merge's top-left cell) and its content. */
export function activePictureTarget(ctx: Context) {
  const sel = ctx.luckysheet_select_save;
  const last = sel?.[sel.length - 1];
  if (!last) return null;
  let r = last.row_focus ?? last.row[0];
  let c = last.column_focus ?? last.column[0];
  const d = getFlowdata(ctx);
  const mc = d?.[r]?.[c]?.mc;
  if (mc) {
    r = mc.r;
    c = mc.c;
  }
  return { r, c, cell: d?.[r]?.[c] ?? null };
}

/** A picture inside a cell grid (24px, currentColor). */
export const PictureInCellIcon: React.FC<{ size?: number }> = ({
  size = 24,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M3.75 8.25h16.5M3.75 15.75h16.5M8.25 3.75v16.5M15.75 3.75v16.5"
      stroke="currentColor"
      strokeWidth="1"
      opacity="0.45"
    />
    <rect
      x="7.75"
      y="7.75"
      width="8.5"
      height="8.5"
      rx="0.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M9 15l2.2-2.6 1.4 1.5 1.3-1.2L15.4 15z" fill="currentColor" />
    <circle cx="13.9" cy="10.1" r="0.9" fill="currentColor" />
  </svg>
);

const PictureInCellButton: React.FC<{ tooltip: string }> = ({ tooltip }) => {
  const { context } = useContext(WorkbookContext);
  const { showModal } = useContext(ModalContext);
  const label = tooltip || locale(context).cellImage.pictureInCell;
  return (
    <div
      className="fortune-toolbar-button fortune-toolbar-item"
      onClick={() => {
        if (context.allowEdit === false) return;
        const at = activePictureTarget(context);
        if (at) showModal(<InsertPictureDialog r={at.r} c={at.c} />);
      }}
      onKeyDown={activateOnKey}
      tabIndex={0}
      data-tips={label}
      role="button"
      aria-label={label}
    >
      <PictureInCellIcon />
      <div className="fortune-tooltip" aria-hidden="true">
        {label}
      </div>
    </div>
  );
};

/** A single picture in pasted HTML with no text around it (a copied image). */
function pastedPictureUrl(html: string) {
  if (!html || !/<img/i.test(html) || typeof DOMParser === "undefined") {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = doc.body.querySelectorAll("img");
  if (imgs.length !== 1 || (doc.body.textContent ?? "").trim() !== "") {
    return null;
  }
  const src = imgs[0].getAttribute("src") ?? "";
  return isAllowedImageSource(src)
    ? { src, alt: imgs[0].getAttribute("alt") ?? "" }
    : null;
}

type Tip = { key: string; text: string; left: number; top: number };

/**
 * Mounted in the cell area: redraws when pictures load, shows the alt text
 * of the picture under the mouse, pastes clipboard pictures into cells.
 */
export const CellImageLayer: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const store = useContext(WorkbookStoreContext);
  // handlers read the latest state untracked (no re-render per read)
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const latest = () => store?.getState() ?? ctxRef.current;
  const [tip, setTip] = useState<Tip | null>(null);

  // a picture finished loading: redraw the grid once per frame
  useEffect(() => {
    let frame: number | null = null;
    const off = onCellImageLoad(() => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setContext(
          (draftCtx) => {
            draftCtx.cellImageRevision = (draftCtx.cellImageRevision ?? 0) + 1;
          },
          { noHistory: true }
        );
      });
    });
    return () => {
      off();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [setContext]);

  // alt text of the picture under the mouse
  useEffect(() => {
    const area = refs.cellArea.current;
    if (!area) return undefined;
    const hide = () => setTip((prev) => (prev ? null : prev));
    const onMove = (e: MouseEvent) => {
      const ctx = latest();
      if (ctx.luckysheetCellUpdate.length > 0 || e.buttons !== 0) {
        hide();
        return;
      }
      const rect = area.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const freeze = refs.globalCache.freezen?.[ctx.currentSheetId];
      const { x, y } = fixPositionOnFrozenCells(
        freeze,
        mouseX + ctx.scrollLeft,
        mouseY + ctx.scrollTop,
        mouseX,
        mouseY
      );
      const r = rowLocation(y, ctx.visibledatarow)[2];
      const c = colLocation(x, ctx.visibledatacolumn)[2];
      const d = getFlowdata(ctx);
      let cell = d?.[r]?.[c];
      if (cell?.mc) cell = d?.[cell.mc.r]?.[cell.mc.c];
      const text = cell?.img?.alt;
      if (!text) {
        hide();
        return;
      }
      const key = `${ctx.currentSheetId}:${r}_${c}`;
      setTip((prev) =>
        prev?.key === key
          ? prev
          : {
              key,
              text,
              left: mouseX + area.scrollLeft + 12,
              top: mouseY + area.scrollTop + 18,
            }
      );
    };
    area.addEventListener("mousemove", onMove);
    area.addEventListener("mouseleave", hide);
    area.addEventListener("mousedown", hide);
    return () => {
      area.removeEventListener("mousemove", onMove);
      area.removeEventListener("mouseleave", hide);
      area.removeEventListener("mousedown", hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.cellArea, refs.globalCache]);

  // Ctrl+V of a picture places it in the active cell (before the sheet's
  // own paste handler, which ignores pictures)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const ctx = latest();
      if (ctx.allowEdit === false || ctx.luckysheetCellUpdate.length > 0) {
        return;
      }
      const active = document.activeElement;
      if (
        active !== refs.cellInput.current &&
        active?.className !== "fortune-sheet-overlay"
      ) {
        return;
      }
      const data = e.clipboardData;
      if (!data) return;
      const html = data.getData("text/html") || "";
      if (/<table/i.test(html)) return;
      const file =
        Array.from(data.files ?? []).find(isPictureFile) ??
        Array.from(data.items ?? [])
          .find((i) => i.kind === "file" && /^image\//i.test(i.type))
          ?.getAsFile();
      const linked = file ? null : pastedPictureUrl(html);
      if (!file && !linked) return;
      const at = activePictureTarget(ctx);
      if (!at) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      selectionCache.isPasteAction = false;
      const place = (src: string, alt?: string) =>
        setContext((draftCtx) => {
          placeImageInCell(draftCtx, at.r, at.c, {
            src,
            alt: alt || undefined,
          });
        });
      if (linked) place(linked.src, linked.alt);
      else if (file)
        readPictureFile(file).then(
          (src) => place(src),
          () => {}
        );
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.cellInput, setContext]);

  if (!tip) return null;
  return (
    <div
      className="fortune-cell-image-tooltip"
      role="tooltip"
      style={{ left: tip.left, top: tip.top }}
    >
      {tip.text}
    </div>
  );
};

/**
 * Formula bar chip for a placed picture (a formula picture shows its
 * =IMAGE(...) formula instead). Covers the bar until it is focused.
 */
export const FxPictureChip: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const at = activePictureTarget(context);
  if (!at || !isPlacedImageCell(at.cell)) return null;
  const t = locale(context).cellImage;
  const alt = at.cell!.img!.alt ?? "";
  return (
    <div className="fortune-fx-picture-chip" aria-hidden="true">
      <span className="fortune-fx-picture-chip-body" title={alt || undefined}>
        <PictureInCellIcon size={16} />
        <span>{alt || t.picture}</span>
      </span>
    </div>
  );
};

let registered = false;

/**
 * Register everything above (idempotent). Called when the context menu
 * module loads, like the default menu actions (the package is side-effect
 * free, so a bare import would be dropped).
 */
export function registerCellImageFeature() {
  if (registered) return;
  registered = true;
  installCellImages();
  registerSheetOverlay("cellImages", CellImageLayer);
  registerToolbarItem("picture-in-cell", ({ tooltip }) => (
    <PictureInCellButton tooltip={tooltip} />
  ));
  registerContextMenuItem("picture-in-cell", {
    label: (ctx) => locale(ctx).cellImage.insertPicture,
    icon: "image",
    onSelect: ({ context, showModal }) => {
      const at = activePictureTarget(context);
      if (at) showModal(<InsertPictureDialog r={at.r} c={at.c} />);
    },
  });
  registerContextMenuItem("picture-over-cells", {
    label: (ctx) => locale(ctx).cellImage.placeOverCells,
    visible: (ctx) => !!activePictureTarget(ctx)?.cell?.img,
    onSelect: ({ context, setContext }) => {
      const at = activePictureTarget(context);
      if (!at) return;
      setContext((draftCtx) => {
        convertCellImageToFloating(draftCtx, at.r, at.c);
      });
    },
  });
  registerContextMenuItem("picture-alt-text", {
    label: (ctx) => locale(ctx).cellImage.altText,
    visible: (ctx) => isPlacedImageCell(activePictureTarget(ctx)?.cell),
    onSelect: ({ context, showModal }) => {
      const at = activePictureTarget(context);
      if (!at?.cell?.img) return;
      showModal(
        <AltTextDialog r={at.r} c={at.c} initial={at.cell.img.alt ?? ""} />
      );
    },
  });
  // the menu of a floating picture
  registerContextMenuItem("picture-place-in-cell", {
    menu: "image",
    label: (ctx) => locale(ctx).cellImage.placeInCell,
    icon: "image",
    visible: (ctx) => !!ctx.activeImg,
    onSelect: ({ setContext }) => {
      setContext((draftCtx) => {
        convertFloatingImageToCell(draftCtx);
      });
    },
  });
  registerContextMenuItem("picture-delete", {
    menu: "image",
    label: (ctx) => locale(ctx).cellImage.deletePicture,
    icon: "delete",
    visible: (ctx) => !!ctx.activeImg,
    onSelect: ({ setContext }) => {
      setContext((draftCtx) => removeActiveImage(draftCtx));
    },
  });
}
