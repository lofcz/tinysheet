import React from "react";
import { transformExcelToFortune } from "../common/Transform";

export const ImportHelper = (props: any) => {
  const { setSheets, setKey, sheetRef, config } = props;
  const acceptTypes = [
    config.xlsx ? ".xlsx" : "",
    config.csv ? ".csv" : "",
    config.tsv ? ".tsv,.tab,.txt" : "",
  ]
    .filter(Boolean)
    .join(",");
  return (
    <input
      type="file"
      id="ImportHelper"
      accept={acceptTypes}
      onChange={async (e) => {
        const input = e.currentTarget;
        await transformExcelToFortune(
          input?.files?.[0],
          setSheets,
          setKey,
          sheetRef
        );
        // Allow importing the same file again.
        if (input) input.value = "";
      }}
      hidden
    />
  );
};
