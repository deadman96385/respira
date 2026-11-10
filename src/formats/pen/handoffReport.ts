import type { PesPatternData } from "../import/pesImporter";
import { preparePatternUpload } from "./prepareUpload";
import { validatePenPlacement } from "./validate";

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

/** A checked transfer snapshot, not evidence that the machine has sewn it. */
export async function createHandoffReport(
  source: PesPatternData,
  rotationDegrees: number,
  offset: { x: number; y: number },
) {
  if (!source.sourcePesSha256)
    throw new Error("Reimport the PES to record its source identity");
  const prepared = preparePatternUpload(source, rotationDegrees, offset);
  const placement = validatePenPlacement(
    prepared.pattern.penData,
    prepared.offset,
  );
  const records = prepared.pattern.penStitches.stitches;
  let binary = "";
  for (const byte of prepared.pattern.penData)
    binary += String.fromCharCode(byte);
  return {
    version: 1,
    kind: "respira-handoff",
    encodingVersion: 2,
    coordinateUnitMm: 0.1,
    sourcePesSha256: source.sourcePesSha256,
    penSha256: await sha256(prepared.pattern.penData),
    penBase64: btoa(binary),
    sourceBounds: source.bounds,
    rotationDegrees,
    offset: prepared.offset,
    placement,
    counts: {
      records: records.length,
      needles: records.filter((s) => !s.isFeed && !s.isCut && !s.isColorEnd)
        .length,
      cuts: records.filter((s) => s.isCut).length,
      pauses: records.filter((s) => s.isColorEnd).length,
    },
    createdAt: new Date().toISOString(),
    uploadConfirmed: false,
    physicalSewOut: "unsewn",
  };
}
