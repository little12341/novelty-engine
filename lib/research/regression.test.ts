import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runResearch } from "./pipeline.ts";
import type { ProviderSearchResult, SearchProvider } from "./types.ts";

type MarketId = "crowded_consumer" | "b2b_workflow" | "regulated_market" | "software_tooling" | "insufficient_evidence";
const fixtures = JSON.parse(await readFile(new URL("./fixtures/regression-markets.json", import.meta.url), "utf8")) as Record<MarketId, ProviderSearchResult[]>;

function providerFor(id: MarketId): SearchProvider {
  const rows = fixtures[id];
  return {
    id: `fixture-${id}`, displayName: `Regression fixture: ${id}`,
    async search(query) {
      if (/closest competitor|unit economics|support cost|technical limitation/i.test(query)) {
        const adversarial = rows.filter((item) => /pricing|failed|shut down|discontinued|cost|regulat|liability|low adoption|would not pay|competitor|alternative/i.test(`${item.title} ${item.snippet}`));
        return adversarial.length ? adversarial : rows.slice(0, 2);
      }
      return rows;
    },
  };
}

const cases: Array<{ id: MarketId; query: string }> = [
  { id: "crowded_consumer", query: "Find 3 differentiated opportunities in the crowded consumer household food-waste category" },
  { id: "b2b_workflow", query: "Find 3 B2B workflow opportunities for small finance teams handling month-end close" },
  { id: "regulated_market", query: "Find 3 compliant workflow opportunities for regulated clinical trial sites" },
  { id: "software_tooling", query: "Find 3 software tooling opportunities for engineering teams dealing with flaky CI tests" },
];

for (const item of cases) test(`regression: ${item.id} clears the disciplined pipeline without losing provenance`, async () => {
  const result = await runResearch(item.query, { provider: providerFor(item.id), persist: false, bypassCache: true, now: () => new Date("2026-08-25T12:00:00Z") });
  assert.notEqual(result.stopDecision.status, "insufficient_evidence");
  assert.ok(result.coverage.sourceFamilyCoverage.competitor > 0);
  assert.ok(result.coverage.sourceFamilyCoverage.user_voice >= 2);
  assert.ok(result.gaps.some((gap) => gap.confidenceLabel !== "speculative opportunity"));
  assert.ok(result.candidates.length > 0);
  assert.ok(result.finalOpportunities.length > 0, "an established market with an evidenced structural gap must not be rejected merely because competitors exist");
  assert.ok(result.rejectedIdeas.length > 0, "selection pressure should leave an auditable rejected set");
  assert.deepEqual(Object.keys(result.output), [
    "researchLandscape", "signals", "structuralGaps", "candidateIdeas", "rejectedIdeas", "survivors",
    "evidenceLineage", "decisiveRisks", "validationTests", "stopDecision",
  ]);
  const known = new Set(result.sources.map((source) => source.id));
  for (const survivor of result.finalOpportunities) {
    assert.ok(survivor.candidate.evidenceIds.length > 0);
    assert.ok(survivor.candidate.evidenceIds.every((id) => known.has(id)));
    assert.equal(Object.keys(survivor.score.decisionFactors).length, 9);
    assert.ok(survivor.score.writtenReasoning.length > 80);
    assert.match(survivor.validationExperiment.estimatedTime, /24–72 hours/);
    assert.ok(survivor.lineage.steps.every((step) => ["VERIFIED", "INFERRED", "UNKNOWN"].includes(step.claimStatus)));
    assert.equal(survivor.falsification.residualUnmetDemand.competitorsPresent, true);
    assert.deepEqual(Object.keys(survivor.falsification.residualUnmetDemand.signals), [
      "repeated_unresolved_complaints", "workaround_prevalence", "switching_behavior", "underserved_segments",
      "price_performance_gaps", "trust_failures", "distribution_gaps", "missing_integrations", "procurement_friction", "tolerated_bad_solutions",
    ]);
  }
  if (item.id === "crowded_consumer") {
    assert.ok(result.finalOpportunities.some((survivor) => survivor.falsification.residualUnmetDemand.conclusion === "meaningful_residual_gap"));
    assert.ok(result.finalOpportunities.some((survivor) => survivor.falsification.residualUnmetDemand.signals.workaround_prevalence.present));
    assert.ok(result.finalOpportunities.some((survivor) => survivor.falsification.residualUnmetDemand.signals.switching_behavior.present));
    assert.ok(result.finalOpportunities.some((survivor) => survivor.falsification.residualUnmetDemand.mechanismMateriallyChangesOutcome.present));
  }
  if (item.id === "regulated_market") {
    assert.ok(result.coverage.sourceFamilyCoverage.institutional > 0);
    assert.ok(result.sources.some((source) => source.sourceType === "regulator"));
  }
});

test("regression: insufficient evidence stops before candidate generation", async () => {
  const result = await runResearch("Find a compelling new smart hydration cup opportunity", {
    provider: providerFor("insufficient_evidence"), persist: false, bypassCache: true, now: () => new Date("2026-08-25T12:00:00Z"),
  });
  assert.equal(result.stopDecision.status, "insufficient_evidence");
  assert.equal(result.stopDecision.canGenerateCandidates, false);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.finalOpportunities.length, 0);
  assert.match(result.stopDecision.distinction, /no competitor/i);
});

test("partial source failures remain visible and cannot produce a complete-looking run", async () => {
  const base = providerFor("b2b_workflow");
  const partial: SearchProvider = {
    id: "fixture-partial", displayName: "Partial regression provider",
    async search(query, options) {
      if (/regulation|failed|shutdown|discontinued/i.test(query)) throw new Error("upstream timed out");
      return base.search(query, options);
    },
  };
  const result = await runResearch("Find 2 B2B month-end close workflow opportunities", { provider: partial, persist: false, bypassCache: true });
  assert.equal(result.status, "partial");
  assert.ok(result.coverage.failedAngles > 0);
  assert.ok(result.warnings.some((warning) => /TIMEOUT/.test(warning)));
});

test("malformed or fully timed-out providers degrade to insufficient evidence without fabricated candidates", async () => {
  for (const [id, search] of [
    ["malformed", async () => ({}) as unknown as ProviderSearchResult[]],
    ["timeout", async () => { throw new DOMException("provider timed out", "AbortError"); }],
  ] as const) {
    const result = await runResearch(`Research an adequately specific ${id} provider case`, {
      provider: { id, displayName: id, search }, persist: false, bypassCache: true,
    });
    assert.equal(result.status, "partial");
    assert.equal(result.stopDecision.status, "insufficient_evidence");
    assert.equal(result.sources.length, 0);
    assert.equal(result.candidates.length, 0);
    assert.equal(result.finalOpportunities.length, 0);
  }
});
