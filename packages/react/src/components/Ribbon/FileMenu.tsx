import React, { useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, ICON_STROKE, MenuItem } from "../ui";
import {
  getFileMenuItems,
  getRibbonRegistryVersion,
  subscribeRibbonRegistry,
} from "./registry";
import {
  shortcutText,
  useRibbonCommandHelpers,
  useRibbonText,
} from "./commands/helpers";

/**
 * Excel's File tab, as a menu: New, Open…, Save As ▸ (.xlsx / .csv),
 * Print… and the entries features register (`registerFileMenuItem`).
 * New / Open / Save As show when the host handles them
 * (`onNewWorkbook`, `onOpenFile`, `onSaveAs`).
 */
const FileMenu: React.FC = () => {
  const h = useRibbonCommandHelpers();
  const t = useRibbonText();
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useSyncExternalStore(
    subscribeRibbonRegistry,
    getRibbonRegistryVersion,
    getRibbonRegistryVersion
  );
  const { settings, context } = h;

  const entries: { order: number; item: MenuItem }[] = getFileMenuItems()
    .filter((f) => f.visible?.(h) ?? true)
    .map((f) => ({
      order: f.order ?? 100,
      item: {
        id: f.id,
        label: typeof f.label === "function" ? f.label(context) : f.label,
        icon: f.icon,
        shortcut: shortcutText(f.shortcut),
        onSelect: () => f.onSelect(h),
      },
    }));
  if (settings.onOpenFile) {
    entries.push({
      order: 20,
      item: {
        id: "open",
        label: t.file.open,
        icon: "file-open",
        onSelect: () => inputRef.current?.click(),
      },
    });
  }
  if (settings.onSaveAs) {
    const save = settings.onSaveAs;
    entries.push({
      order: 30,
      item: {
        id: "save-as",
        label: t.file.saveAs,
        icon: "file-save",
        children: [
          {
            id: "save-xlsx",
            label: t.file.saveAsXlsx,
            onSelect: () => save("xlsx"),
          },
          {
            id: "save-csv",
            label: t.file.saveAsCsv,
            onSelect: () => save("csv"),
          },
        ],
      },
    });
  }
  entries.sort((a, b) => a.order - b.order);
  const items: MenuItem[] = [];
  entries.forEach((e, i) => {
    // a separator between the file and the output entries (Print…)
    if (i > 0 && entries[i - 1].order < 40 && e.order >= 40) {
      items.push({ type: "separator" });
    }
    items.push(e.item);
  });
  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`fortune-ribbon-file${open ? " ts-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          setByKeyboard(e.detail === 0);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setByKeyboard(true);
            setOpen(true);
          }
        }}
      >
        {t.tabs.file}
        <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        items={items}
        autoFocus={byKeyboard}
        minWidth={220}
        aria-label={t.file.menu}
      />
      {settings.onOpenFile && (
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.tsv,.txt"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) settings.onOpenFile?.(file);
          }}
        />
      )}
    </>
  );
};

export default FileMenu;
