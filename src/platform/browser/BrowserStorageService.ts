import { PatternCacheService } from "../../services/PatternCacheService";
import type {
  IStorageService,
  ICachedPattern,
} from "../interfaces/IStorageService";
import type { PesPatternData } from "../../formats/import/pesImporter";
import { createWorkspaceStorage } from "../../services/WorkspaceStorage";

const UPLOADED_PATTERN_KEY = "respira-uploaded-pattern-v1";

/**
 * Durable browser pattern cache, with reads from the older localStorage cache.
 */
export class BrowserStorageService implements IStorageService {
  private storage = createWorkspaceStorage<ICachedPattern>();
  async savePattern(
    uuid: string,
    pesData: PesPatternData,
    fileName: string,
    patternOffset?: { x: number; y: number },
    patternRotation?: number,
    uploadedPesData?: PesPatternData,
  ): Promise<void> {
    await this.storage.setItem(UPLOADED_PATTERN_KEY, {
      state: {
        uuid,
        pesData,
        fileName,
        patternOffset,
        patternRotation,
        uploadedPesData,
        timestamp: Date.now(),
      },
      version: 1,
    });
  }

  async getPatternByUUID(uuid: string): Promise<ICachedPattern | null> {
    const cached = (await this.storage.getItem(UPLOADED_PATTERN_KEY))?.state;
    return cached?.uuid === uuid
      ? cached
      : PatternCacheService.getPatternByUUID(uuid);
  }

  async getMostRecentPattern(): Promise<ICachedPattern | null> {
    return (
      (await this.storage.getItem(UPLOADED_PATTERN_KEY))?.state ??
      PatternCacheService.getMostRecentPattern()
    );
  }

  async hasPattern(uuid: string): Promise<boolean> {
    return !!(await this.getPatternByUUID(uuid));
  }

  async deletePattern(uuid: string): Promise<void> {
    const cached = (await this.storage.getItem(UPLOADED_PATTERN_KEY))?.state;
    if (cached?.uuid === uuid)
      await this.storage.removeItem(UPLOADED_PATTERN_KEY);
    PatternCacheService.deletePattern(uuid);
  }

  async clearCache(): Promise<void> {
    await this.storage.removeItem(UPLOADED_PATTERN_KEY);
    PatternCacheService.clearCache();
  }

  async getCacheInfo(): Promise<{
    hasCache: boolean;
    fileName?: string;
    uuid?: string;
    age?: number;
  }> {
    const cached = await this.getMostRecentPattern();
    return cached
      ? {
          hasCache: true,
          fileName: cached.fileName,
          uuid: cached.uuid,
          age: Date.now() - cached.timestamp,
        }
      : { hasCache: false };
  }
}
