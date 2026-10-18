import type { BaseTranslation } from "typesafe-i18n";

const en = {
  insert: {
    pivotTable: "PivotTable",
    pivotTableTip: "Arrange and summarize complex data in a PivotTable.",
    table: "Table",
    tableTip:
      "Create a table to organize and analyze related data. Tables sort, filter and format the data easily.",
    pictures: "Pictures",
    picturesTip: "Insert pictures in a cell or over the cells of the sheet.",
    placeInCell: "Place in Cell",
    placeOverCells: "Place over Cells",
    thisDevice: "This Device…",
    fromWeb: "From a Web Address…",
    shapes: "Shapes",
    shapesTip:
      "Insert ready-made shapes such as circles, squares and arrows. Pick one, then drag on the sheet to draw it.",
    screenshot: "Screenshot",
    screenshotTip: "Take a picture of the selected cells.",
    recommendedCharts: "Recommended Charts",
    recommendedChartsTip:
      "Want us to recommend a good chart to showcase your data? Select data in your worksheet and click this button.",
    chartColumn: "Insert Column or Bar Chart",
    chartColumnTip:
      "Use this chart type to visually compare values across a few categories.",
    chartLine: "Insert Line or Area Chart",
    chartLineTip:
      "Use this chart type to show trends over time (years, months and days) or categories.",
    chartPie: "Insert Pie or Doughnut Chart",
    chartPieTip:
      "Use this chart type to show proportions of a whole. Use it when the total of your numbers is 100%.",
    chartScatter: "Insert Scatter (X, Y) or Bubble Chart",
    chartScatterTip:
      "Use this chart type to show the relationship between sets of values.",
    chartOther: "Insert Waterfall, Statistic, Stock, Radar or Combo Chart",
    chartOtherTip:
      "Use these chart types to show running totals, distributions, stock data, several measures or mixed series.",
    moreCharts: "More Charts…",
    galleryGroups: {
      column2d: "2-D Column",
      bar2d: "2-D Bar",
      line2d: "2-D Line",
      area2d: "2-D Area",
      pie2d: "2-D Pie",
      doughnut: "Doughnut",
      scatter: "Scatter",
      bubble: "Bubble",
      statistic: "Statistic",
      waterfall: "Waterfall and Funnel",
      stock: "Stock",
      radar: "Radar",
      combo: "Combo",
    },
    sparkLine: "Line",
    sparkLineTip: "Insert a line chart within a single cell.",
    sparkColumn: "Column",
    sparkColumnTip: "Insert a column chart within a single cell.",
    sparkWinLoss: "Win/Loss",
    sparkWinLossTip: "Insert a win/loss chart within a single cell.",
    slicer: "Slicer",
    slicerTip:
      "Use a slicer to filter data visually. Slicers make filtering tables faster and easier.",
    link: "Link",
    linkTip:
      "Create a link in your document for quick access to webpages and other places in the workbook.",
    comment: "Comment",
    commentTip: "Start a conversation about the selected cell.",
    note: "Note",
    noteTip: "Add a note about the selected cell.",
    editNote: "Edit Note",
    textBox: "Text Box",
    textBoxTip: "Draw a text box anywhere on the sheet.",
    headerFooter: "Header & Footer",
    headerFooterTip:
      "Edit the header or footer of the page. The header and footer appear at the top and bottom of each printed page.",
    checkbox: "Checkbox",
    checkboxTip:
      "Insert checkboxes into the selected cells. Checked is TRUE, unchecked is FALSE.",
    removeCheckbox: "Remove the checkboxes of the selected cells.",
  },
  chartDialog: {
    title: "Insert Chart",
    recommended: "Recommended Charts",
    all: "All Charts",
    ok: "OK",
    cancel: "Cancel",
    preview: "Preview",
    noData: "Select the data you want to chart, then try again.",
    families: {
      column: "Column",
      line: "Line",
      pie: "Pie",
      bar: "Bar",
      area: "Area",
      scatter: "X Y (Scatter)",
      stock: "Stock",
      radar: "Radar",
      histogram: "Histogram",
      waterfall: "Waterfall",
      funnel: "Funnel",
      combo: "Combo",
    },
    descriptions: {
      columnClustered:
        "A clustered column chart is used to compare values across a few categories. Use it when the order of categories is not important.",
      columnStacked:
        "A stacked column chart is used to compare parts of a whole. Use it to show how a total changes across categories.",
      columnPercent:
        "A 100% stacked column chart compares the percentage each value contributes to a total across categories.",
      barClustered:
        "A clustered bar chart is used to compare values across a few categories. Use it when the category names are long.",
      barStacked:
        "A stacked bar chart is used to compare parts of a whole across categories with long names.",
      barPercent:
        "A 100% stacked bar chart compares the percentage each value contributes to a total.",
      line: "A line chart is used to display trends over time (years, months and days) or categories when the order is important.",
      lineMarkers:
        "A line chart with markers is used to display trends when there are only a few data points.",
      lineStacked:
        "A stacked line chart shows how each part contributes to a total over time.",
      area: "An area chart is used to display trends over time or categories and to draw attention to the total value.",
      areaStacked:
        "A stacked area chart shows the trend of the contribution of each value over time.",
      areaPercent:
        "A 100% stacked area chart shows the trend of the percentage each value contributes over time.",
      pie: "A pie chart is used to show proportions of a whole. Use it for a single series whose values add up to a total.",
      doughnut:
        "A doughnut chart shows proportions of a whole, like a pie chart, with room for a label in the middle.",
      scatter:
        "A scatter chart is used to compare pairs of values and show the relationship between two variables.",
      scatterLines:
        "A scatter chart with lines connects the points in the order of the X values.",
      bubble:
        "A bubble chart adds a third dimension to a scatter chart: the size of each bubble.",
      histogram:
        "A histogram shows how the data is distributed: how many values fall into each range (bin).",
      pareto:
        "A Pareto chart sorts the bins of a histogram in descending order and adds a cumulative total line.",
      waterfall:
        "A waterfall chart shows a running total as values are added or subtracted.",
      funnel:
        "A funnel chart shows values across the stages of a process, such as a sales pipeline.",
      stockHLC:
        "A high-low-close stock chart shows the trend of stock prices. It needs three series: high, low and close.",
      stockOHLC:
        "An open-high-low-close stock chart needs four series: open, high, low and close.",
      radar:
        "A radar chart compares the values of several series across several measures.",
      radarMarkers:
        "A radar chart with markers compares several series across several measures.",
      radarFilled:
        "A filled radar chart compares the area each series covers across several measures.",
      comboColumnLine:
        "A combo chart highlights different kinds of information: the first series as columns, the others as lines.",
      comboColumnLineSecondary:
        "A combo chart with a secondary axis compares series whose values differ a lot in size.",
      comboAreaColumn:
        "A combo chart with areas and columns shows a total and its parts together.",
    },
  },
  pageLayout: {
    margins: "Margins",
    marginsTip:
      "Set the margin sizes for the sheet. To apply specific margin sizes, choose Custom Margins.",
    customMargins: "Custom Margins…",
    marginDetails: "Top: {top}  Bottom: {bottom}  Left: {left}  Right: {right}",
    lastCustom: "Last Custom Setting",
    orientation: "Orientation",
    orientationTip: "Switch the pages between portrait and landscape layouts.",
    size: "Size",
    sizeTip: "Choose a paper size for the sheet.",
    moreSizes: "More Paper Sizes…",
    printArea: "Print Area",
    printAreaTip: "Mark a specific area of the sheet for printing.",
    breaks: "Breaks",
    breaksTip:
      "Add a page break where you want the next page to begin. The break is inserted above and to the left of the selection.",
    printTitles: "Print Titles",
    printTitlesTip:
      "Specify rows and columns to repeat on each printed page, such as labels and headers.",
    pageSetup: "Page Setup…",
    pageSetupTip:
      "Show the Page Setup dialog: page, margins, header and footer, and sheet options.",
    printPreview: "Print Preview",
    printPreviewTip: "Preview the printed pages and print them.",
    width: "Width",
    widthTip:
      "Shrink the width of the printout to fit a maximum number of pages.",
    height: "Height",
    heightTip:
      "Shrink the height of the printout to fit a maximum number of pages.",
    scale: "Scale",
    scaleTip:
      "Stretch or shrink the printout to a percentage of its actual size. Width and Height must be set to Automatic.",
    automatic: "Automatic",
    pages: "{n} pages",
    onePage: "1 page",
    gridlines: "Gridlines",
    headings: "Headings",
    view: "View",
    print: "Print",
    gridlinesViewTip:
      "Show the lines between rows and columns to make editing and reading easier.",
    gridlinesPrintTip: "Print the lines between rows and columns.",
    headingsViewTip:
      "Show the row and column headings: row numbers on the left, column letters at the top.",
    headingsPrintTip: "Print the row and column headings.",
  },
  view: {
    normal: "Normal",
    normalTip: "View the sheet in Normal view.",
    pageBreakPreview: "Page Break Preview",
    pageBreakPreviewTip:
      "See where the pages break when the sheet is printed. Drag a break to move it.",
    pageLayout: "Page Layout",
    pageLayoutTip:
      "See what the printed sheet will look like: the pages and where they begin and end.",
    gridlines: "Gridlines",
    gridlinesTip:
      "Show the lines between rows and columns to make editing and reading easier.",
    formulaBar: "Formula Bar",
    formulaBarTip:
      "Show the formula bar, where you type text and formulas into cells.",
    headings: "Headings",
    headingsTip:
      "Show the row and column headings: row numbers on the left, column letters at the top.",
    zoom: "Zoom",
    zoomTip: "Open the Zoom dialog box to specify the zoom level of the sheet.",
    zoom100: "100%",
    zoom100Tip: "Zoom the sheet to 100% of the normal size.",
    zoomToSelection: "Zoom to Selection",
    zoomToSelectionTip:
      "Zoom the sheet so that the selected cells fill the whole window.",
    zoomTitle: "Zoom",
    magnification: "Magnification",
    fitSelection: "Fit selection",
    custom: "Custom:",
    ok: "OK",
    cancel: "Cancel",
    freezePanes: "Freeze Panes",
    freezePanesTip:
      "Keep a portion of the sheet visible while the rest of the sheet scrolls.",
    freezePanesItem:
      "Keep rows and columns visible while the rest of the worksheet scrolls (based on the current selection).",
    unfreezePanes: "Unfreeze Panes",
    unfreezePanesItem:
      "Unlock all rows and columns to scroll through the entire worksheet.",
    freezeTopRow: "Freeze Top Row",
    freezeTopRowItem:
      "Keep the top row visible while scrolling through the rest of the worksheet.",
    freezeFirstColumn: "Freeze First Column",
    freezeFirstColumnItem:
      "Keep the first column visible while scrolling through the rest of the worksheet.",
    split: "Split",
    splitTip:
      "Divide the window into panes that each scroll separately. Click again to remove the split.",
    theme: "Theme",
    themeTip: "Choose how the workbook looks: light, dark or like the system.",
    light: "Light",
    dark: "Dark",
    system: "System",
    themeCurrent: "Theme: {theme}",
  },
} as const satisfies BaseTranslation;

export default en;
