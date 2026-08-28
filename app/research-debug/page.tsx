import { notFound } from "next/navigation";
import { providerConfiguration } from "@/lib/research/providers";
import { mcpHealthSnapshot } from "@/lib/mcp/observability";
import ResearchDebugger from "./research-debugger";
import { getResearchBudgetInfo } from "@/lib/research/budget-info";
import { IDEATION_CONTEXT_FIELD_GUIDE } from "@/lib/research/ideation-context";

export const metadata = process.env.NODE_ENV === "production"
  ? { robots: { index: false, follow: false } }
  : { title: "Research inspector — Novelty Engine", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResearchDebugPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <ResearchDebugger
    initialConfiguration={providerConfiguration()}
    initialMcpHealth={mcpHealthSnapshot()}
    initialBudgetInfo={getResearchBudgetInfo()}
    ideationContextGuide={IDEATION_CONTEXT_FIELD_GUIDE}
  />;
}
