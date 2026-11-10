import { STITCH, MOVE, TRIM, STOP, END, COLOR_CHANGE } from "./constants";

export interface PesCommands {
  STITCH: number;
  JUMP: number;
  TRIM: number;
  STOP: number;
  END: number;
  COLOR_CHANGE: number;
  COMMAND_MASK: number;
}

/** PyStitch command IDs are enums, not combinable command bits. */
export function normalizePesCommands<T>(
  raw: number[][],
  sourceThreads: T[],
  commands: PesCommands,
): { stitches: number[][]; threads: T[]; stitchCount: number } {
  const stitches: number[][] = [];
  const threads: T[] = [];
  let sourceColor = 0;
  let step = 0;
  let stitchCount = 0;
  function thread(index: number): T {
    const value = sourceThreads[index];
    if (value === undefined) {
      throw new Error(
        `PES is missing thread information for color ${index + 1}`,
      );
    }
    return value;
  }
  if (raw.length) threads.push(thread(0));
  for (const [x, y, value] of raw) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isSafeInteger(value)
    ) {
      throw new Error("PES contains invalid stitch coordinates or commands");
    }
    const command = value & commands.COMMAND_MASK;
    const mapped =
      command === commands.STITCH
        ? STITCH
        : command === commands.JUMP
          ? MOVE
          : command === commands.TRIM
            ? TRIM
            : command === commands.STOP
              ? STOP
              : command === commands.END
                ? END
                : command === commands.COLOR_CHANGE
                  ? COLOR_CHANGE
                  : undefined;
    if (mapped === undefined) {
      throw new Error(
        `PES command ${command} is not supported by this machine encoder`,
      );
    }
    // Coincident commands and repeated needle placements are intentional data.
    stitches.push([x, y, mapped, step]);
    if (mapped === END) break;
    if (mapped === STITCH) stitchCount++;
    if (mapped === COLOR_CHANGE || mapped === STOP) {
      if (mapped === COLOR_CHANGE) sourceColor++;
      step++;
      // STOP resumes with the same thread in a distinct machine sewing step.
      threads.push(thread(sourceColor));
    }
  }
  return { stitches, threads, stitchCount };
}
