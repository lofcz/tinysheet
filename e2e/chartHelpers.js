// Shared set-up of the chart tools specs (chartRibbon / chartData): a
// "Sales" sheet with a table and a clustered column chart of Revenue and
// Cost by month, and an "Other" sheet with a column of numbers.
const { expect } = require("./fixtures");
const { openScenario } = require("./dragHelpers");

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

const TABLE = [
  ["Month", "Revenue", "Cost", "Profit"],
  ["Jan", 120, 80, 40],
  ["Feb", 135, 90, 45],
  ["Mar", 150, 95, 55],
  ["Apr", 110, 85, 25],
  ["May", 170, 100, 70],
];

const ref = (r1, r2, c1, c2, sheetId = "s1") => ({
  sheetId,
  row: [r1, r2],
  column: [c1, c2],
});

function celldata(table) {
  const out = [];
  table.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v == null) return;
      out.push({ r, c, v: typeof v === "number" ? num(v) : str(v) });
    })
  );
  return out;
}

/** The two sheets; `chart` fields override the default chart. */
function chartBook(chart = {}) {
  return [
    {
      name: "Sales",
      id: "s1",
      order: 0,
      status: 1,
      row: 60,
      column: 26,
      celldata: celldata(TABLE),
      charts:
        chart === null
          ? []
          : [
              {
                id: "ch1",
                type: "column",
                grouping: "clustered",
                title: "Sales",
                source: ref(0, 5, 0, 2),
                series: [1, 2].map((c) => ({
                  nameRef: ref(0, 0, c, c),
                  values: ref(1, 5, c, c),
                  categories: ref(1, 5, 0, 0),
                })),
                legend: "bottom",
                left: 380,
                top: 30,
                width: 480,
                height: 288,
                ...chart,
              },
            ],
    },
    {
      name: "Other",
      id: "s2",
      order: 1,
      status: 1,
      row: 60,
      column: 26,
      celldata: celldata([["Plan"], [100], [110], [120], [130], [140]]),
    },
  ];
}

async function openChartBook(page, chart, options) {
  return openScenario(page, chartBook(chart), options);
}

/** The chart `id` as saved (any sheet). */
function chartOf(page, id = "ch1") {
  return page.evaluate(
    (cid) =>
      window.__tinysheet
        .getAllSheets()
        .flatMap((s) => (s.charts || []).map((c) => ({ ...c, sheet: s.id })))
        .find((c) => c.id === cid) ?? null,
    id
  );
}

const chartBox = (page, id = "ch1") =>
  page.locator(`.fortune-chart-box[data-chart-id="${id}"][role=figure]`);

/** Click the chart area (its top left corner, inside the border). */
async function selectChart(page, id = "ch1") {
  const b = await chartBox(page, id).boundingBox();
  await page.mouse.click(b.x + 6, b.y + 6);
  await expect(
    page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
  ).toBeVisible();
}

/** Show a ribbon tab by id. */
async function showTab(page, id) {
  const tab = page.locator(`.fortune-ribbon [role=tab][data-tab="${id}"]`);
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/** A command of the ribbon's command row by accessible name. */
const command = (page, name) =>
  page
    .locator(".fortune-ribbon-commands")
    .getByRole("button", { name, exact: true });

module.exports = {
  TABLE,
  ref,
  chartBook,
  openChartBook,
  chartOf,
  chartBox,
  selectChart,
  showTab,
  command,
};
