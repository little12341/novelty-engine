import { NextRequest, NextResponse } from "next/server";
import { exportResearchResult } from "@/lib/research/exports";
import { getResearchResultById } from "@/lib/research/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (!['json', 'markdown', 'print'].includes(format)) return NextResponse.json({ error: "format must be json, markdown, or print." }, { status: 400 });
  const run = await getResearchResultById(runId);
  if (!run) return NextResponse.json({ error: "Research run was not found." }, { status: 404 });
  const exported = exportResearchResult(run, format as "json" | "markdown" | "print");
  if (format === "markdown") return new NextResponse(exported as string, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "private, no-store" } });
  return NextResponse.json(exported, { headers: { "Cache-Control": "private, no-store" } });
}
