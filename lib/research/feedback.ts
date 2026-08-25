import { randomUUID } from "node:crypto";
import type { FeedbackKind, ResearchFeedback } from "./types.ts";
import { privateIdentity, putPlatformRecord } from "./platform-store.ts";

const KINDS = new Set<FeedbackKind>([
  "useful", "wrong", "irrelevant", "already_known", "missing_competitor", "competitor_does_not_solve_job",
  "opportunity_already_exists", "source_is_weak", "validation_result_success", "validation_result_failure",
]);

export async function saveResearchFeedback(input: {
  runId: string; userId?: string; kind: FeedbackKind; targetId?: string; note?: string; now?: Date;
}): Promise<ResearchFeedback> {
  if (!/^research_[a-zA-Z0-9_]{8,80}$/.test(input.runId)) throw new RangeError("Invalid research run ID.");
  if (!KINDS.has(input.kind)) throw new RangeError("Unsupported feedback kind.");
  const createdAt = (input.now ?? new Date()).toISOString();
  const feedback: ResearchFeedback = {
    id: `feedback_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    runId: input.runId,
    userId: input.userId ? privateIdentity(input.userId) : null,
    kind: input.kind,
    targetId: input.targetId?.trim().slice(0, 120) ?? null,
    note: input.note?.trim().slice(0, 1_000) ?? null,
    createdAt,
    evidenceStatus: "USER_PROVIDED_CONTEXT_NOT_PUBLIC_EVIDENCE",
  };
  await putPlatformRecord("feedback", feedback.id, feedback, new Date(createdAt).getTime());
  return feedback;
}
