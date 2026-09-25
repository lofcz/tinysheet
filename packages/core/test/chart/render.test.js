import {
  renderChartSvg,
  chartThemes,
  getChartTheme,
  formatChartNumber,
  estimateTextWidth,
  hasChartData,
  computeAxisScale,
  renderChartSvgFromSeries,
  DEFAULT_CHART_COLORS,
} from "../../src";

const model = (extra = {}) => ({
  type: "column",
  categories: ["Jan", "Feb", "Mar"],
  series: [
    { name: "Revenue", color: "#4472C4", values: [10, 20, 30] },
    { name: "Cost", color: "#ED7D31", values: [5, 15, 25] },
  ],
  ...extra,
});

const count = (svg, re) => (svg.match(re) || []).length;

describe("chart renderer", () => {
  test("clustered column draws one bar per point, legend and categories", () => {
    const svg = renderChartSvg(model({ title: "Sales <2024>" }), 400, 300);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 400 300"');
    // title is escaped
    expect(svg).toContain("Sales &lt;2024&gt;");
    expect(count(svg, /fill="#4472C4"/g)).toBe(3 + 1); // bars + legend swatch
    expect(count(svg, /fill="#ED7D31"/g)).toBe(3 + 1);
    ["Jan", "Feb", "Mar", "Revenue", "Cost"].forEach((t) =>
      expect(svg).toContain(`>${t}</text>`)
    );
    // value axis ticks 0..35 step 5
    expect(svg).toContain(">35</text>");
  });

  test("stacked and 100% stacked value axes", () => {
    const stacked = renderChartSvg(model({ grouping: "stacked" }), 400, 300);
    // stack of 30+25 = 55 → axis to 60
    expect(stacked).toContain(">60</text>");
    const percent = renderChartSvg(
      model({ grouping: "percentStacked" }),
      400,
      300
    );
    expect(percent).toContain(">100%</text>");
    expect(percent).toContain(">50%</text>");
  });

  test("bar chart swaps axes and lists the first category at the bottom", () => {
    const svg = renderChartSvg(model({ type: "bar" }), 400, 300);
    const y = (label) => {
      const m = svg.match(new RegExp(`y="([\\d.]+)"[^>]*>${label}</text>`));
      return parseFloat(m[1]);
    };
    expect(y("Jan")).toBeGreaterThan(y("Mar"));
  });

  test("line chart with markers, gaps for blanks and data labels", () => {
    const svg = renderChartSvg(
      model({
        type: "line",
        markers: true,
        dataLabels: true,
        series: [
          {
            name: "A",
            color: "#111111",
            values: [1, null, 3],
            labels: ["1.0", "", "3.0"],
          },
        ],
      }),
      400,
      300
    );
    // the blank breaks the path into two moves
    const path = svg.match(/<path d="([^"]+)"[^>]*stroke="#111111"/)[1];
    expect(count(path, /M/g)).toBe(2);
    expect(count(svg, /<circle[^>]*fill="#111111"/g)).toBe(2 + 1); // + legend
    // data labels use the cell text
    expect(svg).toContain(">1.0</text>");
    expect(svg).toContain(">3.0</text>");
  });

  test("area charts draw polygons; legend can be hidden", () => {
    const svg = renderChartSvg(
      model({ type: "area", grouping: "stacked", legend: "none" }),
      400,
      300
    );
    expect(count(svg, /<polygon/g)).toBe(2);
    expect(svg).not.toContain(">Revenue</text>");
  });

  test("pie and doughnut slices use point colours and category legend", () => {
    const pie = renderChartSvg(
      model({
        type: "pie",
        series: [
          {
            name: "Share",
            color: "#000",
            values: [1, 1, 2],
            pointColors: ["#aa0000", "#00aa00", "#0000aa"],
          },
        ],
      }),
      300,
      300
    );
    expect(count(pie, /<path d="M[^"]+" fill="#aa0000"/g)).toBe(1);
    expect(count(pie, /<path d="M[^"]+" fill="#0000aa"/g)).toBe(1);
    expect(pie).toContain(">Jan</text>");
    // a half-circle slice (2 of 4) uses the small-arc flag
    const doughnut = renderChartSvg(
      model({
        type: "doughnut",
        series: [
          {
            name: "A",
            color: "#000",
            values: [1, 3],
            pointColors: ["#a", "#b"],
          },
          {
            name: "B",
            color: "#000",
            values: [2, 2],
            pointColors: ["#c", "#d"],
          },
        ],
      }),
      300,
      300
    );
    expect(count(doughnut, /<path d="M/g)).toBe(4);
  });

  test("scatter uses numeric X values", () => {
    const svg = renderChartSvg(
      {
        type: "scatter",
        categories: [],
        categoryAxisTitle: "X",
        valueAxisTitle: "Y",
        series: [
          {
            name: "S",
            color: "#123456",
            values: [10, 20, 40],
            xValues: [1, 2, 4],
          },
        ],
      },
      400,
      300
    );
    expect(count(svg, /<circle[^>]*fill="#123456"/g)).toBe(3 + 1);
    expect(svg).toContain(">X</text>");
    expect(svg).toContain(">Y</text>");
    // X axis runs to 4.5 → labels include 4
    expect(svg).toContain(">4</text>");
  });

  test("negative values, empty and tiny charts do not throw", () => {
    expect(
      renderChartSvg(
        model({ series: [{ name: "N", color: "#f00", values: [-5, 3, -1] }] }),
        300,
        200
      )
    ).toContain(">-6</text>");
    expect(renderChartSvg(model({ series: [] }), 100, 80)).toMatch(/<svg/);
    expect(renderChartSvg(model(), 10, 10)).toMatch(/<svg/);
    expect(hasChartData(model({ series: [] }))).toBe(false);
    expect(hasChartData(model())).toBe(true);
  });

  test("themes", () => {
    const dark = renderChartSvg(model(), 300, 200, chartThemes.dark);
    expect(dark).toContain(`fill="${chartThemes.dark.background}"`);
    expect(getChartTheme("dark")).toBe(chartThemes.dark);
    expect(getChartTheme(undefined)).toBe(chartThemes.light);
    expect(getChartTheme("light", { text: "#123" }).text).toBe("#123");
  });

  test("helpers", () => {
    expect(formatChartNumber(3)).toBe("3");
    expect(formatChartNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatChartNumber(1 / 3)).toBe("0.333333333");
    expect(estimateTextWidth("WWW", 10)).toBeGreaterThan(
      estimateTextWidth("iii", 10)
    );
  });

  test("legacy renderer and axis helpers are exported from core", () => {
    expect(computeAxisScale(1.33, 2.67).max).toBe(3);
    const svg = renderChartSvgFromSeries(
      [{ label: "A", value: 1, color: DEFAULT_CHART_COLORS[0] }],
      200,
      100
    );
    expect(svg).toContain("#4472C4");
  });
});
