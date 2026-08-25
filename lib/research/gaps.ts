import { createHash } from "node:crypto";
import type { CandidateGap, ComplaintCluster, Competitor, Evidence, GapPenalty, GapScoreFactors, UnderservedSegment } from "./types.ts";
import { independentEvidenceCount } from "./quality.ts";

const clamp = (value: number, min = 0, max = 10) => Math.min(max, Math.max(min, value));

export function scoreGap(
  factors: GapScoreFactors,
  context: { evidenceCount: number; independentSourceCount: number; competitorCount: number; absenceOnly?: boolean },
): { score: number; penalties: GapPenalty[] } {
  const weights: Record<keyof GapScoreFactors, number> = {
    painSeverity: 0.15,
    complaintRecurrence: 0.14,
    currentSolutionWeakness: 0.13,
    competitiveWhitespace: 0.08,
    differentiationPotential: 0.12,
    willingnessToPay: 0.10,
    timing: 0.08,
    implementationFeasibility: 0.08,
    distributionAccessibility: 0.06,
    defensibility: 0.06,
  };
  let score = Object.entries(weights).reduce((sum, [key, weight]) => sum + clamp(factors[key as keyof GapScoreFactors]) * weight, 0) * 10;
  const penalties: GapPenalty[] = [];
  if (context.absenceOnly) penalties.push({ code: "absence_only", points: 25, reason: "The case relies on missing search results rather than positive evidence." });
  if (context.evidenceCount < 2 || context.independentSourceCount < 2) penalties.push({ code: "weak_evidence", points: 15, reason: "Fewer than two independent supporting sources were retrieved." });
  if (context.evidenceCount === 1) penalties.push({ code: "one_off", points: 12, reason: "Only one complaint supports the gap." });
  if (context.competitorCount >= 8 && factors.differentiationPotential < 6) penalties.push({ code: "incumbent_dominance", points: 12, reason: "The landscape is crowded and no strong wedge is evidenced." });
  score -= penalties.reduce((sum, penalty) => sum + penalty.points, 0);
  return { score: Math.round(clamp(score, 0, 100)), penalties };
}

export function detectGaps(
  evidence: Evidence[],
  competitors: Competitor[],
  complaints: ComplaintCluster[],
  segments: UnderservedSegment[],
): CandidateGap[] {
  return complaints.map((complaint) => {
    const supportingEvidence = evidence.filter((item) => complaint.representativeEvidenceIds.includes(item.id));
    const independentCount = independentEvidenceCount(complaint.representativeEvidenceIds, evidence);
    const segment = complaint.affectedSegment ?? segments.find((item) => item.evidenceIds.some((id) => complaint.representativeEvidenceIds.includes(id)))?.segment ?? null;
    const relatedCompetitors = competitors.filter((competitor) => competitor.evidenceIds.some((id) => {
      const source = evidence.find((item) => item.id === id);
      return source ? complaint.label.toLowerCase().split(" ").some((word) => word.length > 5 && source.summary.toLowerCase().includes(word)) : false;
    }));
    const landscapeCompetitors = relatedCompetitors.length ? relatedCompetitors : competitors.slice(0, 3);
    const counterEvidenceIds = landscapeCompetitors.flatMap((item) => item.evidenceIds).filter((id) => !complaint.representativeEvidenceIds.includes(id)).slice(0, 5);
    const priceSignal = supportingEvidence.find((item) => /\$|€|£|pay|price|cost|budget/i.test(item.summary));
    const timing = evidence.find((item) => item.searchAngleIds.some((id) => id.includes("angle_09")) && /202[5-9]|new|regulat|launch|adopt/i.test(`${item.title} ${item.summary}`));
    const factors: GapScoreFactors = {
      painSeverity: complaint.severity === "high" ? 9 : complaint.severity === "medium" ? 6 : 3,
      complaintRecurrence: clamp(2 + complaint.evidenceCount * 1.7),
      currentSolutionWeakness: relatedCompetitors.length ? 6 : 4,
      competitiveWhitespace: competitors.length <= 3 ? 7 : competitors.length <= 7 ? 5 : 3,
      differentiationPotential: complaint.currentWorkaround || segment ? 7 : 5,
      willingnessToPay: priceSignal ? 6 : 3,
      timing: timing ? 7 : 4,
      implementationFeasibility: complaint.gapType === "integration" ? 6 : complaint.gapType === "compliance" ? 3 : 7,
      distributionAccessibility: segment ? 6 : 4,
      defensibility: complaint.gapType === "integration" || complaint.gapType === "compliance" ? 6 : 4,
    };
    const scored = scoreGap(factors, {
      evidenceCount: complaint.evidenceCount,
      independentSourceCount: independentCount,
      competitorCount: competitors.length,
    });
    const qualityWeight = supportingEvidence.reduce((sum, item) => sum + item.sourceAssessment.overallWeight, 0) / Math.max(1, supportingEvidence.length);
    const confidence = clamp(0.2 + complaint.evidenceCount * 0.1 + independentCount * 0.08 + qualityWeight * .2 - scored.penalties.length * 0.08, 0, 0.95);
    const confidenceLabel = confidence >= 0.68 && complaint.evidenceCount >= 3
      ? "evidence-backed market gap"
      : confidence >= 0.45 && complaint.evidenceCount >= 2
        ? "plausible gap"
        : "speculative opportunity";
    return {
      id: `gap_${createHash("sha1").update(complaint.id).digest("hex").slice(0, 10)}`,
      problemStatement: `${segment ? `${segment} encounter` : "Users report"} ${complaint.label.toLowerCase()} in the current solution landscape.`,
      affectedSegment: segment,
      currentWorkaround: complaint.currentWorkaround,
      existingSolutions: landscapeCompetitors.map((item) => item.name.value).filter((name): name is string => Boolean(name)).slice(0, 5),
      whySolutionsFail: complaint.normalizedProblem,
      supportingEvidenceIds: complaint.representativeEvidenceIds,
      counterEvidenceIds,
      competitiveDensity: competitors.length >= 8 ? "high" : competitors.length >= 4 ? "medium" : competitors.length ? "low" : "unknown",
      willingnessToPaySignal: priceSignal ? `A retrieved source discusses price, cost, budget, or payment: ${priceSignal.id}.` : null,
      implementationDifficulty: complaint.gapType === "compliance" ? "high" : complaint.gapType === "integration" ? "medium" : "unknown",
      timingSignal: timing ? `A retrieved change-signal source may affect timing: ${timing.id}.` : null,
      gapType: complaint.gapType,
      score: scored.score,
      scoreFactors: factors,
      penalties: scored.penalties,
      confidence,
      confidenceLabel,
    } satisfies CandidateGap;
  }).sort((a, b) => b.score - a.score);
}
