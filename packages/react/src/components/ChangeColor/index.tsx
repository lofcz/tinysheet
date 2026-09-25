import {
  Context,
  getSheetIndex,
  locale,
  setSheetTabColor,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useState } from "react";
import WorkbookContext from "../../context";
import ColorPicker from "../Toolbar/ColorPicker";
import "./index.css";

type Props = {
  triggerParentUpdate: (state: boolean) => void;
  /** Sheets to colour (grouped sheets); defaults to the active sheet. */
  sheetIds?: string[];
};

/** Tab colour picker of the sheet tab context menu. */
export const ChangeColor: React.FC<Props> = ({
  triggerParentUpdate,
  sheetIds,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { toolbar, sheetconfig, button } = locale(context);
  const current =
    context.luckysheetfile[
      getSheetIndex(context, context.currentSheetId) as number
    ]?.color;
  const [inputColor, setInputColor] = useState<string>(current ?? "#000000");

  // colours are applied only when picked (opening the menu changes nothing)
  const apply = useCallback(
    (color: string | undefined) => {
      setContext((ctx: Context) => {
        setSheetTabColor(
          ctx,
          sheetIds?.filter(Boolean).length ? sheetIds : [ctx.currentSheetId],
          color
        );
      });
    },
    [setContext, sheetIds]
  );

  return (
    <div id="fortune-change-color">
      <div
        className="color-reset"
        onClick={() => apply(undefined)}
        tabIndex={0}
      >
        {sheetconfig.noColor}
      </div>
      <div className="custom-color">
        <div>{toolbar.customColor}:</div>
        <input
          type="color"
          value={inputColor}
          onChange={(e) => setInputColor(e.target.value)}
          onFocus={() => {
            triggerParentUpdate(true);
          }}
          onBlur={() => {
            triggerParentUpdate(false);
          }}
        />
        <div
          className="button-basic button-primary"
          onClick={() => apply(inputColor)}
          tabIndex={0}
        >
          {button.confirm}
        </div>
      </div>
      <ColorPicker
        onPick={(color) => {
          setInputColor(color);
          apply(color);
        }}
      />
    </div>
  );
};
