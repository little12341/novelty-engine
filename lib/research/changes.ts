import { classifyClaim } from "./quality.ts";
import type { ChangeDetectionResult, ClaimStatus, MaterialChange, ResearchResult } from "./types.ts";

const names = (run: ResearchResult) => new Set(run.competitors.map((item) => item.name.value?.toLowerCase()).filter((item): item is string => Boolean(item)));
const evidenceFor = (run: ResearchResult, pattern: RegExp) => run.sources.filter((item) => pattern.test(`${item.title} ${item.summary}`));
const status = (run: ResearchResult, ids: string[]): ClaimStatus => classifyClaim(ids, run.sources);

export function compareResearchRuns(before: ResearchResult, after: ResearchResult, now = new Date()): ChangeDetectionResult {
  const materialChanges: MaterialChange[] = [];
  let ignoredTrivialChanges = 0;
  const add = (change: MaterialChange) => materialChanges.push(change);
  const beforeCompetitors = names(before); const afterCompetitors = names(after);
  const appeared = [...afterCompetitors].filter((item) => !beforeCompetitors.has(item));
  const disappeared = [...beforeCompetitors].filter((item) => !afterCompetitors.has(item));
  if (appeared.length || disappeared.length) add({
    category: "competitors", severity: appeared.length >= 3 ? "high" : "medium",
    summary: `${appeared.length} supported competitor(s) appeared${appeared.length ? `: ${appeared.join(", ")}` : ""}; ${disappeared.length} were no longer supported by the new snapshot. This describes retrieval change, not certain market entry or exit.`,
    beforeEvidenceIds: before.competitors.flatMap((item) => item.evidenceIds), afterEvidenceIds: after.competitors.flatMap((item) => item.evidenceIds),
    statusBefore: status(before, before.competitors.flatMap((item) => item.evidenceIds)), statusAfter: status(after, after.competitors.flatMap((item) => item.evidenceIds)),
  });

  const patterns: Array<[MaterialChange["category"], RegExp, string]> = [
    ["pricing", /\bpricing|\bplans?|\$\d|per month|contact sales/i, "Public pricing evidence changed materially"],
    ["regulation", /regulat|policy|law|guidance|compliance|license/i, "Regulatory evidence changed"],
    ["complaints", /complain|frustrat|manual|workaround|missing|unreliable|too expensive/i, "Complaint evidence changed"],
    ["substitutes", /alternative|substitute|workaround|spreadsheet|paper|consultant|manual/i, "Substitute or workaround evidence changed"],
    ["funding_hiring", /funding|raised|series [a-z]|hiring|job posting|careers/i, "Funding or hiring evidence changed"],
    ["patents_research", /patent|study|research|trial|paper|arxiv/i, "Patent or research evidence changed"],
    ["platform_policy", /platform policy|api policy|terms of service|developer policy/i, "Platform-policy evidence changed"],
    ["products_features", /feature|launch|product|integration|api|documentation/i, "Product or feature evidence changed"],
    ["demand", /demand|waitlist|adoption|churn|cancel|would pay|procurement|hiring/i, "Demand evidence changed"],
  ];
  for (const [category, pattern, label] of patterns) {
    const left = evidenceFor(before, pattern); const right = evidenceFor(after, pattern);
    const leftClaims = new Set(left.map((item) => item.claimFingerprint));
    const rightClaims = new Set(right.map((item) => item.claimFingerprint));
    const added = right.filter((item) => !leftClaims.has(item.claimFingerprint));
    const removed = left.filter((item) => !rightClaims.has(item.claimFingerprint));
    if (!added.length && !removed.length) { ignoredTrivialChanges += Math.abs(right.length - left.length); continue; }
    const magnitude = added.length + removed.length;
    if (magnitude === 1 && added[0]?.sourceAssessment.repetitionRisk === "likely") { ignoredTrivialChanges += 1; continue; }
    add({
      category, severity: magnitude >= 3 ? "high" : "medium",
      summary: `${label}: ${added.length} material claim(s) added and ${removed.length} no longer present.`,
      beforeEvidenceIds: left.map((item) => item.id), afterEvidenceIds: right.map((item) => item.id),
      statusBefore: status(before, left.map((item) => item.id)), statusAfter: status(after, right.map((item) => item.id)),
    });
  }
  if (before.coverage.coverageStatus !== after.coverage.coverageStatus || before.stopDecision.status !== after.stopDecision.status) add({
    category: "coverage", severity: after.stopDecision.status === "insufficient_evidence" ? "high" : "medium",
    summary: `Coverage moved from ${before.coverage.coverageStatus}/${before.stopDecision.status} to ${after.coverage.coverageStatus}/${after.stopDecision.status}.`,
    beforeEvidenceIds: before.sources.map((item) => item.id), afterEvidenceIds: after.sources.map((item) => item.id),
    statusBefore: status(before, before.sources.map((item) => item.id)), statusAfter: status(after, after.sources.map((item) => item.id)),
  });
  const beforeOpportunities = new Map(before.finalOpportunities.map((item) => [item.candidate.mechanismFamily, item]));
  const afterOpportunities = new Map(after.finalOpportunities.map((item) => [item.candidate.mechanismFamily, item]));
  const opportunityEvolution = [...new Set([...beforeOpportunities.keys(), ...afterOpportunities.keys()])].map((mechanismFamily) => {
    const left = beforeOpportunities.get(mechanismFamily); const right = afterOpportunities.get(mechanismFamily);
    const beforeScore = left?.score.score ?? null; const afterScore = right?.score.score ?? null;
    const status = !left ? "appeared" as const : !right ? "disappeared" as const
      : afterScore! >= beforeScore! + 5 ? "strengthened" as const : afterScore! <= beforeScore! - 5 ? "weakened" as const : "stable" as const;
    return { mechanismFamily, beforeScore, afterScore, beforeEvidenceConfidence: left?.score.evidenceConfidence?.score ?? null, afterEvidenceConfidence: right?.score.evidenceConfidence?.score ?? null, status };
  });
  return {
    baselineRunId: before.id, comparisonRunId: after.id, comparedAt: now.toISOString(), materialChanges,
    ignoredTrivialChanges,
    summary: materialChanges.length ? `${materialChanges.length} material change(s) surfaced; ${ignoredTrivialChanges} trivial or syndicated differences were suppressed.` : "No material change was supported by the two snapshots; this is not proof that the market was unchanged.",
    opportunityEvolution,
  };
}
