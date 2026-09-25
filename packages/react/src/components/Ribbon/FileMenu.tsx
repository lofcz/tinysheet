import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { ribbonFormulasDataReviewLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
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
import "./commands/kit.css";

/** A File menu entry: the command and a line saying what it does. */
const Entry: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <span className="fortune-file-entry">
    <span className="fortune-file-entry-title">{title}</span>
    {description && (
      <span className="fortune-file-entry-description">{description}</span>
    )}
  </span>
);

/**
 * Excel's File tab as a Fika menu ("backstage lite"): New, Open…,
 * Save As ▸ (.xlsx / .csv), Print… and the entries features register
 * (`registerFileMenuItem`), each with a line saying what it does.
 * New / Open / Save As show when the host handles them (`onNewWorkbook`,
 * `onOpenFile`, `onSaveAs`). Keyboard: Alt+F opens it, Enter / Space /
 * ArrowDown on the button too; Ctrl+O opens a file when the host does.
 */
const FileMenu: React.FC = () => {
  const h = useRibbonCommandHelpers();
  const t = useRibbonText();
  const { refs } = useContext(WorkbookContext);
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
  const d = ribbonFormulasDataReviewLocale(context).file;
  const canOpen = !!settings.onOpenFile;

  // Alt+F: the File menu; Ctrl+O: Open… (anywhere in the workbook)
  useEffect(() => {
    const container = refs.workbookContainer.current;
    if (!container) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && key === "f") {
        e.preventDefault();
        e.stopPropagation();
        anchorRef.current?.focus();
        setByKeyboard(true);
        setOpen(true);
      } else if (
        canOpen &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        key === "o"
      ) {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.click();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [refs.workbookContainer, canOpen]);

  const descriptions: Record<string, string> = {
    new: d.newDescription,
    print: d.printDescription,
  };
  const entries: { order: number; item: MenuItem }[] = getFileMenuItems()
    .filter((f) => f.visible?.(h) ?? true)
    .map((f) => {
      const label = typeof f.label === "function" ? f.label(context) : f.label;
      return {
        order: f.order ?? 100,
        item: {
          id: f.id,
          label: <Entry title={label} description={descriptions[f.id]} />,
          icon: f.icon,
          shortcut: shortcutText(f.shortcut),
          onSelect: () => f.onSelect(h),
        },
      };
    });
  if (canOpen) {
    entries.push({
      order: 20,
      item: {
        id: "open",
        label: <Entry title={t.file.open} description={d.openDescription} />,
        icon: "file-open",
        shortcut: shortcutText(t.file.openShortcut),
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
        label: (
          <Entry title={t.file.saveAs} description={d.saveAsDescription} />
        ),
        icon: "file-save",
        children: [
          {
            id: "save-xlsx",
            label: (
              <Entry
                title={t.file.saveAsXlsx}
                description={d.saveAsXlsxDescription}
              />
            ),
            icon: FileSpreadsheet,
            onSelect: () => save("xlsx"),
          },
          {
            id: "save-csv",
            label: (
              <Entry
                title={t.file.saveAsCsv}
                description={d.saveAsCsvDescription}
              />
            ),
            icon: FileText,
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
        aria-keyshortcuts="Alt+F"
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
        minWidth={280}
        className="fortune-file-menu"
        aria-label={t.file.menu}
      />
      {canOpen && (
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.tsv,.txt"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          data-testid="file-open-input"
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
