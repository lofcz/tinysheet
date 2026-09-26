/**
 * Home › Styles: Conditional Formatting (Highlight Cells Rules, Top/Bottom
 * Rules, Data Bars, Color Scales, Icon Sets, New / Clear / Manage Rules),
 * Format as Table (the style gallery) and Cell Styles (the style gallery).
 * The menus and galleries are the shared ones (docs/DESIGN.md, "Pickers &
 * galleries"): `useConditionalFormatMenu`, `FormatAsTableGallery`,
 * `CellStyles`.
 */
import React from "react";
import { Highlighter, SwatchBook, Table } from "lucide-react";
import { LargeButton, MenuButton } from "../../../ui";
import type { DropdownContent } from "../../../ui";
import CellStyles from "../../../CellStyles";
import { useConditionalFormatMenu } from "../../../ConditionFormat";
import { FormatAsTableGallery } from "../../../Tables";
import type { RibbonCommandProps } from "../../registry";
import { useHome } from "./shared";

/** A large button, or a small one when the group is scaled down. */
const StyleButton: React.FC<
  {
    size: RibbonCommandProps["size"];
    icon: typeof Table;
    label: string;
    description: string;
    disabled: boolean;
  } & DropdownContent
> = ({ size, ...props }) =>
  size === "small" ? <MenuButton {...props} /> : <LargeButton {...props} />;

export const ConditionalFormattingCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const home = useHome();
  const { t } = home;
  // the menu closes itself when an entry runs
  const menu = useConditionalFormatMenu(() => {});
  return (
    <StyleButton
      size={size}
      icon={Highlighter}
      label={t.conditionalFormatting}
      description={t.conditionalFormattingDescription}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

export const FormatAsTableCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const home = useHome();
  const { t } = home;
  return (
    <StyleButton
      size={size}
      icon={Table}
      label={t.formatAsTable}
      description={t.formatAsTableDescription}
      disabled={!home.editable}
      popover={(close) => <FormatAsTableGallery autoFocus onClose={close} />}
    />
  );
};

export const CellStylesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const home = useHome();
  const { t } = home;
  return (
    <StyleButton
      size={size}
      icon={SwatchBook}
      label={t.cellStyles}
      description={t.cellStylesDescription}
      disabled={!home.editable}
      popover={(close) => (
        <CellStyles
          bare
          onApplied={() => {
            close();
            home.h.focusSheet();
          }}
        />
      )}
    />
  );
};
