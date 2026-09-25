import { Sheet, unhideSheets } from "@lofcz/tinysheet-core";
import React, { useContext } from "react";
import WorkbookContext from "../../context";
import "./index.css";
import SheetHiddenButton from "./SheetHiddenButton";
import SVGIcon from "../SVGIcon";
import { activateSheetTab } from "../SheetTab/activate";

type Props = {
  sheet: Sheet;
};

const SheetListItem: React.FC<Props> = ({ sheet }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);

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
      className="fortune-sheet-list-item"
      role="menuitemradio"
      aria-checked={sheet.id === context.currentSheetId}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      tabIndex={0}
    >
      <span className="fortune-sheet-selected-check-sapce">
        {sheet.id === context.currentSheetId && (
          <SVGIcon
            name="check"
            width={16}
            height={16}
            style={{ lineHeight: 30, verticalAlign: "middle" }}
          />
        )}
      </span>
      <span
        className="luckysheet-sheets-item-name fortune-sheet-list-item-name"
        spellCheck="false"
      >
        {!!sheet.color && (
          <div
            className="luckysheet-sheets-list-item-color"
            style={{ background: sheet.color }}
          />
        )}
        {sheet.name}
      </span>
      {sheet.hide === 1 && <SheetHiddenButton sheet={sheet} />}
    </div>
  );
};

export default SheetListItem;
