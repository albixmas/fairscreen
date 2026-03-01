/**
 * LLM Extraction provider interface.
 * Pluggable: mock for dev/test, OpenAI-compatible for production.
 */

import type { ExtractionResult, EvidenceItem } from "@fairscreen/shared";

export interface ExtractionProvider {
  name: string;
  extract(text: string, pageMap?: Record<number, { start: number; end: number }>): Promise<{
    result: ExtractionResult;
    evidence: EvidenceItem[];
  }>;
}

export interface ExtractionProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
