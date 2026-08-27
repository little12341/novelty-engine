import { notFound } from "next/navigation";
import { providerConfiguration } from "@/lib/research/providers";
import { mcpHealthSnapshot } from "@/lib/mcp/observability";
import ResearchDebugger from "./research-debugger";

export const metadata = process.env.NODE_ENV === "production"
  ? { robots: { index: false, follow: false } }
  : { title: "Research inspector — Novelty Engine", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResearchDebugPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <ResearchDebugger initialConfiguration={providerConfiguration()} initialMcpHealth={mcpHealthSnapshot()} />;
}
