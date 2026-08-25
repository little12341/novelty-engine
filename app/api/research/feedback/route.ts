import { NextRequest, NextResponse } from "next/server";
import { saveResearchFeedback } from "@/lib/research/feedback";
import type { FeedbackKind } from "@/lib/research/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { runId?: unknown; userId?: unknown; kind?: unknown; targetId?: unknown; note?: unknown };
    if (typeof body.runId !== "string" || typeof body.kind !== "string") return NextResponse.json({ error: "runId and kind are required." }, { status: 400 });
    const feedback = await saveResearchFeedback({ runId: body.runId, kind: body.kind as FeedbackKind, userId: typeof body.userId === "string" ? body.userId : undefined, targetId: typeof body.targetId === "string" ? body.targetId : undefined, note: typeof body.note === "string" ? body.note : undefined });
    return NextResponse.json(feedback, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid feedback." }, { status: error instanceof RangeError ? 400 : 500 });
  }
}
