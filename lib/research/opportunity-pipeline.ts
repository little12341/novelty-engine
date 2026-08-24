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
import type { CandidateGap, ComplaintCluster, Competitor, Evidence, FinalOpportunity, MutationRecord, PipelineBudgetUsage, ResearchLimits, UnderservedSegment } from "./types.ts";

export function runOpportunityPipeline(input: {
  query: string; sources: Evidence[]; competitors: Competitor[]; complaints: ComplaintCluster[];
  segments: UnderservedSegment[]; gaps: CandidateGap[]; limits: ResearchLimits; now?: Date;
}) {
  const initialGraph = buildOpportunityGraph(input.sources, input.competitors, input.complaints, input.segments, input.gaps);
  const graphHoles = detectGraphHoles(initialGraph);
  const stitchingPatterns = detectWorkflowStitching(input.sources, input.complaints);
  const weakSignals = normalizeWeakSignals(input.sources, input.now);
  const failedAttempts = mineFailedAttempts(input.sources, weakSignals);
  const opportunityGraph = addFailedAttemptsToGraph(initialGraph, failedAttempts);
  const assumptions = extractAssumptions(input.sources, input.competitors);
  const contradictions = generateContradictions(assumptions);
  const initial = generateCandidates({
    query: input.query, gaps: input.gaps, graphHoles, contradictions, stitching: stitchingPatterns,
    signals: weakSignals, failedAttempts, maxCandidates: input.limits.maxCandidates,
  });
  const competitorFingerprints = input.competitors.map(fingerprintCompetitor);
  const allCandidates = [...initial];
  const mutations: MutationRecord[] = [];
  let fingerprints = allCandidates.map(fingerprintCandidate);
  let similarities = similarityMatrix(fingerprints, competitorFingerprints);
  const pool = rejectNearDuplicates(initial, fingerprints).filter((candidate) => {
    const nearestCompetitor = similarities.filter((item) => item.leftId === candidate.id && competitorFingerprints.some((fingerprint) => fingerprint.candidateId === item.rightId)).reduce((max, item) => Math.max(max, item.score), 0);
    return nearestCompetitor < 0.78;
  });
  const falsificationResults = pool.map((candidate) => falsifyCandidate(candidate, { evidence: input.sources, gaps: input.gaps, similarities }));
  const survivors = pool.filter((candidate) => falsificationResults.find((item) => item.candidateId === candidate.id)?.outcome === "survived");
  const desired = requestedIdeaCount(input.query);
  let survivorIterations = 0;
  let mutationSources = pool.filter((candidate) => falsificationResults.find((item) => item.candidateId === candidate.id)?.outcome !== "survived");
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
    survivors.push(...mutated.candidates.filter((candidate) => results.find((item) => item.candidateId === candidate.id)?.outcome === "survived"));
    mutationSources = mutated.candidates.filter((candidate) => results.find((item) => item.candidateId === candidate.id)?.outcome === "mutate");
  }
  const lineages = allCandidates.map((candidate) => buildLineage(candidate, {
    gaps: input.gaps, complaints: input.complaints, holes: graphHoles, contradictions, stitching: stitchingPatterns,
    signals: weakSignals, failedAttempts, mutations,
  }));
  const scoredSurvivors = survivors.map((candidate) => {
    const falsification = falsificationResults.find((item) => item.candidateId === candidate.id)!;
    const score = scoreOpportunity(candidate, { gaps: input.gaps, holes: graphHoles, stitching: stitchingPatterns, signals: weakSignals, similarities, falsification });
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
  const budgetUsage: PipelineBudgetUsage = {
    providerCalls: 0, modelIterations: 0, candidatesGenerated: allCandidates.length, survivorIterations,
    sourceCount: input.sources.length, exhausted: allCandidates.length >= input.limits.maxCandidates || survivorIterations >= input.limits.maxSurvivorIterations,
  };
  return {
    opportunityGraph, graphHoles, assumptions, contradictions, stitchingPatterns, weakSignals, failedAttempts,
    candidates: allCandidates, mutations, fingerprints, similarities, falsificationResults, lineages,
    opportunityScores, validationExperiments, finalOpportunities, budgetUsage,
  };
}
