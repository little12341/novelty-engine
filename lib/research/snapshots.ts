import { classifyClaim } from "./quality.ts";
import type { Evidence, EvidenceSnapshot, ResearchCoverage } from "./types.ts";

export function createEvidenceSnapshot(evidence: Evidence[], coverage: ResearchCoverage, capturedAt: string): EvidenceSnapshot {
  return {
    schemaVersion: "1.0",
    capturedAt,
    evidence: structuredClone(evidence),
    normalizedClaims: evidence.map((item) => ({
      evidenceId: item.id,
      claim: item.summary,
      status: classifyClaim([item.id], evidence),
      sourceAssessment: structuredClone(item.sourceAssessment),
    })),
    duplicateWarnings: evidence.filter((item) => item.duplicateSourceUrls.length > 0).map((item) => ({
      evidenceId: item.id,
      duplicateSourceUrls: [...item.duplicateSourceUrls],
    })),
    missingSourceFamilyWarnings: [...coverage.missingCriticalSourceFamilies],
  };
}
