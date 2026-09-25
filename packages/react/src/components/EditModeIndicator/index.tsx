import React, { useContext } from "react";
import { getEditMode, locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import "./index.css";

/**
 * Excel's status bar mode: Ready / Enter / Edit / Point, plus "End Mode"
 * while End is waiting for an arrow key.
 */
const EditModeIndicator: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const mode = getEditMode(context);
  const { editMode: t } = locale(context);
  return (
    <div
      className="fortune-edit-mode"
      data-mode={mode}
      role="status"
      aria-live="polite"
    >
      <span className="fortune-edit-mode-label">{t[mode]}</span>
      {context.endMode && mode === "ready" && (
        <span className="fortune-edit-mode-end">{t.endMode}</span>
      )}
    </div>
  );
};

export default EditModeIndicator;
