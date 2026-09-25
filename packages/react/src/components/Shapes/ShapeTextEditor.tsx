import React, { useContext, useLayoutEffect, useRef } from "react";
import { locale, Shape, ShapeText } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { htmlToShapeText, shapeTextToHtml } from "./richText";

type Props = {
  shape: Shape;
  /** Called once when editing ends, with the edited text. */
  onDone: (text: ShapeText | null) => void;
  /** Esc: editing ended from the keyboard, focus the shape again. */
  onExit: () => void;
};

/**
 * In-place rich-text editor of a shape (double-click, F2 or typing on a
 * selected shape). Ctrl+B / I / U format the selection natively; the text is
 * read back from the DOM when the editor loses focus.
 */
const ShapeTextEditor: React.FC<Props> = ({ shape, onDone, onExit }) => {
  const { context } = useContext(WorkbookContext);
  const t = locale(context).shape;
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const initial = useRef(shape.text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = shapeTextToHtml(initial.current);
    el.focus({ preventScroll: true });
    // caret at the end of the text
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      // not supported: formatting falls back to <b>/<i>/<u> tags
    }
  }, []);

  const finish = () => {
    if (done.current || !ref.current) return;
    done.current = true;
    onDone(htmlToShapeText(ref.current, initial.current));
  };

  return (
    <div
      ref={ref}
      className="fortune-shape-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${t.editText}: ${shape.name ?? t.shape}`}
      spellCheck={false}
      onBlur={finish}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onCopy={(e) => e.stopPropagation()}
      onCut={(e) => e.stopPropagation()}
      onPaste={(e) => {
        // plain text only: pasted markup would bring foreign styles along
        e.preventDefault();
        e.stopPropagation();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish();
          onExit();
        }
      }}
    />
  );
};

export default ShapeTextEditor;
