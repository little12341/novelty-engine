import type { IdeaCandidate, ValidationExperiment } from "./types.ts";

export function generateValidationExperiment(candidate: IdeaCandidate): ValidationExperiment {
  const technical = /sensor|hardware|edge|device|robot/i.test(`${candidate.technology} ${candidate.mechanism}`);
  const type = technical ? "technical_poc" : candidate.payer && candidate.payer !== candidate.targetCustomer ? "cold_outreach" : "concierge";
  if (technical) return {
    candidateId: candidate.id, type, hypothesis: `The core mechanism can complete “${candidate.jobToBeDone}” reliably enough to outperform the current workaround.`,
    targetUser: candidate.targetCustomer ?? "the specific affected segment identified in discovery",
    action: "Build a narrow proof using 10 representative real-world cases; compare accuracy, completion time, and failures with the current manual method.",
    successThreshold: "At least 8 of 10 cases succeed and median task time improves by 50% without a critical failure.",
    failureThreshold: "Fewer than 6 of 10 cases succeed, or any failure creates unacceptable safety, trust, or compliance risk.",
    estimatedCost: "$0–$250 depending on prototype hardware", estimatedTime: "24–72 hours",
    decision: "If successful, test willingness to pay; if failed, reject the mechanism or isolate the failing technical assumption.", ethicsNote: null,
  };
  return {
    candidateId: candidate.id, type, hypothesis: `${candidate.targetCustomer ?? "The target segment"} will commit time or a next step for this outcome, not merely say it sounds useful.`,
    targetUser: candidate.targetCustomer ?? "the specific affected segment identified in discovery",
    action: `Contact 25 qualified people with a concrete offer for a manual ${candidate.name} service. Ask 5 to supply a real case and schedule delivery; quote the proposed ${candidate.businessModel ?? "outcome-based"} model.`,
    successThreshold: "At least 5 qualified replies, 3 real-case submissions, and 1 paid pilot or signed letter of intent.",
    failureThreshold: "Fewer than 2 qualified replies or no one supplies a real case after 25 well-targeted contacts.",
    estimatedCost: "$0–$100", estimatedTime: "24–72 hours",
    decision: "Proceed to a narrow concierge pilot on success; otherwise revise the segment/offer once, then reject if the retest also fails.",
    ethicsNote: "Represent the service as a manual pilot. Do not imply unavailable automation or take non-refundable payment for an unavailable product.",
  };
}
