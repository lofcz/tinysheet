import React, {
  CSSProperties,
  useCallback,
  useRef,
  useState,
  useContext,
} from "react";
import { locale } from "@lofcz/tinysheet-core";
import SVGIcon from "../SVGIcon";
import WorkbookContext from "../../context";
import { activateOnKey } from "./Button";
import { useToolbarPopup } from "./usePopup";

type Props = {
  tooltip: string;
  iconId?: string;
  text?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  children: (
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  ) => React.ReactNode;
  /**
   * A box the value can be typed into (Excel's font size box): Enter
   * applies what was typed through `onCommit`, Escape keeps the value.
   */
  onCommit?: (typed: string) => void;
};

/** The typed-into part of an editable combo (see `onCommit`). */
const ComboInput: React.FC<{
  value: string;
  label: string;
  onCommit: (typed: string) => void;
  onOpen: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  focusSheet: () => void;
}> = ({ value, label, onCommit, onOpen, focusSheet }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="fortune-toolbar-combo-input"
      aria-label={label}
      data-tips={label}
      value={draft ?? value}
      size={3}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (draft != null) onCommit(draft);
          setDraft(null);
          focusSheet();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setDraft(null);
          focusSheet();
        } else if (e.key === "ArrowDown" && e.altKey) {
          onOpen(e);
        }
      }}
    />
  );
};

const Combo: React.FC<Props> = ({
  tooltip,
  onClick,
  text,
  iconId,
  children,
  onCommit,
}) => {
  const { context, refs } = useContext(WorkbookContext);
  const style: CSSProperties = { userSelect: "none" };
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const { info } = locale(context);

  const focusSheet = useCallback(() => {
    refs?.cellInput?.current?.focus({ preventScroll: true });
  }, [refs.cellInput]);
  const { onPopupKeyDown, onTriggerClick, onTriggerKeyDown } = useToolbarPopup(
    open,
    setOpen,
    {
      containerRef,
      popupRef,
      triggerRef: onClick || onCommit ? arrowRef : mainRef,
      restoreFocus: focusSheet,
    }
  );

  const toggle = () => setOpen((o) => !o);

  return (
    <div
      ref={containerRef}
      className="fortune-toobar-combo-container fortune-toolbar-item"
    >
      <div className="fortune-toolbar-combo">
        {onCommit ? (
          <ComboInput
            value={text ?? ""}
            label={tooltip}
            onCommit={onCommit}
            onOpen={(e) => {
              e.preventDefault();
              e.stopPropagation();
              arrowRef.current?.focus();
              setOpen(true);
            }}
            focusSheet={focusSheet}
          />
        ) : (
          <div
            ref={mainRef}
            className="fortune-toolbar-combo-button"
            onClick={(e) => {
              if (onClick) onClick(e);
              else onTriggerClick(e, toggle);
            }}
            onKeyDown={(e) => {
              if (!onClick) onTriggerKeyDown(e);
              if (!e.defaultPrevented) activateOnKey(e);
            }}
            aria-haspopup={onClick ? undefined : true}
            aria-expanded={onClick ? undefined : open}
            tabIndex={0}
            data-tips={tooltip}
            role="button"
            aria-label={text ? `${tooltip}: ${text}` : tooltip}
            style={style}
          >
            {iconId ? (
              <SVGIcon name={iconId} />
            ) : (
              <span className="fortune-toolbar-combo-text">
                {text !== undefined ? text : ""}
              </span>
            )}
          </div>
        )}
        <div
          ref={arrowRef}
          className="fortune-toolbar-combo-arrow"
          onClick={(e) => onTriggerClick(e, toggle)}
          onKeyDown={(e) => {
            onTriggerKeyDown(e);
            if (!e.defaultPrevented) activateOnKey(e);
          }}
          aria-haspopup
          aria-expanded={open}
          tabIndex={0}
          data-tips={tooltip}
          role="button"
          aria-label={`${tooltip}: ${info.Dropdown}`}
          style={style}
        >
          <SVGIcon name="combo-arrow" width={10} />
        </div>
        {tooltip && !open && (
          <div className="fortune-tooltip" aria-hidden="true">
            {tooltip}
          </div>
        )}
      </div>
      {open && (
        <div
          ref={popupRef}
          className="fortune-toolbar-combo-popup"
          onKeyDown={onPopupKeyDown}
        >
          {children?.(setOpen)}
        </div>
      )}
    </div>
  );
};

export default Combo;
