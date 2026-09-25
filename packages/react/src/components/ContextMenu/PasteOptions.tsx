import React from "react";
import {
  ArrowRightLeft,
  ClipboardPaste,
  ClipboardType,
  Link2,
  Paintbrush,
  SquareFunction,
} from "lucide-react";
import { Icon, LucideIcon, Tooltip } from "../ui";

export type PasteOption =
  | "all"
  | "values"
  | "formulas"
  | "transpose"
  | "formats"
  | "link";

const ICONS: Record<PasteOption, LucideIcon> = {
  all: ClipboardPaste,
  values: ClipboardType,
  formulas: SquareFunction,
  transpose: ArrowRightLeft,
  formats: Paintbrush,
  link: Link2,
};

/** Excel's access keys of the paste options. */
const KEYS: Record<PasteOption, string> = {
  all: "P",
  values: "V",
  formulas: "F",
  transpose: "T",
  formats: "R",
  link: "N",
};

type Props = {
  title: string;
  options: {
    id: PasteOption;
    label: string;
    disabled?: boolean;
  }[];
  onPaste: (id: PasteOption) => void;
};

/**
 * "Paste Options:" of Excel's cell menu: a row of icon buttons (Paste,
 * Values, Formulas, Transpose, Formatting, Paste Link) with screen tips.
 * One keyboard stop of the menu; Left / Right move between the buttons.
 */
const PasteOptions: React.FC<Props> = ({ title, options, onPaste }) => (
  <div className="fortune-paste-options">
    <div className="fortune-paste-options-title">{title}</div>
    <div
      className="fortune-paste-options-row"
      role="group"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const buttons = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"])'
          )
        );
        const i = buttons.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        e.preventDefault();
        e.stopPropagation();
        const next = e.key === "ArrowRight" ? i + 1 : i - 1;
        buttons[(next + buttons.length) % buttons.length]?.focus({
          preventScroll: true,
        });
      }}
    >
      {options.map((o) => (
        <Tooltip
          key={o.id}
          label={`${o.label} (${KEYS[o.id]})`}
          placement="bottom"
        >
          <div
            className="fortune-paste-option"
            role="menuitem"
            tabIndex={-1}
            data-key={`paste-${o.id}`}
            aria-label={o.label}
            aria-disabled={o.disabled || undefined}
            onMouseEnter={(e) => {
              if (!o.disabled) e.currentTarget.focus({ preventScroll: true });
            }}
            onClick={() => {
              if (!o.disabled) onPaste(o.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                if (!o.disabled) onPaste(o.id);
              }
            }}
          >
            <Icon icon={ICONS[o.id]} />
          </div>
        </Tooltip>
      ))}
    </div>
  </div>
);

export default PasteOptions;
