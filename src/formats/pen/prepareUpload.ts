import type { PesPatternData } from "../import/pesImporter";
import { transformStitchesRotation } from "../../utils/rotationUtils";
import { encodeStitchesToPen } from "./encoder";
import { decodePenData } from "./decoder";

/** The preview check and upload must use the same rounded command stream. */
export function preparePatternUpload(
  source: PesPatternData,
  rotation: number,
  offset: { x: number; y: number },
) {
  if (!Number.isFinite(rotation))
    throw new Error("Pattern rotation must be finite");
  const stitches = rotation
    ? transformStitchesRotation(source.stitches, rotation, source.bounds)
    : source.stitches;
  const penData = rotation
    ? new Uint8Array(encodeStitchesToPen(stitches).penBytes)
    : source.penData;
  const decoded = decodePenData(penData);
  const bounds = decoded.bounds;
  return {
    pattern: { ...source, stitches, penData, penStitches: decoded, bounds },
    offset: {
      x:
        offset.x +
        (bounds.minX + bounds.maxX - source.bounds.minX - source.bounds.maxX) /
          2,
      y:
        offset.y +
        (bounds.minY + bounds.maxY - source.bounds.minY - source.bounds.maxY) /
          2,
    },
  };
}
