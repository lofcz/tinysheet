/**
 * The quick access cluster of the tab row: Undo (Ctrl+Z) and Redo (Ctrl+Y).
 */
import React, { useContext } from "react";
import { Redo2, Undo2 } from "lucide-react";
import { locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import { IconButton } from "../../ui";
import type { RibbonCommandProps } from "../registry";
import { shortcutText } from "./helpers";

export const UndoCommand: React.FC<RibbonCommandProps> = () => {
  const { context, refs, handleUndo } = useContext(WorkbookContext);
  return (
    <IconButton
      icon={Undo2}
      label={locale(context).toolbar.undo}
      shortcut={shortcutText("Ctrl+Z")}
      disabled={refs.globalCache.undoList.length === 0}
      onClick={() => handleUndo()}
    />
  );
};

export const RedoCommand: React.FC<RibbonCommandProps> = () => {
  const { context, refs, handleRedo } = useContext(WorkbookContext);
  return (
    <IconButton
      icon={Redo2}
      label={locale(context).toolbar.redo}
      shortcut={shortcutText("Ctrl+Y")}
      disabled={refs.globalCache.redoList.length === 0}
      onClick={() => handleRedo()}
    />
  );
};
