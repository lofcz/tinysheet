import React from "react";
import {
  insertChart,
  openFormatCells,
  openPasteSpecial,
} from "@lofcz/tinysheet-core";
import { registerContextMenuAction } from "./actions";
import NameManager from "../NameManager";

/**
 * Handlers of the cell menu entries whose feature lives in another module.
 * Registered once when the context menu module loads; hosts can replace any
 * of them with `registerContextMenuAction`.
 */
export function registerDefaultContextMenuActions() {
  const unregister = [
    // Paste Special dialog over the last copy (Ctrl+Alt+V)
    registerContextMenuAction("pasteSpecial", ({ setContext }) => {
      setContext(
        (ctx) => {
          openPasteSpecial(ctx);
        },
        { noHistory: true }
      );
    }),
    // Format Cells dialog (Ctrl+1)
    registerContextMenuAction("formatCells", ({ setContext }) => {
      setContext((ctx) => openFormatCells(ctx, "number"), {
        noHistory: true,
      });
    }),
    // a clustered column chart of the selection, selected for editing
    registerContextMenuAction("insertChart", ({ setContext }) => {
      setContext((ctx) => {
        insertChart(ctx, { type: "column", grouping: "clustered" });
      });
    }),
    // Formulas > Define Name: the New Name dialog for the selection
    registerContextMenuAction("defineName", ({ showDialog }) => {
      showDialog(<NameManager initialMode="newName" />);
    }),
  ];
  return () => unregister.forEach((fn) => fn());
}

registerDefaultContextMenuActions();
