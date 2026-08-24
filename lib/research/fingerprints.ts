import type { Competitor, IdeaCandidate, NoveltyFingerprint, SimilarityResult } from "./types.ts";
import { unique } from "./utils.ts";

function tokens(value: string | null): string[] {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !["the", "and", "for", "with", "that", "from", "into"].includes(token));
}

export function fingerprintCandidate(candidate: IdeaCandidate): NoveltyFingerprint {
  const dimensions = {
    targetCustomer: candidate.targetCustomer, jobToBeDone: candidate.jobToBeDone, mechanism: candidate.mechanism,
    interface: candidate.interface, technology: candidate.technology, businessModel: candidate.businessModel,
    distribution: candidate.distribution, dataSource: candidate.dataSource, ownershipModel: candidate.ownershipModel,
    workflowPosition: candidate.workflowPosition, coreDifferentiator: candidate.differentiator,
  };
  return { candidateId: candidate.id, dimensions, tokens: unique(Object.values(dimensions).flatMap((value) => tokens(value))) };
}

export function fingerprintCompetitor(competitor: Competitor): NoveltyFingerprint {
  const name = competitor.name.value ?? competitor.id;
  const dimensions = {
    targetCustomer: competitor.targetCustomer.value, jobToBeDone: competitor.coreJobToBeDone.value ?? "unknown",
    mechanism: competitor.keyFeatures.value?.join(" ") ?? "unknown", interface: "software product",
    technology: null, businessModel: competitor.pricing.value, distribution: null, dataSource: null,
    ownershipModel: competitor.pricing.value ? "subscription or purchase" : null, workflowPosition: competitor.positioning.value ?? "unknown",
    coreDifferentiator: competitor.positioning.value ?? name,
  };
  return { candidateId: competitor.id, dimensions, tokens: unique(Object.values(dimensions).flatMap((value) => tokens(value))) };
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a); const right = new Set(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / (left.size + right.size - intersection);
}

export function compareFingerprints(left: NoveltyFingerprint, right: NoveltyFingerprint): SimilarityResult {
  const matchingDimensions = Object.keys(left.dimensions).filter((key) => {
    const dimension = key as keyof NoveltyFingerprint["dimensions"];
    return jaccard(tokens(left.dimensions[dimension]), tokens(right.dimensions[dimension])) >= 0.35;
  });
  const tokenScore = jaccard(left.tokens, right.tokens);
  const score = Math.round(Math.min(1, tokenScore * 0.55 + matchingDimensions.length / 11 * 0.45) * 100) / 100;
  return {
    leftId: left.candidateId, rightId: right.candidateId, score, matchingDimensions,
    explanation: `Transparent heuristic: 55% token overlap and 45% matching fingerprint dimensions; ${matchingDimensions.length} of 11 dimensions matched.`, heuristic: true,
  };
}

export function similarityMatrix(candidates: NoveltyFingerprint[], competitors: NoveltyFingerprint[]): SimilarityResult[] {
  const results: SimilarityResult[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    for (const competitor of competitors) results.push(compareFingerprints(candidates[index], competitor));
    for (let other = index + 1; other < candidates.length; other += 1) results.push(compareFingerprints(candidates[index], candidates[other]));
  }
  return results.sort((a, b) => b.score - a.score);
}

export function rejectNearDuplicates(candidates: IdeaCandidate[], fingerprints: NoveltyFingerprint[], threshold = 0.72): IdeaCandidate[] {
  const accepted: IdeaCandidate[] = [];
  for (const candidate of candidates) {
    const fingerprint = fingerprints.find((item) => item.candidateId === candidate.id)!;
    if (accepted.some((item) => compareFingerprints(fingerprint, fingerprints.find((other) => other.candidateId === item.id)!).score >= threshold)) continue;
    accepted.push(candidate);
  }
  return accepted;
}
