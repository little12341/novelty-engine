import { providerConfiguration } from "@/lib/research/providers";
import { mcpHealthSnapshot } from "@/lib/mcp/observability";
import ResearchDebugger from "./research-debugger";

export const metadata = { title: "Research inspector — Novelty Engine", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResearchDebugPage() {
  return <ResearchDebugger initialConfiguration={providerConfiguration()} initialMcpHealth={mcpHealthSnapshot()} />;
}
