import { createHash } from "node:crypto";
import type { SearchAngle, SearchAngleKind } from "./types.ts";

const ANGLES: Array<{ kind: SearchAngleKind; suffix: string; purpose: string; domains: string[] }> = [
  { kind: "direct_competitors", suffix: "software tools companies pricing", purpose: "Direct competitors, positioning, capabilities, and public pricing", domains: [] },
  { kind: "adjacent_categories", suffix: "alternatives adjacent products comparison", purpose: "Adjacent categories and indirect alternatives", domains: ["producthunt.com"] },
  { kind: "customer_complaints", suffix: "problems complaints frustrating reviews", purpose: "First-hand customer complaints and recurring pain", domains: ["reddit.com"] },
  { kind: "manual_workarounds", suffix: "spreadsheet manual workaround template", purpose: "Manual workarounds and shadow workflows", domains: ["reddit.com", "github.com"] },
  { kind: "pricing_complaints", suffix: "too expensive pricing cost complaint", purpose: "Pricing and packaging objections", domains: ["reddit.com", "g2.com", "capterra.com"] },
  { kind: "underserved_segments", suffix: "small business solo operator underserved difficult", purpose: "Customer groups poorly served by incumbent assumptions", domains: ["reddit.com"] },
  { kind: "workflow_fragmentation", suffix: "multiple tools switching workflow fragmented", purpose: "Workflow fragmentation and context switching", domains: ["reddit.com"] },
  { kind: "poor_integrations", suffix: "missing integration feature request", purpose: "Integration gaps and interoperability failures", domains: ["github.com"] },
  { kind: "change_signals", suffix: "new regulation technology trend 2025 2026", purpose: "Regulatory, technology, or behavior changes affecting timing", domains: [] },
  { kind: "substitutes", suffix: "how do people currently handle without software", purpose: "Substitutes, services, labor, and doing-nothing alternatives", domains: ["reddit.com"] },
];

export function deriveSearchAngles(query: string, limit = 10): SearchAngle[] {
  return ANGLES.slice(0, Math.max(1, Math.min(limit, ANGLES.length))).map((angle, index) => ({
    id: `angle_${String(index + 1).padStart(2, "0")}_${createHash("sha1").update(`${query}:${angle.kind}`).digest("hex").slice(0, 6)}`,
    kind: angle.kind,
    query: `${query} ${angle.suffix}`,
    purpose: angle.purpose,
    targetedDomains: angle.domains,
  }));
}

export function buildProviderQuery(angle: SearchAngle): string {
  if (angle.targetedDomains.length === 0) return angle.query;
  return `${angle.query} (${angle.targetedDomains.map((domain) => `site:${domain}`).join(" OR ")})`;
}
