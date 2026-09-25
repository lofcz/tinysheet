import React, { useContext } from "react";
import { insertChart, locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Combo from "../Toolbar/Combo";
import Select, { Option } from "../Toolbar/Select";
import { useAlert } from "../../hooks/useAlert";
import {
  applyChartTypeOption,
  CHART_TYPE_GROUPS,
  CHART_TYPE_OPTIONS,
  ChartTypeIcon,
  ChartTypeOption,
} from "./chartTypes";

export const CHART_TOOLBAR_ICON = "fortune-insert-chart";

/** Toolbar "Insert chart": the button inserts a clustered column chart, the
 * arrow opens the list of chart types (grouped like Excel's Insert Chart). */
const ChartToolbarItem: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { chart: t } = locale(context);
  const { showAlert } = useAlert();

  const insert = (option: ChartTypeOption) => {
    if (context.allowEdit === false) return;
    if (!context.luckysheet_select_save?.length) {
      showAlert(t.noData, "ok");
      return;
    }
    setContext((ctx) => {
      const chart = insertChart(ctx, {
        type: option.type,
        grouping: option.grouping,
        markers: option.markers,
      });
      if (chart) applyChartTypeOption(chart, option);
    });
  };

  return (
    <>
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden="true"
      >
        <defs>
          <symbol id={CHART_TOOLBAR_ICON} viewBox="0 0 24 24" fill="none">
            <path
              d="M4.75 4.75v14.5h14.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect x="8" y="11" width="2.5" height="5.5" fill="currentColor" />
            <rect x="12" y="7" width="2.5" height="9.5" fill="currentColor" />
            <rect x="16" y="9.5" width="2.5" height="7" fill="currentColor" />
          </symbol>
        </defs>
      </svg>
      <Combo
        iconId={CHART_TOOLBAR_ICON}
        tooltip={t.insertChart}
        onClick={() => insert(CHART_TYPE_OPTIONS[0])}
      >
        {(setOpen) => (
          <div className="fortune-chart-type-menu">
            <Select>
              {CHART_TYPE_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  <div className="fortune-chart-type-group" role="presentation">
                    {t[group]}
                  </div>
                  {CHART_TYPE_OPTIONS.filter((o) => o.group === group).map(
                    (option) => (
                      <Option
                        key={option.key}
                        onClick={() => {
                          insert(option);
                          setOpen(false);
                        }}
                      >
                        <div className="fortune-chart-type-option">
                          <ChartTypeIcon type={option.type} />
                          <span>{t[option.key]}</span>
                        </div>
                      </Option>
                    )
                  )}
                </React.Fragment>
              ))}
            </Select>
          </div>
        )}
      </Combo>
    </>
  );
};

export default ChartToolbarItem;
