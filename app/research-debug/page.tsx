import { providerConfiguration } from "@/lib/research/providers";
import ResearchDebugger from "./research-debugger";

export const metadata = { title: "Research inspector — Novelty Engine", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResearchDebugPage() {
  return <ResearchDebugger initialConfiguration={providerConfiguration()} />;
}
