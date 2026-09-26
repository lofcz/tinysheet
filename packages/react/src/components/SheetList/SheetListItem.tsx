import { Sheet, unhideSheets } from "@lofcz/tinysheet-core";
import React, { useContext } from "react";
import { Check } from "lucide-react";
import WorkbookContext from "../../context";
import "./index.css";
import SheetHiddenButton from "./SheetHiddenButton";
import { Icon } from "../ui/icons";
import { activateSheetTab } from "../SheetTab/activate";

type Props = {
  sheet: Sheet;
};

const SheetListItem: React.FC<Props> = ({ sheet }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const current = sheet.id === context.currentSheetId;

  const activate = () => {
    setContext((draftCtx) => {
      draftCtx.showSheetList = undefined;
      // a hidden sheet is unhidden to be shown
      if (sheet.hide === 1) {
        if (draftCtx.allowEdit === false) return;
        unhideSheets(draftCtx, [sheet.id!]);
        return;
      }
      activateSheetTab(
        draftCtx,
        sheet.id!,
        refs.globalCache,
        refs.cellInput.current
      );
    });
    refs.cellInput.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className={`ts-menu-item fortune-sheet-list-item${
        sheet.hide === 1 ? " fortune-sheet-list-item-hidden" : ""
      }`}
      role="menuitemradio"
      aria-checked={current}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      tabIndex={0}
    >
      <span className="ts-menu-icon fortune-sheet-selected-check-sapce">
        {current && <Icon icon={Check} size={16} />}
      </span>
      <span
        className="fortune-sheet-list-item-color"
        style={{ background: sheet.color || undefined }}
        aria-hidden="true"
      />
      <span
        className="ts-menu-label luckysheet-sheets-item-name fortune-sheet-list-item-name"
        spellCheck="false"
      >
        {sheet.name}
      </span>
      {sheet.hide === 1 && <SheetHiddenButton sheet={sheet} />}
    </div>
  );
};

export default SheetListItem;
