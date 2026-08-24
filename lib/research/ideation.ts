import type { CandidateGap, ContradictionHypothesis, FailedAttempt, GraphHole, IdeaCandidate, WeakSignal, WorkflowStitchingPattern } from "./types.ts";
import { evidenceUnion, stableId } from "./utils.ts";

const MECHANISMS = [
  { label: "event bridge", interface: "background integration", technology: "event-driven connectors", position: "between existing tools", differentiator: "moves only decision-relevant state without another system of record" },
  { label: "exception queue", interface: "message-based exception inbox", technology: "rules and lightweight automation", position: "after source-system events", differentiator: "asks for attention only when systems disagree" },
  { label: "shared proof", interface: "portable job receipt", technology: "local-first signed records", position: "at the handoff", differentiator: "coordinates parties without centralizing their operational data" },
  { label: "outcome service", interface: "concierge-to-automation service", technology: null, position: "at job completion", differentiator: "sells a verified outcome instead of another seat" },
  { label: "ambient capture", interface: "passive capture at the worksite", technology: "edge sensing or device metadata", position: "when work occurs", differentiator: "removes manual data entry rather than making it faster" },
];

export function requestedIdeaCount(query: string): number {
  const match = query.match(/\b(?:generate|give|find|propose|develop|create|return|want)\s+(\d{1,2})\b/i) ?? query.match(/\b(\d{1,2})\s+(?:ideas?|opportunities|concepts?)\b/i);
  return Math.min(12, Math.max(1, Number(match?.[1] ?? 5)));
}

export function generateCandidates(input: {
  query: string; gaps: CandidateGap[]; graphHoles: GraphHole[]; contradictions: ContradictionHypothesis[];
  stitching: WorkflowStitchingPattern[]; signals: WeakSignal[]; failedAttempts: FailedAttempt[]; maxCandidates: number;
}): IdeaCandidate[] {
  const desired = Math.min(input.maxCandidates, Math.max(requestedIdeaCount(input.query) * 3, 15));
  const bases = input.gaps.length ? input.gaps : [{
    id: "gap_unknown", problemStatement: "A market opening has not yet been supported by evidence.", affectedSegment: null,
    currentWorkaround: null, supportingEvidenceIds: [],
  }];
  const candidates: IdeaCandidate[] = [];
  for (let index = 0; index < desired; index += 1) {
    const gap = bases[index % bases.length];
    const mechanism = MECHANISMS[index % MECHANISMS.length];
    const hole = input.graphHoles[index % Math.max(1, input.graphHoles.length)];
    const contradiction = input.contradictions[index % Math.max(1, input.contradictions.length)];
    const stitch = input.stitching[index % Math.max(1, input.stitching.length)];
    const signal = input.signals[index % Math.max(1, input.signals.length)];
    const failed = input.failedAttempts.filter((item) => item.resurrectionEligible)[index % Math.max(1, input.failedAttempts.filter((item) => item.resurrectionEligible).length)];
    const target = gap.affectedSegment ?? stitch?.segment ?? null;
    const variation = Math.floor(index / MECHANISMS.length) + 1;
    const idSeed = `${gap.id}:${mechanism.label}:${variation}`;
    candidates.push({
      id: stableId("candidate", idSeed), name: `${mechanism.label.replace(/\b\w/g, (letter) => letter.toUpperCase())} ${variation}`,
      summary: `A ${mechanism.label} for ${target ?? "the affected user"} that addresses ${gap.problemStatement.toLowerCase()}`,
      targetCustomer: target, payer: index % 3 === 0 ? "beneficiary or downstream counterparty" : target,
      jobToBeDone: stitch?.job ?? gap.problemStatement, mechanism: contradiction?.hypothesis ?? mechanism.label,
      interface: mechanism.interface, technology: signal?.label ?? mechanism.technology,
      businessModel: index % 3 === 0 ? "per verified outcome" : index % 3 === 1 ? "usage-based" : "service subscription",
      distribution: index % 2 === 0 ? "through an existing workflow partner" : "direct to the affected segment",
      dataSource: mechanism.label === "ambient capture" ? "operational exhaust or device metadata" : "existing source systems",
      ownershipModel: index % 4 === 0 ? "shared or temporary access" : "customer-controlled",
      workflowPosition: mechanism.position, differentiator: mechanism.differentiator,
      sourceGapIds: gap.id === "gap_unknown" ? [] : [gap.id], sourceGraphHoleIds: hole ? [hole.id] : [],
      sourceContradictionIds: contradiction ? [contradiction.id] : [], sourceStitchingIds: stitch ? [stitch.id] : [],
      sourceSignalIds: signal ? [signal.id] : [], sourceFailedAttemptIds: failed ? [failed.id] : [],
      evidenceIds: evidenceUnion(gap.supportingEvidenceIds, hole?.evidenceIds ?? [], contradiction?.evidenceIds ?? [], stitch?.evidenceIds ?? [], signal?.evidenceIds ?? [], failed?.allEvidenceIds ?? []),
      iteration: 0,
    });
  }
  return candidates;
}
