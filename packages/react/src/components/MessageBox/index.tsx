import React from "react";
import Dialog from "../Dialog";

type Props = {
  type: "ok" | "yesno";
  onOk?: () => void;
  onCancel?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
};

/** A message with OK (or Cancel / OK), as Excel's message boxes. */
const MessageBox: React.FC<Props> = ({
  type = "yesno",
  onOk,
  onCancel,
  title,
  children,
}) => {
  return (
    <Dialog type={type} onOk={onOk} onCancel={onCancel} title={title}>
      {children}
    </Dialog>
  );
};

export default MessageBox;
