type Rect = { r: number; c: number; rs: number; cs: number };
type Node<T> = {
  center: number;
  starts: T[];
  ends: T[];
  left?: Node<T>;
  right?: Node<T>;
};

/** Geometry stays as ranges, including whole-column merges and large spills. */
export function sourceRangeLookup<T extends Rect>(
  ranges: T[]
): (r: number, c: number) => T | undefined {
  const build = (items: T[]): Node<T> | undefined => {
    if (!items.length) return undefined;
    const center = items[items.length >>> 1].r;
    const left: T[] = [],
      right: T[] = [],
      overlap: T[] = [];
    for (const item of items) {
      if (item.r + item.rs <= center) left.push(item);
      else if (item.r > center) right.push(item);
      else overlap.push(item);
    }
    return {
      center,
      starts: overlap,
      ends: overlap.slice().sort((a, b) => b.r + b.rs - (a.r + a.rs)),
      left: build(left),
      right: build(right),
    };
  };
  const root = build(
    ranges
      .filter((item) => item.rs > 0 && item.cs > 0)
      .sort((a, b) => a.r - b.r)
  );
  return (r, c) => {
    let node = root;
    while (node) {
      const before = r < node.center;
      for (const item of before ? node.starts : node.ends) {
        if (before ? item.r > r : item.r + item.rs <= r) break;
        if (c >= item.c && c < item.c + item.cs) return item;
      }
      node = before ? node.left : node.right;
    }
    return undefined;
  };
}
