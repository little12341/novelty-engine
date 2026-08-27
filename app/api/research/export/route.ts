import { NextRequest, NextResponse } from "next/server";
import { exportResearchResult } from "@/lib/research/exports";
import type { ResearchExportFormat } from "@/lib/research/exports";
import { getResearchResultById } from "@/lib/research/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run_id") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const formats: ResearchExportFormat[] = ["json", "markdown", "print", "csv", "competitor_matrix", "validation_plan", "opportunity_brief", "investor_memo", "bibliography"];
  if (!formats.includes(format as ResearchExportFormat)) return NextResponse.json({ error: `format must be one of: ${formats.join(", ")}.` }, { status: 400 });
  const run = await getResearchResultById(runId);
  if (!run) return NextResponse.json({ error: "Research run was not found." }, { status: 404 });
  const exported = exportResearchResult(run, format as ResearchExportFormat);
  if (["markdown", "investor_memo"].includes(format)) return new NextResponse(exported as string, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "private, no-store" } });
  if (["csv", "competitor_matrix"].includes(format)) return new NextResponse(exported as string, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store" } });
  return NextResponse.json(exported, { headers: { "Cache-Control": "private, no-store" } });
}
