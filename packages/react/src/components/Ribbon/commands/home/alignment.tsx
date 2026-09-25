/**
 * Home › Alignment: Top / Middle / Bottom Align, Align Left / Center /
 * Align Right, Orientation, Wrap Text, Merge & Center (Merge Across,
 * Merge Cells, Unmerge Cells) and Decrease / Increase Indent. Toggles show
 * the active cell's alignment.
 */
import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  FoldVertical,
  IndentDecrease,
  IndentIncrease,
  MoveDown,
  MoveDownRight,
  MoveUp,
  MoveUpRight,
  TableCellsMerge,
  TableCellsSplit,
  WrapText,
} from "lucide-react";
import {
  applyFormatCells,
  cellRotation,
  handleHorizontalAlign,
  handleMerge,
  handleVerticalAlign,
  normalizedCellAttr,
  openFormatCells,
} from "@lofcz/tinysheet-core";
import {
  IconButton,
  LucideIcon,
  MenuButton,
  MenuItem,
  SplitButton,
} from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { MergeAcross, MergeCells, Orientation, VerticalText } from "./glyphs";
import { moreLabel, useHome } from "./shared";

type AlignButton = {
  value: string;
  code: string;
  icon: LucideIcon;
  label: string;
};

/** Top / Middle / Bottom Align: three toggles in one item. */
export const VerticalAlignCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const current = normalizedCellAttr(cell as any, "vt");
  const buttons: AlignButton[] = [
    { value: "top", code: "1", icon: ArrowUpToLine, label: t.topAlign },
    { value: "middle", code: "0", icon: FoldVertical, label: t.middleAlign },
    { value: "bottom", code: "2", icon: ArrowDownToLine, label: t.bottomAlign },
  ];
  return (
    <div className="ts-home-set" role="group" aria-label={t.middleAlign}>
      {buttons.map((b) => (
        <IconButton
          key={b.value}
          icon={b.icon}
          label={b.label}
          pressed={current === b.code}
          disabled={!home.editable}
          onClick={() =>
            home.run((ctx) => handleVerticalAlign(ctx, home.input(), b.value))
          }
        />
      ))}
    </div>
  );
};

/**
 * Align Left / Center / Align Right. A pressed one turns back to General
 * alignment (text left, numbers right), like Excel.
 */
export const HorizontalAlignCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const current = cell?.ht == null ? null : `${cell.ht}`;
  const buttons: AlignButton[] = [
    { value: "left", code: "1", icon: AlignLeft, label: t.alignLeft },
    { value: "center", code: "0", icon: AlignCenter, label: t.center },
    { value: "right", code: "2", icon: AlignRight, label: t.alignRight },
  ];
  return (
    <div className="ts-home-set" role="group" aria-label={t.center}>
      {buttons.map((b) => (
        <IconButton
          key={b.value}
          icon={b.icon}
          label={b.label}
          pressed={current === b.code}
          disabled={!home.editable}
          onClick={() =>
            home.run((ctx) => {
              if (current === b.code) applyFormatCells(ctx, { ht: "general" });
              else handleHorizontalAlign(ctx, home.input(), b.value);
            })
          }
        />
      ))}
    </div>
  );
};

export const OrientationCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const rotation = cellRotation(cell);
  const entry = (
    id: string,
    label: string,
    icon: LucideIcon,
    value: number | "vertical"
  ): MenuItem => ({
    id: `orientation-${id}`,
    label,
    icon,
    checked: rotation === value,
    onSelect: () =>
      home.run((ctx) =>
        // choosing the orientation in effect turns it off, like Excel
        applyFormatCells(ctx, { rotation: rotation === value ? 0 : value })
      ),
  });
  const menu: MenuItem[] = [
    entry("ccw", t.angleCounterclockwise, MoveUpRight, 45),
    entry("cw", t.angleClockwise, MoveDownRight, -45),
    entry("vertical", t.verticalText, VerticalText, "vertical"),
    entry("up", t.rotateUp, MoveUp, 90),
    entry("down", t.rotateDown, MoveDown, -90),
    { type: "separator" },
    {
      id: "orientation-format",
      label: t.formatAlignment,
      onSelect: () =>
        home.run((ctx) => openFormatCells(ctx, "alignment"), {
          noHistory: true,
        }),
    },
  ];
  return (
    <MenuButton
      icon={Orientation}
      label={t.orientation}
      className={rotation !== 0 ? "ts-home-active" : undefined}
      disabled={!home.editable}
      menu={menu}
    />
  );
};

export const WrapTextCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const wrapped = `${cell?.tb ?? ""}` === "2";
  return (
    <IconButton
      icon={WrapText}
      label={t.wrapText}
      description={t.wrapTextDescription}
      text={<span className="ts-home-label">{t.wrapText}</span>}
      pressed={wrapped}
      disabled={!home.editable}
      onClick={() =>
        home.run((ctx) => applyFormatCells(ctx, { wrap: !wrapped }))
      }
    />
  );
};

export const MergeCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const merged = !!cell?.mc;
  const mergeCenter = () =>
    home.run((ctx) => {
      if (merged) {
        handleMerge(ctx, "merge-cancel");
        return;
      }
      handleMerge(ctx, "merge-all");
      applyFormatCells(ctx, { ht: "0" });
    });
  const menu: MenuItem[] = [
    {
      id: "merge-center",
      label: t.mergeCenter,
      icon: TableCellsMerge,
      onSelect: mergeCenter,
    },
    {
      id: "merge-across",
      label: t.mergeAcross,
      icon: MergeAcross,
      onSelect: () => home.run((ctx) => handleMerge(ctx, "merge-horizontal")),
    },
    {
      id: "merge-cells",
      label: t.mergeCells,
      icon: MergeCells,
      onSelect: () => home.run((ctx) => handleMerge(ctx, "merge-all")),
    },
    {
      id: "merge-cancel",
      label: t.unmergeCells,
      icon: TableCellsSplit,
      disabled: !merged,
      onSelect: () => home.run((ctx) => handleMerge(ctx, "merge-cancel")),
    },
  ];
  return (
    <SplitButton
      icon={TableCellsMerge}
      label={t.mergeCenter}
      description={t.mergeCenterDescription}
      text={<span className="ts-home-label">{t.mergeCenter}</span>}
      arrowLabel={moreLabel(t, t.mergeCenter)}
      pressed={merged}
      disabled={!home.editable}
      onClick={mergeCenter}
      menu={menu}
    />
  );
};

function useIndent(dir: 1 | -1) {
  const home = useHome();
  const level = Number((home.cell as any)?.ind ?? 0) || 0;
  const apply = () =>
    home.run((ctx) => {
      const indent = Math.max(0, Math.min(15, level + dir));
      if (indent === level) return;
      // indenting General or centred text left-aligns it, like Excel
      const ht = `${home.cell?.ht ?? ""}`;
      applyFormatCells(
        ctx,
        dir > 0 && ht !== "2" && ht !== "1" ? { indent, ht: "1" } : { indent }
      );
    });
  return { home, level, apply };
}

export const DecreaseIndentCommand: React.FC<RibbonCommandProps> = () => {
  const { home, level, apply } = useIndent(-1);
  return (
    <IconButton
      icon={IndentDecrease}
      label={home.t.decreaseIndent}
      disabled={!home.editable || level === 0}
      onClick={apply}
    />
  );
};

export const IncreaseIndentCommand: React.FC<RibbonCommandProps> = () => {
  const { home, apply } = useIndent(1);
  return (
    <IconButton
      icon={IndentIncrease}
      label={home.t.increaseIndent}
      disabled={!home.editable}
      onClick={apply}
    />
  );
};
