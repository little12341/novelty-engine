import { NextRequest, NextResponse } from "next/server";
import { saveResearchFeedback } from "@/lib/research/feedback";
import type { FeedbackKind } from "@/lib/research/types";
import { BoundedJsonError, clientNetworkIdentity, operationalLog, readBoundedJson, safeErrorCategory } from "@/lib/http-safety";
import { acquireProtection } from "@/lib/research/protection";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Cross-site feedback submissions are not accepted." }, { status: 403 });
  let body: { runId?: unknown; kind?: unknown; targetId?: unknown; note?: unknown; companyWebsite?: unknown };
  try {
    body = await readBoundedJson<typeof body>(request, 2_048);
  } catch (error) {
    const bounded = error instanceof BoundedJsonError ? error : new BoundedJsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
    return NextResponse.json({ error: bounded.message, code: bounded.code }, { status: bounded.status });
  }
  if (typeof body.kind !== "string" || typeof body.note !== "string") return NextResponse.json({ error: "kind and note are required." }, { status: 400 });
  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim()) return NextResponse.json({ accepted: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  const permit = await acquireProtection(`${clientNetworkIdentity(request)}:feedback`, false);
  if (!permit.allowed) {
    operationalLog("warn", "feedback_rate_limited", { reason: permit.reason, backend: permit.backend });
    return NextResponse.json({ error: "Feedback request limit reached.", code: permit.reason.toUpperCase() }, { status: 429, headers: { "Retry-After": String(permit.retryAfterSeconds) } });
  }
  try {
    const feedback = await saveResearchFeedback({
      runId: typeof body.runId === "string" ? body.runId : undefined,
      kind: body.kind as FeedbackKind,
      targetId: typeof body.targetId === "string" ? body.targetId : undefined,
      note: body.note,
    });
    operationalLog("info", "beta_feedback_received", { kind: feedback.kind, hasRunId: feedback.runId !== null });
    return NextResponse.json({ accepted: true, id: feedback.id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    operationalLog("error", "feedback_save_failed", { category: safeErrorCategory(error) });
    return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 });
  } finally {
    await permit.release();
  }
}
