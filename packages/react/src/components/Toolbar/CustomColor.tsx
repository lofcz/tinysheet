import { locale } from "@lofcz/tinysheet-core";
import React, { useContext, useState } from "react";
import WorkbookContext from "../../context";
import ColorPicker from "../Toolbar/ColorPicker";
import { activateOnKey } from "./Button";
import "./index.css";

type Props = {
  onCustomPick: (color: string | undefined) => void;
  onColorPick: (color: string) => void;
};

export const CustomColor: React.FC<Props> = ({ onCustomPick, onColorPick }) => {
  const { context } = useContext(WorkbookContext);
  const { toolbar, sheetconfig, button } = locale(context);
  const [inputColor, setInputColor] = useState<string | undefined>("#000000");

  return (
    <div id="fortune-custom-color">
      <div
        className="color-reset"
        onClick={() => onCustomPick(undefined)}
        onKeyDown={activateOnKey}
        role="button"
        tabIndex={0}
      >
        {sheetconfig.resetColor}
      </div>
      <div className="custom-color">
        <div>{toolbar.customColor}:</div>
        <input
          type="color"
          aria-label={toolbar.customColor}
          value={inputColor}
          onChange={(e) => setInputColor(e.target.value)}
        />
        <div
          className="button-basic button-primary"
          onClick={() => {
            onCustomPick(inputColor);
          }}
          onKeyDown={activateOnKey}
          role="button"
          tabIndex={0}
        >
          {button.confirm}
        </div>
      </div>
      <ColorPicker
        onPick={(color) => {
          onColorPick(color);
        }}
      />
    </div>
  );
};
