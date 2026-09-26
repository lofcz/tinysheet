import _ from "lodash";
import React, { useContext, useRef, useCallback, useEffect } from "react";
import { locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useFloatingPosition } from "../ui/floating";
import "../ui/ui.css";
import "./index.css";
import SheetListItem from "./SheetListItem";

/**
 * All sheets (the ≡ button of the bottom bar): every sheet, hidden ones
 * with an eye to unhide them; a click shows the sheet. A menu above the
 * button, kept inside the window.
 */
const SheetList: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  anchorRef.current =
    refs.workbookContainer.current?.querySelector<HTMLElement>(
      "button#all-sheets"
    ) ?? null;
  useFloatingPosition(true, anchorRef, containerRef, "top-start", 6);

  const close = useCallback(() => {
    setContext((ctx) => {
      ctx.showSheetList = false;
    });
  }, [setContext]);
  useOutsideClick(containerRef, close, [close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  // the current sheet is in view (and focused when opened by keyboard)
  useEffect(() => {
    const item = containerRef.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]'
    );
    item?.scrollIntoView({ block: "nearest" });
    if (anchorRef.current?.matches(":focus-visible")) {
      item?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div
      className="fortune-sheet-list ts-popover ts-popover--menu"
      ref={containerRef}
      role="menu"
      aria-label={locale(context).info.allSheets}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const items = Array.from(
          containerRef.current?.querySelectorAll<HTMLElement>(
            ".fortune-sheet-list-item"
          ) ?? []
        );
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === "ArrowDown"
            ? items[(at + 1) % items.length]
            : items[(at - 1 + items.length) % items.length];
        e.preventDefault();
        next?.focus();
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {_.sortBy(context.luckysheetfile, (s) => Number(s.order)).map(
        (singleSheet) => {
          return <SheetListItem sheet={singleSheet} key={singleSheet.id} />;
        }
      )}
    </div>
  );
};

export default SheetList;
