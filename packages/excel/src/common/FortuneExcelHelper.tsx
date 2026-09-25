import React from "react";
import { ImportHelper } from "../ToFortuneSheet/ImportHelper";
import { ExportHelper } from "../ToExcel/ExportHelper";

const formatConfig = (config = {}) => {
  const defaultConfig = {
    import: { xlsx: true, csv: true, tsv: true },
    export: { xlsx: true, csv: true, tsv: true },
  };
  return { ...defaultConfig, ...config };
};

export const FortuneExcelHelper = (props: any) => {
  // lang: UI language of the import/export strings (English fallback);
  // onError(error, message): import/export failures (default: alert)
  const { setKey, setSheets, sheetRef, config, lang, onError } = props;
  const sanitizedConfig = formatConfig(config);
  return (
    <>
      <ImportHelper
        setKey={setKey}
        setSheets={setSheets}
        sheetRef={sheetRef}
        config={sanitizedConfig.import}
        lang={lang}
        onError={onError}
      />
      <ExportHelper
        sheetRef={sheetRef}
        config={sanitizedConfig.export}
        lang={lang}
        onError={onError}
      />
    </>
  );
};
