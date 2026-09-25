import React, { useContext, useRef, useState } from "react";
import {
  MARGIN_PRESETS,
  addToPrintArea,
  clearPrintArea,
  getPageSetup,
  hasPageBreakAt,
  insertPageBreak,
  isPageBreakPreview,
  isShowingPageBreaks,
  removePageBreak,
  resetAllPageBreaks,
  resolvePageSetup,
  setPageBreakPreview,
  setPrintArea,
  setShowPageBreaks,
  updatePageSetup,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import { activateOnKey } from "../Toolbar/Button";
import { useToolbarPopup } from "../Toolbar/usePopup";
import Select, { Option } from "../Toolbar/Select";
import { MenuDivider } from "../Toolbar/Divider";
import { usePageLayoutDialogs } from "./dialogs";
import { PageLayoutIcon, PrintIcon, usePageLayoutText } from "./shared";

/** Toolbar item "print": File > Print (the Print Preview). */
export const PrintButton: React.FC = () => {
  const t = usePageLayoutText();
  const { openPrintPreview } = usePageLayoutDialogs();
  return (
    <div
      className="fortune-toolbar-button fortune-toolbar-item"
      role="button"
      tabIndex={0}
      aria-label={t.print}
      data-tips={t.print}
      onClick={openPrintPreview}
      onKeyDown={activateOnKey}
    >
      <PrintIcon />
      <div className="fortune-tooltip" aria-hidden="true">
        {t.print}
      </div>
    </div>
  );
};

const Check: React.FC<{ on: boolean }> = ({ on }) => (
  <span className="fortune-page-menu-check" aria-hidden="true">
    {on ? "✓" : ""}
  </span>
);

/** Toolbar item "pageLayout": Excel's Page Layout tab as a menu. */
export const PageLayoutMenu: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const t = usePageLayoutText();
  const { openPrintPreview, openPageSetup } = usePageLayoutDialogs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { onPopupKeyDown, onTriggerClick, onTriggerKeyDown } = useToolbarPopup(
    open,
    setOpen,
    {
      containerRef: ref,
      popupRef,
      triggerRef,
      restoreFocus: () =>
        refs?.cellInput?.current?.focus({ preventScroll: true }),
    }
  );
  const setup = resolvePageSetup(getPageSetup(context));
  const preview = isPageBreakPreview(context);
  const shown = isShowingPageBreaks(context);
  const hasBreak = hasPageBreakAt(context);
  const hasArea = !!getPageSetup(context).printArea?.length;
  const editable = context.allowEdit !== false;

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const edit = (
    recipe: Parameters<typeof setContext>[0],
    options?: Parameters<typeof setContext>[1]
  ) => run(() => setContext(recipe, options));
  const item = (
    key: string,
    label: React.ReactNode,
    onClick: () => void,
    opts: { checked?: boolean; disabled?: boolean } = {}
  ) => (
    <Option key={key} onClick={opts.disabled ? undefined : onClick}>
      <div
        className={`fortune-toolbar-menu-line fortune-page-menu-item${
          opts.disabled ? " disabled" : ""
        }`}
        data-action={key}
        aria-disabled={opts.disabled || undefined}
      >
        {opts.checked !== undefined && <Check on={opts.checked} />}
        <span>{label}</span>
      </div>
    </Option>
  );

  return (
    <div
      ref={ref}
      className="fortune-toobar-combo-container fortune-toolbar-item fortune-page-layout-menu"
    >
      <div
        className="fortune-toolbar-button"
        role="button"
        tabIndex={0}
        aria-label={t.pageLayout}
        aria-haspopup
        aria-expanded={open}
        data-tips={t.pageLayout}
        ref={triggerRef}
        onClick={(e) => onTriggerClick(e, () => setOpen((o) => !o))}
        onKeyDown={(e) => {
          onTriggerKeyDown(e);
          if (!e.defaultPrevented) activateOnKey(e);
        }}
      >
        <PageLayoutIcon />
        <div className="fortune-tooltip" aria-hidden="true">
          {t.pageLayout}
        </div>
      </div>
      {open && (
        <div
          ref={popupRef}
          className="fortune-toolbar-combo-popup"
          onKeyDown={onPopupKeyDown}
        >
          <Select>
            {item("pageSetup", t.pageSetup, () =>
              run(() => openPageSetup("page"))
            )}
            {item("printPreview", t.printPreview, () => run(openPrintPreview))}
            <MenuDivider />
            {item(
              "portrait",
              t.portrait,
              () =>
                edit((ctx) =>
                  updatePageSetup(ctx, { orientation: "portrait" })
                ),
              { checked: setup.orientation === "portrait", disabled: !editable }
            )}
            {item(
              "landscape",
              t.landscape,
              () =>
                edit((ctx) =>
                  updatePageSetup(ctx, { orientation: "landscape" })
                ),
              {
                checked: setup.orientation === "landscape",
                disabled: !editable,
              }
            )}
            <MenuDivider />
            {(
              Object.keys(MARGIN_PRESETS) as (keyof typeof MARGIN_PRESETS)[]
            ).map((k) =>
              item(
                `margins-${k}`,
                `${t.margins}: ${t.marginPresets[k]}`,
                () =>
                  edit((ctx) =>
                    updatePageSetup(ctx, { margins: { ...MARGIN_PRESETS[k] } })
                  ),
                {
                  checked: _.isEqual(setup.margins, MARGIN_PRESETS[k]),
                  disabled: !editable,
                }
              )
            )}
            <MenuDivider />
            {item(
              "setPrintArea",
              t.setPrintArea,
              () => edit((ctx) => setPrintArea(ctx)),
              { disabled: !editable }
            )}
            {item(
              "addToPrintArea",
              t.addToPrintArea,
              () => edit((ctx) => addToPrintArea(ctx)),
              { disabled: !editable || !hasArea }
            )}
            {item(
              "clearPrintArea",
              t.clearPrintArea,
              () => edit((ctx) => clearPrintArea(ctx)),
              { disabled: !editable || !hasArea }
            )}
            {item("printTitles", t.printTitles, () =>
              run(() => openPageSetup("sheet"))
            )}
            <MenuDivider />
            {item(
              "insertPageBreak",
              t.insertPageBreak,
              () =>
                edit((ctx) => {
                  insertPageBreak(ctx);
                  if (settings.showPageBreaksAfterPrint !== false) {
                    setShowPageBreaks(ctx, true);
                  }
                }),
              { disabled: !editable }
            )}
            {item(
              "removePageBreak",
              t.removePageBreak,
              () => edit((ctx) => removePageBreak(ctx)),
              { disabled: !editable || !hasBreak }
            )}
            {item(
              "resetPageBreaks",
              t.resetPageBreaks,
              () => edit((ctx) => resetAllPageBreaks(ctx)),
              {
                disabled:
                  !editable ||
                  (setup.rowBreaks.length === 0 &&
                    setup.colBreaks.length === 0),
              }
            )}
            <MenuDivider />
            {item(
              "pageBreakPreview",
              t.pageBreakPreview,
              () =>
                edit((ctx) => setPageBreakPreview(ctx, !preview), {
                  noHistory: true,
                }),
              { checked: preview }
            )}
            {item(
              "showPageBreaks",
              t.showPageBreaks,
              () =>
                edit((ctx) => setShowPageBreaks(ctx, !shown), {
                  noHistory: true,
                }),
              { checked: shown }
            )}
          </Select>
        </div>
      )}
    </div>
  );
};
