import React, { useCallback, useContext, useRef, useState } from "react";
import {
  Context,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  getSheetIndex,
  locale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import "./index.css";
import { activateOnKey } from "../Toolbar/Button";

const presets = [
  {
    text: "10%",
    value: 0.1,
  },
  {
    text: "30%",
    value: 0.3,
  },
  {
    text: "50%",
    value: 0.5,
  },
  {
    text: "70%",
    value: 0.7,
  },
  {
    text: "100%",
    value: 1,
  },
  {
    text: "150%",
    value: 1.5,
  },
  {
    text: "200%",
    value: 2,
  },
  {
    text: "300%",
    value: 3,
  },
  {
    text: "400%",
    value: 4,
  },
];

const ZoomControl: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const menuRef = useRef<HTMLDivElement>(null);
  const [radioMenuOpen, setRadioMenuOpen] = useState(false);
  const { info } = locale(context);

  useOutsideClick(menuRef, () => {
    setRadioMenuOpen(false);
  }, []);

  const zoomTo = useCallback(
    (val: number) => {
      val = parseFloat(val.toFixed(1));
      if (val > MAX_ZOOM_RATIO || val < MIN_ZOOM_RATIO) {
        return;
      }
      setContext(
        (ctx: Context) => {
          const index = getSheetIndex(ctx, ctx.currentSheetId);
          if (index == null) {
            return;
          }
          ctx.luckysheetfile[index].zoomRatio = val;
          ctx.zoomRatio = val;
        },
        { noHistory: true }
      );
    },
    [setContext]
  );

  return (
    <aside aria-label={info.zoomSettings} className="fortune-zoom-container">
      <div
        className="fortune-zoom-button"
        aria-label={info.zoomOut}
        title={info.zoomOut}
        onClick={(e) => {
          zoomTo(context.zoomRatio - 0.1);
          e.stopPropagation();
        }}
        onKeyDown={activateOnKey}
        tabIndex={0}
        role="button"
      >
        <SVGIcon name="minus" width={16} height={16} />
      </div>
      <div className="fortune-zoom-ratio">
        <div
          className="fortune-zoom-ratio-current fortune-zoom-button"
          onClick={() => setRadioMenuOpen(true)}
          onKeyDown={activateOnKey}
          tabIndex={0}
          role="button"
          aria-label={`${info.zoomLevel}: ${(context.zoomRatio * 100).toFixed(
            0
          )}%`}
          aria-haspopup="listbox"
          aria-expanded={radioMenuOpen}
        >
          {(context.zoomRatio * 100).toFixed(0)}%
        </div>
        {radioMenuOpen && (
          <div
            className="fortune-zoom-ratio-menu"
            ref={menuRef}
            role="listbox"
            aria-label={info.zoomLevel}
          >
            {presets.map((v) => (
              <div
                className="fortune-zoom-ratio-item"
                key={v.text}
                onClick={(e) => {
                  zoomTo(v.value);
                  setRadioMenuOpen(false);
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyDown={activateOnKey}
                role="option"
                aria-selected={Math.abs(context.zoomRatio - v.value) < 0.001}
                tabIndex={0}
              >
                <div className="fortune-zoom-ratio-text">{v.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        className="fortune-zoom-button"
        aria-label={info.zoomIn}
        title={info.zoomIn}
        onClick={(e) => {
          zoomTo(context.zoomRatio + 0.1);
          e.stopPropagation();
        }}
        onKeyDown={activateOnKey}
        tabIndex={0}
        role="button"
      >
        <SVGIcon name="plus" width={16} height={16} />
      </div>
    </aside>
  );
};

export default ZoomControl;
