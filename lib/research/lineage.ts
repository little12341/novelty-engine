import type { CandidateGap, ComplaintCluster, ContradictionHypothesis, Evidence, FailedAttempt, GraphHole, IdeaCandidate, IdeaLineage, LineageStep, MutationRecord, WeakSignal, WorkflowStitchingPattern } from "./types.ts";
import { classifyClaim, traceableClaim } from "./quality.ts";

export function buildLineage(candidate: IdeaCandidate, input: {
  gaps: CandidateGap[]; complaints: ComplaintCluster[]; holes: GraphHole[]; contradictions: ContradictionHypothesis[];
  stitching: WorkflowStitchingPattern[]; signals: WeakSignal[]; failedAttempts: FailedAttempt[]; mutations: MutationRecord[]; evidence?: Evidence[];
}): IdeaLineage {
  const evidence = input.evidence ?? [];
  const steps: LineageStep[] = [];
  const step = (value: Omit<LineageStep, "claimStatus">): LineageStep => ({
    ...value,
    claimStatus: ["graph_hole", "contradiction", "mutation"].includes(value.kind) ? "INFERRED" : classifyClaim(value.evidenceIds, evidence),
  });
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const complaint = input.complaints.find((item) => gap?.supportingEvidenceIds.some((id) => item.representativeEvidenceIds.includes(id)));
  if (complaint) steps.push(step({ kind: "complaint", refId: complaint.id, label: complaint.label, evidenceIds: complaint.representativeEvidenceIds }));
  const stitch = input.stitching.find((item) => candidate.sourceStitchingIds.includes(item.id));
  if (stitch) steps.push(step({ kind: "workaround", refId: stitch.id, label: stitch.tools.length ? stitch.tools.join(" + ") : stitch.job, evidenceIds: stitch.evidenceIds }));
  if (gap?.affectedSegment) steps.push(step({ kind: "segment", refId: gap.id, label: gap.affectedSegment, evidenceIds: gap.supportingEvidenceIds }));
  const hole = input.holes.find((item) => candidate.sourceGraphHoleIds.includes(item.id));
  if (hole) steps.push(step({ kind: "graph_hole", refId: hole.id, label: hole.summary, evidenceIds: hole.evidenceIds }));
  const contradiction = input.contradictions.find((item) => candidate.sourceContradictionIds.includes(item.id));
  if (contradiction) steps.push(step({ kind: "contradiction", refId: contradiction.id, label: contradiction.hypothesis, evidenceIds: contradiction.evidenceIds }));
  const signal = input.signals.find((item) => candidate.sourceSignalIds.includes(item.id));
  if (signal) steps.push(step({ kind: "technology", refId: signal.id, label: signal.label, evidenceIds: signal.evidenceIds }));
  const failed = input.failedAttempts.find((item) => candidate.sourceFailedAttemptIds.includes(item.id));
  if (failed) steps.push(step({ kind: "failed_attempt", refId: failed.id, label: `${failed.name}: blocker ${failed.blocker}`, evidenceIds: failed.allEvidenceIds }));
  const mutation = input.mutations.find((item) => item.resultCandidateId === candidate.id);
  if (mutation) steps.push(step({ kind: "mutation", refId: mutation.id, label: `${mutation.dimension}: ${mutation.before ?? "unknown"} → ${mutation.after}`, evidenceIds: [] }));
  const observations = steps.filter((item) => ["complaint", "workaround", "segment", "technology", "failed_attempt"].includes(item.kind)).map((item) => traceableClaim(item.label, item.evidenceIds, evidence, "Observation derived from the named upstream record; source wording and truth are not silently strengthened."));
  const contradictionClaims = steps.filter((item) => item.kind === "contradiction" || item.kind === "graph_hole").map((item) => ({
    ...traceableClaim(item.label, item.evidenceIds, evidence, "A structured inference that combines retrieved observations; its source facts may be verified but this transformation remains inferred."),
    status: "INFERRED" as const,
  }));
  const mutationRecords = input.mutations.filter((item) => item.resultCandidateId === candidate.id).map((item) => ({ mutationId: item.id, parentCandidateId: item.parentCandidateId, dimension: item.dimension, before: item.before, after: item.after }));
  return {
    candidateId: candidate.id, steps,
    summary: steps.length ? steps.map((item) => `${item.kind.replaceAll("_", " ")} [${item.claimStatus}]`).join(" → ") : "hypothesis [UNKNOWN] → candidate",
    observations, contradictions: contradictionClaims, mutations: mutationRecords,
    evidenceIds: [...new Set(steps.flatMap((item) => item.evidenceIds))],
  };
}
