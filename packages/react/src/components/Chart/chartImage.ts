/**
 * Chart pictures: rasterise a chart's SVG to PNG, copy it to the system
 * clipboard as an image, or save it as a PNG / SVG file.
 */
import { svgToDataUri } from "@lofcz/tinysheet-core";

/** Rasterise an SVG string to a PNG blob (scale 2 for crisp pastes). */
export function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const g = canvas.getContext("2d");
        if (!g) {
          reject(new Error("no canvas"));
          return;
        }
        g.scale(scale, scale);
        g.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = svgToDataUri(svg);
  });
}

/**
 * Copy the chart as a picture. Returns false when the browser has no
 * image clipboard (or refused the write).
 */
export async function copyChartImage(
  svg: string,
  width: number,
  height: number
) {
  const { clipboard } = navigator as unknown as {
    clipboard?: { write?: (items: unknown[]) => Promise<void> };
  };
  const Item = (window as unknown as { ClipboardItem?: any }).ClipboardItem;
  if (!clipboard?.write || !Item) return false;
  try {
    // Safari wants the item to be created synchronously with a promise.
    const png = svgToPngBlob(svg, width, height);
    await clipboard.write([
      new Item({
        "image/png": png,
      }),
    ]);
    return true;
  } catch (e) {
    return false;
  }
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from the chart title (or "Chart"). */
export function chartFileName(title: string | undefined, ext: string) {
  const base =
    (title ?? "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "Chart";
  return `${base}.${ext}`;
}

export function saveChartSvg(svg: string, title?: string) {
  download(
    new Blob([svg], { type: "image/svg+xml" }),
    chartFileName(title, "svg")
  );
}

export async function saveChartPng(
  svg: string,
  width: number,
  height: number,
  title?: string
) {
  const blob = await svgToPngBlob(svg, width, height);
  download(blob, chartFileName(title, "png"));
}
