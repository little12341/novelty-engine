import { randomUUID } from "node:crypto";
import type { FeedbackKind, ResearchFeedback } from "./types.ts";
import { privateIdentity, putPlatformRecord } from "./platform-store.ts";

const KINDS = new Set<FeedbackKind>([
  "useful", "wrong", "irrelevant", "already_known", "missing_competitor", "competitor_does_not_solve_job",
  "opportunity_already_exists", "source_is_weak", "validation_result_success", "validation_result_failure",
  "installation_problem", "mcp_failure",
]);
const RUN_OPTIONAL_KINDS = new Set<FeedbackKind>(["installation_problem", "mcp_failure"]);

export async function saveResearchFeedback(input: {
  runId?: string; userId?: string; kind: FeedbackKind; targetId?: string; note?: string; now?: Date;
}): Promise<ResearchFeedback> {
  if (!KINDS.has(input.kind)) throw new RangeError("Unsupported feedback kind.");
  const runId = input.runId?.trim() || null;
  if (runId && !/^research_[a-zA-Z0-9_]{8,80}$/.test(runId)) throw new RangeError("Invalid research run ID.");
  if (!runId && !RUN_OPTIONAL_KINDS.has(input.kind)) throw new RangeError("A research run ID is required for research-result feedback.");
  const note = input.note?.trim().slice(0, 1_000) ?? "";
  if (note.length < 5) throw new RangeError("Feedback must include a short description.");
  const createdAt = (input.now ?? new Date()).toISOString();
  const feedback: ResearchFeedback = {
    id: `feedback_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    runId,
    userId: input.userId ? privateIdentity(input.userId) : null,
    kind: input.kind,
    targetId: input.targetId?.trim().slice(0, 120) ?? null,
    note,
    createdAt,
    evidenceStatus: "USER_PROVIDED_CONTEXT_NOT_PUBLIC_EVIDENCE",
  };
  await putPlatformRecord("feedback", feedback.id, feedback, new Date(createdAt).getTime());
  return feedback;
}
