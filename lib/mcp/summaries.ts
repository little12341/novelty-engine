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

function unknownCompetitorIntelligenceFields(competitor: Competitor) {
  return Object.entries(competitor.intelligence ?? {}).filter(([, value]) => value.value === null).map(([field]) => field);
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

export function summarizeCompetitor(competitor: Competitor, result: ResearchResult, candidateId?: string) {
  const similarity = result.similarities.find((item) => candidateId
    ? item.leftId === candidateId && item.rightId === competitor.id || item.rightId === candidateId && item.leftId === competitor.id
    : item.leftId === competitor.id || item.rightId === competitor.id) ?? null;
  return {
    id: competitor.id, canonicalOrganizationId: competitor.canonicalOrganizationId, canonicalDomain: competitor.canonicalDomain,
    name: competitor.name.value, website: competitor.website,
    targetCustomer: competitor.targetCustomer.value, coreJobToBeDone: competitor.coreJobToBeDone.value,
    pricing: competitor.pricing.value, keyFeatures: competitor.keyFeatures.value,
    positioning: competitor.positioning.value, likelyStrengths: competitor.likelyStrengths.value,
    likelyWeaknesses: competitor.likelyWeaknesses.value, relationship: competitor.relationship?.value ?? null,
    classification: competitor.classification, sourcePageIds: competitor.sourcePageIds,
    similarity: similarity ? {
      candidateId: candidateId ?? (result.candidates.some((item) => item.id === similarity.leftId) ? similarity.leftId : similarity.rightId),
      score: similarity.score, matchedDimensions: similarity.matchingDimensions,
      unmatchedDimensions: similarity.nonMatchingDimensions ?? [], dimensionScores: similarity.dimensionScores ?? {}, explanation: similarity.explanation,
    } : null,
    unknownFields: unknownCompetitorFields(competitor),
    intelligence: competitor.intelligence,
    unknownIntelligenceFields: unknownCompetitorIntelligenceFields(competitor),
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
      definition: opportunity.candidate.definition,
      mechanism: opportunity.candidate.mechanism, opportunityScore: opportunity.score.score,
      confidence: opportunity.score.confidenceLabel, scoreIsHeuristic: opportunity.score.heuristic,
      falsification: {
        outcome: opportunity.falsification.outcome, survivalScore: opportunity.falsification.survivalScore,
        reason: opportunity.falsification.reason,
        unknownDimensions: opportunity.falsification.hypotheses.filter((item) => item.unknown).map((item) => item.dimension),
        decisiveRisks: opportunity.falsification.decisiveRisks,
        closestCompetitorSimilarity: opportunity.falsification.residualUnmetDemand.closestCompetitorSimilarity,
        closestCompetitorDimensions: opportunity.nearestAnalogues[0] ? {
          competitorId: opportunity.nearestAnalogues[0].rightId,
          matched: opportunity.nearestAnalogues[0].matchingDimensions,
          unmatched: opportunity.nearestAnalogues[0].nonMatchingDimensions ?? [],
          scores: opportunity.nearestAnalogues[0].dimensionScores ?? {},
        } : null,
        searchCoverage: opportunity.falsification.searchCoverage,
      },
      evidenceIds: opportunity.candidate.evidenceIds,
      evidenceLineage: opportunity.lineage,
      decisionFactors: opportunity.score.decisionFactors,
      evidenceConfidence: opportunity.score.evidenceConfidence,
      noveltyScore: opportunity.score.noveltyScore,
      structuredScorecard: opportunity.score.scorecard,
      intelligenceScores: opportunity.score.intelligence,
      writtenReasoning: opportunity.score.writtenReasoning,
      validationExperiment: opportunity.validationExperiment,
      lifecycle: opportunity.lifecycle,
      evidenceGate: opportunity.evidenceGate,
      assumptionLedger: opportunity.assumptionLedger,
      whyNotBuilt: opportunity.whyNotBuilt,
      adversarialReview: opportunity.adversarialReview,
      validationPlan: opportunity.validationPlan,
    };
  });
  result.gaps.slice(0, 5).flatMap((gap) => [...gap.supportingEvidenceIds, ...gap.counterEvidenceIds]).forEach((id) => evidenceIds.add(id));
  return {
    schemaVersion: result.schemaVersion, engineVersion: result.engineVersion, depth: result.depth, runId: result.id, query: result.query, status: result.status,
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
    taskGraph: result.taskGraph,
    searchBranches: result.searchBranches,
    competitorRecall: result.competitorRecall,
    candidateIdMapping: result.candidateIdMapping,
    candidateLifecycles: result.candidateLifecycles,
    nextBestAction: result.nextBestAction,
    stopDecision: result.stopDecision,
    citations: citationsFor([...evidenceIds], result, 20), warnings: result.warnings,
    budgetUsage: result.budgetUsage,
    citationCoverage: result.citationCoverage,
    unknowns: survivors.length === 0 ? [result.stopDecision.status === "insufficient_evidence" ? "Insufficient evidence for a compelling opportunity; no candidate was forced." : result.budgetUsage.exhausted ? "No opportunity survived after the configured retrieval and expansion budget was exhausted." : "No opportunity survived in the branches searched so far; this is not an exhaustive market rejection."] : [],
    retrievalHint: "Use get_research_run with include_full=true only when the full internal record is needed.",
  };
}

export function summarizeGaps(result: ResearchResult, limit: number, cursor = 0) {
  const gaps = result.gaps.slice(cursor, cursor + limit).map((gap) => summarizeGap(gap, result));
  return { runId: result.id, query: result.query, gaps, cursor, nextCursor: cursor + gaps.length < result.gaps.length ? cursor + gaps.length : null, total: result.gaps.length, warnings: result.warnings };
}

export function summarizeCompetitors(result: ResearchResult, limit: number, cursor = 0, candidateId?: string) {
  const competitors = result.competitors.slice(cursor, cursor + limit).map((item) => summarizeCompetitor(item, result, candidateId));
  const sourceRelationships = result.sources.reduce<Record<string, number>>((counts, item) => {
    counts[item.pageIdentity.relationship] = (counts[item.pageIdentity.relationship] ?? 0) + 1;
    return counts;
  }, {});
  return {
    runId: result.id, query: result.query, candidateId: candidateId ?? null, competitors,
    counts: {
      directCompetitors: result.competitors.filter((item) => item.classification === "direct_competitor").length,
      substitutes: result.competitors.filter((item) => item.classification === "substitute").length,
      normalizedEntities: result.competitors.length,
      sourceRelationships,
    },
    closestCompetitorSimilarity: candidateId ? result.similarities.filter((item) => item.leftId === candidateId || item.rightId === candidateId)
      .filter((item) => result.competitors.some((competitor) => competitor.id === item.leftId || competitor.id === item.rightId))
      .sort((a, b) => b.score - a.score)[0] ?? null : null,
    cursor, nextCursor: cursor + competitors.length < result.competitors.length ? cursor + competitors.length : null,
    total: result.competitors.length, warnings: result.warnings,
  };
}
