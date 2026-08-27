import type { CandidateLifecycleEvent, CandidateLifecycleRecord, EvidenceGateResult, FalsificationResult, IdeaCandidate, RejectedIdea } from "./types.ts";

export function buildCandidateLifecycle(candidate: IdeaCandidate, input: {
  falsification: FalsificationResult | undefined;
  gate: EvidenceGateResult;
  rejected: RejectedIdea | undefined;
  at: string;
}): CandidateLifecycleRecord {
  const events: CandidateLifecycleEvent[] = [];
  const add = (state: CandidateLifecycleEvent["state"], reason: string, evidenceIds = candidate.evidenceIds, killCode: string | null = null) => {
    events.push({ candidateId: candidate.id, state, at: input.at, reason, evidenceIds: [...new Set(evidenceIds)], killCode });
  };
  add("DISCOVERED", "Candidate was generated from a cited gap, graph hole, contradiction, workflow stitch, signal, or failed-attempt record.");
  add("RESEARCHING", "Positive evidence, competitors, substitutes, spend, timing, and buyer signals were assessed.");
  if (input.falsification) {
    add("CHALLENGED", "The candidate entered an explicit adversarial challenge.");
    add("FALSIFICATION", input.falsification.reason, input.falsification.hypotheses.flatMap((item) => [...item.supportingEvidenceIds, ...item.counterEvidenceIds]));
  }
  if (input.rejected || input.gate.classification === "killed") {
    const reason = input.rejected?.reason ?? input.gate.rationale;
    add("KILLED", reason, input.rejected?.evidenceIds ?? candidate.evidenceIds, input.rejected?.phase ?? "evidence_gate");
  } else if (input.gate.classification === "validated") {
    add("SURVIVED", "The candidate cleared research falsification and the survival evidence gate.");
    add("VALIDATING", "The strict validation evidence gate passed and external validation was evaluated.");
    add("VALIDATED", "Configured evidence thresholds and external validation criteria passed.");
  } else if (input.gate.classification === "survived") {
    add("SURVIVED", "The candidate cleared the research survival gate. It remains explicitly not validated.");
    add("VALIDATING", `Validation is pending: ${input.gate.blockers.join(", ")}.`);
  }
  const terminal = events.at(-1)?.state ?? "DISCOVERED";
  return {
    candidateId: candidate.id,
    currentState: terminal,
    classification: terminal === "KILLED" ? "killed" : terminal === "VALIDATED" ? "validated" : terminal === "VALIDATING" || terminal === "SURVIVED" ? "survived" : candidate.evidenceIds.length ? "promising" : "discovered",
    events,
    exactKillReason: terminal === "KILLED" ? events.at(-1)!.reason : null,
    failureFeedback: terminal === "KILLED" ? [events.at(-1)!.killCode ?? "unknown", events.at(-1)!.reason] : [],
  };
}
