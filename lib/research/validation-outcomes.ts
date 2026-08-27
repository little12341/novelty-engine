import { randomUUID } from "node:crypto";
import { listPlatformRecords, putPlatformRecord } from "./platform-store.ts";
import { getResearchResultById } from "./store.ts";
import { validateExternalResearchUrl } from "./url-policy.ts";
import type { ExternalValidationOutcome, ValidationExperiment } from "./types.ts";

const EXPERIMENT_TYPES: ValidationExperiment["type"][] = ["fake_door", "cold_outreach", "concierge", "manual_service", "clickable_prototype", "preorder", "pricing_test", "comparison_ad", "marketplace_listing", "waitlist", "interview", "technical_poc"];

export async function recordValidationOutcome(input: {
  runId: string; candidateId: string; experimentType: ValidationExperiment["type"];
  success: boolean; observedMetrics: string[]; artifactUrls?: string[]; now?: Date;
}): Promise<ExternalValidationOutcome> {
  const run = await getResearchResultById(input.runId);
  if (!run) throw new RangeError("Research run was not found.");
  const opportunity = run.finalOpportunities.find((item) => item.candidate.id === input.candidateId);
  if (!opportunity) throw new RangeError("Only a recorded research survivor can receive an external validation outcome.");
  if (!EXPERIMENT_TYPES.includes(input.experimentType)) throw new RangeError("Unsupported validation experiment type.");
  const observedMetrics = input.observedMetrics.map((item) => item.trim().slice(0, 500)).filter(Boolean).slice(0, 20);
  if (!observedMetrics.length) throw new RangeError("Observed validation metrics are required; a bare success claim is insufficient.");
  const artifactUrls = [...new Set((input.artifactUrls ?? []).map((item) => validateExternalResearchUrl(item)).filter((item) => item.allowed && item.normalizedUrl).map((item) => item.normalizedUrl!))].slice(0, 20);
  const decision: ExternalValidationOutcome["decision"] = !input.success ? "KILLED"
    : opportunity.evidenceGate?.validationEvidenceGatePassed && artifactUrls.length ? "VALIDATED" : "INVESTIGATE";
  const at = (input.now ?? new Date()).toISOString();
  const rationale = decision === "VALIDATED" ? "The strict research evidence gate passed, the recorded experiment met its threshold, and at least one external artifact URL was supplied."
    : decision === "KILLED" ? "The recorded validation experiment failed its predeclared success criterion."
      : "The experiment was reported successful, but the strict research evidence gate or inspectable external artifact requirement is still incomplete.";
  const outcome: ExternalValidationOutcome = {
    id: `validation_${randomUUID().replaceAll("-", "").slice(0, 16)}`, runId: run.id, candidateId: opportunity.candidate.id,
    recordedAt: at, experimentType: input.experimentType, success: input.success, observedMetrics, artifactUrls, decision, rationale,
    lifecycleEvent: { candidateId: opportunity.candidate.id, state: decision === "VALIDATED" ? "VALIDATED" : decision === "KILLED" ? "KILLED" : "VALIDATING", at, reason: rationale, evidenceIds: opportunity.candidate.evidenceIds, killCode: decision === "KILLED" ? "external_validation_failed" : null },
  };
  await putPlatformRecord("validation", outcome.id, outcome, new Date(at).getTime());
  return outcome;
}

export async function listValidationOutcomes(runId: string, candidateId?: string) {
  return (await listPlatformRecords<ExternalValidationOutcome>("validation", 100)).filter((item) => item.runId === runId && (!candidateId || item.candidateId === candidateId));
}
