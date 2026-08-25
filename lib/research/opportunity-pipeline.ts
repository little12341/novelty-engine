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
import type { CandidateGap, ComplaintCluster, Competitor, Evidence, FinalOpportunity, MutationRecord, PipelineBudgetUsage, RejectedIdea, ResearchLimits, UnderservedSegment } from "./types.ts";

export function runOpportunityPipeline(input: {
  query: string; sources: Evidence[]; competitors: Competitor[]; complaints: ComplaintCluster[];
  segments: UnderservedSegment[]; gaps: CandidateGap[]; limits: ResearchLimits; now?: Date; allowGeneration?: boolean;
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
  const pool = deduplicated.filter((candidate) => {
    const nearestCompetitor = similarities.filter((item) => item.leftId === candidate.id && competitorFingerprints.some((fingerprint) => fingerprint.candidateId === item.rightId)).reduce((max, item) => Math.max(max, item.score), 0);
    if (nearestCompetitor >= 0.78) rejectedIdeas.push({ candidateId: candidate.id, name: candidate.name, phase: "competitor_check", reason: "The mechanism-level fingerprint is too close to a retrieved competitor or substitute to call differentiated.", evidenceIds: candidate.evidenceIds, decisiveRisks: ["competition"], mutatedFrom: null });
    return nearestCompetitor < 0.78;
  });
  const falsificationResults = pool.map((candidate) => falsifyCandidate(candidate, { evidence: input.sources, gaps: input.gaps, similarities }));
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
    const results = mutated.candidates.map((candidate) => falsifyCandidate(candidate, { evidence: input.sources, gaps: input.gaps, similarities }));
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
    const score = scoreOpportunity(candidate, { gaps: input.gaps, holes: graphHoles, stitching: stitchingPatterns, signals: weakSignals, similarities, falsification, evidence: input.sources, competitorIds: input.competitors.map((item) => item.id) });
    return { candidate, falsification, score };
  }).sort((a, b) => b.score.score - a.score.score);
  const opportunityScores = scoredSurvivors.map((item) => item.score);
  const validationExperiments = scoredSurvivors.slice(0, desired).map((item) => generateValidationExperiment(item.candidate));
  const finalOpportunities: FinalOpportunity[] = scoredSurvivors.slice(0, desired).map(({ candidate, falsification, score }) => ({
    candidate, fingerprint: fingerprints.find((item) => item.candidateId === candidate.id)!,
    nearestAnalogues: similarities.filter((item) => item.leftId === candidate.id || item.rightId === candidate.id).slice(0, 3),
    falsification, lineage: lineages.find((item) => item.candidateId === candidate.id)!, score,
    validationExperiment: validationExperiments.find((item) => item.candidateId === candidate.id)!,
  }));
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
  const budgetUsage: PipelineBudgetUsage = {
    providerCalls: 0, modelIterations: 0, candidatesGenerated: allCandidates.length, survivorIterations,
    sourceCount: input.sources.length, exhausted: allCandidates.length >= input.limits.maxCandidates || survivorIterations >= input.limits.maxSurvivorIterations,
  };
  return {
    opportunityGraph, graphHoles, assumptions, contradictions, stitchingPatterns, weakSignals, failedAttempts,
    candidates: allCandidates, mutations, fingerprints, similarities, falsificationResults, lineages,
    opportunityScores, validationExperiments, finalOpportunities, rejectedIdeas, budgetUsage,
  };
}
