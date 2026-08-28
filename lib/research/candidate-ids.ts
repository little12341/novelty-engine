import type { CandidateIdMapping, IdeaCandidate, ResearchResult } from "./types.ts";

function identityKey(candidate: IdeaCandidate): string {
  return [candidate.rootCandidateId, candidate.mechanismFamily, candidate.iteration, candidate.sourceGapIds[0] ?? "", candidate.definition?.specificProblem ?? candidate.jobToBeDone]
    .join("|").toLowerCase().replace(/\s+/g, " ");
}

export function buildCandidateIdMapping(provisional: IdeaCandidate[], canonical: IdeaCandidate[]): CandidateIdMapping {
  const canonicalById = new Map(canonical.map((item) => [item.id, item]));
  const canonicalByKey = new Map(canonical.map((item) => [identityKey(item), item.id]));
  const provisionalToCanonical: Record<string, string> = {};
  for (const candidate of provisional) {
    const canonicalId = canonicalById.has(candidate.id) ? candidate.id : canonicalByKey.get(identityKey(candidate));
    if (canonicalId) provisionalToCanonical[candidate.id] = canonicalId;
  }
  for (const candidate of canonical) provisionalToCanonical[candidate.id] = candidate.id;
  return { canonicalIds: canonical.map((item) => item.id), provisionalToCanonical };
}

export function resolveCandidateId(run: Pick<ResearchResult, "candidateIdMapping" | "candidates">, candidateId: string): string | null {
  const mapped = run.candidateIdMapping?.provisionalToCanonical[candidateId] ?? candidateId;
  return run.candidates.some((item) => item.id === mapped) ? mapped : null;
}
