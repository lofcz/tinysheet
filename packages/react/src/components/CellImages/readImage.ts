/**
 * Reading picture files (file picker, clipboard) into data URLs that can be
 * stored in a cell. Big pictures are scaled down first, so a pasted
 * screenshot does not put megabytes into the workbook.
 */

/** Longest side (px) a stored picture keeps. */
export const MAX_PICTURE_SIDE = 1600;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

/** Whether a clipboard / file-picker file is a picture. */
export function isPictureFile(file: File | null | undefined): file is File {
  return !!file && /^image\//i.test(file.type);
}

/**
 * A picture file as a data:image URL, scaled down to at most
 * MAX_PICTURE_SIDE pixels on its longest side (SVG and GIF are kept as they
 * are: scaling would rasterise them or drop the animation).
 */
export async function readPictureFile(file: File): Promise<string> {
  const url = await readAsDataUrl(file);
  if (!/^data:image\//i.test(url)) throw new Error("not a picture");
  if (/^data:image\/(svg\+xml|gif)/i.test(url)) return url;
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch (e) {
    return url;
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, MAX_PICTURE_SIDE / Math.max(w, h, 1));
  if (scale >= 1) return url;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const g = canvas.getContext("2d");
  if (!g) return url;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = /^data:image\/jpe?g/i.test(url) ? "image/jpeg" : "image/png";
  try {
    return canvas.toDataURL(type, 0.9);
  } catch (e) {
    return url;
  }
}
