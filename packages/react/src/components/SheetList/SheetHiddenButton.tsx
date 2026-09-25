import { Sheet, api } from "@lofcz/tinysheet-core";
import React, { CSSProperties, useCallback, useContext } from "react";
import { EyeOff } from "lucide-react";
import { Icon } from "../ui/icons";
import WorkbookContext from "../../context";

type Props = {
  style?: CSSProperties;
  sheet?: Sheet;
};

/** The eye of a hidden sheet in the sheet list: a click unhides it. */
const SheetHiddenButton: React.FC<Props> = ({ style, sheet }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const showSheet = useCallback(() => {
    if (context.allowEdit === false) return;
    if (!sheet) return;
    setContext((ctx) => {
      api.showSheet(ctx, sheet.id as string);
    });
  }, [context.allowEdit, setContext, sheet]);

  if (sheet?.hide !== 1) return null;
  return (
    <span
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        showSheet();
      }}
      className="fortune-sheet-hidden-button"
      aria-hidden="true"
    >
      <Icon icon={EyeOff} size={14} />
    </span>
  );
};

export default SheetHiddenButton;
