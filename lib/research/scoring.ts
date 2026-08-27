import type { CandidateGap, ClaimStatus, Evidence, FalsificationResult, GraphHole, IdeaCandidate, OpportunityScore, OpportunityScoreFactors, ResearchUserContext, ScoreFactorAssessment, SimilarityResult, WeakSignal, WorkflowStitchingPattern } from "./types.ts";
import { clamp } from "./utils.ts";
import { independentEvidenceCount } from "./quality.ts";
import { buildDecisionIntelligence, buildEvidenceConfidence, buildNoveltyScore, buildStructuredScorecard } from "./intelligence.ts";

export function scoreOpportunity(candidate: IdeaCandidate, input: {
  gaps: CandidateGap[]; holes: GraphHole[]; stitching: WorkflowStitchingPattern[]; signals: WeakSignal[];
  similarities: SimilarityResult[]; falsification: FalsificationResult; evidence: Evidence[]; competitorIds?: string[];
  founderContext?: ResearchUserContext;
}): OpportunityScore {
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const hole = input.holes.find((item) => candidate.sourceGraphHoleIds.includes(item.id));
  const stitch = input.stitching.find((item) => candidate.sourceStitchingIds.includes(item.id));
  const signal = input.signals.find((item) => candidate.sourceSignalIds.includes(item.id));
  const competitorIds = new Set(input.competitorIds ?? []);
  const competitorComparisons = input.similarities.filter((item) => (item.leftId === candidate.id && competitorIds.has(item.rightId)) || (item.rightId === candidate.id && competitorIds.has(item.leftId)));
  const nearest = competitorComparisons.reduce((max, item) => Math.max(max, item.score), 0);
  const competitorCheckComplete = competitorComparisons.length > 0;
  const factors: OpportunityScoreFactors = {
    marketGapStrength: clamp((gap?.score ?? 20) / 10), complaintRecurrence: gap?.scoreFactors.complaintRecurrence ?? 1,
    severity: gap?.scoreFactors.painSeverity ?? 2, willingnessToPay: gap?.scoreFactors.willingnessToPay ?? stitch?.scoreFactors.willingnessToPay ?? 2,
    competitorWeakness: gap?.scoreFactors.currentSolutionWeakness ?? 3, saturation: gap ? 10 - ({ low: 2, medium: 5, high: 8, unknown: 6 }[gap.competitiveDensity]) : 3,
    noveltyDistance: competitorCheckComplete ? clamp((1 - nearest) * 10) : 2, weakSignalStrength: signal ? clamp((signal.recency + signal.recurrence) / 2) : 2,
    feasibility: /hardware|sensor|robot/i.test(candidate.technology ?? "") ? 5 : 7,
    distributionAccessibility: gap?.scoreFactors.distributionAccessibility ?? 4,
    defensibility: competitorCheckComplete
      ? Math.min(gap?.scoreFactors.defensibility ?? 4, clamp((1 - nearest) * 10))
      : gap?.scoreFactors.defensibility ?? 4,
    timing: signal ? clamp((signal.recency + (hole?.strength ?? 4)) / 2) : gap?.scoreFactors.timing ?? 3,
    falsificationSurvival: input.falsification.survivalScore / 10,
  };
  const weights: Record<keyof OpportunityScoreFactors, number> = {
    marketGapStrength: .13, complaintRecurrence: .08, severity: .08, willingnessToPay: .08,
    competitorWeakness: .07, saturation: .06, noveltyDistance: .10, weakSignalStrength: .06,
    feasibility: .08, distributionAccessibility: .07, defensibility: .06, timing: .06, falsificationSurvival: .07,
  };
  const penalties: OpportunityScore["penalties"] = [];
  if (candidate.evidenceIds.length === 0) penalties.push({ code: "no_evidence", points: 20, reason: "No retrieved evidence supports the candidate lineage." });
  if (!competitorCheckComplete) penalties.push({ code: "competitor_check_unresolved", points: 12, reason: "No competitor fingerprint could be compared; absence of a retrieved competitor is not novelty evidence." });
  if (nearest >= 0.72) penalties.push({ code: "near_duplicate", points: 18, reason: "A close competitor fingerprint reduces differentiation and defensibility; it is decisive only if the residual-demand assessment also shows the same job is already adequately solved for the same user." });
  if (input.falsification.outcome === "rejected") penalties.push({ code: "failed_falsification", points: 30, reason: input.falsification.reason });
  let score = Object.entries(weights).reduce((sum, [key, weight]) => sum + factors[key as keyof OpportunityScoreFactors] * weight, 0) * 10;
  score -= penalties.reduce((sum, penalty) => sum + penalty.points, 0);
  const confidenceLabel = gap?.confidenceLabel === "evidence-backed market gap" && candidate.evidenceIds.length >= 3 ? "evidence-backed" : candidate.evidenceIds.length >= 2 ? "plausible" : "speculative";
  const factor = (value: number, ids: string[], rationale: string, status: ClaimStatus = ids.length ? "INFERRED" : "UNKNOWN"): ScoreFactorAssessment => ({
    score: Math.round(clamp(value, 0, 10) * 10) / 10, status, rationale, evidenceIds: [...new Set(ids)],
  });
  const hypothesis = (dimension: string) => input.falsification.hypotheses.find((item) => item.dimension === dimension);
  const economic = hypothesis("economics"); const regulatory = hypothesis("regulation");
  const demandIds = gap?.supportingEvidenceIds ?? [];
  const evidenceStrength = clamp(independentEvidenceCount(candidate.evidenceIds, input.evidence) * 2
    + input.evidence.filter((item) => candidate.evidenceIds.includes(item.id)).reduce((sum, item) => sum + item.sourceAssessment.overallWeight, 0) / Math.max(1, candidate.evidenceIds.length) * 4);
  const decisionFactors: OpportunityScore["decisionFactors"] = {
    evidenceStrength: factor(evidenceStrength, candidate.evidenceIds, "Combines quality-weighted evidence with independent provenance groups; syndicated copies do not add independent strength."),
    demandSignal: factor((factors.complaintRecurrence + factors.severity + factors.willingnessToPay) / 3, demandIds, "Uses repeated pain, severity, and explicit payment/cost signals; complaints alone are not treated as validated demand."),
    noveltyDifferentiation: factor(factors.noveltyDistance, competitorCheckComplete ? gap?.counterEvidenceIds ?? [] : [], competitorCheckComplete ? `Mechanism-level distance from retrieved competitors and substitutes, interpreted alongside the explicit residual-demand conclusion (${input.falsification.residualUnmetDemand.conclusion}); this is not a patent or exhaustive uniqueness opinion.` : "UNKNOWN: no competitor fingerprint was available, so missing results receive no novelty credit.", competitorCheckComplete ? "INFERRED" : "UNKNOWN"),
    feasibility: factor(factors.feasibility, hypothesis("technical_feasibility")?.supportingEvidenceIds ?? [], "Reflects the proposed mechanism and retrieved technical evidence; untested implementation details remain unknown."),
    economics: factor(economic ? 10 - economic.risk : 3, [...(economic?.supportingEvidenceIds ?? []), ...(economic?.counterEvidenceIds ?? [])], "Higher means the economics case survived better; acquisition, support, and delivery costs are explicitly challenged."),
    distribution: factor(factors.distributionAccessibility, [...(hypothesis("distribution")?.supportingEvidenceIds ?? []), ...(hypothesis("distribution")?.counterEvidenceIds ?? [])], "Assesses whether a specific, trusted, affordable channel is evidenced rather than assumed."),
    defensibility: factor(factors.defensibility, [...(hypothesis("defensibility")?.supportingEvidenceIds ?? []), ...(hypothesis("defensibility")?.counterEvidenceIds ?? [])], "Considers incumbent bundling, copy response, and proximity to close substitutes; competition can lower this score without automatically rejecting an evidenced residual gap."),
    regulatoryRisk: factor(regulatory?.risk ?? 6, [...(regulatory?.supportingEvidenceIds ?? []), ...(regulatory?.counterEvidenceIds ?? [])], "Risk scale: 0 is low and 10 is high. UNKNOWN is never silently converted into low risk.", regulatory?.claimStatus ?? "UNKNOWN"),
    confidence: factor(confidenceLabel === "evidence-backed" ? 8 : confidenceLabel === "plausible" ? 6 : 3, candidate.evidenceIds, "Overall calibration label derived from evidence provenance and gap support, not the aggregate opportunity score."),
  };
  const writtenReasoning = `Evidence ${decisionFactors.evidenceStrength.status.toLowerCase()} (${decisionFactors.evidenceStrength.rationale}) Demand ${decisionFactors.demandSignal.status.toLowerCase()}. Decisive unresolved risks: ${input.falsification.decisiveRisks.map((item) => item.dimension).join(", ") || "none recorded"}.`;
  const referenced = [
    ...candidate.evidenceIds,
    ...input.falsification.hypotheses.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]),
  ];
  const known = new Set(input.evidence.map((item) => item.id));
  const citationCoverage = referenced.length ? referenced.filter((id) => known.has(id)).length / referenced.length : 0;
  const evidenceConfidence = buildEvidenceConfidence(candidate, input.evidence, citationCoverage);
  const noveltyScore = buildNoveltyScore(candidate, input.similarities, input.competitorIds ?? []);
  const scorecard = buildStructuredScorecard(candidate, {
    gap, evidence: input.evidence, falsification: input.falsification, evidenceConfidence,
    novelty: noveltyScore, founderContext: input.founderContext,
  });
  const intelligence = buildDecisionIntelligence(scorecard, evidenceConfidence);
  return { candidateId: candidate.id, score: Math.round(clamp(score, 0, 100)), factors, penalties, confidenceLabel, heuristic: true, decisionFactors, writtenReasoning, evidenceConfidence, noveltyScore, scorecard, intelligence };
}
