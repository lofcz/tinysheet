import React, { useContext } from "react";
import { getEditMode, EditMode } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import "./index.css";

const LABELS: Record<EditMode, string> = {
  ready: "Ready",
  enter: "Enter",
  edit: "Edit",
  point: "Point",
};

/**
 * Excel's status bar mode: Ready / Enter / Edit / Point, plus "End Mode"
 * while End is waiting for an arrow key.
 */
const EditModeIndicator: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const mode = getEditMode(context);
  return (
    <div
      className="fortune-edit-mode"
      data-mode={mode}
      role="status"
      aria-live="polite"
    >
      <span className="fortune-edit-mode-label">{LABELS[mode]}</span>
      {context.endMode && mode === "ready" && (
        <span className="fortune-edit-mode-end">End Mode</span>
      )}
    </div>
  );
};

export default EditModeIndicator;
