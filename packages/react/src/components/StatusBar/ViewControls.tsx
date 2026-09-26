import React, { useContext } from "react";
import {
  isPageBreakPreview,
  locale,
  requestPrintPreview,
  setPageBreakPreview,
} from "@lofcz/tinysheet-core";
import { Grid3x3, PanelTop, PanelTopBottomDashed } from "lucide-react";
import WorkbookContext from "../../context";
import { IconButton } from "../ui/Button";
import ZoomControl from "../ZoomControl";
import "./index.css";

export type WorkbookView = "normal" | "pageLayout" | "pageBreakPreview";

/**
 * The right end of the status bar (Excel): the workbook view buttons
 * (Normal, Page Layout, Page Break Preview) and the zoom control.
 *
 * Normal and Page Break Preview switch the sheet's page layout view state
 * (`setPageBreakPreview`); Page Layout shows the pages in Print Preview,
 * the page view TinySheet has.
 */
const ViewControls: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { statusBar } = locale(context);
  const preview = isPageBreakPreview(context);
  const current: WorkbookView = preview ? "pageBreakPreview" : "normal";

  const show = (view: WorkbookView) => {
    setContext(
      (ctx) => {
        if (view === "pageLayout") {
          requestPrintPreview(ctx);
          return;
        }
        const on = view === "pageBreakPreview";
        if (isPageBreakPreview(ctx) !== on) setPageBreakPreview(ctx, on);
      },
      { noHistory: true }
    );
  };

  const buttons: {
    view: WorkbookView;
    label: string;
    icon: typeof Grid3x3;
  }[] = [
    { view: "normal", label: statusBar.normalView, icon: Grid3x3 },
    { view: "pageLayout", label: statusBar.pageLayoutView, icon: PanelTop },
    {
      view: "pageBreakPreview",
      label: statusBar.pageBreakPreview,
      icon: PanelTopBottomDashed,
    },
  ];

  return (
    <div className="fortune-view-controls">
      <div
        className="fortune-view-buttons"
        role="group"
        aria-label={statusBar.views}
      >
        {buttons.map(({ view, label, icon }) => (
          <IconButton
            key={view}
            size="sm"
            icon={icon}
            label={label}
            data-view={view}
            className={`fortune-view-button${
              current === view ? " fortune-view-button-active" : ""
            }`}
            aria-pressed={current === view}
            onClick={() => show(view)}
          />
        ))}
      </div>
      <ZoomControl />
    </div>
  );
};

export default ViewControls;
