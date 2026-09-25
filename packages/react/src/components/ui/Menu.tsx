import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { Icon, ICON_STROKE, LucideIcon } from "./icons";
import { Popover } from "./Popover";
import { Placement, useFloatingPosition } from "./floating";
import "./ui.css";

/** One entry of a menu (dropdown, context menu, File menu, submenu). */
export type MenuItem =
  | {
      type?: "item";
      id: string;
      label: React.ReactNode;
      /** A registered icon name or a lucide component. */
      icon?: string | LucideIcon;
      /** Custom leading visual (a colour swatch, a preview) instead of icon. */
      leading?: React.ReactNode;
      shortcut?: string;
      /** Second line / right-aligned hint (e.g. a format preview). */
      hint?: React.ReactNode;
      disabled?: boolean;
      /** A checkable entry: announced as menuitemcheckbox (or radio). */
      checked?: boolean;
      /** With `checked`: one of a set (menuitemradio). */
      radio?: boolean;
      /** Keep the menu open after selecting (toggles). */
      keepOpen?: boolean;
      onSelect?: () => void;
      /** A submenu (opens on hover after a short delay, or ArrowRight). */
      children?: MenuItem[];
    }
  | { type: "separator"; id?: string }
  | { type: "header"; id?: string; label: React.ReactNode }
  | {
      type: "custom";
      id: string;
      /** Rendered as is (a gallery, a colour grid); `close` closes the menu. */
      render: (close: () => void) => React.ReactNode;
    };

type ItemEntry = Extract<MenuItem, { id: string; label: React.ReactNode }> & {
  type?: "item";
};

const isItem = (m: MenuItem): m is ItemEntry =>
  m.type === undefined || m.type === "item";

/** Delay before a hovered submenu opens / another one replaces it (ms). */
const SUBMENU_DELAY = 150;

const ITEM_SELECTOR =
  ':scope > [role="menuitem"], :scope > [role="menuitemcheckbox"], :scope > [role="menuitemradio"]';

function menuItemsOf(menu: HTMLElement | null) {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (el) => el.getAttribute("aria-disabled") !== "true"
  );
}

export type MenuListProps = {
  items: MenuItem[];
  /** Called after an item was selected (closes the whole menu tree). */
  onClose: () => void;
  /** Called by ArrowLeft / Escape in a submenu: back to the parent item. */
  onCloseSubmenu?: () => void;
  "aria-label"?: string;
  autoFocus?: boolean;
  className?: string;
  /** Min width of the list (px). */
  minWidth?: number;
  /** Element id (e.g. for a combobox's aria-controls). */
  id?: string;
};

/**
 * A menu list (role="menu"): 30px rows with a 16px icon column, the
 * shortcut right-aligned, separators, headers, checkable items and
 * submenus. Full keyboard support: Up / Down / Home / End move, Enter /
 * Space select, Right opens a submenu, Left / Escape close it, and typing
 * a letter jumps to the next item starting with it.
 */
export const MenuList: React.FC<MenuListProps> = ({
  items,
  onClose,
  onCloseSubmenu,
  autoFocus,
  className,
  minWidth,
  id,
  ...rest
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<string | null>(null);
  const [submenuFocus, setSubmenuFocus] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!autoFocus) return;
    const list = menuItemsOf(listRef.current);
    const checked = list.find(
      (el) => el.getAttribute("aria-checked") === "true"
    );
    (checked ?? list[0])?.focus({ preventScroll: true });
  }, [autoFocus]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const openSubmenuLater = (id: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSubmenuFocus(false);
      setSubmenu(id);
    }, SUBMENU_DELAY);
  };

  const select = (item: ItemEntry) => {
    if (item.disabled) return;
    if (item.children?.length) {
      setSubmenuFocus(true);
      setSubmenu(item.id);
      return;
    }
    item.onSelect?.();
    if (!item.keepOpen) onClose();
  };

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // keys of a nested submenu stay there
      if (target.closest('[role="menu"]') !== listRef.current) return;
      if (target.closest("input, textarea, select")) return;
      const list = menuItemsOf(listRef.current);
      const index = list.indexOf(target);
      const move = (next: number) => {
        e.preventDefault();
        e.stopPropagation();
        list[(next + list.length) % list.length]?.focus({
          preventScroll: true,
        });
      };
      if (e.key === "ArrowDown") move(index + 1);
      else if (e.key === "ArrowUp") move(index < 0 ? -1 : index - 1);
      else if (e.key === "Home") move(0);
      else if (e.key === "End") move(list.length - 1);
      else if (e.key === "ArrowRight") {
        const id = target.dataset.menuId;
        const item = items.find((m) => isItem(m) && m.id === id) as
          | ItemEntry
          | undefined;
        if (item?.children?.length && !item.disabled) {
          e.preventDefault();
          e.stopPropagation();
          setSubmenuFocus(true);
          setSubmenu(item.id);
        }
      } else if (
        (e.key === "ArrowLeft" || e.key === "Escape") &&
        onCloseSubmenu
      ) {
        e.preventDefault();
        e.stopPropagation();
        onCloseSubmenu();
      } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey) {
        // type-ahead: the next item whose label starts with the letter
        const key = e.key.toLowerCase();
        const start = index + 1;
        for (let i = 0; i < list.length; i += 1) {
          const el = list[(start + i) % list.length];
          if (el.textContent?.trim().toLowerCase().startsWith(key)) {
            e.preventDefault();
            e.stopPropagation();
            el.focus({ preventScroll: true });
            break;
          }
        }
      }
    },
    [items, onCloseSubmenu]
  );

  return (
    <div
      ref={listRef}
      id={id}
      className={`ts-menu${className ? ` ${className}` : ""}`}
      role="menu"
      aria-label={rest["aria-label"]}
      style={minWidth ? { minWidth } : undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        if (item.type === "separator") {
          return (
            <div
              key={item.id ?? `sep-${i}`}
              className="ts-menu-separator"
              role="separator"
            />
          );
        }
        if (item.type === "header") {
          return (
            <div
              key={item.id ?? `header-${i}`}
              className="ts-menu-header"
              role="presentation"
            >
              {item.label}
            </div>
          );
        }
        if (item.type === "custom") {
          return (
            <div key={item.id} className="ts-menu-custom" role="none">
              {item.render(onClose)}
            </div>
          );
        }
        const hasChildren = !!item.children?.length;
        let role = "menuitem";
        if (item.checked !== undefined)
          role = item.radio ? "menuitemradio" : "menuitemcheckbox";
        const open = submenu === item.id;
        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) itemRefs.current.set(item.id, el);
              else itemRefs.current.delete(item.id);
            }}
            className={`ts-menu-item${open ? " ts-menu-item--open" : ""}`}
            role={role}
            data-menu-id={item.id}
            tabIndex={-1}
            aria-checked={item.checked}
            aria-disabled={item.disabled || undefined}
            aria-haspopup={hasChildren ? "menu" : undefined}
            aria-expanded={hasChildren ? open : undefined}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLElement).focus({
                  preventScroll: true,
                });
              }
              openSubmenuLater(hasChildren && !item.disabled ? item.id : null);
            }}
            onClick={() => select(item)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                select(item);
              }
            }}
          >
            <span className="ts-menu-icon">
              {item.leading ??
                (item.checked !== undefined && !item.icon ? (
                  item.checked ? (
                    <Check size={16} strokeWidth={ICON_STROKE} aria-hidden />
                  ) : null
                ) : typeof item.icon === "string" ? (
                  <Icon name={item.icon} />
                ) : item.icon ? (
                  <Icon icon={item.icon} />
                ) : null)}
            </span>
            <span className="ts-menu-label">{item.label}</span>
            {item.hint != null && (
              <span className="ts-menu-hint">{item.hint}</span>
            )}
            {item.shortcut && (
              <span className="ts-menu-shortcut">{item.shortcut}</span>
            )}
            {hasChildren && (
              <ChevronRight
                className="ts-menu-chevron"
                size={14}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
            )}
            {hasChildren && open && (
              <Submenu
                anchor={itemRefs.current.get(item.id) ?? null}
                items={item.children!}
                autoFocus={submenuFocus}
                onClose={onClose}
                onBack={() => {
                  setSubmenu(null);
                  itemRefs.current.get(item.id)?.focus({ preventScroll: true });
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const Submenu: React.FC<{
  anchor: HTMLElement | null;
  items: MenuItem[];
  autoFocus: boolean;
  onClose: () => void;
  onBack: () => void;
}> = ({ anchor, items, autoFocus, onClose, onBack }) => {
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(anchor);
  anchorRef.current = anchor;
  useFloatingPosition(true, anchorRef, ref, "right-start", 2);
  return (
    // rendered inside the parent item: hovering it keeps the item "hovered"
    <div
      ref={ref}
      className="ts-popover ts-popover--menu ts-submenu"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <MenuList
        items={items}
        onClose={onClose}
        onCloseSubmenu={onBack}
        autoFocus={autoFocus}
      />
    </div>
  );
};

export type DropdownMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  items: MenuItem[];
  placement?: Placement;
  /** Focus the first (or checked) item: true when opened by keyboard. */
  autoFocus?: boolean;
  "aria-label"?: string;
  minWidth?: number;
  className?: string;
  /** Id of the menu list. */
  id?: string;
};

/**
 * A menu in a popover, opened from a button (see `useMenuTrigger`). Closes
 * on selection, a click outside, Escape (focus back to the trigger) or when
 * another drop-down opens; stays inside the viewport.
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  open,
  onOpenChange,
  anchorRef,
  items,
  placement,
  autoFocus = true,
  minWidth = 180,
  className,
  id,
  ...rest
}) => (
  <Popover
    open={open}
    onOpenChange={onOpenChange}
    anchorRef={anchorRef}
    placement={placement}
    variant="menu"
    className={className}
  >
    <MenuList
      items={items}
      onClose={() => onOpenChange(false)}
      autoFocus={autoFocus}
      minWidth={minWidth}
      id={id}
      aria-label={rest["aria-label"]}
    />
  </Popover>
);

/**
 * State and trigger props for a button that opens a drop-down: click
 * toggles it, ArrowDown / Enter / Space open it with the first item
 * focused, and `aria-haspopup` / `aria-expanded` are set.
 */
export function useMenuTrigger() {
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const triggerProps = {
    ref: anchorRef,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    onClick: (e: React.MouseEvent) => {
      setByKeyboard(e.detail === 0);
      setOpen((o) => !o);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        e.stopPropagation();
        setByKeyboard(true);
        setOpen(true);
      }
    },
  };
  return { open, setOpen, anchorRef, byKeyboard, triggerProps };
}

export default MenuList;
