import assert from "node:assert/strict";
import test from "node:test";
import { CLAUDE_COMMAND_ROUTES, resolveClaudeCommand } from "./intents.ts";
import { assessFounderFit } from "./founder-fit.ts";
import { runResearch } from "./pipeline.ts";
import { validateExternalResearchUrl } from "./url-policy.ts";
import { backtestFinancialSignals, createFinancialSignal } from "../financial-signals/backtest.ts";
import type { IdeaCandidate, ProviderSearchResult, SearchProvider } from "./types.ts";

const marketRows: ProviderSearchResult[] = [
  { url: "https://routeops.example/pricing", title: "RouteOps pricing", snippet: "Dispatch and invoicing costs $99 per month for small field teams.", publishedAt: "2026-05-01" },
  { url: "https://fieldflow.example/pricing", title: "FieldFlow pricing", snippet: "Field service plans start at $79 per month per team.", publishedAt: "2026-05-02" },
  { url: "https://jobbridge.example/docs", title: "JobBridge documentation", snippet: "Scheduling and invoicing integrations for contractors and owner-operators.", publishedAt: "2026-04-01" },
  { url: "https://reddit.com/r/smallbusiness/comments/reentry_22", title: "Manual re-entry every day", snippet: "Our small contractor team manually copies every job from email to a spreadsheet because tools do not integrate.", publishedAt: "2026-06-01" },
  { url: "https://community.contractors.example/workaround-7", title: "Spreadsheet and text workaround", snippet: "We are independent contractors who still use spreadsheets and text messages, and we would pay to stop duplicate entry.", publishedAt: "2026-06-02" },
  { url: "https://g2.com/products/routeops/reviews", title: "RouteOps reviews", snippet: "Small teams say it is too expensive, missing integrations, and they switched back to paper.", publishedAt: "2026-06-03" },
  { url: "https://jobs.example.com/dispatch-coordinator", title: "Dispatch coordinator job", snippet: "Hiring a coordinator to re-enter jobs, reconcile invoices, and call technicians.", publishedAt: "2026-06-04" },
  { url: "https://regulator.example.gov/digital-record-rule", title: "Digital field record rule", snippet: "A new 2026 regulation requires retained digital service records.", publishedAt: "2026-03-01" },
];

const provider: SearchProvider = { id: "v22-fixture", displayName: "V2.2 fixture", async search() { return marketRows; } };

test("V2.2 runs persist lifecycle, gates, independent adversaries, score separation, ledgers, task graph, and next action", async () => {
  const run = await runResearch("Find opportunities for small field service contractor teams", { provider, persist: false, bypassCache: true, now: () => new Date("2026-08-27T12:00:00Z") });
  assert.equal(run.engineVersion, "2.2.0");
  assert.equal(run.depth, "standard");
  assert.ok(run.candidateLifecycles.length === run.candidates.length);
  assert.ok(run.candidateLifecycles.filter((item) => item.classification === "killed").every((item) => item.exactKillReason));
  assert.ok(run.finalOpportunities.length > 0);
  for (const survivor of run.finalOpportunities) {
    assert.equal(survivor.evidenceGate.survivalGatePassed, true);
    assert.equal(survivor.evidenceGate.externallyValidated, false);
    assert.notEqual(survivor.evidenceGate.classification, "validated");
    assert.equal(survivor.score.heuristic, true);
    assert.equal(survivor.score.evidenceConfidence.heuristic, true);
    assert.equal(survivor.score.noveltyScore.heuristic, true);
    assert.ok(Object.keys(survivor.score.scorecard).length >= 29);
    assert.notEqual(survivor.adversarialReview.bull.independentInputHash, survivor.adversarialReview.bear.independentInputHash);
    assert.equal(survivor.assumptionLedger.length, 9);
    assert.ok(survivor.assumptionLedger.every((item) => item.killCriterion && (item.status === "SUPPORTED" || item.status === "DISPROVEN" || item.researchToResolve)));
    assert.ok(survivor.whyNotBuilt.explanations.length >= 10);
    assert.ok(survivor.validationPlan.milestones.every((item) => item.successCriterion && item.killCriterion));
  }
  assert.equal(run.taskGraph.resumable, true);
  assert.ok(run.taskGraph.agents.some((item) => item.agent === "bull"));
  assert.ok(run.taskGraph.agents.some((item) => item.agent === "bear"));
  assert.ok(run.nextBestAction.action.length > 20);
  assert.ok(run.nextBestAction.killCriterion.length > 20);
});

test("weak initial niches trigger bounded adjacent search and preserve exhausted-budget truth", async () => {
  let calls = 0;
  const expanding: SearchProvider = {
    id: "expansion-fixture", displayName: "Expansion fixture",
    async search(query) { calls += 1; return /adjacent customer segment|upstream downstream workflow/i.test(query) ? marketRows : []; },
  };
  const run = await runResearch("Investigate an initially weak niche for contractor coordination", { provider: expanding, persist: false, bypassCache: true, now: () => new Date("2026-08-27T12:00:00Z") });
  assert.ok(run.searchBranches.length > 0);
  assert.ok(run.searchBranches.every((item) => item.learnedFromKillReasons.length >= 0 && item.searchAngleIds.length === 1));
  assert.ok(calls <= run.limits.maxProviderCalls);
  assert.equal(run.budgetUsage.exhausted, run.budgetUsage.providerCalls >= run.limits.maxProviderCalls,
    "exhaustion must reflect actual provider-call usage");
  assert.equal(run.budgetUsage.expansionStopReason === "budget_exhausted", run.budgetUsage.exhausted,
    "the stop reason and authoritative exhaustion state must agree");
  assert.ok(["survivor_found", "coverage_plateau", "budget_exhausted"].includes(run.budgetUsage.expansionStopReason ?? ""));
  assert.ok(run.nextBestAction.action.length > 0);
});

test("Agent Shield rejects SSRF-style destinations and founder constraints can kill a mismatched candidate", () => {
  for (const url of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data", "http://10.0.0.3/data", "https://localhost.localdomain/x", "https://example.com:8443/x"]) {
    assert.equal(validateExternalResearchUrl(url).allowed, false, url);
  }
  assert.equal(validateExternalResearchUrl("https://example.com/research").allowed, true);
  assert.equal(validateExternalResearchUrl("https://fda.gov/guidance").allowed, true);
  const candidate: IdeaCandidate = {
    id: "candidate_founder", name: "Regulated Robot", summary: "A regulated medical hardware robot marketplace.",
    targetCustomer: "clinics", payer: "clinics", jobToBeDone: "automate clinical work", mechanism: "hardware robot",
    interface: "robot", technology: "medical hardware", businessModel: "marketplace", distribution: "enterprise integration",
    dataSource: null, ownershipModel: null, workflowPosition: "new system", differentiator: "automation", sourceGapIds: [],
    sourceGraphHoleIds: [], sourceContradictionIds: [], sourceStitchingIds: [], sourceSignalIds: [], sourceFailedAttemptIds: [],
    evidenceIds: [], iteration: 0, rootCandidateId: "candidate_founder", mechanismFamily: "robot", crossDomainTransfer: null,
  };
  const fit = assessFounderFit(candidate, { teamSize: 1, timeToMvpWeeks: 2, riskTolerance: "low" });
  assert.equal(fit.rejected, true);
  assert.ok(fit.reasons.length >= 2);
});

test("Claude command routing covers research, specialist, stored-run, rerun, and export commands", () => {
  for (const command of ["/research-market", "/find-gaps", "/inspect-competitors", "/falsify", "/validate-idea", "/research-company", "/find-business", "/compare", "/market-size", "/pricing", "/customer-pain", "/trend-check", "/source-check", "/evidence", "/summarize-run", "/rerun", "/export", "/commands", "/help"]) {
    assert.ok(command in CLAUDE_COMMAND_ROUTES, command);
  }
  const sourceCheck = resolveClaudeCommand("/source-check", "research_20260827120000_route1234");
  assert.deepEqual(sourceCheck, { kind: "mcp", command: "/source-check", mcpTool: "source_check", arguments: { run_id: "research_20260827120000_route1234" } });
  assert.equal(resolveClaudeCommand("/commands")?.kind, "skill_help");
});

test("financial signals are timestamped before outcomes and weak repeatability is automatically killed", () => {
  const signals = Array.from({ length: 5 }, (_, index) => createFinancialSignal({
    symbol: `T${index}`, hypothesis: `Public evidence hypothesis ${index}`, direction: "positive",
    observedAt: "2026-01-01T10:00:00Z", persistedAt: "2026-01-01T12:00:00Z", expiresAt: "2026-03-01T00:00:00Z",
    evidenceIds: [`evidence_${index}`], confidence: .8, falsifiers: ["5-day excess return is non-positive"],
  }));
  const prices = signals.flatMap((signal) => [
    { symbol: signal.symbol, at: signal.persistedAt, price: 100, benchmarkPrice: 100 },
    { symbol: signal.symbol, at: "2026-01-07T12:00:00Z", price: 95, benchmarkPrice: 102 },
    { symbol: signal.symbol, at: "2026-02-02T12:00:00Z", price: 92, benchmarkPrice: 104 },
  ]);
  const result = backtestFinancialSignals(signals, prices, { minimumSampleSize: 5, evaluatedAt: new Date("2026-03-02T00:00:00Z") });
  assert.equal(result.metrics.sampleSize, 5);
  assert.equal(result.verdict, "KILLED");
  assert.equal(result.disclaimer, "Historical evidence testing is not guaranteed stock prediction or investment advice.");
});
