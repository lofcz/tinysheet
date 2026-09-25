import React, { useMemo } from "react";

let counter = 0;

/** A labelled checkbox row of the data tools dialogs. */
const DtCheck: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
}> = ({ checked, onChange, children, style, disabled }) => {
  const id = useMemo(() => {
    counter += 1;
    return `fortune-dt-check-${counter}`;
  }, []);
  return (
    <label className="fortune-dt-check" htmlFor={id} style={style}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
};

export default DtCheck;
