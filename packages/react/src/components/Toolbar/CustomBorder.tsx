import React, { useContext, useLayoutEffect, useRef, useState } from "react";
import "./index.css";
import { locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import { CustomColor } from "./CustomColor";

const size = [
  {
    Text: "1",
    value: "Thin",
    strokeDasharray: "1,0",
    strokeWidth: "1",
  },
  {
    Text: "2",
    value: "Hair",
    strokeDasharray: "1,5",
    strokeWidth: "1",
  },
  {
    Text: "3",
    value: "Dotted",
    strokeDasharray: "2,5",
    strokeWidth: "2",
  },
  {
    Text: "4",
    value: "Dashed",
    strokeDasharray: "5,5",
    strokeWidth: "2",
  },
  {
    Text: "5",
    value: "DashDot",
    strokeDasharray: "20,5,5,10,5,5",
    strokeWidth: "2",
  },
  {
    Text: "6",
    value: "DashDotDot",
    strokeDasharray: "20,5,5,5,5,10,5,5,5,5",
    strokeWidth: "2",
  },
  // {
  //   Text: "7",
  //   value: "Double",
  // },
  {
    Text: "8",
    value: "Medium",
    strokeDasharray: "2,0",
    strokeWidth: "2",
  },
  {
    Text: "9",
    value: "MediumDashed",
    strokeDasharray: "3,5",
    strokeWidth: "3",
  },
  {
    Text: "10",
    value: "MediumDashDot",
    strokeDasharray: "20,5,5,10,5,5",
    strokeWidth: "3",
  },
  {
    Text: "11",
    value: "MediumDashDotDot",
    strokeDasharray: "5,5,5,5,20,5,5,5,5,10",
    strokeWidth: "3",
  },
  // {
  //   Text: "12",
  //   value: "SlantedDashDot",
  // },
  {
    Text: "13",
    value: "Thick",
    strokeDasharray: "2,0",
    strokeWidth: "3",
  },
];

const DEFAULT_COLOR = "#000000";

type Props = {
  /** Line colour and style used by the border buttons. */
  color?: string;
  style?: string;
  onPick: (changeColor: string, changeStyle: string) => void;
};

type Sub = "color" | "style";

/** A submenu entry: opens on hover, click, Enter / Space / ArrowRight. */
const SubmenuItem: React.FC<{
  label: string;
  open: boolean;
  onOpen: (focus: boolean) => void;
  onClose: () => void;
  preview: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, open, onOpen, onClose, preview, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<"right" | "left">("right");

  // open to the right of the menu, or to its left when that overflows
  useLayoutEffect(() => {
    if (!open || !ref.current || !menuRef.current) return;
    const item = ref.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const winW = document.documentElement.clientWidth || window.innerWidth;
    setSide(item.right + menu.width > winW ? "left" : "right");
  }, [open]);

  return (
    <div
      ref={ref}
      className="fortune-border-select-option"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      tabIndex={0}
      onMouseEnter={() => onOpen(false)}
      onMouseLeave={onClose}
      onClick={(e) => {
        if (
          e.target === e.currentTarget ||
          !menuRef.current?.contains(e.target as Node)
        )
          onOpen(e.detail === 0);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          // ArrowLeft / Escape inside the submenu: back to this entry
          if (e.key === "ArrowLeft" || e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            ref.current?.focus();
          }
          return;
        }
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          onOpen(true);
        }
      }}
    >
      <div className="fortune-toolbar-menu-line">
        {label}
        <SVGIcon name="rightArrow" style={{ width: "14px" }} />
      </div>
      {preview}
      {open && (
        <div
          ref={menuRef}
          className="fortune-border-select-menu"
          role="menu"
          aria-label={label}
          style={side === "right" ? { left: "100%" } : { right: "100%" }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/** Border menu: line colour and line style of the borders drawn next. */
const CustomBorder: React.FC<Props> = ({
  color = DEFAULT_COLOR,
  style = "1",
  onPick,
}) => {
  const { context } = useContext(WorkbookContext);
  const { border } = locale(context);
  const [sub, setSub] = useState<Sub | null>(null);
  const colorMenu = useRef<HTMLDivElement>(null);
  const styleMenu = useRef<HTMLDivElement>(null);
  const current = size.find((s) => s.Text === style) ?? size[0];

  const open = (which: Sub, focus: boolean) => {
    setSub(which);
    if (focus) {
      // after the submenu rendered
      setTimeout(() => {
        const menu = (which === "color" ? colorMenu : styleMenu).current;
        menu
          ?.querySelector<HTMLElement>('[tabindex="0"], input')
          ?.focus({ preventScroll: true });
      });
    }
  };

  return (
    <div>
      <SubmenuItem
        label={border.borderColor}
        open={sub === "color"}
        onOpen={(focus) => open("color", focus)}
        onClose={() => setSub(null)}
        preview={
          <div
            className="fortune-border-color-preview"
            style={{ backgroundColor: color }}
          />
        }
      >
        <div ref={colorMenu} style={{ width: 166 }}>
          <CustomColor
            onCustomPick={(c) => onPick(c ?? DEFAULT_COLOR, style)}
            onColorPick={(c) => onPick(c, style)}
          />
        </div>
      </SubmenuItem>
      <SubmenuItem
        label={border.borderStyle}
        open={sub === "style"}
        onOpen={(focus) => open("style", focus)}
        onClose={() => setSub(null)}
        preview={
          <div className="fortune-border-style-preview">
            <svg width="90" height="3" aria-hidden="true">
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth={current.strokeWidth}
              >
                <path
                  strokeDasharray={current.strokeDasharray}
                  d="M0 1 l90 0"
                />
              </g>
            </svg>
          </div>
        }
      >
        <div
          ref={styleMenu}
          className="fortune-toolbar-select"
          style={{ width: 110 }}
        >
          <div
            className="fortune-border-style-picker-menu fortune-border-style-reset"
            role="menuitemradio"
            aria-checked={style === "1"}
            onClick={() => onPick(color, "1")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onPick(color, "1");
              }
            }}
            tabIndex={0}
          >
            {border.borderDefault}
          </div>
          <div className="fortune-boder-style-picker">
            {size.map((items) => (
              <div
                key={items.Text}
                className={`fortune-border-style-picker-menu${
                  items.Text === style ? " fortune-border-style-current" : ""
                }`}
                role="menuitemradio"
                aria-checked={items.Text === style}
                aria-label={items.value}
                onClick={() => onPick(color, items.Text)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onPick(color, items.Text);
                  }
                }}
                tabIndex={0}
              >
                <svg height="10" width="90" aria-hidden="true">
                  <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={items.strokeWidth}
                  >
                    <path
                      strokeDasharray={items.strokeDasharray}
                      d="M0 5 l85 0"
                    />
                  </g>
                </svg>
              </div>
            ))}
          </div>
        </div>
      </SubmenuItem>
    </div>
  );
};

export default CustomBorder;
