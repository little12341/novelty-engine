import type { Evidence, FailedAttempt, FailureBlocker, WeakSignal } from "./types.ts";
import { stableId } from "./utils.ts";

const OUTCOME = /shut down|shutdown|discontinued|failed|dead startup|sunset|abandoned|acquired.{0,50}abandoned|never gained adoption|low adoption/i;
const BLOCKERS: Array<[FailureBlocker, RegExp]> = [
  ["technology", /technology|technical|accuracy|capability/], ["customer_acquisition", /customer acquisition|cac|acquisition cost/],
  ["timing", /too early|timing/], ["regulation", /regulat|policy|legal/], ["hardware_cost", /hardware cost|expensive hardware/],
  ["user_behavior", /behavior|habit|adoption/], ["infrastructure", /infrastructure|bandwidth|cloud/], ["market_size", /market size|small market/],
  ["trust", /trust|privacy|security/], ["pricing", /pricing|price|moneti/], ["distribution", /distribution|channel/], ["execution", /execution|runway|team/],
];

export function mineFailedAttempts(evidence: Evidence[], signals: WeakSignal[]): FailedAttempt[] {
  return evidence.filter((item) => OUTCOME.test(`${item.title} ${item.summary}`)).map((item) => {
    const text = `${item.title} ${item.summary}`;
    const blocker = BLOCKERS.find(([, pattern]) => pattern.test(text))?.[0] ?? "unknown";
    const changedSignals = signals.filter((signal) => {
      if (blocker === "technology" || blocker === "infrastructure") return ["api_capability", "hardware_availability", "open_source_growth"].includes(signal.kind);
      if (blocker === "hardware_cost") return signal.kind === "price_collapse" || signal.kind === "hardware_availability";
      if (blocker === "regulation") return signal.kind === "regulatory_change";
      if (blocker === "user_behavior" || blocker === "timing") return signal.kind === "behavior_change";
      return false;
    });
    const evidenceBackedBlocker = blocker !== "unknown";
    return {
      id: stableId("failed", item.normalizedUrl), name: item.title.replace(/\s+[|–—:].*$/, ""),
      outcome: /discontinued|sunset/i.test(text) ? "discontinued" : /shut down|shutdown/i.test(text) ? "shut_down" : /acquired/i.test(text) ? "acquired_and_abandoned" : /low adoption|never gained/i.test(text) ? "low_adoption" : "failed",
      approach: item.summary || null, blocker, blockerEvidenceIds: evidenceBackedBlocker ? [item.id] : [], allEvidenceIds: [item.id],
      blockerStillExists: changedSignals.length ? false : evidenceBackedBlocker ? null : null,
      changedConditionEvidenceIds: changedSignals.flatMap((signal) => signal.evidenceIds),
      resurrectionEligible: evidenceBackedBlocker && changedSignals.length > 0,
      confidence: evidenceBackedBlocker ? 0.66 : 0.38,
    };
  });
}
