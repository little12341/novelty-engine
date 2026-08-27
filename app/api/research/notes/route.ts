import { NextRequest, NextResponse } from "next/server";
import { listResearchNotes, saveResearchNote } from "@/lib/research/notes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id") ?? "";
  if (userId.length < 3) return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const notes = await listResearchNotes(userId, {
    runId: request.nextUrl.searchParams.get("run_id") ?? undefined,
    folder: request.nextUrl.searchParams.get("folder") ?? undefined,
    tag: request.nextUrl.searchParams.get("tag") ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return NextResponse.json({ notes }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 8_192) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  try {
    const body = await request.json() as { runId?: string; userId?: string; candidateId?: string; kind?: "research_note" | "decision_log"; title?: string; body?: string; tags?: string[]; folder?: string };
    if (typeof body.runId !== "string" || typeof body.userId !== "string" || typeof body.title !== "string" || typeof body.body !== "string") return NextResponse.json({ error: "runId, userId, title, and body are required." }, { status: 400 });
    return NextResponse.json(await saveResearchNote({ runId: body.runId, userId: body.userId, candidateId: body.candidateId, kind: body.kind, title: body.title, body: body.body, tags: Array.isArray(body.tags) ? body.tags : undefined, folder: body.folder }), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note." }, { status: error instanceof RangeError ? 400 : 500 });
  }
}
