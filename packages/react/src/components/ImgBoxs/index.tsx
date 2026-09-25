import _ from "lodash";
import {
  locale,
  onImageMoveStart,
  onImageResizeStart,
} from "@lofcz/tinysheet-core";
import React, { useContext, useMemo } from "react";
import WorkbookContext from "../../context";

const ImgBoxs: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { info, button } = locale(context);
  const activeImg = useMemo(() => {
    return _.find(context.insertedImgs, { id: context.activeImg });
  }, [context.activeImg, context.insertedImgs]);
  // right-click: select the picture and open its menu (Place in Cell, ...)
  const openImageMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const wb = refs.workbookContainer.current?.getBoundingClientRect();
    if (!wb) return;
    setContext((ctx) => {
      ctx.activeImg = id;
      ctx.contextMenu = {
        x: e.pageX - wb.left,
        y: e.pageY - wb.top,
        pageX: e.pageX,
        pageY: e.pageY,
        imageMenu: true,
      };
    });
  };

  return (
    <div id="luckysheet-image-showBoxs">
      {activeImg && (
        <div
          id="luckysheet-modal-dialog-activeImage"
          className="luckysheet-modal-dialog"
          style={{
            padding: 0,
            position: "absolute",
            zIndex: 300,
            width: activeImg.width * context.zoomRatio,
            height: activeImg.height * context.zoomRatio,
            left: activeImg.left * context.zoomRatio,
            top: activeImg.top * context.zoomRatio,
          }}
        >
          <div
            className="luckysheet-modal-dialog-border"
            style={{ position: "absolute" }}
          />
          <div
            className="luckysheet-modal-dialog-content"
            style={{
              width: activeImg.width * context.zoomRatio,
              height: activeImg.height * context.zoomRatio,
              backgroundImage: `url(${activeImg.src})`,
              backgroundSize: `${activeImg.width * context.zoomRatio}px ${
                activeImg.height * context.zoomRatio
              }px`,
              backgroundRepeat: "no-repeat",
              // context.activeImg.width * context.zoomRatio +
              // context.activeImg.height * context.zoomRatio,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.button !== 0) return;
              // no text selection or native image drag while moving it
              e.preventDefault();
              const { nativeEvent } = e;
              setContext((ctx) => {
                onImageMoveStart(ctx, refs.globalCache, nativeEvent);
              });
            }}
            onContextMenu={(e) => openImageMenu(e, activeImg.id)}
          />
          <div className="luckysheet-modal-dialog-resize">
            {["lt", "mt", "lm", "rm", "rt", "lb", "mb", "rb"].map((v) => (
              <div
                key={v}
                className={`luckysheet-modal-dialog-resize-item luckysheet-modal-dialog-resize-item-${v}`}
                data-type={v}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const { nativeEvent } = e;
                  setContext((ctx) => {
                    onImageResizeStart(ctx, refs.globalCache, nativeEvent, v);
                  });
                }}
              />
            ))}
          </div>
          <div className="luckysheet-modal-dialog-controll">
            <span
              className="luckysheet-modal-controll-btn luckysheet-modal-controll-crop"
              role="button"
              tabIndex={0}
              aria-label={info.imageCrop}
              title={info.imageCrop}
            >
              <i className="fa fa-pencil" aria-hidden="true" />
            </span>
            <span
              className="luckysheet-modal-controll-btn luckysheet-modal-controll-restore"
              role="button"
              tabIndex={0}
              aria-label={info.imageRestore}
              title={info.imageRestore}
            >
              <i className="fa fa-window-maximize" aria-hidden="true" />
            </span>
            <span
              className="luckysheet-modal-controll-btn luckysheet-modal-controll-del"
              role="button"
              tabIndex={0}
              aria-label={button.delete}
              title={button.delete}
            >
              <i className="fa fa-trash" aria-hidden="true" />
            </span>
          </div>
        </div>
      )}
      <div className="img-list">
        {context.insertedImgs?.map((v: any) => {
          const { id, left, top, width, height, src } = v;
          if (v.id === context.activeImg) return null;
          return (
            <div
              id={id}
              key={id}
              className="luckysheet-modal-dialog luckysheet-modal-dialog-image"
              style={{
                width: width * context.zoomRatio,
                height: height * context.zoomRatio,
                padding: 0,
                position: "absolute",
                left: left * context.zoomRatio,
                top: top * context.zoomRatio,
                zIndex: 200,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (e.button !== 0) return;
                // one gesture selects the picture and moves it (Excel)
                e.preventDefault();
                const { nativeEvent } = e;
                setContext((ctx) => {
                  onImageMoveStart(ctx, refs.globalCache, nativeEvent, id);
                });
              }}
              onContextMenu={(e) => openImageMenu(e, id)}
              onClick={(e) => {
                setContext((ctx) => {
                  ctx.activeImg = id;
                });
                e.stopPropagation();
              }}
              tabIndex={0}
            >
              <div
                className="luckysheet-modal-dialog-content"
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{
                    width: width * context.zoomRatio,
                    height: height * context.zoomRatio,
                  }}
                />
              </div>
              <div className="luckysheet-modal-dialog-border" />
            </div>
          );
        })}
      </div>
      <div
        id="luckysheet-modal-dialog-cropping"
        className="luckysheet-modal-dialog"
        style={{
          display: "none",
          padding: 0,
          position: "absolute",
          zIndex: 300,
        }}
      >
        <div className="cropping-mask" />
        <div className="cropping-content" />
        <div
          className="luckysheet-modal-dialog-border"
          style={{ position: "absolute" }}
        />
        <div className="luckysheet-modal-dialog-resize">
          <div className="resize-item lt" data-type="lt" />
          <div className="resize-item mt" data-type="mt" />
          <div className="resize-item lm" data-type="lm" />
          <div className="resize-item rm" data-type="rm" />
          <div className="resize-item rt" data-type="rt" />
          <div className="resize-item lb" data-type="lb" />
          <div className="resize-item mb" data-type="mb" />
          <div className="resize-item rb" data-type="rb" />
        </div>
        <div className="luckysheet-modal-dialog-controll">
          <span
            className="luckysheet-modal-controll-btn luckysheet-modal-controll-crop"
            role="button"
            tabIndex={0}
            aria-label={info.imageCrop}
            title={info.imageCrop}
          >
            <i className="fa fa-pencil" aria-hidden="true" />
          </span>
          <span
            className="luckysheet-modal-controll-btn luckysheet-modal-controll-restore"
            role="button"
            tabIndex={0}
            aria-label={info.imageRestore}
            title={info.imageRestore}
          >
            <i className="fa fa-window-maximize" aria-hidden="true" />
          </span>
          <span
            className="luckysheet-modal-controll-btn luckysheet-modal-controll-del"
            role="button"
            tabIndex={0}
            aria-label={button.delete}
            title={button.delete}
          >
            <i className="fa fa-trash" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="cell-date-picker" />
    </div>
  );
};

export default ImgBoxs;
