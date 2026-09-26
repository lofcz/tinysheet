import React, { useContext, useEffect } from "react";
import { dismissDataVerificationAlert } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import FilterStatus from "../FilterOption/FilterStatus";
import DataVerificationAlert from "./Alert";
import { DataVerificationPane } from "./Sidebar";

/**
 * Workbook-level UI of the data tools: the validation error alert, the
 * validation rules sidebar and the filter record count.
 */
const DataToolsLayer: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const alertKey = context.dataVerificationAlert
    ? `${context.dataVerificationAlert.sheetId}_${context.dataVerificationAlert.r}_${context.dataVerificationAlert.c}_${context.dataVerificationAlert.value}`
    : null;

  useEffect(() => {
    if (!alertKey) return;
    showDialog(<DataVerificationAlert />, undefined, undefined, () => {
      setContext((ctx) => {
        dismissDataVerificationAlert(ctx);
      });
      hideDialog();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey]);

  return (
    <>
      <DataVerificationPane />
      <FilterStatus />
    </>
  );
};

export default DataToolsLayer;
