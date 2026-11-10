import { decodePenData } from "./decoder";

export interface PenPlacement {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  moveX: number;
  moveY: number;
}

/** Validate the bytes that will be sent, before deleting the machine's pattern. */
export function validatePenPlacement(
  bytes: Uint8Array,
  offset?: { x: number; y: number },
  hoop = { maxWidth: 1000, maxHeight: 1000 },
): PenPlacement {
  const decoded = decodePenData(bytes);
  const records = decoded.stitches;
  if (
    records.filter((s) => s.isDataEnd).length !== 1 ||
    !records.at(-1)?.isDataEnd
  ) {
    throw new Error(
      "Pattern must end exactly once at its final encoded command",
    );
  }
  if (
    records.some(
      (s) =>
        ![0, 3, 5].includes(s.xFlags) ||
        s.yFlags > 3 ||
        (s.isColorEnd && (!s.isCut || s.isFeed)),
    )
  ) {
    throw new Error("Pattern contains unsupported PEN command flags");
  }
  if (!records.some((s) => !s.isFeed && !s.isCut && !s.isColorEnd)) {
    throw new Error("Pattern has no needle placements");
  }
  const bounds = decoded.bounds;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const moveX = Math.round((offset?.x ?? 0) - centerX);
  const moveY = Math.round((offset?.y ?? 0) - centerY);
  if (
    ![moveX, moveY, hoop.maxWidth, hoop.maxHeight].every(Number.isFinite) ||
    hoop.maxWidth <= 0 ||
    hoop.maxHeight <= 0
  ) {
    throw new Error("Pattern placement and hoop size must be finite");
  }
  const limits = [
    ["left", -hoop.maxWidth / 2 - (bounds.minX + moveX)],
    ["right", bounds.maxX + moveX - hoop.maxWidth / 2],
    ["top", -hoop.maxHeight / 2 - (bounds.minY + moveY)],
    ["bottom", bounds.maxY + moveY - hoop.maxHeight / 2],
  ] as const;
  const outside = limits.filter(([, excess]) => excess > 0);
  if (outside.length) {
    throw new Error(
      `Encoded pattern exceeds hoop bounds: ${outside
        .map(([side, excess]) => `${side} by ${(excess / 10).toFixed(1)} mm`)
        .join(", ")}. Adjust position or size before uploading.`,
    );
  }
  return { bounds, moveX, moveY };
}
