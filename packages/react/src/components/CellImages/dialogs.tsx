import {
  isAllowedImageSource,
  locale,
  placeImageInCell,
  setCellImageAltText,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { ModalContext } from "../../context/modal";
import Dialog from "../Dialog";
import { isPictureFile, readPictureFile } from "./readImage";

/** Close the dialog and give the keyboard back to the sheet. */
function useClose() {
  const { refs } = useContext(WorkbookContext);
  const { hideModal } = useContext(ModalContext);
  return () => {
    hideModal();
    refs.cellInput.current?.focus({ preventScroll: true });
  };
}

/** Keys typed in a dialog field must not reach the sheet. */
function fieldKeys(submit: () => void, close: () => void) {
  return (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
}

/**
 * Insert > Picture in Cell: a picture from this device or a web address,
 * with alt text, placed into cell (r, c) as its value.
 */
export const InsertPictureDialog: React.FC<{ r: number; c: number }> = ({
  r,
  c,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const close = useClose();
  const t = locale(context).cellImage;
  const [fileSrc, setFileSrc] = useState("");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const submit = () => {
    const src = fileSrc || url.trim();
    if (!src) {
      setError(t.noPicture);
      return;
    }
    if (!isAllowedImageSource(src)) {
      setError(t.invalidUrl);
      return;
    }
    close();
    setContext((draftCtx) => {
      placeImageInCell(draftCtx, r, c, { src, alt: alt.trim() || undefined });
    });
  };
  const onKeyDown = fieldKeys(submit, close);

  return (
    <Dialog type="yesno" title={t.insertTitle} onOk={submit} onCancel={close}>
      <div className="fortune-cellmenu-dialog fortune-cell-image-dialog">
        <div className="fortune-cell-image-dialog-source">
          <button
            type="button"
            className="ts-btn ts-btn--secondary ts-btn--sm fortune-cell-image-dialog-button"
            onClick={() => fileRef.current?.click()}
          >
            {t.fromFile}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            data-testid="cell-image-file"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!isPictureFile(file)) return;
              readPictureFile(file).then(
                (src) => {
                  setFileSrc(src);
                  setFileName(file.name);
                  setUrl("");
                  setError("");
                },
                () => setError(t.readFailed)
              );
            }}
          />
          {fileSrc && (
            <span className="fortune-cell-image-dialog-file">
              <img src={fileSrc} alt="" />
              <span title={fileName}>{fileName}</span>
            </span>
          )}
        </div>
        <label
          className="fortune-cell-image-dialog-field"
          htmlFor="fortune-cell-image-url"
        >
          <span>{t.urlLabel}</span>
          <input
            id="fortune-cell-image-url"
            ref={urlRef}
            className="fortune-cellmenu-dialog-input"
            type="url"
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFileSrc("");
              setFileName("");
              setError("");
            }}
            onKeyDown={onKeyDown}
          />
        </label>
        <label
          className="fortune-cell-image-dialog-field"
          htmlFor="fortune-cell-image-alt"
        >
          <span>{t.altTextTitle}</span>
          <input
            id="fortune-cell-image-alt"
            className="fortune-cellmenu-dialog-input"
            type="text"
            placeholder={t.altTextLabel}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
        {error && (
          <div className="fortune-cell-image-dialog-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
};

/** Alt Text… of a placed picture. */
export const AltTextDialog: React.FC<{
  r: number;
  c: number;
  initial: string;
}> = ({ r, c, initial }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const close = useClose();
  const t = locale(context).cellImage;
  const [alt, setAlt] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const submit = () => {
    close();
    setContext((draftCtx) => {
      setCellImageAltText(draftCtx, r, c, alt.trim());
    });
  };
  return (
    <Dialog type="yesno" title={t.altTextTitle} onOk={submit} onCancel={close}>
      <div className="fortune-cellmenu-dialog fortune-cell-image-dialog">
        <label
          className="fortune-cell-image-dialog-field"
          htmlFor="fortune-cell-image-alt-text"
        >
          <span>{t.altTextLabel}</span>
          <textarea
            id="fortune-cell-image-alt-text"
            ref={ref}
            className="fortune-cellmenu-dialog-input fortune-cell-image-dialog-textarea"
            value={alt}
            rows={3}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.stopPropagation();
                e.preventDefault();
                submit();
                return;
              }
              fieldKeys(submit, close)(e);
            }}
          />
        </label>
      </div>
    </Dialog>
  );
};
