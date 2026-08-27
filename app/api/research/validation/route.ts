import { NextRequest, NextResponse } from "next/server";
import { listValidationOutcomes, recordValidationOutcome } from "@/lib/research/validation-outcomes";
import type { ValidationExperiment } from "@/lib/research/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id") ?? "";
  if (!runId) return NextResponse.json({ error: "run_id is required." }, { status: 400 });
  return NextResponse.json({ outcomes: await listValidationOutcomes(runId, request.nextUrl.searchParams.get("candidate_id") ?? undefined) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? "0") > 12_288) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  try {
    const body = await request.json() as { runId?: string; candidateId?: string; experimentType?: ValidationExperiment["type"]; success?: boolean; observedMetrics?: string[]; artifactUrls?: string[] };
    if (typeof body.runId !== "string" || typeof body.candidateId !== "string" || typeof body.experimentType !== "string" || typeof body.success !== "boolean" || !Array.isArray(body.observedMetrics)) return NextResponse.json({ error: "runId, candidateId, experimentType, success, and observedMetrics are required." }, { status: 400 });
    return NextResponse.json(await recordValidationOutcome({ runId: body.runId, candidateId: body.candidateId, experimentType: body.experimentType, success: body.success, observedMetrics: body.observedMetrics, artifactUrls: Array.isArray(body.artifactUrls) ? body.artifactUrls : undefined }), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record validation." }, { status: error instanceof RangeError ? 400 : 500 });
  }
}
