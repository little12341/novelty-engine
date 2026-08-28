import { NextRequest, NextResponse } from "next/server";
import { getResearchResultById, listResearchRuns } from "@/lib/research/store";
import { clientNetworkIdentity } from "@/lib/http-safety";
import { privateIdentity } from "@/lib/research/platform-store";

export const runtime = "nodejs";

const CATEGORIES = ["emerging_gaps", "vulnerable_incumbents", "rising_pains", "regulation", "ai_capability", "newly_funded", "open_source"] as const;
type Category = typeof CATEGORIES[number];

const patterns: Record<Category, RegExp> = {
  emerging_gaps: /gap|underserved|missing|workaround/i,
  vulnerable_incumbents: /incumbent|too expensive|poor support|unreliable|switched|cancel/i,
  rising_pains: /complaint|manual|frustrat|burden|increasing|recurring/i,
  regulation: /regulat|law|mandate|compliance|guidance|standard/i,
  ai_capability: /ai|model|llm|agent|automation|new api/i,
  newly_funded: /funding|raised|series [a-z]|seed round|venture/i,
  open_source: /open.source|github|repository|apache|mit license/i,
};

export async function GET(request: NextRequest) {
  const category = (request.nextUrl.searchParams.get("category") ?? "emerging_gaps") as Category;
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(", ")}.` }, { status: 400 });
  const cadence = request.nextUrl.searchParams.get("cadence") === "daily" ? "daily" : "weekly";
  const cutoff = Date.now() - (cadence === "daily" ? 1 : 7) * 86_400_000;
  const ownerScope = privateIdentity(`research:${clientNetworkIdentity(request)}`);
  const summaries = (await listResearchRuns(100, ownerScope)).filter((item) => new Date(item.completedAt).getTime() >= cutoff);
  const runs = (await Promise.all(summaries.map((item) => getResearchResultById(item.id)))).filter((item) => item !== null);
  const entries = runs.flatMap((run) => run!.finalOpportunities.flatMap((opportunity) => {
    const evidence = run!.sources.filter((item) => opportunity.candidate.evidenceIds.includes(item.id) && patterns[category].test(`${item.title} ${item.summary}`));
    if (!evidence.length && category !== "emerging_gaps") return [];
    return [{
      runId: run!.id, completedAt: run!.completedAt, category, candidateId: opportunity.candidate.id,
      name: opportunity.candidate.name, summary: opportunity.candidate.summary,
      lifecycle: opportunity.lifecycle?.classification ?? "survived", opportunityScore: opportunity.score.score,
      evidenceConfidence: opportunity.score.evidenceConfidence?.score ?? 0, noveltyScore: opportunity.score.noveltyScore?.score ?? 0,
      nextBestAction: run!.nextBestAction.candidateId === opportunity.candidate.id ? run!.nextBestAction : null,
      citations: (evidence.length ? evidence : run!.sources.filter((item) => opportunity.candidate.evidenceIds.includes(item.id))).slice(0, 5).map((item) => ({ title: item.title, url: item.sourceUrl, sourceType: item.sourceType })),
    }];
  })).sort((a, b) => b.evidenceConfidence - a.evidenceConfidence || b.opportunityScore - a.opportunityScore);
  return NextResponse.json({ category, cadence, generatedAt: new Date().toISOString(), entries, note: "Feed entries are drawn from saved research snapshots. Scheduling fresh runs remains a deployment/automation concern." }, { headers: { "Cache-Control": "private, no-store" } });
}
