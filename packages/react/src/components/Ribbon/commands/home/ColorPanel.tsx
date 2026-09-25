/**
 * The colour drop-down of Fill Color, Font Color, Line Color and Tab
 * Color: the shared Excel colour picker (components/ui/ColorPicker), closed
 * after a pick.
 */
import React from "react";
import { ColorPicker } from "../../../ui";
import type { HomeText } from "./strings";

export type ColorPanelProps = {
  t: HomeText;
  /** The colour currently applied (marked in the grid). */
  value?: string | null;
  /** First entry: "Automatic" (font colour) or "No Fill" (fill). */
  reset?: { label: string; kind: "automatic" | "none" };
  onPick: (color: string | null) => void;
  /** Close the drop-down (after a pick). */
  close: () => void;
};

export const ColorPanel: React.FC<ColorPanelProps> = ({
  value,
  reset,
  onPick,
  close,
}) => (
  // the shared Excel colour picker (components/ui/ColorPicker)
  <ColorPicker
    className="ts-home-colors"
    value={value}
    automaticLabel={reset?.label}
    automaticColor={reset?.kind === "automatic" ? "#000000" : null}
    onChange={(color) => {
      onPick(color);
      close();
    }}
  />
);

export default ColorPanel;
