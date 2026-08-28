import type {
  CandidateGap, Evidence, FalsificationDimension, FalsificationHypothesis, FalsificationResult,
  IdeaCandidate, ResidualDemandCriterion, ResidualDemandSignalAssessment,
  ResidualUnmetDemandAssessment, SimilarityResult,
} from "./types.ts";
import { classifyClaim, independentEvidenceCount } from "./quality.ts";
import { filterEvidenceIdsForClaim } from "./claim-support.ts";

const HYPOTHESES: Array<[FalsificationDimension, string]> = [
  ["demand", "The reported pain is not frequent or severe enough to change behavior."],
  ["competition", "A close substitute already solves the same job for the same user with no meaningful residual gap."],
  ["economics", "The avoided cost is lower than acquisition, support, and delivery cost."],
  ["distribution", "The target user cannot be reached through an affordable trusted channel."],
  ["technical_feasibility", "The core mechanism is unreliable at the required cost or accuracy."],
  ["regulation", "Policy, licensing, or data rules block the proposed workflow."],
  ["user_behavior", "Users will not abandon the workaround or supply the required behavior."],
  ["trust", "The system requires data access or autonomy users will not grant."],
  ["liability", "A failure creates liability greater than the value delivered."],
  ["switching_cost", "Migration and integration costs overwhelm the wedge."],
  ["defensibility", "Incumbents can copy or bundle the mechanism before it compounds."],
];

const RESIDUAL_PATTERNS: Record<Exclude<ResidualDemandCriterion, "repeated_unresolved_complaints" | "underserved_segments">, RegExp> = {
  workaround_prevalence: /workaround|spreadsheet|paper|copy and paste|manual(?:ly)?|by hand|built (?:our|my) own|freezer tape|text messages?/i,
  switching_behavior: /switched|switching|went back|stopped (?:using|tracking)|abandon(?:ed|ing)?|cancel(?:led|ed)|churn|migrat(?:ed|ing)|replaced/i,
  price_performance_gaps: /too expensive|overpriced|not worth|unreliable|fails?|broken|limited|slow|inaccurate|hard to use|too (?:much|many)|poor performance|manual entry/i,
  trust_failures: /don.?t trust|trust failure|privacy concern|security concern|data loss|surveillance|poor support|no response/i,
  distribution_gaps: /not available|only enterprise|minimum seats?|not in (?:my|our) (?:country|region)|rural|remote area|procurement barrier|no trusted channel/i,
  missing_integrations: /missing integration|no api|doesn.?t integrate|does not integrate|copy and paste|re-enter|manual export|sync fails?/i,
  procurement_friction: /procurement|rfp|security review|legal review|vendor approval|sales cycle|contact sales|minimum seats?|enterprise only/i,
  tolerated_bad_solutions: /put up with|live with|still use|keep using|no better option|went back|paper|spreadsheet|manual rotation|tolerat/i,
};

const ADEQUATE_SOLUTION = /adequately solves?|fully solves?|complete solution|same job for the same (?:user|customer)|meets? (?:all|the) (?:needs|requirements)|no meaningful (?:gap|complaint)|eliminates? (?:the )?(?:problem|workaround)/i;

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function assessResidualUnmetDemand(candidate: IdeaCandidate, gap: CandidateGap | undefined, input: {
  evidence: Evidence[]; similarities: SimilarityResult[]; competitorIds?: string[];
}): ResidualUnmetDemandAssessment {
  const explicitCompetitorIds = new Set(input.competitorIds ?? []);
  const comparisons = input.similarities.filter((item) => {
    if (item.leftId !== candidate.id && item.rightId !== candidate.id) return false;
    if (explicitCompetitorIds.size === 0) return true;
    const otherId = item.leftId === candidate.id ? item.rightId : item.leftId;
    return explicitCompetitorIds.has(otherId);
  });
  const closest = [...comparisons].sort((a, b) => b.score - a.score)[0] ?? null;
  const competitorsPresent = explicitCompetitorIds.size > 0 || comparisons.length > 0;
  const sameJobSameUserSubstitute = comparisons.some((item) => {
    const dimensions = new Set(item.matchingDimensions);
    return item.score >= .42 && dimensions.has("targetCustomer") && dimensions.has("jobToBeDone")
      || (item.dimensionScores?.targetCustomer ?? 0) >= .5 && (item.dimensionScores?.jobToBeDone ?? 0) >= .5;
  });
  const relevantIds = unique([...(gap?.supportingEvidenceIds ?? []), ...(gap?.counterEvidenceIds ?? []), ...candidate.evidenceIds]);
  const marketContext = `${candidate.definition?.industry ?? ""} ${candidate.definition?.companyProfile ?? candidate.targetCustomer ?? ""} ${candidate.jobToBeDone}`;
  const relevantEvidence = input.evidence.filter((item) => relevantIds.includes(item.id) && item.relevanceAssessment.acceptedForMarket);
  const residualEvidence = relevantEvidence.filter((item) => !ADEQUATE_SOLUTION.test(`${item.title} ${item.summary}`));
  const matchingIds = (pattern: RegExp) => residualEvidence.filter((item) => pattern.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const signal = (criterion: ResidualDemandCriterion, ids: string[], rationale: string): ResidualDemandSignalAssessment => {
    const claimType = criterion === "workaround_prevalence" || criterion === "tolerated_bad_solutions" ? "customer_workaround"
      : criterion === "underserved_segments" ? "underserved_status"
        : criterion === "price_performance_gaps" ? "competitor_weakness" : "unmet_demand";
    const evidenceIds = filterEvidenceIdsForClaim(claimType, rationale, unique(ids), input.evidence, marketContext);
    return {
      criterion, present: evidenceIds.length ? true : null,
      claimStatus: evidenceIds.length ? classifyClaim(evidenceIds, input.evidence) : "UNKNOWN",
      evidenceIds, rationale: evidenceIds.length ? rationale : `No retrieved evidence directly established ${criterion.replaceAll("_", " ")}; it remains unknown rather than false.`,
    };
  };
  const repeatedIds = independentEvidenceCount(gap?.supportingEvidenceIds ?? [], input.evidence) >= 2 ? gap?.supportingEvidenceIds ?? [] : [];
  const workaroundIds = unique([
    ...(gap?.currentWorkaround ? gap.supportingEvidenceIds : []),
    ...matchingIds(RESIDUAL_PATTERNS.workaround_prevalence),
  ]);
  const segmentIds = gap?.affectedSegment ? gap.supportingEvidenceIds : [];
  const pricePerformanceIds = unique([
    ...(["pricing", "integration", "usability"].includes(gap?.gapType ?? "") ? gap?.supportingEvidenceIds ?? [] : []),
    ...matchingIds(RESIDUAL_PATTERNS.price_performance_gaps),
  ]);
  const trustIds = unique([
    ...(gap?.gapType === "trust" ? gap.supportingEvidenceIds : []),
    ...matchingIds(RESIDUAL_PATTERNS.trust_failures),
  ]);
  const distributionIds = unique([
    ...(gap?.gapType === "distribution" ? gap.supportingEvidenceIds : []),
    ...matchingIds(RESIDUAL_PATTERNS.distribution_gaps),
  ]);
  const signals: ResidualUnmetDemandAssessment["signals"] = {
    repeated_unresolved_complaints: signal("repeated_unresolved_complaints", repeatedIds, "At least two independent sources repeat the unresolved complaint represented by the source gap."),
    workaround_prevalence: signal("workaround_prevalence", workaroundIds, "Retrieved users describe continuing manual or improvised workarounds despite available products."),
    switching_behavior: signal("switching_behavior", matchingIds(RESIDUAL_PATTERNS.switching_behavior), "Retrieved users describe abandoning, cancelling, reverting from, or switching existing solutions."),
    underserved_segments: signal("underserved_segments", segmentIds, `The source gap identifies a constrained segment${gap?.affectedSegment ? `: ${gap.affectedSegment}` : ""}.`),
    price_performance_gaps: signal("price_performance_gaps", pricePerformanceIds, "Retrieved evidence describes a price, reliability, usability, integration, or performance shortfall."),
    trust_failures: signal("trust_failures", trustIds, "Retrieved evidence describes trust, privacy, security, data-loss, or support failures."),
    distribution_gaps: signal("distribution_gaps", distributionIds, "Retrieved evidence describes availability, packaging, regional, procurement, or channel exclusion."),
    missing_integrations: signal("missing_integrations", matchingIds(RESIDUAL_PATTERNS.missing_integrations), "Retrieved evidence describes missing integrations, absent APIs, re-entry, exports, or failed synchronization."),
    procurement_friction: signal("procurement_friction", matchingIds(RESIDUAL_PATTERNS.procurement_friction), "Retrieved evidence describes procurement, review, packaging, or sales-cycle friction."),
    tolerated_bad_solutions: signal("tolerated_bad_solutions", matchingIds(RESIDUAL_PATTERNS.tolerated_bad_solutions), "Retrieved evidence shows customers continuing to tolerate manual or poor solutions despite available products."),
  };

  const proposal = `${candidate.mechanism} ${candidate.interface} ${candidate.technology ?? ""} ${candidate.businessModel ?? ""} ${candidate.distribution ?? ""} ${candidate.workflowPosition} ${candidate.differentiator}`;
  const issue = `${gap?.gapType ?? ""} ${gap?.whySolutionsFail ?? ""} ${gap?.currentWorkaround ?? ""}`;
  const mechanismPatterns: RegExp[] = [];
  if (/integration|fragment|multiple tools|copy|re-enter|sync/i.test(issue)) mechanismPatterns.push(/bridge|connector|integrat|interoperab|sync|event|between existing tools|no new system of record/i);
  if (/manual|usability|hard to use|entry|paper|spreadsheet|product/i.test(issue)) mechanismPatterns.push(/ambient|passive|automat|exception|outcome|zero.entry|removes manual|asks for attention only/i);
  if (/pricing|expensive|cost/i.test(issue)) mechanismPatterns.push(/outcome|usage|pooled|shared capacity|per verified|instead of another seat/i);
  if (/trust|privacy|security|support/i.test(issue)) mechanismPatterns.push(/customer.control|local.first|signed|proof|receipt|reversible|escrow|verifi/i);
  if (/distribution|available|enterprise|region|segment/i.test(issue)) mechanismPatterns.push(/pooled|shared service|workflow partner|direct to the affected segment|cohort/i);
  const materialChange = mechanismPatterns.length ? mechanismPatterns.some((pattern) => pattern.test(proposal)) : null;
  const mechanismEvidenceIds = materialChange === null ? [] : gap?.supportingEvidenceIds ?? [];
  const mechanismMateriallyChangesOutcome = {
    present: materialChange,
    claimStatus: materialChange === null ? "UNKNOWN" as const : "INFERRED" as const,
    evidenceIds: mechanismEvidenceIds,
    rationale: materialChange === null
      ? "The retrieved gap does not expose a specific incumbent failure that can be compared with the proposed mechanism."
      : materialChange
        ? "The proposed mechanism directly changes the workflow, cost, access, or trust condition implicated by the residual-gap evidence; this is an inferred causal hypothesis, not proof of performance."
        : "The proposal changes packaging or presentation but does not clearly alter the failure mode identified in the residual-gap evidence.",
  };
  const presentSignals = Object.values(signals).filter((item) => item.present).length;
  const meaningfulResidualGap = signals.repeated_unresolved_complaints.present === true || presentSignals >= 2;
  const adequateIds = filterEvidenceIdsForClaim("competitor_relationship", "A same-buyer same-job solution adequately resolves the workflow",
    input.evidence.filter((item) => relevantIds.includes(item.id) && ADEQUATE_SOLUTION.test(`${item.title} ${item.summary}`)).map((item) => item.id), input.evidence, marketContext);
  const adequateSameJobSameUserSolution = sameJobSameUserSubstitute && !meaningfulResidualGap
    && independentEvidenceCount(adequateIds, input.evidence) >= 2;
  const conclusion: ResidualUnmetDemandAssessment["conclusion"] = !competitorsPresent ? "no_competitor_evaluated"
    : adequateSameJobSameUserSolution ? "adequately_solved"
      : meaningfulResidualGap && materialChange === true ? "meaningful_residual_gap" : "residual_gap_uncertain";
  const evidenceIds = unique([...Object.values(signals).flatMap((item) => item.evidenceIds), ...adequateIds]);
  const rationale = !competitorsPresent
    ? "No competitor fingerprint was available, so competition remains unknown and receives no whitespace credit."
    : adequateSameJobSameUserSolution
      ? "A close substitute matches the same user and job, multiple independent sources indicate adequate resolution, and no meaningful residual-demand signal was retrieved."
      : meaningfulResidualGap && materialChange === true
        ? "Competitors validate that the job may exist, while unresolved demand signals and a causally different mechanism preserve a structural-gap hypothesis."
        : meaningfulResidualGap
          ? "Residual unmet demand is evidenced, but the proposed mechanism does not yet show a material change to the incumbent failure mode."
          : "Competitors exist, but the retrieved evidence does not yet establish whether a meaningful residual gap remains; existence alone is not a rejection condition.";
  return {
    competitorsPresent, closestCompetitorSimilarity: closest?.score ?? null, sameJobSameUserSubstitute,
    signals, mechanismMateriallyChangesOutcome, meaningfulResidualGap, adequateSameJobSameUserSolution,
    conclusion, rationale, evidenceIds,
  };
}

export function falsifyCandidate(candidate: IdeaCandidate, input: {
  evidence: Evidence[]; gaps: CandidateGap[]; similarities: SimilarityResult[]; competitorIds?: string[];
}): FalsificationResult {
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const residualUnmetDemand = assessResidualUnmetDemand(candidate, gap, input);
  const maxSimilarity = residualUnmetDemand.closestCompetitorSimilarity ?? 0;
  const marketContext = `${candidate.definition?.industry ?? ""} ${candidate.definition?.companyProfile ?? candidate.targetCustomer ?? ""} ${candidate.jobToBeDone}`;
  const positiveIds = filterEvidenceIdsForClaim("customer_pain", gap?.problemStatement ?? candidate.jobToBeDone, candidate.evidenceIds, input.evidence, marketContext);
  const independent = independentEvidenceCount(positiveIds, input.evidence);
  const activeCounterevidence = input.evidence.filter((item) => item.relevanceAssessment.acceptedForMarket && item.searchAngleIds.some((id) => id.startsWith("falsify_")));
  const idsMatching = (pattern: RegExp) => activeCounterevidence.filter((item) => pattern.test(`${item.title} ${item.summary}`)).map((item) => item.id);
  const critical = new Set<FalsificationDimension>(["demand", "economics", "distribution", "technical_feasibility"]);
  const hypotheses: FalsificationHypothesis[] = HYPOTHESES.map(([dimension, statement]) => {
    let risk = 6;
    const supportingEvidenceIds: string[] = [];
    const counterEvidenceIds: string[] = [];
    if (dimension === "demand") {
      risk = independent >= 3 ? 3 : independent >= 2 ? 5 : 8;
      supportingEvidenceIds.push(...positiveIds);
      counterEvidenceIds.push(...idsMatching(/low demand|would not pay|not worth|low adoption|cancel|abandon|shut down|failed/i));
    }
    if (dimension === "competition") {
      supportingEvidenceIds.push(...Object.values(residualUnmetDemand.signals).flatMap((item) => item.evidenceIds));
      if (residualUnmetDemand.adequateSameJobSameUserSolution) {
        risk = 10;
        counterEvidenceIds.push(...residualUnmetDemand.evidenceIds.filter((id) => {
          const item = input.evidence.find((source) => source.id === id);
          return item ? ADEQUATE_SOLUTION.test(`${item.title} ${item.summary}`) : false;
        }));
      } else if (!residualUnmetDemand.competitorsPresent) risk = 7;
      else if (residualUnmetDemand.conclusion === "meaningful_residual_gap") risk = Math.min(6, Math.round(maxSimilarity * 10));
      else risk = Math.max(5, Math.round(maxSimilarity * 10));
    }
    if (dimension === "economics") {
      if (gap?.willingnessToPaySignal) supportingEvidenceIds.push(...filterEvidenceIdsForClaim("willingness_to_pay", gap.willingnessToPaySignal, gap.supportingEvidenceIds, input.evidence, marketContext));
      counterEvidenceIds.push(...idsMatching(/unit economics|support cost|acquisition cost|too expensive|infrastructure cost|small market|pricing/i));
    }
    if (dimension === "distribution") {
      const distributionIds = input.evidence.filter((item) => item.sourceType === "job_posting" || /procurement|rfp|partner|marketplace|community/i.test(`${item.title} ${item.summary}`)).map((item) => item.id);
      supportingEvidenceIds.push(...filterEvidenceIdsForClaim("market_spend", "A reachable buying or procurement channel exists", distributionIds, input.evidence, marketContext));
      counterEvidenceIds.push(...idsMatching(/acquisition|distribution|procurement|trusted channel|sales cycle/i));
    }
    if (dimension === "technical_feasibility") {
      const technicalIds = input.evidence.filter((item) => ["documentation", "github", "research", "patent"].includes(item.sourceType)).map((item) => item.id);
      supportingEvidenceIds.push(...filterEvidenceIdsForClaim("automation_capability", candidate.mechanism, technicalIds, input.evidence, marketContext));
      counterEvidenceIds.push(...idsMatching(/technical limitation|unreliable|accuracy|latency|infrastructure|hardware cost/i));
      risk = candidate.technology && /sensor|edge|hardware/i.test(candidate.technology) ? 7 : 5;
    }
    if (dimension === "user_behavior") {
      supportingEvidenceIds.push(...gap?.supportingEvidenceIds ?? []);
      counterEvidenceIds.push(...idsMatching(/adoption|behavior|would not|refus|manual.*prefer|habit/i));
    }
    if (dimension === "trust") {
      counterEvidenceIds.push(...idsMatching(/trust|privacy|security|data access|surveillance/i));
      risk = /passive|data|autonomous|metadata/i.test(`${candidate.dataSource} ${candidate.mechanism}`) ? 7 : 5;
    }
    if (dimension === "liability") counterEvidenceIds.push(...idsMatching(/liability|safety|harm|insurance|responsib/i));
    if (dimension === "switching_cost") {
      supportingEvidenceIds.push(...gap?.supportingEvidenceIds ?? []);
      counterEvidenceIds.push(...idsMatching(/switching cost|migration|integration cost|lock.in/i));
      risk = /replace|new system/i.test(candidate.workflowPosition) ? 8 : 5;
    }
    if (dimension === "defensibility") {
      counterEvidenceIds.push(...filterEvidenceIdsForClaim("competitor_weakness", "Incumbents, open source, or AI can copy, bundle, or commoditize the mechanism", idsMatching(/incumbent|bundle|copy|open.source|commodity|commodit|capability becomes free/i), input.evidence, marketContext));
      risk = maxSimilarity > 0.55 ? 8 : 6;
    }
    if (dimension === "regulation") {
      const regulatory = input.evidence.filter((item) => item.sourceType === "regulator" || /regulat|rule|policy/i.test(`${item.title} ${item.summary}`));
      const eligibleRegulatory = filterEvidenceIdsForClaim("regulation", `Applicable regulation for ${candidate.jobToBeDone}`, regulatory.map((item) => item.id), input.evidence, marketContext);
      counterEvidenceIds.push(...eligibleRegulatory);
      risk = eligibleRegulatory.length ? 6 : 5;
    }
    const support = unique(supportingEvidenceIds);
    const counter = unique(counterEvidenceIds);
    const competitionUnknown = dimension === "competition" && !residualUnmetDemand.competitorsPresent;
    const unknown = competitionUnknown || support.length === 0 && counter.length === 0;
    if (dimension !== "competition") {
      if (counter.length >= 2 && support.length === 0) risk = Math.max(risk, 8);
      else if (counter.length > support.length) risk = Math.max(risk, 7);
      else if (support.length >= 2 && counter.length === 0) risk = Math.min(risk, 4);
      else if (support.length > 0 && support.length >= counter.length) risk = Math.min(risk, 5);
      else if (unknown && critical.has(dimension)) risk = Math.max(risk, 7);
    }
    const status = unknown ? "UNKNOWN" : classifyClaim([...support, ...counter], input.evidence);
    const rationale = dimension === "competition" ? residualUnmetDemand.rationale : unknown
      ? "No retrieved source directly tested this failure hypothesis; the risk remains unknown and receives no clearance credit."
      : `${support.length} source record(s) weigh against the failure hypothesis and ${counter.length} weigh in its favor; repeated copies are collapsed upstream.`;
    const decisive = dimension === "competition"
      ? residualUnmetDemand.adequateSameJobSameUserSolution
      : risk >= 7 || unknown && critical.has(dimension);
    return { dimension, statement, supportingEvidenceIds: support, counterEvidenceIds: counter, risk, unknown, claimStatus: status, rationale, decisive };
  });
  const averageRisk = hypotheses.reduce((sum, item) => sum + item.risk, 0) / hypotheses.length;
  const evidenceBonus = Math.min(10, independent * 2.5);
  const survivalScore = Math.round(Math.max(0, Math.min(100, 100 - averageRisk * 9 + evidenceBonus)));
  const unknownCriticalCount = hypotheses.filter((item) => item.unknown && critical.has(item.dimension)).length;
  const knownFatal = residualUnmetDemand.adequateSameJobSameUserSolution || hypotheses.some((item) => item.dimension !== "competition" && item.risk >= 9 && item.counterEvidenceIds.length >= 2);
  const outcome = !knownFatal && survivalScore >= 48 && unknownCriticalCount <= 2 ? "survived"
    : !knownFatal && survivalScore >= 35 && unknownCriticalCount <= 3 && candidate.iteration === 0 ? "mutate" : "rejected";
  const decisiveRisks = hypotheses.filter((item) => item.decisive).sort((a, b) => b.risk - a.risk).slice(0, 5).map((item) => ({
    dimension: item.dimension, risk: item.risk, status: item.claimStatus, reason: item.rationale,
    evidenceIds: unique([...item.supportingEvidenceIds, ...item.counterEvidenceIds]),
  }));
  const competitorEvidenceIds = unique(gap?.counterEvidenceIds ?? []);
  const failedAttemptIds = filterEvidenceIdsForClaim("falsification_risk", "Prior companies or attempts failed in this buyer and workflow context",
    input.evidence.filter((item) => /failed|failure|shut down|shutdown|discontinued|low adoption|abandon/i.test(`${item.title} ${item.summary}`)).map((item) => item.id), input.evidence, marketContext);
  const aiCommoditizationIds = filterEvidenceIdsForClaim("competitor_weakness", "AI, incumbent bundling, or open source can commoditize the core capability",
    input.evidence.filter((item) => /\bai\b|artificial intelligence|commodit|bundle|open.source|capability becomes free/i.test(`${item.title} ${item.summary}`)).map((item) => item.id), input.evidence, marketContext);
  const constraintSearchObserved = input.evidence.some((item) => item.searchAngleIds.some((id) => /^falsify_2_|failed_attempt/i.test(id)));
  return {
    candidateId: candidate.id, hypotheses,
    argumentsFor: [
      ...(positiveIds.length ? [{ claim: "Retrieved evidence supports the source gap, workaround, or enabling change.", evidenceIds: positiveIds }] : []),
      ...(residualUnmetDemand.meaningfulResidualGap ? [{ claim: "Explicit residual-demand signals show that the proposed gap remains unresolved even after accounting for retrieved alternatives.", evidenceIds: residualUnmetDemand.evidenceIds }] : []),
    ],
    argumentsAgainst: residualUnmetDemand.adequateSameJobSameUserSolution
      ? [{ claim: "Close substitutes already solve the same job for the same user and no meaningful residual gap was evidenced.", evidenceIds: residualUnmetDemand.evidenceIds }]
      : competitorEvidenceIds.length
        ? [{ claim: "Retrieved competitors address part of the job; similarity reduces differentiation and defensibility but is not by itself decisive.", evidenceIds: competitorEvidenceIds }]
        : [{ claim: "No targeted competitive resolution evidence was retrieved; competition remains unknown, not cleared.", evidenceIds: [] }],
    survivalScore, outcome, decisiveRisks, unknownCriticalCount, residualUnmetDemand,
    searchCoverage: {
      failedCompaniesPriorAttempts: {
        searched: constraintSearchObserved, status: failedAttemptIds.length ? classifyClaim(failedAttemptIds, input.evidence) : "UNKNOWN",
        evidenceIds: failedAttemptIds, rationale: failedAttemptIds.length ? "Relevant failed-company or prior-attempt evidence was retrieved." : "The focused search did not establish a relevant prior failed attempt; the result remains UNKNOWN.",
      },
      aiCommoditization: {
        searched: constraintSearchObserved, status: aiCommoditizationIds.length ? classifyClaim(aiCommoditizationIds, input.evidence) : "UNKNOWN",
        evidenceIds: aiCommoditizationIds, rationale: aiCommoditizationIds.length ? "Relevant AI, bundling, open-source, or commoditization evidence was retrieved." : "The focused search did not establish AI commoditization in this buyer/workflow context; the result remains UNKNOWN.",
      },
    },
    reason: outcome === "survived" ? "The concept cleared the positive-evidence gate; competitor existence was separated from adequate resolution, and no known fatal risk or excessive critical unknowns survived the adversarial pass." : outcome === "mutate" ? "The evidence-backed core remains promising, but exactly one bounded constraint mutation may be retested." : residualUnmetDemand.adequateSameJobSameUserSolution ? "A close substitute already solves the same job for the same user, and the residual-demand assessment found no meaningful remaining gap." : "A decisive non-competition factor, counterevidence, or too many critical unknowns overwhelm the current case; competitor existence alone did not cause rejection.",
  };
}
