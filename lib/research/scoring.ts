import type { CandidateGap, FalsificationResult, GraphHole, IdeaCandidate, OpportunityScore, OpportunityScoreFactors, SimilarityResult, WeakSignal, WorkflowStitchingPattern } from "./types.ts";
import { clamp } from "./utils.ts";

export function scoreOpportunity(candidate: IdeaCandidate, input: {
  gaps: CandidateGap[]; holes: GraphHole[]; stitching: WorkflowStitchingPattern[]; signals: WeakSignal[];
  similarities: SimilarityResult[]; falsification: FalsificationResult;
}): OpportunityScore {
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const hole = input.holes.find((item) => candidate.sourceGraphHoleIds.includes(item.id));
  const stitch = input.stitching.find((item) => candidate.sourceStitchingIds.includes(item.id));
  const signal = input.signals.find((item) => candidate.sourceSignalIds.includes(item.id));
  const nearest = input.similarities.filter((item) => item.leftId === candidate.id || item.rightId === candidate.id).reduce((max, item) => Math.max(max, item.score), 0);
  const factors: OpportunityScoreFactors = {
    marketGapStrength: clamp((gap?.score ?? 20) / 10), complaintRecurrence: gap?.scoreFactors.complaintRecurrence ?? 1,
    severity: gap?.scoreFactors.painSeverity ?? 2, willingnessToPay: gap?.scoreFactors.willingnessToPay ?? stitch?.scoreFactors.willingnessToPay ?? 2,
    competitorWeakness: gap?.scoreFactors.currentSolutionWeakness ?? 3, saturation: gap ? 10 - ({ low: 2, medium: 5, high: 8, unknown: 6 }[gap.competitiveDensity]) : 3,
    noveltyDistance: clamp((1 - nearest) * 10), weakSignalStrength: signal ? clamp((signal.recency + signal.recurrence) / 2) : 2,
    feasibility: /hardware|sensor|robot/i.test(candidate.technology ?? "") ? 5 : 7,
    distributionAccessibility: gap?.scoreFactors.distributionAccessibility ?? 4, defensibility: gap?.scoreFactors.defensibility ?? 4,
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
  if (nearest >= 0.72) penalties.push({ code: "near_duplicate", points: 18, reason: "The transparent fingerprint heuristic found a near-duplicate." });
  if (input.falsification.outcome === "rejected") penalties.push({ code: "failed_falsification", points: 30, reason: input.falsification.reason });
  let score = Object.entries(weights).reduce((sum, [key, weight]) => sum + factors[key as keyof OpportunityScoreFactors] * weight, 0) * 10;
  score -= penalties.reduce((sum, penalty) => sum + penalty.points, 0);
  const confidenceLabel = gap?.confidenceLabel === "evidence-backed market gap" && candidate.evidenceIds.length >= 3 ? "evidence-backed" : candidate.evidenceIds.length >= 2 ? "plausible" : "speculative";
  return { candidateId: candidate.id, score: Math.round(clamp(score, 0, 100)), factors, penalties, confidenceLabel, heuristic: true };
}
