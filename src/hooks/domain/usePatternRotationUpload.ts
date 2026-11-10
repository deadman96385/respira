import { useCallback } from "react";
import type { PesPatternData } from "../../formats/import/pesImporter";
import { preparePatternUpload } from "../../formats/pen/prepareUpload";
import { validatePenPlacement } from "../../formats/pen/validate";

export interface UsePatternRotationUploadParams {
  uploadPattern: (
    penData: Uint8Array,
    uploadedPesData: PesPatternData,
    fileName: string,
    patternOffset?: { x: number; y: number },
    patternRotation?: number,
    originalPesData?: PesPatternData,
  ) => Promise<void>;
  setUploadedPattern: (
    pesData: PesPatternData,
    offset: { x: number; y: number },
    fileName?: string,
  ) => void;
}

export interface UsePatternRotationUploadReturn {
  handleUpload: (
    pesData: PesPatternData,
    displayFileName: string,
    patternOffset: { x: number; y: number },
    patternRotation: number,
  ) => Promise<void>;
}

/**
 * Custom hook for handling pattern rotation transformation and upload
 *
 * Manages the complex rotation logic including:
 * - Stitch transformation with rotation
 * - PEN encoding/decoding for coordinate rounding
 * - Center shift calculation to maintain visual position
 * - Upload orchestration with proper caching
 *
 * Note: This hook operates on passed parameters rather than store state,
 * allowing it to be used as a callback handler. The center calculations
 * use the same helpers as the store selectors for consistency.
 *
 * @param params - Upload and store functions
 * @returns Upload handler function
 */
export function usePatternRotationUpload({
  uploadPattern,
  setUploadedPattern,
}: UsePatternRotationUploadParams): UsePatternRotationUploadReturn {
  const handleUpload = useCallback(
    async (
      pesData: PesPatternData,
      displayFileName: string,
      patternOffset: { x: number; y: number },
      patternRotation: number,
    ) => {
      const prepared = preparePatternUpload(
        pesData,
        patternRotation,
        patternOffset,
      );
      validatePenPlacement(prepared.pattern.penData, prepared.offset);
      await uploadPattern(
        prepared.pattern.penData,
        prepared.pattern,
        displayFileName,
        prepared.offset,
        patternRotation,
        pesData,
      );
      // A rejected or failed upload must not leave a phantom uploaded pattern.
      setUploadedPattern(prepared.pattern, prepared.offset);
    },
    [uploadPattern, setUploadedPattern],
  );

  return {
    handleUpload,
  };
}
