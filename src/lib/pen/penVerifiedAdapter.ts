import { encode, writePesx, type PesxPath } from "./pen";
import { MOVE } from "../../formats/import/constants";

const MM = 10; // 0.1mm units per mm

/**
 * Adapter that drives the verified (pure-TS) pen encoder from the same
 * stitch array shape used by the conversion worker (`number[][]` of
 * `[x, y, cmd, colorIndex]`). Returns PEN bytes + bounds in the same
 * shape as `encodeStitchesToPen`.
 */
export function encodeStitchesToPenVerified(stitches: number[][]): {
  penBytes: number[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
} {
  // Track bounds (exclude MOVE stitches), matching encoder.ts semantics.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of stitches) {
    if (s[2] & MOVE) continue;
    minX = Math.min(minX, s[0]);
    maxX = Math.max(maxX, s[0]);
    minY = Math.min(minY, s[1]);
    maxY = Math.max(maxY, s[1]);
  }
  if (!isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }

  // Group stitches into per-color pesx paths.
  const paths: PesxPath[] = [];
  let current: PesxPath | null = null;
  let currentColor = -1;
  for (const s of stitches) {
    const colorIndex = s[3] ?? 0;
    if (!current || colorIndex !== currentColor) {
      current = { points: [], threadcode: "001", chartcode: 13, color: [0, 0, 0] };
      paths.push(current);
      currentColor = colorIndex;
    }
    current.points.push([s[0] / MM, s[1] / MM]);
  }

  const spanX = Math.max(1, (maxX - minX) / MM);
  const spanY = Math.max(1, (maxY - minY) / MM);
  const widthMm = Math.max(40, spanX + 20);
  const heightMm = Math.max(40, spanY + 20);

  const pesx = writePesx(paths, widthMm, heightMm);
  const result = encode(pesx);

  return {
    penBytes: Array.from(result.stream),
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
    },
  };
}
