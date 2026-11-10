import { useMemo } from "react";
import type { PesPatternData } from "../../formats/import/pesImporter";
import type { MachineInfo } from "../../types/machine";
import { preparePatternUpload } from "../../formats/pen/prepareUpload";
import { validatePenPlacement } from "../../formats/pen/validate";

export interface PatternBoundsCheckResult {
  fits: boolean;
  error: string | null;
}

export interface UsePatternValidationParams {
  pesData: PesPatternData | null;
  machineInfo: MachineInfo | null;
  patternOffset: { x: number; y: number };
  patternRotation: number;
}

/**
 * Custom hook for validating pattern bounds against hoop size
 *
 * Checks if the pattern (with rotation and offset applied) fits within
 * the machine's hoop bounds and provides detailed error messages if not.
 *
 * @param params - Pattern and machine configuration
 * @returns Bounds check result with fit status and error message
 */
export function usePatternValidation({
  pesData,
  machineInfo,
  patternOffset,
  patternRotation,
}: UsePatternValidationParams): PatternBoundsCheckResult {
  // Memoize the bounds check calculation to avoid unnecessary recalculations
  return useMemo((): PatternBoundsCheckResult => {
    if (!pesData || !machineInfo) {
      return { fits: true, error: null };
    }

    try {
      const prepared = preparePatternUpload(
        pesData,
        patternRotation,
        patternOffset,
      );
      validatePenPlacement(
        prepared.pattern.penData,
        prepared.offset,
        machineInfo,
      );
      return { fits: true, error: null };
    } catch (error) {
      return {
        fits: false,
        error:
          error instanceof Error ? error.message : "Invalid encoded pattern",
      };
    }
  }, [pesData, machineInfo, patternOffset, patternRotation]);
}
