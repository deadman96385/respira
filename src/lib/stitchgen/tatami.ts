// tatami.ts — tatami fill stitch expansion (TS port)
export type Point = [number, number];

function rotate(p: Point, ang: number): Point {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
}
function unrotate(p: Point, ang: number): Point {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

export function expandTatami(polygon: Point[], angleDeg = 0, rowSpacing = 0.4, stitchLen = 3.0): Point[] {
  if (polygon.length < 3) return [];
  const ang = (angleDeg * Math.PI) / 180;
  const rpoly = polygon.map((p) => rotate(p, ang));
  const ys = rpoly.map((p) => p[1]);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const segs = rpoly.map((p, i) => [p, rpoly[(i + 1) % rpoly.length]] as [Point, Point]);
  function intersectHorizontal(y: number): number[] {
    const xs: number[] = [];
    for (const [a, b] of segs) {
      if ((a[1] <= y && y < b[1]) || (b[1] <= y && y < a[1])) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + (b[0] - a[0]) * t);
      }
    }
    xs.sort((u, v) => u - v);
    return xs;
  }
  const out: Point[] = [];
  let y = ymin;
  while (y <= ymax + 1e-9) {
    const xs = intersectHorizontal(y);
    let i = 0;
    while (i + 1 < xs.length) {
      const x0 = xs[i], x1 = xs[i + 1];
      const n = Math.max(1, Math.floor((x1 - x0) / stitchLen));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        out.push(unrotate([x0 + (x1 - x0) * t, y], ang));
      }
      i += 2;
    }
    y += rowSpacing;
  }
  return out;
}
