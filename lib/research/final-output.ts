import type {
  CandidateGap, Competitor, Evidence, FinalOutputSchema, FinalOpportunity, IdeaCandidate,
  IdeaLineage, RejectedIdea, ResearchCoverage, SourceType, StopDecision, ValidationExperiment, WeakSignal,
} from "./types.ts";
import { classifyClaim } from "./quality.ts";

export function buildFinalOutput(input: {
  evidence: Evidence[]; competitors: Competitor[]; gaps: CandidateGap[]; signals: WeakSignal[];
  candidates: IdeaCandidate[]; rejectedIdeas: RejectedIdea[]; survivors: FinalOpportunity[];
  lineages: IdeaLineage[]; validationExperiments: ValidationExperiment[];
  coverage: ResearchCoverage; stopDecision: StopDecision;
}): FinalOutputSchema {
  const sourceTypeCounts = input.evidence.reduce((counts, item) => {
    counts[item.sourceType] = (counts[item.sourceType] ?? 0) + 1;
    return counts;
  }, {} as Partial<Record<SourceType, number>>);
  const survivorIds = new Set(input.survivors.map((item) => item.candidate.id));
  return {
    researchLandscape: {
      coverage: input.coverage,
      competitors: input.competitors.slice(0, 10).map((item) => ({
        id: item.id, name: item.name.value, website: item.website, classification: item.classification, canonicalDomain: item.canonicalDomain,
        claimStatus: classifyClaim(item.evidenceIds, input.evidence), evidenceIds: item.evidenceIds,
      })),
      sourceTypeCounts,
    },
    signals: input.signals.slice(0, 10).map((item) => ({ id: item.id, label: item.label, status: classifyClaim(item.evidenceIds, input.evidence), evidenceIds: item.evidenceIds })),
    structuralGaps: input.gaps.filter((item) => item.confidenceLabel !== "speculative opportunity").slice(0, 8),
    candidateIdeas: input.candidates.slice(0, 30).map((item) => ({ candidateId: item.id, name: item.name, mechanismFamily: item.mechanismFamily, status: survivorIds.has(item.id) ? "survivor" : "rejected" })),
    rejectedIdeas: input.rejectedIdeas.slice(0, 20),
    survivors: input.survivors,
    evidenceLineage: input.lineages.filter((item) => survivorIds.has(item.candidateId)),
    decisiveRisks: input.survivors.map((item) => ({ candidateId: item.candidate.id, risks: item.falsification.decisiveRisks })),
    validationTests: input.validationExperiments.filter((item) => survivorIds.has(item.candidateId)),
    stopDecision: input.stopDecision,
  };
}
