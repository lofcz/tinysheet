import React, { useRef, useEffect } from "react";

type Props = React.PropsWithChildren<{
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement
  ) => void;
  onMouseLeave?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement
  ) => void;
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement
  ) => void;
}>;

const Menu: React.FC<Props> = ({
  onClick,
  onMouseLeave,
  onMouseEnter,
  children,
}) => {
  useEffect(() => {
    // focus on mount for keyboard nav
    const element = document.querySelector(".luckysheet-cols-menuitem");
    if (element) {
      (element as HTMLDivElement).focus();
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Enter / Space activate the item; arrow keys move between items of the
  // same menu. Keys typed into inputs inside an item are left alone.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.click();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const menu = e.currentTarget.parentElement;
    if (!menu) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLDivElement>(
        ":scope > .luckysheet-cols-menuitem"
      )
    );
    const index = items.indexOf(e.currentTarget);
    if (index === -1 || items.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.key === "ArrowDown" ? 1 : -1;
    items[(index + delta + items.length) % items.length].focus();
  };

  return (
    <div
      ref={containerRef}
      className="luckysheet-cols-menuitem luckysheet-mousedown-cancel"
      onClick={(e) => onClick?.(e, containerRef.current!)}
      onMouseLeave={(e) => onMouseLeave?.(e, containerRef.current!)}
      onMouseEnter={(e) => onMouseEnter?.(e, containerRef.current!)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="menuitem"
    >
      <div className="luckysheet-cols-menuitem-content luckysheet-mousedown-cancel">
        {children}
      </div>
    </div>
  );
};

export default Menu;
