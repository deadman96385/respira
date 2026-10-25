// running.ts — running stitch expansion (TS port of pen/stitchgen/running.py)
export type Point = [number, number];

export function divideEqually(
  a: Point,
  b: Point,
  stitchLen: number,
  emitEnd = true,
): Point[] {
  if (stitchLen <= 0) return emitEnd ? [b] : [];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const n = Math.max(1, Math.floor(d / stitchLen));
  const out: Point[] = [];
  let last: Point = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const pt: Point = [a[0] + dx * t, a[1] + dy * t];
    if (pt[0] !== last[0] || pt[1] !== last[1]) {
      out.push(pt);
      last = pt;
    } else if (i === n && emitEnd) {
      out.push(pt);
    }
  }
  if (!emitEnd && out.length && out[out.length - 1][0] === b[0] && out[out.length - 1][1] === b[1]) {
    out.pop();
  }
  return out;
}

export function expandPolyline(points: Point[], stitchLen = 2.5): Point[] {
  if (points.length === 0) return [];
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = divideEqually(points[i], points[i + 1], stitchLen, true);
    if (seg.length && seg[0][0] === out[out.length - 1][0] && seg[0][1] === out[out.length - 1][1]) {
      seg.shift();
    }
    out.push(...seg);
  }
  return out;
}
