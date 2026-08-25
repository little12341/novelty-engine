import { NextRequest, NextResponse } from "next/server";
import { disableResearchMemory, getResearchMemory, saveResearchMemory } from "@/lib/research/memory";
import type { ResearchUserContext } from "@/lib/research/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profile_id") ?? "";
  const userId = request.headers.get("x-novelty-user-id") ?? "";
  if (!profileId || !userId) return NextResponse.json({ error: "profile_id and x-novelty-user-id are required." }, { status: 400 });
  const profile = await getResearchMemory(profileId, userId);
  return profile ? NextResponse.json(profile, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Profile was not found." }, { status: 404 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: unknown; optedIn?: unknown; context?: unknown; previousRunIds?: unknown };
    if (typeof body.userId !== "string" || body.optedIn !== true || !body.context || typeof body.context !== "object" || Array.isArray(body.context)) return NextResponse.json({ error: "Explicit userId, optedIn=true, and a structured context are required." }, { status: 400 });
    const profile = await saveResearchMemory({ userId: body.userId, optedIn: true, context: body.context as ResearchUserContext, previousRunIds: Array.isArray(body.previousRunIds) ? body.previousRunIds.filter((item): item is string => typeof item === "string") : undefined });
    return NextResponse.json(profile, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid memory profile." }, { status: error instanceof RangeError ? 400 : 500 });
  }
}


export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null) as { profileId?: unknown; userId?: unknown } | null;
  if (!body || typeof body.profileId !== "string" || typeof body.userId !== "string") return NextResponse.json({ error: "profileId and userId are required." }, { status: 400 });
  return await disableResearchMemory(body.profileId, body.userId)
    ? NextResponse.json({ disabled: true }, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Profile was not found." }, { status: 404 });
}
