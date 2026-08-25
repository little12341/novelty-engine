import type { CandidateGap, Competitor, Evidence, ResearchResult } from "../research/types.ts";

function citation(evidence: Evidence) {
  return {
    id: evidence.id, title: evidence.title, url: evidence.sourceUrl,
    publicationDate: evidence.publicationDate, confidence: evidence.confidence,
    sourceType: evidence.sourceType, sourceAssessment: evidence.sourceAssessment,
    duplicateSourceUrls: evidence.duplicateSourceUrls,
  };
}

function citationsFor(ids: string[], result: ResearchResult, limit = 12) {
  const wanted = new Set(ids);
  return result.sources.filter((item) => wanted.has(item.id)).slice(0, limit).map(citation);
}

function unknownCompetitorFields(competitor: Competitor) {
  const fields = ["name", "targetCustomer", "coreJobToBeDone", "pricing", "keyFeatures", "positioning", "likelyStrengths", "likelyWeaknesses"] as const;
  return fields.filter((field) => competitor[field].value === null);
}

export function summarizeGap(gap: CandidateGap, result: ResearchResult) {
  return {
    id: gap.id, rankScore: gap.score, confidence: gap.confidenceLabel,
    problem: gap.problemStatement, affectedSegment: gap.affectedSegment,
    currentWorkaround: gap.currentWorkaround, existingSolutions: gap.existingSolutions,
    whySolutionsFail: gap.whySolutionsFail, competitiveDensity: gap.competitiveDensity,
    willingnessToPaySignal: gap.willingnessToPaySignal,
    implementationDifficulty: gap.implementationDifficulty, timingSignal: gap.timingSignal,
    unknownFields: [
      !gap.affectedSegment && "affectedSegment", !gap.currentWorkaround && "currentWorkaround",
      !gap.willingnessToPaySignal && "willingnessToPaySignal",
      gap.implementationDifficulty === "unknown" && "implementationDifficulty", !gap.timingSignal && "timingSignal",
    ].filter(Boolean),
    supportingCitations: citationsFor(gap.supportingEvidenceIds, result),
    counterCitations: citationsFor(gap.counterEvidenceIds, result), penalties: gap.penalties,
  };
}

export function summarizeCompetitor(competitor: Competitor, result: ResearchResult) {
  return {
    id: competitor.id, name: competitor.name.value, website: competitor.website,
    targetCustomer: competitor.targetCustomer.value, coreJobToBeDone: competitor.coreJobToBeDone.value,
    pricing: competitor.pricing.value, keyFeatures: competitor.keyFeatures.value,
    positioning: competitor.positioning.value, likelyStrengths: competitor.likelyStrengths.value,
    likelyWeaknesses: competitor.likelyWeaknesses.value, unknownFields: unknownCompetitorFields(competitor),
    citations: citationsFor(competitor.evidenceIds, result),
  };
}

export function summarizeResearch(result: ResearchResult) {
  const evidenceIds = new Set<string>();
  const survivors = result.finalOpportunities.slice(0, 5).map((opportunity) => {
    opportunity.candidate.evidenceIds.forEach((id) => evidenceIds.add(id));
    opportunity.falsification.hypotheses.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]).forEach((id) => evidenceIds.add(id));
    return {
      candidateId: opportunity.candidate.id, name: opportunity.candidate.name,
      summary: opportunity.candidate.summary, targetCustomer: opportunity.candidate.targetCustomer,
      mechanism: opportunity.candidate.mechanism, opportunityScore: opportunity.score.score,
      confidence: opportunity.score.confidenceLabel, scoreIsHeuristic: opportunity.score.heuristic,
      falsification: {
        outcome: opportunity.falsification.outcome, survivalScore: opportunity.falsification.survivalScore,
        reason: opportunity.falsification.reason,
        unknownDimensions: opportunity.falsification.hypotheses.filter((item) => item.unknown).map((item) => item.dimension),
        decisiveRisks: opportunity.falsification.decisiveRisks,
      },
      evidenceIds: opportunity.candidate.evidenceIds,
      evidenceLineage: opportunity.lineage,
      decisionFactors: opportunity.score.decisionFactors,
      writtenReasoning: opportunity.score.writtenReasoning,
      validationExperiment: opportunity.validationExperiment,
    };
  });
  result.gaps.slice(0, 5).flatMap((gap) => [...gap.supportingEvidenceIds, ...gap.counterEvidenceIds]).forEach((id) => evidenceIds.add(id));
  return {
    schemaVersion: result.schemaVersion, runId: result.id, query: result.query, status: result.status,
    provider: result.provider, cache: result.cache, completedAt: result.completedAt,
    researchLandscape: result.output.researchLandscape,
    signals: result.output.signals,
    structuralGaps: result.output.structuralGaps.slice(0, 5).map((gap) => summarizeGap(gap, result)),
    candidateIdeas: result.output.candidateIdeas.slice(0, 12),
    rejectedIdeas: result.output.rejectedIdeas.slice(0, 12),
    survivors,
    evidenceLineage: result.output.evidenceLineage,
    decisiveRisks: result.output.decisiveRisks,
    validationTests: result.output.validationTests,
    mode: result.mode,
    companyProfile: result.companyProfile,
    researchRoles: result.roleOutputs,
    qualityCheckpoints: result.checkpoints,
    stopDecision: result.stopDecision,
    citations: citationsFor([...evidenceIds], result, 20), warnings: result.warnings,
    budgetUsage: result.budgetUsage,
    unknowns: survivors.length === 0 ? [result.stopDecision.status === "insufficient_evidence" ? "Insufficient evidence for a compelling opportunity; no candidate was forced." : "No opportunity survived the bounded falsification loop."] : [],
    retrievalHint: "Use get_research_run with include_full=true only when the full internal record is needed.",
  };
}

export function summarizeGaps(result: ResearchResult, limit: number) {
  return { runId: result.id, query: result.query, gaps: result.gaps.slice(0, limit).map((gap) => summarizeGap(gap, result)), warnings: result.warnings };
}

export function summarizeCompetitors(result: ResearchResult, limit: number) {
  return { runId: result.id, query: result.query, competitors: result.competitors.slice(0, limit).map((item) => summarizeCompetitor(item, result)), warnings: result.warnings };
}
