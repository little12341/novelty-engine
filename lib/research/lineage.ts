import type { CandidateGap, ComplaintCluster, ContradictionHypothesis, FailedAttempt, GraphHole, IdeaCandidate, IdeaLineage, LineageStep, MutationRecord, WeakSignal, WorkflowStitchingPattern } from "./types.ts";

export function buildLineage(candidate: IdeaCandidate, input: {
  gaps: CandidateGap[]; complaints: ComplaintCluster[]; holes: GraphHole[]; contradictions: ContradictionHypothesis[];
  stitching: WorkflowStitchingPattern[]; signals: WeakSignal[]; failedAttempts: FailedAttempt[]; mutations: MutationRecord[];
}): IdeaLineage {
  const steps: LineageStep[] = [];
  const gap = input.gaps.find((item) => candidate.sourceGapIds.includes(item.id));
  const complaint = input.complaints.find((item) => gap?.supportingEvidenceIds.some((id) => item.representativeEvidenceIds.includes(id)));
  if (complaint) steps.push({ kind: "complaint", refId: complaint.id, label: complaint.label, evidenceIds: complaint.representativeEvidenceIds });
  const stitch = input.stitching.find((item) => candidate.sourceStitchingIds.includes(item.id));
  if (stitch) steps.push({ kind: "workaround", refId: stitch.id, label: stitch.tools.length ? stitch.tools.join(" + ") : stitch.job, evidenceIds: stitch.evidenceIds });
  if (gap?.affectedSegment) steps.push({ kind: "segment", refId: gap.id, label: gap.affectedSegment, evidenceIds: gap.supportingEvidenceIds });
  const hole = input.holes.find((item) => candidate.sourceGraphHoleIds.includes(item.id));
  if (hole) steps.push({ kind: "graph_hole", refId: hole.id, label: hole.summary, evidenceIds: hole.evidenceIds });
  const contradiction = input.contradictions.find((item) => candidate.sourceContradictionIds.includes(item.id));
  if (contradiction) steps.push({ kind: "contradiction", refId: contradiction.id, label: contradiction.hypothesis, evidenceIds: contradiction.evidenceIds });
  const signal = input.signals.find((item) => candidate.sourceSignalIds.includes(item.id));
  if (signal) steps.push({ kind: "technology", refId: signal.id, label: signal.label, evidenceIds: signal.evidenceIds });
  const failed = input.failedAttempts.find((item) => candidate.sourceFailedAttemptIds.includes(item.id));
  if (failed) steps.push({ kind: "failed_attempt", refId: failed.id, label: `${failed.name}: blocker ${failed.blocker}`, evidenceIds: failed.allEvidenceIds });
  const mutation = input.mutations.find((item) => item.resultCandidateId === candidate.id);
  if (mutation) steps.push({ kind: "mutation", refId: mutation.id, label: `${mutation.dimension}: ${mutation.before ?? "unknown"} → ${mutation.after}`, evidenceIds: [] });
  return { candidateId: candidate.id, steps, summary: steps.length ? steps.map((item) => item.kind.replaceAll("_", " ")).join(" → ") : "hypothesis → candidate (no external evidence available)" };
}
