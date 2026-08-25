import type { IdeaCandidate, MutationDimension, MutationRecord } from "./types.ts";
import { stableId } from "./utils.ts";

const MUTATIONS: Array<{ dimension: MutationDimension; read: keyof IdeaCandidate; after: (candidate: IdeaCandidate) => string; effect: string }> = [
  { dimension: "payer", read: "payer", after: () => "downstream beneficiary", effect: "separates user and payer to align price with avoided cost" },
  { dimension: "ownership_model", read: "ownershipModel", after: () => "shared, temporary access", effect: "removes a purchase prerequisite" },
  { dimension: "interface", read: "interface", after: () => "ambient or existing-channel interaction", effect: "removes a new dashboard from the workflow" },
  { dimension: "human_autonomy", read: "mechanism", after: () => "autonomous by default with human exception review", effect: "compresses repetitive coordination into exception handling" },
  { dimension: "architecture", read: "technology", after: () => "local-first distributed coordination", effect: "minimizes centralized sensitive data" },
  { dimension: "revenue_model", read: "businessModel", after: () => "pay per verified outcome", effect: "moves risk from the buyer to the provider" },
  { dimension: "integration_depth", read: "workflowPosition", after: () => "embedded at the handoff between authoritative systems", effect: "avoids replacing incumbent systems" },
  { dimension: "data_source", read: "dataSource", after: () => "passive operational exhaust", effect: "removes user-maintained data" },
];

export function mutateCandidate(parent: IdeaCandidate, iteration: number, dimensionIndex = 0): { candidate: IdeaCandidate; mutation: MutationRecord } {
  const mutation = MUTATIONS[dimensionIndex % MUTATIONS.length];
  const after = mutation.after(parent);
  const id = stableId("candidate", `${parent.id}:${mutation.dimension}:${iteration}`);
  const candidate: IdeaCandidate = {
    ...parent, id, name: `${parent.name} / ${mutation.dimension.replaceAll("_", " ")}`,
    summary: `${parent.summary} The mutation ${mutation.effect}.`, iteration,
    [mutation.read]: after, rootCandidateId: parent.rootCandidateId || parent.id,
  };
  return { candidate, mutation: {
    id: stableId("mutation", `${parent.id}:${id}`), parentCandidateId: parent.id, resultCandidateId: id,
    dimension: mutation.dimension, before: typeof parent[mutation.read] === "string" ? parent[mutation.read] as string : null,
    after, effect: mutation.effect, iteration,
    boundedRationale: "One core constraint changed because the parent cleared the evidence gate but failed a bounded falsification test; no other dimensions were rescued.",
    result: "pending",
  } };
}

export function mutateCandidates(candidates: IdeaCandidate[], iteration: number, limit: number): { candidates: IdeaCandidate[]; mutations: MutationRecord[] } {
  const seenRoots = new Set<string>();
  const eligible = candidates.filter((candidate) => {
    const root = candidate.rootCandidateId || candidate.id;
    if (candidate.iteration > 0 || seenRoots.has(root)) return false;
    seenRoots.add(root);
    return true;
  });
  const pairs = eligible.slice(0, limit).map((candidate, index) => mutateCandidate(candidate, iteration, index + iteration));
  return { candidates: pairs.map((pair) => pair.candidate), mutations: pairs.map((pair) => pair.mutation) };
}
