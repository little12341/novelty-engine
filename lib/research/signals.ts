import type { Evidence, WeakSignal, WeakSignalKind } from "./types.ts";
import { clamp, stableId } from "./utils.ts";

const SIGNAL_RULES: Array<{ kind: WeakSignalKind; label: string; pattern: RegExp }> = [
  { kind: "api_capability", label: "New API or automation capability", pattern: /new api|api launch|webhook|model capability|automation/i },
  { kind: "hardware_availability", label: "Hardware capability or cost shift", pattern: /sensor|chip|hardware|device|robot|camera/i },
  { kind: "open_source_growth", label: "Open-source activity", pattern: /open[- ]source|github|stars?|forks?|repository/i },
  { kind: "integration_demand", label: "Unofficial integration demand", pattern: /feature request|unofficial integration|missing integration|no api|webhook/i },
  { kind: "regulatory_change", label: "Regulatory or policy change", pattern: /new (?:regulation|rule|policy)|beginning in 202\d|requires?|mandate/i },
  { kind: "behavior_change", label: "Changing user behavior", pattern: /increasingly|adoption|becoming mainstream|remote|mobile[- ]first|creator/i },
  { kind: "price_collapse", label: "Enabling technology price decline", pattern: /price (?:drop|decline|collapse)|costs? (?:fell|falling)|cheaper/i },
  { kind: "terminology", label: "Emerging terminology", pattern: /new term|called|known as|emerging category/i },
];

export function normalizeWeakSignals(evidence: Evidence[], now = new Date()): WeakSignal[] {
  return SIGNAL_RULES.flatMap((rule) => {
    const matches = evidence.filter((item) => rule.pattern.test(`${item.title} ${item.summary}`));
    if (!matches.length) return [];
    const dates = matches.map((item) => item.publicationDate).filter((value): value is string => Boolean(value)).sort();
    const newest = dates.at(-1);
    const daysOld = newest ? Math.max(0, (now.getTime() - new Date(newest).getTime()) / 86_400_000) : null;
    const recency = daysOld === null ? 3 : clamp(10 - daysOld / 90);
    const hosts = new Set(matches.map((item) => new URL(item.normalizedUrl).hostname)).size;
    const accelerationProxy = dates.length >= 3 ? clamp((dates.length / Math.max(1, hosts)) * 3) : null;
    return [{
      id: stableId("signal", rule.kind), kind: rule.kind, label: rule.label,
      description: `${matches.length} retrieved source${matches.length === 1 ? "" : "s"} contain this early indicator.`,
      firstSeen: dates[0] ?? null, recency, recurrence: clamp(hosts * 2), accelerationProxy,
      accelerationIsApproximation: accelerationProxy !== null, evidenceIds: matches.map((item) => item.id),
      confidence: Math.min(0.9, 0.35 + hosts * 0.12 + (dates.length ? 0.08 : 0)),
    }];
  }).sort((a, b) => (b.recency + b.recurrence) - (a.recency + a.recurrence));
}
