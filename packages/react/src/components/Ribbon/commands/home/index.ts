/**
 * The Home tab's ribbon commands (layout: ../../tabs/home.ts). Commands
 * that replace a legacy toolbar item keep its name as their id, so a
 * custom `settings.toolbarItems` list still finds them; new commands list
 * the legacy names they stand for as aliases.
 */
import { Grid2x2Plus } from "lucide-react";
import { registerIcon } from "../../../ui";
import { registerRibbonCommand } from "../../registry";
import { FormatPainterCommand } from "../clipboard";
import {
  BoldCommand,
  BordersCommand,
  FillColorCommand,
  FontColorCommand,
  FontFamilyCommand,
  FontSizeCommand,
  GrowFontCommand,
  ItalicCommand,
  ShrinkFontCommand,
  StrikethroughCommand,
  UnderlineCommand,
} from "./font";
import {
  DecreaseIndentCommand,
  HorizontalAlignCommand,
  IncreaseIndentCommand,
  MergeCommand,
  OrientationCommand,
  VerticalAlignCommand,
  WrapTextCommand,
} from "./alignment";
import {
  AccountingCommand,
  CommaCommand,
  DecreaseDecimalCommand,
  IncreaseDecimalCommand,
  NumberFormatCommand,
  PercentCommand,
} from "./number";
import {
  CellStylesCommand,
  ConditionalFormattingCommand,
  FormatAsTableCommand,
} from "./styles";
import { DeleteCommand, FormatCommand, InsertCommand } from "./cells";
import {
  AutoSumCommand,
  ClearCommand,
  FillCommand,
  FindSelectCommand,
  SortFilterCommand,
} from "./editing";

export function registerHomeCommands() {
  // the Cells group's button when the ribbon collapses it
  registerIcon("home-cells", Grid2x2Plus);
  // Clipboard (Paste / Cut / Copy register in ../index.ts)
  registerRibbonCommand("format-painter", FormatPainterCommand);
  // Font
  registerRibbonCommand("font", FontFamilyCommand);
  registerRibbonCommand("font-size", FontSizeCommand);
  registerRibbonCommand("font-grow", GrowFontCommand, {
    aliases: ["font-size"],
  });
  registerRibbonCommand("font-shrink", ShrinkFontCommand, {
    aliases: ["font-size"],
  });
  registerRibbonCommand("bold", BoldCommand);
  registerRibbonCommand("italic", ItalicCommand);
  registerRibbonCommand("underline", UnderlineCommand);
  registerRibbonCommand("strike-through", StrikethroughCommand);
  registerRibbonCommand("border", BordersCommand);
  registerRibbonCommand("background", FillColorCommand);
  registerRibbonCommand("font-color", FontColorCommand);
  // Alignment
  registerRibbonCommand("vertical-align", VerticalAlignCommand);
  registerRibbonCommand("horizontal-align", HorizontalAlignCommand);
  registerRibbonCommand("text-rotation", OrientationCommand);
  registerRibbonCommand("text-wrap", WrapTextCommand);
  registerRibbonCommand("merge-cell", MergeCommand);
  registerRibbonCommand("indent-decrease", DecreaseIndentCommand, {
    aliases: ["horizontal-align"],
  });
  registerRibbonCommand("indent-increase", IncreaseIndentCommand, {
    aliases: ["horizontal-align"],
  });
  // Number
  registerRibbonCommand("format", NumberFormatCommand);
  registerRibbonCommand("currency-format", AccountingCommand);
  registerRibbonCommand("percentage-format", PercentCommand);
  registerRibbonCommand("comma-style", CommaCommand, {
    aliases: ["currency-format"],
  });
  registerRibbonCommand("number-increase", IncreaseDecimalCommand);
  registerRibbonCommand("number-decrease", DecreaseDecimalCommand);
  // Styles
  registerRibbonCommand("conditionFormat", ConditionalFormattingCommand);
  registerRibbonCommand("formatAsTable", FormatAsTableCommand);
  registerRibbonCommand("cell-styles", CellStylesCommand);
  // Cells
  registerRibbonCommand("cells-insert", InsertCommand);
  registerRibbonCommand("cells-delete", DeleteCommand);
  registerRibbonCommand("cells-format", FormatCommand);
  // Editing
  registerRibbonCommand("autosum", AutoSumCommand, {
    aliases: ["quick-formula"],
  });
  registerRibbonCommand("fill", FillCommand);
  registerRibbonCommand("clear-format", ClearCommand);
  registerRibbonCommand("sort-filter", SortFilterCommand, {
    aliases: ["filter"],
  });
  registerRibbonCommand("search", FindSelectCommand, {
    aliases: ["locationCondition"],
  });
}
