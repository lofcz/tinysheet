/**
 * Home › Clipboard: Paste (split: Paste, Formulas, Keep Source Formatting,
 * No Borders, Transpose, Values, Formatting, Paste Link, Paste Special…),
 * Cut, Copy and Format Painter (a click paints once, a double-click keeps
 * painting until Esc).
 */
import React from "react";
import {
  ArrowDownUp,
  ClipboardPaste,
  Copy,
  Hash,
  Link,
  MoveHorizontal,
  Paintbrush,
  Percent,
  Scissors,
  SquareDashed,
  SquareFunction,
  SquarePercent,
} from "lucide-react";
import {
  handleCopy,
  handleFormatPainter,
  handlePasteByClick,
  handlePasteSpecial,
  PasteSpecialOptions,
  startFormatPainter,
} from "@lofcz/tinysheet-core";
import {
  IconButton,
  LargeButton,
  LucideIcon,
  MenuItem,
  SplitButton,
} from "../../ui";
import { getContextMenuAction } from "../../ContextMenu/actions";
import type { RibbonCommandProps } from "../registry";
import { shortcutText } from "./helpers";
import { useHome } from "./home/shared";

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
  const home = useHome();
  const { t, h } = home;
  const hasCopy = !!h.context.luckysheet_copy_save?.copyRange?.length;
  const paste = async () => {
    const text = await readClipboardText();
    home.run((ctx) => handlePasteByClick(ctx, text));
  };
  const special = (options: PasteSpecialOptions) => () =>
    home.run((ctx) => {
      handlePasteSpecial(ctx, options);
    });
  const option = (
    id: string,
    label: string,
    icon: LucideIcon,
    options: PasteSpecialOptions
  ): MenuItem => ({
    id: `paste-${id}`,
    label,
    icon,
    disabled: !hasCopy,
    onSelect: special(options),
  });
  const menu: MenuItem[] = [
    { type: "header", label: t.pasteGroup },
    {
      id: "paste-all",
      label: t.pasteAll,
      icon: ClipboardPaste,
      shortcut: shortcutText(t.pasteShortcut),
      onSelect: paste,
    },
    option("formulas", t.pasteFormulas, SquareFunction, { paste: "formulas" }),
    option("formulas-number", t.pasteFormulasNumber, SquarePercent, {
      paste: "formulasAndNumberFormats",
    }),
    option("keep-source", t.pasteKeepSource, Paintbrush, { paste: "all" }),
    option("no-borders", t.pasteNoBorders, SquareDashed, {
      paste: "allExceptBorders",
    }),
    option("column-widths", t.pasteColumnWidths, MoveHorizontal, {
      paste: "allUsingSourceColumnWidths",
    }),
    option("transpose", t.pasteTranspose, ArrowDownUp, {
      paste: "all",
      transpose: true,
    }),
    { type: "header", label: t.pasteValuesGroup },
    option("values", t.pasteValues, Hash, { paste: "values" }),
    option("values-number", t.pasteValuesNumber, Percent, {
      paste: "valuesAndNumberFormats",
    }),
    { type: "header", label: t.pasteOtherGroup },
    option("formatting", t.pasteFormatting, Paintbrush, { paste: "formats" }),
    option("link", t.pasteLink, Link, { pasteLink: true }),
  ];
  const pasteSpecial = getContextMenuAction("pasteSpecial");
  if (pasteSpecial) {
    menu.push({ type: "separator" });
    menu.push({
      id: "paste-special",
      label: t.pasteSpecial,
      shortcut: shortcutText(t.pasteSpecialShortcut),
      disabled: !hasCopy,
      onSelect: () => pasteSpecial(h),
    });
  }
  if (size === "small") {
    return (
      <SplitButton
        icon={ClipboardPaste}
        label={t.paste}
        shortcut={shortcutText(t.pasteShortcut)}
        description={t.pasteDescription}
        disabled={!home.editable}
        onClick={paste}
        menu={menu}
      />
    );
  }
  return (
    <LargeButton
      icon={ClipboardPaste}
      label={t.paste}
      shortcut={shortcutText(t.pasteShortcut)}
      description={t.pasteDescription}
      disabled={!home.editable}
      onClick={paste}
      menu={menu}
    />
  );
};

export const CutCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  return (
    <IconButton
      icon={Scissors}
      label={t.cut}
      shortcut={shortcutText(t.cutShortcut)}
      disabled={!home.editable}
      onClick={() =>
        home.run((ctx) => {
          handleCopy(ctx);
          ctx.luckysheet_paste_iscut = true;
        })
      }
    />
  );
};

export const CopyCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  return (
    <IconButton
      icon={Copy}
      label={t.copy}
      shortcut={shortcutText(t.copyShortcut)}
      onClick={() => home.run((ctx) => handleCopy(ctx))}
    />
  );
};

export const FormatPainterCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const on = !!home.context.luckysheetPaintModelOn;
  return (
    <IconButton
      icon={Paintbrush}
      label={t.formatPainter}
      description={t.formatPainterDescription}
      pressed={on}
      data-sticky={on && !home.context.luckysheetPaintSingle ? "" : undefined}
      disabled={!home.editable}
      onClick={(e) => {
        // the second click of a double-click is handled below
        if (e.detail > 1) return;
        home.run((ctx) => handleFormatPainter(ctx), { noHistory: true });
      }}
      onDoubleClick={() =>
        home.run((ctx) => startFormatPainter(ctx, true), { noHistory: true })
      }
    />
  );
};
