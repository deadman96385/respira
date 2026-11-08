import { useMemo } from "react";
import type { PesPatternData } from "../formats/import/pesImporter";
import { calculatePatternTime } from "../utils/timeCalculation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface PatternInfoProps {
  pesData: PesPatternData;
  showThreadBlocks?: boolean;
}

export function PatternInfo({
  pesData,
  showThreadBlocks = false,
}: PatternInfoProps) {
  const estimates = useMemo(() => estimatePattern(pesData), [pesData]);

  return (
    <>
      <TooltipProvider>
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-gray-200 dark:bg-gray-700/50 p-2 rounded cursor-help">
                <span className="text-gray-600 dark:text-gray-400 block">
                  Size
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {((pesData.bounds.maxX - pesData.bounds.minX) / 10).toFixed(
                    1,
                  )}{" "}
                  x{" "}
                  {((pesData.bounds.maxY - pesData.bounds.minY) / 10).toFixed(
                    1,
                  )}{" "}
                  mm
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Pattern dimensions (width × height)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-gray-200 dark:bg-gray-700/50 p-2 rounded cursor-help">
                <span className="text-gray-600 dark:text-gray-400 block">
                  Stitches
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {pesData.penStitches?.stitches.length.toLocaleString() ||
                    pesData.stitchCount.toLocaleString()}
                  {pesData.penStitches &&
                    pesData.penStitches.stitches.length !==
                      pesData.stitchCount && (
                      <span
                        className="text-gray-500 dark:text-gray-500 font-normal ml-1"
                        title="Input stitch count from PES file (lock stitches were added for machine compatibility)"
                      >
                        ({pesData.stitchCount.toLocaleString()})
                      </span>
                    )}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                {pesData.penStitches &&
                pesData.penStitches.stitches.length !== pesData.stitchCount
                  ? `Total stitches including lock stitches. Original file had ${pesData.stitchCount.toLocaleString()} stitches.`
                  : "Total number of stitches in the pattern"}
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-gray-200 dark:bg-gray-700/50 p-2 rounded cursor-help">
                <span className="text-gray-600 dark:text-gray-400 block">
                  {showThreadBlocks ? "Colors / Blocks" : "Colors"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {showThreadBlocks
                    ? `${pesData.uniqueColors.length} / ${pesData.threads.length}`
                    : pesData.uniqueColors.length}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {showThreadBlocks
                  ? `${pesData.uniqueColors.length} unique ${pesData.uniqueColors.length === 1 ? "color" : "colors"} across ${pesData.threads.length} thread ${pesData.threads.length === 1 ? "block" : "blocks"}`
                  : `${pesData.uniqueColors.length} unique ${pesData.uniqueColors.length === 1 ? "color" : "colors"} in the pattern`}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {estimates && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="bg-gray-200 dark:bg-gray-700/50 p-2 rounded">
            <span className="text-gray-600 dark:text-gray-400 block">
              Est. time
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              ~{estimates.minutes} min
            </span>
          </div>
          <div className="bg-gray-200 dark:bg-gray-700/50 p-2 rounded">
            <span className="text-gray-600 dark:text-gray-400 block">
              Thread
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              ~{(estimates.threadMm / 1000).toFixed(1)} m
            </span>
          </div>
        </div>
      )}

      <Separator className="mb-3" />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          Colors:
        </span>
        <TooltipProvider>
          <div className="flex gap-1">
            {pesData.uniqueColors.slice(0, 8).map((color, idx) => {
              // Primary metadata: brand and catalog number
              const primaryMetadata = [
                color.brand,
                color.catalogNumber ? `#${color.catalogNumber}` : null,
              ]
                .filter(Boolean)
                .join(" ");

              // Secondary metadata: chart and description
              // Only show chart if it's different from catalogNumber
              const secondaryMetadata = [
                color.chart && color.chart !== color.catalogNumber
                  ? color.chart
                  : null,
                color.description,
              ]
                .filter(Boolean)
                .join(" ");

              const metadata = [primaryMetadata, secondaryMetadata]
                .filter(Boolean)
                .join(" • ");

              // Show which thread blocks use this color in PatternSummaryCard
              const threadNumbers = color.threadIndices
                .map((i) => i + 1)
                .join(", ");
              const tooltipText = showThreadBlocks
                ? metadata
                  ? `Color ${idx + 1}: ${color.hex} - ${metadata}`
                  : `Color ${idx + 1}: ${color.hex}`
                : metadata
                  ? `Color ${idx + 1}: ${color.hex}\n${metadata}\nUsed in thread blocks: ${threadNumbers}`
                  : `Color ${idx + 1}: ${color.hex}\nUsed in thread blocks: ${threadNumbers}`;

              return (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div
                      className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 cursor-help"
                      style={{ backgroundColor: color.hex }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs whitespace-pre-line">{tooltipText}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {pesData.uniqueColors.length > 8 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 leading-none cursor-help">
                    +{pesData.uniqueColors.length - 8}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {pesData.uniqueColors.length - 8} more{" "}
                    {pesData.uniqueColors.length - 8 === 1 ? "color" : "colors"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </>
  );
}

/**
 * Sew time and top-thread estimates for the machine stitch stream.
 * Time uses the same per-block formula as the Brother app (see timeCalculation).
 */
function estimatePattern(pesData: PesPatternData) {
  const pen = pesData.penStitches;
  if (!pen || pen.stitches.length === 0) return null;

  const { totalMinutes } = calculatePatternTime(
    pen.colorBlocks.map((b) => ({
      stitchCount: b.endStitchIndex - b.startStitchIndex + 1,
    })),
    0,
  );

  // Thread used by sewn stitches (jumps are trimmed, so they don't count),
  // plus 10% for take-up. Coordinates are in 0.1 mm.
  let threadMm = 0;
  for (let i = 1; i < pen.stitches.length; i++) {
    const cur = pen.stitches[i];
    if (cur.isFeed) continue;
    const prev = pen.stitches[i - 1];
    threadMm += Math.hypot(cur.x - prev.x, cur.y - prev.y) / 10;
  }

  return { minutes: totalMinutes, threadMm: threadMm * 1.1 };
}
