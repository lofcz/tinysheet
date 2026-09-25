/**
 * Sparkline UI strings, kept in one file so the sparkline feature does not
 * touch the big per-language files. `sparklineLocale(ctx)` picks the
 * workbook's language and falls back to English key by key.
 */
const en = {
  sparklines: "Sparklines",
  insertSparklines: "Insert Sparklines",
  createSparklines: "Create Sparklines",
  line: "Line",
  column: "Column",
  winLoss: "Win/Loss",
  chooseData: "Choose the data that you want",
  dataRange: "Data Range",
  chooseLocation: "Choose where you want the sparklines to be placed",
  locationRange: "Location Range",
  selectRange: "Select a range on the sheet",
  pickHint: "Select the cells on the sheet, then press OK.",
  errorData: "The data range is not valid.",
  errorLocation: "The location range is not valid.",
  errorLocationShape:
    "Location reference is not valid because the cells are not all in the same column or row. Select cells that are all in a single column or row.",
  errorLocationSheet: "The location range must be on the active sheet.",
  errorMismatch:
    "Data range dimensions are not valid: they must match the location range (one row or column of data per sparkline).",
  errorDataShape:
    "The data range for a single sparkline must be a single row or column.",
  errorDateRange:
    "The date range must have as many cells as each sparkline has data points.",
  editSparklines: "Sparklines",
  editGroupData: "Edit Group Location & Data…",
  editSingleData: "Edit Single Sparkline's Data…",
  editGroupDataTitle: "Edit Sparklines",
  editSingleDataTitle: "Edit Sparkline Data",
  settings: "Sparkline Settings…",
  settingsTitle: "Sparkline Settings",
  group: "Group",
  ungroup: "Ungroup",
  clearSelected: "Clear Selected Sparklines",
  clearGroups: "Clear Selected Sparkline Groups",
  type: "Type",
  show: "Show",
  high: "High Point",
  low: "Low Point",
  negative: "Negative Points",
  first: "First Point",
  last: "Last Point",
  markers: "Markers",
  style: "Style",
  styleN: "Style {n}",
  colors: "Colours",
  sparklineColor: "Sparkline Colour",
  weight: "Weight (pt)",
  markerColors: "Marker Colour",
  axisColor: "Axis Colour",
  axis: "Axis",
  showAxis: "Show Axis",
  rightToLeft: "Plot Data Right-to-Left",
  dateAxis: "Date Axis Type",
  dateRange: "Date range",
  minAxis: "Vertical Axis Minimum Value",
  maxAxis: "Vertical Axis Maximum Value",
  axisIndividual: "Automatic for Each Sparkline",
  axisGroup: "Same for All Sparklines",
  axisCustom: "Custom Value",
  hiddenEmpty: "Hidden & Empty Cells",
  emptyCells: "Show empty cells as",
  emptyGap: "Gaps",
  emptyZero: "Zero",
  emptySpan: "Connect data points with line",
  showHidden: "Show data in hidden rows and columns",
  noSparkline: "Select a cell that contains a sparkline.",
};

export type SparklineLocale = typeof en;

const zh: Partial<SparklineLocale> = {
  sparklines: "迷你图",
  insertSparklines: "插入迷你图",
  createSparklines: "创建迷你图",
  line: "折线",
  column: "柱形",
  winLoss: "盈亏",
  chooseData: "选择所需的数据",
  dataRange: "数据范围",
  chooseLocation: "选择放置迷你图的位置",
  locationRange: "位置范围",
  editSparklines: "迷你图",
  editGroupData: "编辑组位置和数据…",
  editSingleData: "编辑单个迷你图的数据…",
  settings: "迷你图设置…",
  settingsTitle: "迷你图设置",
  group: "组合",
  ungroup: "取消组合",
  clearSelected: "清除所选的迷你图",
  clearGroups: "清除所选的迷你图组",
  high: "高点",
  low: "低点",
  negative: "负点",
  first: "首点",
  last: "尾点",
  markers: "标记",
  showAxis: "显示坐标轴",
  rightToLeft: "从右到左的绘图数据",
  dateAxis: "日期坐标轴类型",
  emptyGap: "空距",
  emptyZero: "零值",
  emptySpan: "用直线连接数据点",
  showHidden: "显示隐藏行和列中的数据",
};

const sparklineLocales: Record<string, Partial<SparklineLocale>> = {
  en,
  zh,
  "zh-TW": zh,
};

export function sparklineLocale(ctx: { lang?: string | null }) {
  const lang = ctx.lang || "";
  const over =
    sparklineLocales[lang] ?? sparklineLocales[lang.split("-")[0]] ?? {};
  return { ...en, ...over } as SparklineLocale;
}
