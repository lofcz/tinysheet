/**
 * Building blocks of the Formulas, Data and Review commands:
 *
 * - `RibbonButton`: one command that renders as Excel does at every size —
 *   a large button (icon over label), a small labelled button (icon + text,
 *   the rows of small commands next to the large ones) or an icon button
 *   (when its group is compacted); a split button when it has both an
 *   action and a drop-down.
 * - `useFdrText` (the tabs' strings), `useNotify` (an Excel message box).
 * - `requestRibbonCommand` / `useRibbonCommandRequest`: keyboard shortcuts
 *   registered in core (which only see the model) ask the mounted ribbon
 *   to open a dialog (Shift+F3 Insert Function, Ctrl+F3 Name Manager).
 */
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { ribbonFormulasDataReviewLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import { useAlert } from "../../../hooks/useAlert";
import {
  IconButton,
  LargeButton,
  MenuButton,
  MenuItem,
  SplitButton,
} from "../../ui";
import type { LucideIcon } from "../../ui";
import type { RibbonItemSize } from "../types";
import "./kit.css";

export type IconSource = string | LucideIcon;

type Dropdown =
  | { menu: MenuItem[]; popover?: never }
  | { popover: (close: () => void) => React.ReactNode; menu?: never }
  | { menu?: never; popover?: never };

export type RibbonButtonProps = {
  size: RibbonItemSize;
  /**
   * How the command looks at size "small": "labeled" (icon + text, the
   * small commands of Excel's Formulas / Data / Review tabs) or "icon".
   */
  small?: "labeled" | "icon";
  icon: IconSource;
  label: string;
  shortcut?: string;
  description?: React.ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
} & Dropdown;

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/** A ribbon command at its size (see the file comment). */
export const RibbonButton: React.FC<RibbonButtonProps> = ({
  size,
  small = "icon",
  icon,
  label,
  shortcut,
  description,
  onClick,
  pressed,
  disabled,
  menu,
  popover,
}) => {
  const dropdown = menu ? { menu } : popover ? { popover } : null;
  if (size === "large") {
    return (
      <LargeButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        onClick={onClick}
        pressed={pressed}
        disabled={disabled}
        {...(dropdown ?? {})}
      />
    );
  }
  const labeled = small === "labeled";
  const className = cx(labeled && "fortune-ribbon-labeled");
  const text = labeled ? label : undefined;
  if (dropdown && onClick) {
    return (
      <SplitButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        onClick={onClick}
        pressed={pressed}
        disabled={disabled}
        text={text}
        className={className}
        {...dropdown}
      />
    );
  }
  if (dropdown) {
    return (
      <MenuButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        disabled={disabled}
        text={text}
        className={className}
        // MenuButtonProps inherits the HTML `popover` attribute, which
        // clashes with its drop-down `popover` in the type (not at runtime)
        {...(dropdown as { menu: MenuItem[] })}
      />
    );
  }
  return (
    <IconButton
      icon={icon}
      label={label}
      shortcut={shortcut}
      description={description}
      pressed={pressed}
      disabled={disabled}
      text={text}
      className={className || undefined}
      onClick={onClick}
    />
  );
};

/** The strings of the Formulas, Data and Review tabs. */
export function useFdrText() {
  const { context } = useContext(WorkbookContext);
  return ribbonFormulasDataReviewLocale(context);
}

/** An Excel message box ("The active cell does not contain a formula"). */
export function useNotify() {
  const { showAlert } = useAlert();
  return useCallback((text: string) => showAlert(text, "ok"), [showAlert]);
}

/* ------------------------------------------------------------------ */
/*  Commands requested from the keyboard                               */
/* ------------------------------------------------------------------ */

export type RibbonCommandRequest =
  | "insertFunction"
  | "nameManager"
  | "createFromSelection"
  | "autoSum"
  | "note";

const requestListeners = new Set<(r: RibbonCommandRequest) => void>();
let pending: RibbonCommandRequest | null = null;

/**
 * Ask the mounted workbook UI to run a command (from a core shortcut
 * handler, which runs inside a state update: the request is delivered
 * after it, once).
 */
export function requestRibbonCommand(request: RibbonCommandRequest) {
  pending = request;
  setTimeout(() => {
    if (pending == null) return;
    const r = pending;
    pending = null;
    requestListeners.forEach((l) => l(r));
  });
}

/** Run `handler` for every requested command while mounted. */
export function useRibbonCommandRequest(
  handler: (r: RibbonCommandRequest) => void
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = (r: RibbonCommandRequest) => ref.current(r);
    requestListeners.add(listener);
    return () => {
      requestListeners.delete(listener);
    };
  }, []);
}
