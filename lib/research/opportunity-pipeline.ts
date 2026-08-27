import { extractAssumptions, generateContradictions } from "./contradictions.ts";
import { mineFailedAttempts } from "./failures.ts";
import { falsifyCandidate } from "./falsification.ts";
import { fingerprintCandidate, fingerprintCompetitor, rejectNearDuplicates, similarityMatrix } from "./fingerprints.ts";
import { addFailedAttemptsToGraph, buildOpportunityGraph, detectGraphHoles } from "./graph.ts";
import { generateCandidates, requestedIdeaCount } from "./ideation.ts";
import { buildLineage } from "./lineage.ts";
import { mutateCandidates } from "./mutations.ts";
import { scoreOpportunity } from "./scoring.ts";
import { normalizeWeakSignals } from "./signals.ts";
import { detectWorkflowStitching } from "./stitching.ts";
import { generateValidationExperiment } from "./validation.ts";
import { evaluateEvidenceGate } from "./evidence-gate.ts";
import { analyzeWhyNotBuilt, buildAssumptionLedger } from "./assumption-ledger.ts";
import { runAdversarialPanel } from "./adversarial.ts";
import { buildCandidateLifecycle } from "./lifecycle.ts";
import { buildValidationPlan, chooseNextBestAction } from "./next-action.ts";
import { assessFounderFit } from "./founder-fit.ts";
import { buildResearchTaskGraph } from "./orchestration.ts";
import { buildCounterfactual, buildMoatStressTest } from "./strategy-tests.ts";
import type { CandidateCompetitorRecall, CandidateGap, ComplaintCluster, Competitor, Evidence, EvidenceGateResult, FinalOpportunity, MutationRecord, PipelineBudgetUsage, RejectedIdea, ResearchDepth, ResearchLimits, ResearchUserContext, UnderservedSegment } from "./types.ts";

export function runOpportunityPipeline(input: {
  query: string; sources: Evidence[]; competitors: Competitor[]; complaints: ComplaintCluster[];
  segments: UnderservedSegment[]; gaps: CandidateGap[]; limits: ResearchLimits; now?: Date; allowGeneration?: boolean;
  excludedMechanisms?: string[]; userContext?: ResearchUserContext; depth?: ResearchDepth;
  competitorRecall?: CandidateCompetitorRecall[];
}) {
  const initialGraph = buildOpportunityGraph(input.sources, input.competitors, input.complaints, input.segments, input.gaps);
  const graphHoles = detectGraphHoles(initialGraph);
  const stitchingPatterns = detectWorkflowStitching(input.sources, input.complaints);
  const weakSignals = normalizeWeakSignals(input.sources, input.now);
  const failedAttempts = mineFailedAttempts(input.sources, weakSignals);
  const opportunityGraph = addFailedAttemptsToGraph(initialGraph, failedAttempts);
  const assumptions = extractAssumptions(input.sources, input.competitors);
  const contradictions = generateContradictions(assumptions);
  const initial = input.allowGeneration === false ? [] : generateCandidates({
    query: input.query, gaps: input.gaps, graphHoles, contradictions, stitching: stitchingPatterns,
    signals: weakSignals, failedAttempts, maxCandidates: input.limits.maxCandidates,
  });
  const competitorFingerprints = input.competitors.map(fingerprintCompetitor);
  const allCandidates = [...initial];
  const mutations: MutationRecord[] = [];
  const rejectedIdeas: RejectedIdea[] = [];
  let fingerprints = allCandidates.map(fingerprintCandidate);
  let similarities = similarityMatrix(fingerprints, competitorFingerprints);
  const deduplicated = rejectNearDuplicates(initial, fingerprints);
  for (const candidate of initial.filter((item) => !deduplicated.some((accepted) => accepted.id === item.id))) rejectedIdeas.push({
    candidateId: candidate.id, name: candidate.name, phase: "deduplication",
    reason: "Collapsed because another candidate uses the same core mechanism for the same evidenced gap; naming or cosmetic variation is not distinct.",
    evidenceIds: candidate.evidenceIds, decisiveRisks: [], mutatedFrom: null,
  });
  const excluded = (input.excludedMechanisms ?? []).map((item) => item.toLowerCase().trim()).filter(Boolean);
  const memoryFiltered = deduplicated.filter((candidate) => !excluded.some((item) => candidate.mechanismFamily.toLowerCase().includes(item)
    || candidate.mechanism.toLowerCase().includes(item)));
  for (const candidate of deduplicated.filter((item) => !memoryFiltered.some((accepted) => accepted.id === item.id))) rejectedIdeas.push({
    candidateId: candidate.id, name: candidate.name, phase: "deduplication",
    reason: "Excluded by explicit user memory/context because this mechanism was previously rejected; current instructions did not request reconsideration.",
    evidenceIds: candidate.evidenceIds, decisiveRisks: [], mutatedFrom: null,
  });
  const pool = memoryFiltered.filter((candidate) => !assessFounderFit(candidate, input.userContext).rejected);
  for (const candidate of memoryFiltered.filter((item) => !pool.some((accepted) => accepted.id === item.id))) {
    const fit = assessFounderFit(candidate, input.userContext);
    rejectedIdeas.push({
      candidateId: candidate.id, name: candidate.name, phase: "founder_constraint",
      reason: `Rejected by founder constraint mode: ${fit.reasons.join(" ")}`,
      evidenceIds: candidate.evidenceIds, decisiveRisks: [], mutatedFrom: null,
    });
  }
  const competitorIds = input.competitors.map((item) => item.id);
  const falsificationResults = pool.map((candidate) => falsifyCandidate(candidate, {
    evidence: input.sources, gaps: input.gaps, similarities, competitorIds,
  }));
  const survivors = pool.filter((candidate) => falsificationResults.find((item) => item.candidateId === candidate.id)?.outcome === "survived");
  for (const candidate of pool.filter((item) => falsificationResults.find((result) => result.candidateId === item.id)?.outcome === "rejected")) {
    const result = falsificationResults.find((item) => item.candidateId === candidate.id)!;
    rejectedIdeas.push({ candidateId: candidate.id, name: candidate.name, phase: "falsification", reason: result.reason, evidenceIds: candidate.evidenceIds, decisiveRisks: result.decisiveRisks.map((item) => item.dimension), mutatedFrom: null });
  }
  const desired = requestedIdeaCount(input.query);
  let survivorIterations = 0;
  let mutationSources = pool.filter((candidate) => {
    const result = falsificationResults.find((item) => item.candidateId === candidate.id);
    return result?.outcome === "mutate" && result.survivalScore >= 35 && candidate.evidenceIds.length > 0;
  });
  while (survivors.length < desired && mutationSources.length && survivorIterations < input.limits.maxSurvivorIterations && allCandidates.length < input.limits.maxCandidates) {
    survivorIterations += 1;
    const remainingBudget = input.limits.maxCandidates - allCandidates.length;
    const mutated = mutateCandidates(mutationSources, survivorIterations, Math.min(remainingBudget, desired - survivors.length));
    mutations.push(...mutated.mutations);
    allCandidates.push(...mutated.candidates);
    fingerprints = allCandidates.map(fingerprintCandidate);
    similarities = similarityMatrix(fingerprints, competitorFingerprints);
    const results = mutated.candidates.map((candidate) => falsifyCandidate(candidate, {
      evidence: input.sources, gaps: input.gaps, similarities, competitorIds,
    }));
    falsificationResults.push(...results);
    for (const mutation of mutated.mutations) mutation.result = results.find((item) => item.candidateId === mutation.resultCandidateId)?.outcome === "survived" ? "survived" : "rejected";
    survivors.push(...mutated.candidates.filter((candidate) => results.find((item) => item.candidateId === candidate.id)?.outcome === "survived"));
    for (const candidate of mutated.candidates.filter((item) => results.find((result) => result.candidateId === item.id)?.outcome !== "survived")) {
      const result = results.find((item) => item.candidateId === candidate.id)!;
      rejectedIdeas.push({ candidateId: candidate.id, name: candidate.name, phase: "mutation", reason: `${result.reason} Bounded rescue stops after this single mutation.`, evidenceIds: candidate.evidenceIds, decisiveRisks: result.decisiveRisks.map((item) => item.dimension), mutatedFrom: mutated.mutations.find((item) => item.resultCandidateId === candidate.id)?.parentCandidateId ?? null });
    }
    mutationSources = [];
  }
  const lineages = allCandidates.map((candidate) => buildLineage(candidate, {
    gaps: input.gaps, complaints: input.complaints, holes: graphHoles, contradictions, stitching: stitchingPatterns,
    signals: weakSignals, failedAttempts, mutations, evidence: input.sources,
  }));
  const scoredSurvivors = survivors.map((candidate) => {
    const falsification = falsificationResults.find((item) => item.candidateId === candidate.id)!;
    const score = scoreOpportunity(candidate, { gaps: input.gaps, holes: graphHoles, stitching: stitchingPatterns, signals: weakSignals, similarities, falsification, evidence: input.sources, competitorIds: input.competitors.map((item) => item.id), founderContext: input.userContext });
    return { candidate, falsification, score };
  }).sort((a, b) => b.score.score - a.score.score);
  const opportunityScores = scoredSurvivors.map((item) => item.score);
  const validationExperiments = scoredSurvivors.map((item) => generateValidationExperiment(item.candidate));
  const detailedSurvivors = scoredSurvivors.map(({ candidate, falsification, score }) => {
    const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
    const evidenceGate = evaluateEvidenceGate(candidate, { gap, evidence: input.sources, competitors: input.competitors, segments: input.segments, falsification,
      competitorRecall: input.competitorRecall?.find((item) => item.candidateId === candidate.id) });
    const assumptionLedger = buildAssumptionLedger(candidate, gap, falsification, input.sources);
    const whyNotBuilt = analyzeWhyNotBuilt(candidate, gap, input.sources);
    const counterfactual = buildCounterfactual(candidate, assumptionLedger);
    const moatStressTest = buildMoatStressTest(candidate, score);
    const adversarialReview = runAdversarialPanel(candidate, { gap, falsification, evidence: input.sources, assumptions: assumptionLedger });
    const validationExperiment = validationExperiments.find((item) => item.candidateId === candidate.id)!;
    const lifecycle = buildCandidateLifecycle(candidate, { falsification, gate: evidenceGate, rejected: undefined, at: (input.now ?? new Date()).toISOString() });
    return {
      candidate, fingerprint: fingerprints.find((item) => item.candidateId === candidate.id)!,
      nearestAnalogues: similarities.filter((item) => item.leftId === candidate.id || item.rightId === candidate.id).slice(0, 3),
      falsification, lineage: lineages.find((item) => item.candidateId === candidate.id)!, score,
      validationExperiment, evidenceGate, lifecycle, assumptionLedger, whyNotBuilt, counterfactual, moatStressTest, adversarialReview,
      validationPlan: buildValidationPlan(candidate, validationExperiment, assumptionLedger),
    } satisfies FinalOpportunity;
  });
  const gateCleared = detailedSurvivors.filter((item) => item.evidenceGate.survivalGatePassed);
  for (const item of detailedSurvivors.filter((entry) => !entry.evidenceGate.survivalGatePassed)) rejectedIdeas.push({
    candidateId: item.candidate.id, name: item.candidate.name, phase: "evidence_gate",
    reason: `Research falsification did not translate into a complete survival gate: ${item.evidenceGate.blockers.join(", ")}.`,
    evidenceIds: item.candidate.evidenceIds, decisiveRisks: item.falsification.decisiveRisks.map((risk) => risk.dimension), mutatedFrom: item.candidate.iteration ? item.candidate.rootCandidateId : null,
  });
  const finalOpportunities: FinalOpportunity[] = gateCleared.slice(0, desired);
  const selectedIds = new Set(finalOpportunities.map((item) => item.candidate.id));
  for (const item of scoredSurvivors.filter((entry) => !selectedIds.has(entry.candidate.id))) rejectedIdeas.push({
    candidateId: item.candidate.id, name: item.candidate.name, phase: "selection_cutoff",
    reason: `Survived falsification but ranked below the requested survivor cap; retained score ${item.score.score} with written factor reasoning instead of padding the final output.`,
    evidenceIds: item.candidate.evidenceIds, decisiveRisks: item.falsification.decisiveRisks.map((risk) => risk.dimension), mutatedFrom: item.candidate.iteration ? item.candidate.rootCandidateId : null,
  });
  for (const candidate of allCandidates.filter((item) => !selectedIds.has(item.id) && !rejectedIdeas.some((rejected) => rejected.candidateId === item.id))) {
    const result = falsificationResults.find((item) => item.candidateId === candidate.id);
    rejectedIdeas.push({
      candidateId: candidate.id, name: candidate.name, phase: result?.outcome === "mutate" ? "selection_cutoff" : "falsification",
      reason: result?.outcome === "mutate"
        ? "The candidate was eligible for one bounded mutation, but stronger survivors already filled the requested cap or the bounded mutation budget was unavailable; it was not rescued for completeness."
        : result?.reason ?? "The candidate did not reach the final evidence, differentiation, and falsification cutoff.",
      evidenceIds: candidate.evidenceIds, decisiveRisks: result?.decisiveRisks.map((risk) => risk.dimension) ?? [],
      mutatedFrom: candidate.iteration ? candidate.rootCandidateId : null,
    });
  }
  const evidenceGates: EvidenceGateResult[] = falsificationResults.map((falsification) => {
    const candidate = allCandidates.find((item) => item.id === falsification.candidateId)!;
    const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
    return evaluateEvidenceGate(candidate, { gap, evidence: input.sources, competitors: input.competitors, segments: input.segments, falsification,
      competitorRecall: input.competitorRecall?.find((item) => item.candidateId === candidate.id) });
  });
  const fallbackGate = (candidate: typeof allCandidates[number]): EvidenceGateResult => ({
    candidateId: candidate.id, thresholds: evidenceGates[0]?.thresholds ?? {
      minIndependentPainSignals: 3, minIndependentSpendSignals: 2, minCompetitorsAnalyzed: 3, minUnderservedSegments: 1,
      minTimingSignals: 1, minSourceTypes: 3, minCitationCoverage: .85, maxUnresolvedFatalFalsifications: 0,
    },
    observed: { independentPainSignals: 0, independentSpendSignals: 0, competitorsAnalyzed: input.competitors.length, underservedSegments: input.segments.length, timingSignals: 0, sourceTypes: 0, citationCoverage: candidate.evidenceIds.length ? 1 : 0, unresolvedFatalFalsifications: 0 },
    checks: { pain: false, spend: false, competition: input.competitors.length >= 3, competitorRecall: false, buyerSpecificity: Boolean(candidate.definition), segment: input.segments.length > 0, timing: false, sourceDiversity: false, citationCoverage: candidate.evidenceIds.length > 0, fatalFalsification: true },
    survivalGatePassed: false, validationEvidenceGatePassed: false, externallyValidated: false,
    classification: rejectedIdeas.some((item) => item.candidateId === candidate.id) ? "killed" : candidate.evidenceIds.length ? "promising" : "discovered",
    blockers: ["falsification_not_completed", "external_validation_not_completed"], rationale: "Candidate did not complete the survival and validation gates.",
  });
  const candidateLifecycles = allCandidates.map((candidate) => {
    const falsification = falsificationResults.find((item) => item.candidateId === candidate.id);
    const gate = evidenceGates.find((item) => item.candidateId === candidate.id) ?? fallbackGate(candidate);
    return buildCandidateLifecycle(candidate, { falsification, gate, rejected: rejectedIdeas.find((item) => item.candidateId === candidate.id), at: (input.now ?? new Date()).toISOString() });
  });
  for (const opportunity of finalOpportunities) opportunity.lifecycle = candidateLifecycles.find((item) => item.candidateId === opportunity.candidate.id)!;
  const assumptionLedger = detailedSurvivors.flatMap((item) => item.assumptionLedger);
  const adversarialReviews = detailedSurvivors.flatMap((item) => [item.adversarialReview.bull, item.adversarialReview.bear, item.adversarialReview.judge]);
  const nextBestAction = chooseNextBestAction(finalOpportunities);
  const taskGraph = buildResearchTaskGraph({
    runSeed: input.query, depth: input.depth ?? "standard", at: (input.now ?? new Date()).toISOString(),
    evidenceIds: input.sources.map((item) => item.id), candidateIds: allCandidates.map((item) => item.id), partial: input.allowGeneration === false,
  });
  const budgetUsage: PipelineBudgetUsage = {
    providerCalls: 0, counterevidenceSearches: 0, agentCalls: 0, modelIterations: 0, estimatedProviderCredits: 0,
    candidatesGenerated: allCandidates.length, survivorIterations,
    sourceCount: input.sources.length, exhausted: false,
    gracefulDegradation: "none",
  };
  return {
    opportunityGraph, graphHoles, assumptions, contradictions, stitchingPatterns, weakSignals, failedAttempts,
    candidates: allCandidates, mutations, fingerprints, similarities, falsificationResults, lineages,
    opportunityScores, validationExperiments, finalOpportunities, rejectedIdeas, budgetUsage,
    candidateLifecycles, evidenceGates, assumptionLedger, adversarialReviews, taskGraph, nextBestAction,
  };
}
