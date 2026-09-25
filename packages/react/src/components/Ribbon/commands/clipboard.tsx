/**
 * Home › Clipboard: Paste (split: Paste / Paste Special…), Cut, Copy.
 * Format Painter is still the legacy toolbar item.
 */
import React from "react";
import { handleCopy, handlePasteByClick } from "@lofcz/tinysheet-core";
import { IconButton, LargeButton, MenuItem } from "../../ui";
import { getContextMenuAction } from "../../ContextMenu/actions";
import type { RibbonCommandProps } from "../registry";
import {
  shortcutText,
  useRibbonCommandHelpers,
  useRibbonText,
} from "./helpers";

/** The clipboard text (system clipboard, or the in-page fallback). */
async function readClipboardText() {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    // clipboard access blocked: the session copy below
  }
  return text || sessionStorage.getItem("localClipboard") || "";
}

export const PasteCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useRibbonText().commands;
  const editable = h.context.allowEdit !== false;
  const paste = async () => {
    const text = await readClipboardText();
    h.setContext((ctx) => handlePasteByClick(ctx, text));
    h.focusSheet();
  };
  const pasteSpecial = getContextMenuAction("pasteSpecial");
  const menu: MenuItem[] = [
    {
      id: "paste",
      label: t.paste,
      icon: "paste",
      shortcut: shortcutText(t.pasteShortcut),
      onSelect: paste,
    },
  ];
  if (pasteSpecial) {
    menu.push({ type: "separator" });
    menu.push({
      id: "paste-special",
      label: t.pasteSpecial,
      shortcut: shortcutText("Ctrl+Alt+V"),
      disabled: !h.context.luckysheet_copy_save?.copyRange?.length,
      onSelect: () => pasteSpecial(h),
    });
  }
  if (size === "small") {
    return (
      <IconButton
        icon="paste"
        label={t.paste}
        shortcut={shortcutText(t.pasteShortcut)}
        disabled={!editable}
        onClick={paste}
      />
    );
  }
  return (
    <LargeButton
      icon="paste"
      label={t.paste}
      shortcut={shortcutText(t.pasteShortcut)}
      disabled={!editable}
      onClick={paste}
      menu={menu}
    />
  );
};

export const CutCommand: React.FC<RibbonCommandProps> = () => {
  const h = useRibbonCommandHelpers();
  const t = useRibbonText().commands;
  return (
    <IconButton
      icon="cut"
      label={t.cut}
      shortcut={shortcutText(t.cutShortcut)}
      disabled={h.context.allowEdit === false}
      onClick={() => {
        h.setContext((ctx) => {
          handleCopy(ctx);
          ctx.luckysheet_paste_iscut = true;
        });
        h.focusSheet();
      }}
    />
  );
};

export const CopyCommand: React.FC<RibbonCommandProps> = () => {
  const h = useRibbonCommandHelpers();
  const t = useRibbonText().commands;
  return (
    <IconButton
      icon="copy"
      label={t.copy}
      shortcut={shortcutText(t.copyShortcut)}
      onClick={() => {
        h.setContext((ctx) => handleCopy(ctx));
        h.focusSheet();
      }}
    />
  );
};
