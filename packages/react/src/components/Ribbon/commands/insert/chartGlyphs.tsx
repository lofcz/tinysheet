/**
 * Monochrome thumbnails of every chart variant (Insert › Charts galleries
 * and the Insert Chart dialog), drawn on a 40 x 30 grid in currentColor:
 * the first series solid, the second one lighter, the axes faint.
 */
import React from "react";

const A = { fill: "currentColor" };
const B = { fill: "currentColor", fillOpacity: 0.42 };
const C = { fill: "currentColor", fillOpacity: 0.2 };
const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const LINE_B = { ...LINE, strokeOpacity: 0.45 };

const Axes: React.FC<{ bar?: boolean }> = ({ bar }) => (
  <path
    d={bar ? "M6 3v25" : "M3 27h35"}
    stroke="currentColor"
    strokeOpacity={0.35}
    strokeWidth={1}
    fill="none"
  />
);

/** Columns (or bars) of `heights` series per category. */
function columns(
  groups: number[][],
  mode: "clustered" | "stacked" | "percent",
  bar = false
) {
  const out: React.ReactNode[] = [];
  const styles = [A, B, C];
  const gw = 32 / groups.length;
  groups.forEach((g, gi) => {
    const total = g.reduce((s, v) => s + v, 0);
    let acc = 0;
    g.forEach((v, si) => {
      let len = v;
      let start = 0;
      let off = 0;
      let thick = gw - 4;
      if (mode === "clustered") {
        thick = (gw - 4) / g.length;
        off = si * thick;
      } else {
        if (mode === "percent") len = (v / total) * 23;
        start = acc;
        acc += len;
      }
      const pos = 5 + gi * gw + off;
      out.push(
        bar ? (
          <rect
            key={`${gi}-${si}`}
            x={7 + start}
            y={pos - 2}
            width={len * 1.3}
            height={thick - 0.6}
            rx={0.6}
            {...styles[si]}
          />
        ) : (
          <rect
            key={`${gi}-${si}`}
            x={pos}
            y={27 - start - len}
            width={thick - 0.6}
            height={len}
            rx={0.6}
            {...styles[si]}
          />
        )
      );
    });
  });
  return out;
}

const pts = (list: [number, number][]) =>
  list.map(([x, y]) => `${x},${y}`).join(" ");

const Markers: React.FC<{ list: [number, number][]; light?: boolean }> = ({
  list,
  light,
}) => (
  <>
    {list.map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} {...(light ? B : A)} />
    ))}
  </>
);

/** Pie / doughnut slices. */
function slices(hole: boolean) {
  const cx = 20;
  const cy = 15;
  const r = 12;
  const parts = [0.45, 0.3, 0.25];
  const styles = [A, B, C];
  let a = -Math.PI / 2;
  return parts.map((p, i) => {
    const b = a + p * Math.PI * 2;
    const large = p > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(a);
    const y1 = cy + r * Math.sin(a);
    const x2 = cx + r * Math.cos(b);
    const y2 = cy + r * Math.sin(b);
    let d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    if (hole) {
      const h = 5.5;
      const hx1 = cx + h * Math.cos(a);
      const hy1 = cy + h * Math.sin(a);
      const hx2 = cx + h * Math.cos(b);
      const hy2 = cy + h * Math.sin(b);
      d = `M${hx1},${hy1} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${hx2},${hy2} A${h},${h} 0 ${large} 0 ${hx1},${hy1} Z`;
    }
    a = b;
    return (
      <path
        key={i}
        d={d}
        {...styles[i]}
        stroke="var(--ts-pane, #fff)"
        strokeWidth={0.8}
      />
    );
  });
}

const radarWeb = (scale: number) => {
  const out: [number, number][] = [];
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    out.push([20 + 13 * scale * Math.cos(a), 16 + 13 * scale * Math.sin(a)]);
  }
  return out;
};

const radarShape = (values: number[]) =>
  values.map((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [20 + 13 * v * Math.cos(a), 16 + 13 * v * Math.sin(a)] as [
      number,
      number,
    ];
  });

function body(key: string): React.ReactNode {
  const L1: [number, number][] = [
    [5, 21],
    [13, 14],
    [21, 17],
    [29, 8],
    [36, 11],
  ];
  const L2: [number, number][] = [
    [5, 24],
    [13, 21],
    [21, 23],
    [29, 17],
    [36, 19],
  ];
  switch (key) {
    case "columnClustered":
      return [
        <Axes key="ax" />,
        ...columns(
          [
            [12, 18],
            [20, 14],
            [9, 16],
          ],
          "clustered"
        ),
      ];
    case "columnStacked":
      return [
        <Axes key="ax" />,
        ...columns(
          [
            [9, 6],
            [12, 9],
            [6, 7],
          ],
          "stacked"
        ),
      ];
    case "columnPercent":
      return [
        <Axes key="ax" />,
        ...columns(
          [
            [12, 11],
            [16, 7],
            [8, 15],
          ],
          "percent"
        ),
      ];
    case "barClustered":
      return [
        <Axes key="ax" bar />,
        ...columns(
          [
            [12, 18],
            [20, 14],
            [9, 16],
          ],
          "clustered",
          true
        ),
      ];
    case "barStacked":
      return [
        <Axes key="ax" bar />,
        ...columns(
          [
            [9, 6],
            [12, 9],
            [6, 7],
          ],
          "stacked",
          true
        ),
      ];
    case "barPercent":
      return [
        <Axes key="ax" bar />,
        ...columns(
          [
            [12, 11],
            [16, 7],
            [8, 15],
          ],
          "percent",
          true
        ),
      ];
    case "line":
      return [
        <Axes key="ax" />,
        <polyline key="b" points={pts(L2)} {...LINE_B} />,
        <polyline key="a" points={pts(L1)} {...LINE} />,
      ];
    case "lineMarkers":
      return [
        <Axes key="ax" />,
        <polyline key="b" points={pts(L2)} {...LINE_B} />,
        <polyline key="a" points={pts(L1)} {...LINE} />,
        <Markers key="mb" list={L2} light />,
        <Markers key="ma" list={L1} />,
      ];
    case "lineStacked": {
      const top: [number, number][] = [
        [5, 16],
        [13, 10],
        [21, 12],
        [29, 5],
        [36, 7],
      ];
      return [
        <Axes key="ax" />,
        <polyline key="b" points={pts(L2)} {...LINE_B} />,
        <polyline key="a" points={pts(top)} {...LINE} />,
        <Markers key="ma" list={top} />,
      ];
    }
    case "area":
      return [
        <Axes key="ax" />,
        <polygon key="a" points={`4,27 ${pts(L1)} 37,27`} {...B} />,
        <polygon key="b" points={`4,27 ${pts(L2)} 37,27`} {...A} />,
      ];
    case "areaStacked":
      return [
        <Axes key="ax" />,
        <polygon
          key="a"
          points={`4,27 ${pts(L1.map(([x, y]) => [x, y - 3]))} 37,27`}
          {...B}
        />,
        <polygon key="b" points={`4,27 ${pts(L2)} 37,27`} {...A} />,
      ];
    case "areaPercent":
      return [
        <Axes key="ax" />,
        <rect key="bg" x={4} y={4} width={33} height={23} {...B} />,
        <polygon key="b" points={`4,27 ${pts(L1)} 37,27`} {...A} />,
      ];
    case "pie":
      return slices(false);
    case "doughnut":
      return slices(true);
    case "scatter":
    case "scatterLines": {
      const P: [number, number][] = [
        [7, 22],
        [11, 18],
        [15, 19],
        [19, 13],
        [24, 14],
        [28, 9],
        [33, 6],
      ];
      return [
        <Axes key="ax" />,
        <path
          key="y"
          d="M4 3v24"
          stroke="currentColor"
          strokeOpacity={0.35}
          fill="none"
        />,
        key === "scatterLines" ? (
          <path
            key="l"
            d="M7 22 C 12 17, 16 20, 19 13 S 28 10, 33 6"
            {...LINE}
          />
        ) : null,
        <Markers key="m" list={P} />,
      ];
    }
    case "bubble":
      return [
        <Axes key="ax" />,
        <circle key="1" cx={11} cy={19} r={5} {...B} />,
        <circle key="2" cx={22} cy={12} r={7} {...A} fillOpacity={0.75} />,
        <circle key="3" cx={32} cy={20} r={3.5} {...A} />,
      ];
    case "histogram":
      return [
        <Axes key="ax" />,
        ...[5, 11, 18, 22, 15, 8, 4].map((h, i) => (
          <rect
            key={i}
            x={4 + i * 4.8}
            y={27 - h}
            width={4.4}
            height={h}
            {...(i % 2 ? B : A)}
          />
        )),
      ];
    case "pareto":
      return [
        <Axes key="ax" />,
        ...[20, 14, 9, 6, 4, 2].map((h, i) => (
          <rect
            key={i}
            x={4 + i * 5.4}
            y={27 - h}
            width={4.6}
            height={h}
            {...B}
          />
        )),
        <polyline
          key="cum"
          points="6,14 12,8 17,5.5 22,4 28,3.2 33,3"
          {...LINE}
        />,
      ];
    case "waterfall": {
      const steps: [number, number, typeof A][] = [
        [0, 13, A],
        [13, 20, B],
        [15, 20, C],
        [15, 22, B],
        [0, 22, A],
      ];
      return [
        <Axes key="ax" />,
        ...steps.map(([from, to, style], i) => (
          <rect
            key={i}
            x={5 + i * 6.6}
            y={27 - to}
            width={5}
            height={to - from}
            {...style}
          />
        )),
      ];
    }
    case "funnel":
      return [28, 22, 16, 10].map((w, i) => (
        <rect
          key={i}
          x={20 - w / 2}
          y={4 + i * 6}
          width={w}
          height={5}
          rx={0.8}
          {...(i % 2 ? B : A)}
        />
      ));
    case "stockHLC":
    case "stockOHLC": {
      const sticks: [number, number, number, number, number][] = [
        [8, 8, 22, 12, 18],
        [16, 5, 18, 15, 9],
        [24, 10, 25, 13, 21],
        [32, 4, 16, 12, 6],
      ];
      return [
        <Axes key="ax" />,
        ...sticks.map(([x, hi, lo, open, close]) =>
          key === "stockOHLC" ? (
            <g key={x}>
              <path
                d={`M${x} ${hi}V${lo}`}
                stroke="currentColor"
                strokeWidth={1.2}
              />
              <rect
                x={x - 2.5}
                y={Math.min(open, close)}
                width={5}
                height={Math.abs(open - close)}
                {...(open > close ? B : A)}
                stroke="currentColor"
                strokeWidth={0.8}
              />
            </g>
          ) : (
            <g key={x}>
              <path
                d={`M${x} ${hi}V${lo}`}
                stroke="currentColor"
                strokeWidth={1.4}
              />
              <path
                d={`M${x} ${close}h3`}
                stroke="currentColor"
                strokeWidth={1.4}
              />
            </g>
          )
        ),
      ];
    }
    case "radar":
    case "radarMarkers":
    case "radarFilled": {
      const web = [1, 0.6].map((s) => (
        <polygon
          key={s}
          points={pts(radarWeb(s))}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={0.8}
        />
      ));
      const shape = radarShape([0.9, 0.55, 0.8, 0.45, 0.7]);
      return [
        ...web,
        key === "radarFilled" ? (
          <polygon key="s" points={pts(shape)} {...A} fillOpacity={0.55} />
        ) : (
          <polygon key="s" points={pts(shape)} {...LINE} />
        ),
        key === "radarMarkers" ? <Markers key="m" list={shape} /> : null,
      ];
    }
    case "comboColumnLine":
    case "comboColumnLineSecondary":
      return [
        <Axes key="ax" />,
        ...columns([[10], [16], [12], [19]], "clustered"),
        <polyline
          key="l"
          points="8,12 16,8 24,14 32,5"
          {...LINE}
          stroke="currentColor"
          strokeOpacity={0.6}
        />,
        <Markers
          key="m"
          list={[
            [8, 12],
            [16, 8],
            [24, 14],
            [32, 5],
          ]}
          light
        />,
        key === "comboColumnLineSecondary" ? (
          <path
            key="y2"
            d="M37 3v24"
            stroke="currentColor"
            strokeOpacity={0.35}
            fill="none"
          />
        ) : null,
      ];
    case "comboAreaColumn":
      return [
        <Axes key="ax" />,
        <polygon key="a" points="4,27 4,12 14,8 24,13 37,6 37,27" {...C} />,
        ...columns([[8], [13], [9], [15]], "clustered").map((c) => c),
      ];
    default:
      return [<Axes key="ax" />, ...columns([[12], [20], [9]], "clustered")];
  }
}

/** Thumbnail of the chart variant `optionKey` (CHART_TYPE_OPTIONS keys). */
export const ChartGlyph: React.FC<{
  optionKey: string;
  width?: number;
  height?: number;
}> = ({ optionKey, width = 40, height = 30 }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 40 30"
    aria-hidden="true"
    focusable="false"
    className="ts-chart-glyph"
  >
    {body(optionKey)}
  </svg>
);

export default ChartGlyph;
