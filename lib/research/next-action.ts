import type { AssumptionLedgerEntry, IdeaCandidate, NextBestAction, ValidationExperiment, ValidationPlan } from "./types.ts";

const PRIORITY: Record<AssumptionLedgerEntry["dimension"], number> = {
  existing_spend: 10, customer_pain: 9, buyer_access: 9, pain_frequency: 8, switching: 8,
  technology: 8, regulation: 7, market_size: 7, incumbent_weakness: 6,
};

export function buildValidationPlan(candidate: IdeaCandidate, primary: ValidationExperiment, ledger: AssumptionLedgerEntry[]): ValidationPlan {
  const target = candidate.targetCustomer ?? "buyers in the evidenced underserved segment";
  const payer = candidate.payer ?? target;
  const criticalDimensions = ledger.filter((item) => item.status === "CRITICAL" || item.status === "UNTESTED").map((item) => item.dimension.replaceAll("_", " ")).slice(0, 3);
  return {
    candidateId: candidate.id,
    interviewTargets: [`10 ${target} with a recent concrete incident`, `3 former users of the closest substitute`, `2 ${payer} budget owners`, ...(criticalDimensions.length ? [`Targets able to resolve: ${criticalDimensions.join(", ")}`] : [])],
    outreachTargets: [`25 named ${target} reachable through ${candidate.distribution ?? "the proposed distribution channel"}`, `5 implementation or workflow partners`, `3 buyers currently paying for labor or a substitute`],
    experiments: [primary],
    milestones: [
      { milestone: "Problem evidence", successCriterion: "3 independent recent cases with measurable consequence.", killCriterion: "Fewer than 3 of 10 targets experienced the pain recently." },
      { milestone: "Spend evidence", successCriterion: "2 buyers disclose current spend and 1 accepts a paid pilot or binding next step.", killCriterion: "No budget owner can identify spend, avoided loss, or approval path." },
      { milestone: "Switching feasibility", successCriterion: "1 account completes a reversible pilot without replacing its system of record.", killCriterion: "Every qualified account requires an uneconomic full migration." },
      { milestone: "Mechanism proof", successCriterion: primary.successThreshold, killCriterion: primary.failureThreshold },
    ],
  };
}

export function chooseNextBestAction(opportunities: Array<{ candidate: IdeaCandidate; score: { score: number }; validationExperiment: ValidationExperiment; assumptionLedger: AssumptionLedgerEntry[] }>): NextBestAction {
  if (!opportunities.length) return {
    candidateId: null,
    action: "Expand the search into one adjacent segment or workflow using the recorded kill reasons, then seek independent user-voice and spend evidence.",
    reason: "No candidate survived, so testing an invented winner would have lower information value than targeted search expansion.",
    resolvesAssumptionIds: [], expectedInformationGain: 10, estimatedCost: "one bounded research branch", estimatedTime: "within the configured research budget",
    successCriterion: "At least one new gap has 3 independent pain signals and 2 spend signals.",
    killCriterion: "The hard query, time, or provider-spend budget is exhausted without a gate-clearing gap.",
  };
  const ranked = opportunities.flatMap((opportunity) => opportunity.assumptionLedger
    .filter((item) => item.status !== "SUPPORTED" && item.status !== "DISPROVEN")
    .map((item) => ({ opportunity, item, value: PRIORITY[item.dimension] + (item.status === "CRITICAL" ? 3 : item.status === "UNTESTED" ? 2 : 1) + opportunity.score.score / 100 })))
    .sort((a, b) => b.value - a.value);
  const selected = ranked[0];
  const fallback = opportunities[0];
  if (!selected) return {
    candidateId: fallback.candidate.id, action: fallback.validationExperiment.action,
    reason: "The research assumptions are supported; the recorded behavioral validation is now the highest-value step.",
    resolvesAssumptionIds: [], expectedInformationGain: 7, estimatedCost: fallback.validationExperiment.estimatedCost,
    estimatedTime: fallback.validationExperiment.estimatedTime, successCriterion: fallback.validationExperiment.successThreshold,
    killCriterion: fallback.validationExperiment.failureThreshold,
  };
  return {
    candidateId: selected.opportunity.candidate.id,
    action: selected.item.researchToResolve ?? selected.opportunity.validationExperiment.action,
    reason: `${selected.item.dimension.replaceAll("_", " ")} is ${selected.item.status} and has the greatest combination of decision impact and uncertainty for the top surviving candidate.`,
    resolvesAssumptionIds: [selected.item.id], expectedInformationGain: Math.min(10, Math.round(selected.value)),
    estimatedCost: selected.opportunity.validationExperiment.estimatedCost,
    estimatedTime: selected.opportunity.validationExperiment.estimatedTime,
    successCriterion: selected.opportunity.validationExperiment.successThreshold,
    killCriterion: selected.item.killCriterion,
  };
}
