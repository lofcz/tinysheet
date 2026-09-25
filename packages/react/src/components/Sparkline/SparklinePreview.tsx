import React, { useContext, useEffect, useRef } from "react";
import { drawSparkline, resolveCellTextColor } from "@lofcz/tinysheet-core";
import type {
  ComputedSparkline,
  SparklineGroup,
  SparklineGroupOptions,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/** Sample data for previews when the real data is not at hand. */
export const SAMPLE_VALUES = [3, 5, -2, 4, 6, 1, 7, 4, -1, 5];

/** A sparkline of `values` drawn with `options`, like the grid draws it. */
export function previewSparkline(
  options: SparklineGroupOptions,
  values: (number | null)[]
): ComputedSparkline {
  const n = values.length;
  let points = values.map((v, i) => ({ x: n <= 1 ? 0.5 : i / (n - 1), v }));
  if (options.rightToLeft) {
    points = points.map((p) => ({ x: 1 - p.x, v: p.v })).reverse();
  }
  const nums = values.filter((v): v is number => v != null);
  const dataMin = nums.length ? Math.min(...nums) : NaN;
  const dataMax = nums.length ? Math.max(...nums) : NaN;
  let min = dataMin;
  let max = dataMax;
  if (options.minAxisType === "custom" && Number.isFinite(options.manualMin)) {
    min = options.manualMin as number;
  }
  if (options.maxAxisType === "custom" && Number.isFinite(options.manualMax)) {
    max = options.manualMax as number;
  }
  return { points, dataMin, dataMax, min, max };
}

const SparklinePreview: React.FC<{
  options: SparklineGroupOptions;
  values?: (number | null)[];
  width: number;
  height: number;
  className?: string;
}> = ({ options, values = SAMPLE_VALUES, width, height, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useContext(WorkbookContext).context;
  useEffect(() => {
    const canvas = ref.current;
    let rc: CanvasRenderingContext2D | null = null;
    try {
      rc = canvas?.getContext("2d") ?? null;
    } catch {
      rc = null;
    }
    if (!canvas || !rc) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc.clearRect(0, 0, width, height);
    const group = { ...options, id: "preview", sparklines: [] };
    drawSparkline(
      rc,
      group as SparklineGroup,
      previewSparkline(options, values),
      { x: 0, y: 0, w: width, h: height },
      1,
      // near-black colours read as the theme text colour, like on the grid
      theme === "dark" ? (c) => resolveCellTextColor("dark", c) : undefined
    );
  }, [options, values, width, height, theme]);
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};

export default SparklinePreview;
