import { MOVE, TRIM, COLOR_CHANGE, STOP, END } from "../import/constants";
import { decodePenData } from "./decoder";

export interface PenEncodingResult {
  penBytes: number[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/** Coordinates are signed 13-bit values in 0.1 mm units. */
export function encodeStitchPosition(x: number, y: number): number[] {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.round(x) < -4096 ||
    Math.round(x) > 4095 ||
    Math.round(y) < -4096 ||
    Math.round(y) > 4095
  )
    throw new Error("Pattern coordinates exceed the PEN coordinate range");
  const a = (Math.round(x) << 3) & 0xffff;
  const b = (Math.round(y) << 3) & 0xffff;
  return [a & 255, a >> 8, b & 255, b >> 8];
}

/**
 * Preserve authored needle placements, jumps and cuts. PES already contains its
 * securing stitches; adding locks or cutting long jumps changes the inspected
 * plan. STOP pauses with the same thread using a PEN color-boundary marker.
 */
export function encodeStitchesToPen(stitches: number[][]): PenEncodingResult {
  const bytes: number[] = [];
  let previous: [number, number] | null = null;
  let currentColor = stitches[0]?.[3] ?? 0;
  let entering = false;
  let boundaryCutAvailable = false;
  function append(x: number, y: number, xFlags = 0, yFlags = 0) {
    const point = encodeStitchPosition(x, y);
    point[0] |= xFlags;
    point[2] |= yFlags;
    bytes.push(...point);
    previous = [Math.round(x), Math.round(y)];
  }
  function boundary(x: number, y: number) {
    // An adjacent authored trim can share the boundary's cut record.
    if (
      bytes.length >= 4 &&
      previous?.[0] === Math.round(x) &&
      previous?.[1] === Math.round(y) &&
      (bytes[bytes.length - 2] & 7) === 2 &&
      (bytes[bytes.length - 4] & 7) === 0
    ) {
      bytes[bytes.length - 4] |= 3;
      boundaryCutAvailable = false;
    } else {
      append(x, y, 3, 2);
      boundaryCutAvailable = true;
    }
    entering = true;
  }
  for (const row of stitches) {
    const [x, y, command, color] = row;
    if (
      row.length < 4 ||
      !Number.isSafeInteger(command) ||
      !Number.isSafeInteger(color) ||
      color < 0 ||
      ![0, MOVE, TRIM, MOVE | TRIM, COLOR_CHANGE, STOP, END].includes(command)
    ) {
      throw new Error("Pattern contains an invalid embroidery command");
    }
    encodeStitchPosition(x, y);
    if (command & END) break;
    if (command === COLOR_CHANGE || command === STOP) {
      boundary(x, y);
      currentColor = color + 1;
      continue;
    }
    // Older cached patterns express boundaries only through their color index.
    if (color !== currentColor) {
      if (previous) boundary(previous[0], previous[1]);
      currentColor = color;
    }
    if (entering && command === 0) {
      if (
        previous &&
        (previous[0] !== Math.round(x) || previous[1] !== Math.round(y))
      ) {
        append(x, y, 0, 1);
      }
      entering = false;
    }
    // Ink/Stitch PES commonly writes COLOR_CHANGE then TRIM. PEN requires
    // these flags together, so consume that one authored trim at the boundary.
    if (
      command === TRIM &&
      boundaryCutAvailable &&
      previous?.[0] === Math.round(x) &&
      previous?.[1] === Math.round(y)
    ) {
      boundaryCutAvailable = false;
      continue;
    }
    boundaryCutAvailable = false;
    append(x, y, 0, (command & MOVE ? 1 : 0) | (command & TRIM ? 2 : 0));
    if (command & MOVE) entering = false;
  }
  if (!bytes.length) {
    return { penBytes: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }
  // End is a flag on the final record, never another needle penetration. Keep
  // a final pause intact by following it with a non-sewing end record.
  if ((bytes[bytes.length - 4] & 7) === 3)
    append(previous![0], previous![1], 5, 1);
  else bytes[bytes.length - 4] |= 5;
  return {
    penBytes: bytes,
    bounds: decodePenData(new Uint8Array(bytes)).bounds,
  };
}
