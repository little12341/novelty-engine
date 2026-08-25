# Novelty Engine V2.1+ platform implementation report

## Outcome

This pass extends the existing V2.1 pipeline rather than replacing it. `runResearch` remains the canonical retrieval, evidence calibration, coverage, stop-decision, opportunity, falsification, scoring, and report path. The public website was not redesigned. Direct API, MCP, Claude Skill, exports, company research, comparison, history, memory, feedback, and watch/change services all adapt the same typed research records.

The working tree already contained uncommitted V2.1 residual-demand and falsification improvements when this work began. Those changes were preserved and extended; nothing was reset, pushed, or deployed.

## Architecture and research roles

The following roles are deterministic stage boundaries recorded in `ResearchResult.roleOutputs`. They are not independent free-form personas and are not claimed to improve truth by themselves:

1. Source Verification — screens untrusted text, normalizes URLs/claims, assigns trust metadata, and deduplicates repeated/syndicated evidence once.
2. Market Mapping — consumes the shared evidence set and emits supported market/graph records.
3. Competitor Analysis — emits evidence-carrying direct competitor and substitute records; unsupported fields stay null.
4. Complaint/Workaround Mining — emits complaint clusters and manual/workaround records.
5. Structural Gap Detection — emits supported gaps and penalties from those shared records.
6. Adversarial Falsification — is the only role permitted to request the bounded candidate-focused search allowance, then emits structured factor arguments and outcomes.
7. Company Analysis — runs only in company mode and separates company-controlled claims, third-party evidence, and unknowns.
8. Opportunity Synthesis — generates, mechanism-deduplicates, falsifies, mutates once when eligible, scores, and validates candidates.

Role permissions are limited to `read_retrieved_evidence`, `derive_structured_records`, and—only for adversarial falsification—`request_bounded_search`. Research roles have no repository, deployment, user-data mutation, secret access, or arbitrary tool capability. The current implementation uses zero model/agent calls; role boundaries are deterministic functions over one shared evidence set.

## Non-overridable rules and checkpoints

`governance.ts` defines the hard rules: no global novelty claim from bounded search; no invented source, competitor, price, or complaint; no status promotion without qualifying evidence; no demand credit for an empty competitor result; no automatic competition veto; mandatory evidence lineage and falsification for survivors; visible critical unknowns; and no silent resurrection of rejected roots.

Every new run records these checkpoints:

- source validation and claim/URL deduplication after retrieval;
- competitor/substitute coverage before novelty claims;
- residual-gap assessment before promotion;
- mechanism-family deduplication before final candidate count;
- adversarial falsification before survivor status;
- evidence-ID/citation validation before response;
- final persistence after successful completion.

The final gate rejects any survivor whose lineage does not resolve to stored evidence, whose falsification outcome is not `survived`, or which is also present in the rejection set.

## Competition and residual demand

Competition validates that a job may exist but is decisive only when close same-user/same-job substitutes adequately resolve the job and no meaningful residual gap remains. Residual demand now records repeated unresolved complaints, workarounds, switching, underserved segments, price/performance mismatch, trust failures, distribution gaps, missing integrations, procurement friction, continued tolerance of bad solutions, and whether the proposed mechanism materially changes the failure mode. Economics, regulation, liability, distribution, behavior, technical feasibility, trust, switching cost, defensibility, and incumbent response remain independent decisive factors.

The regression suite keeps crowded consumer, B2B workflow, regulated, and developer-tool cases, and adds a local/service market. Crowded markets with evidenced residual gaps continue to produce survivors rather than being rejected merely for having competitors.

## Modes and commands

The following intents map to shared services:

- `/find-business` → `find_business`
- `/research-market` → `research_market`
- `/research-company` → `research_company`
- `/find-competitors` → `find_competitors`
- `/find-gaps` → `find_gaps`
- `/falsify` → `falsify`
- `/validate-idea` → `validate_idea`
- `/compare-ideas` → `compare_ideas`

The direct `POST /api/research` accepts `mode`, or a command prefix in `query`. Comparison accepts a structured 2–5 item `ideas` array. MCP exposes `run_research_mode` and `compare_ideas` while preserving the original five tools.

## Company Research

Company mode uses the canonical research run, then adds `companyProfile`: identity, products/services, target users, apparent positioning, pricing/business model, direct competitors, indirect substitutes, company/category complaints, competitor strengths/weaknesses, underserved segments, threats, differentiation opportunities, adjacent markets, and available 24–72 hour validation actions. Company-controlled evidence IDs and third-party evidence IDs are separate. Unsupported fields are explicit UNKNOWN claims. A public company page is treated as a company claim, not independent proof.

## Idea Comparison

`compareIdeas` researches 2–5 ideas under one shared provider-call cap and emits qualitative assessments for evidence strength, demand, residual gap, differentiation, feasibility, economics, distribution, switching cost, trust, regulation/liability, defensibility, incumbent response, and decisive risks. Recommendations are `advance`, `validate_first`, `hold`, or `reject`, followed by written guidance. Numeric pipeline heuristics remain internal aids and are not presented as a falsely precise cross-idea rank.

## Persistence, history, snapshots, memory, and feedback

No new database vendor was added. Local development extends `.research-runs`; deployed durable storage continues to use the existing Upstash Redis REST adapter.

- Full run history has a separate long retention from short query-cache TTL and a searchable time index.
- `EvidenceSnapshot` embeds URLs, retrieval times, normalized claims, source assessments, VERIFIED/INFERRED/UNKNOWN status, duplicate/syndication warnings, and missing-family warnings in every new run.
- Older stored V2.1 records are normalized on read. Original evidence is retained, new absent claim statuses are conservatively UNKNOWN, and new checkpoints are marked not applicable rather than retroactively passed.
- Memory requires explicit `optedIn=true`, stores only bounded research preferences/constraints, hashes the supplied user identifier, allows disabling/clearing the useful context, and never overrides a current-run field.
- Previously rejected mechanisms can exclude the same mechanism from later synthesis unless current instructions explicitly replace that context.
- Feedback is a separate `ResearchFeedback` record marked `USER_PROVIDED_CONTEXT_NOT_PUBLIC_EVIDENCE`; it never silently becomes VERIFIED public evidence.

## Watchlists and change detection

A watchlist stores a label, query, market/company/opportunity mode, baseline run, optional candidate, selected change families, enabled state, and last-check time. It does not schedule itself. `checkWatchlist` explicitly runs a fresh bounded research pass, compares the two immutable snapshots, persists a change report, and advances the baseline.

Change detection suppresses same-fingerprint and likely syndicated copies, then surfaces supported changes in competitors, products/features, pricing, funding/hiring, regulation, patents/research, complaints, substitutes/workarounds, platform policy, demand, and coverage/stop state. Each material change retains before/after evidence IDs and claim statuses. A retrieval delta is described as a retrieval delta, not certain proof that a company entered or exited the market.

## Source trust and security

Each source now records family, primary status, provenance/control, directness, independence group, recency, commercial-bias risk, observation kind, repetition risk, and the original transparent weighting rationale. This is decision metadata, not an absolute truth score.

All snippets, pages, forums, repositories, PDFs, and company content are untrusted data. Screening recognizes instruction overrides, secret-exfiltration requests, tool/shell instructions, system-style directives, and repository/deployment/data mutation requests. Those spans are ignored before downstream analysis while ordinary market facts remain. Provider keys and internal prompts are never added to research queries or results. Print export HTML-escapes every retrieved string.

## Coverage and graceful degradation

Coverage now reports source-family counts and `covered` / `attempted_unavailable` / `not_attempted`, thin commercial evidence, duplicate claims collapsed, and whether the counterevidence allowance was exhausted. The canonical stop result remains `proceed`, `partial_research`, or `insufficient_evidence`. Budget usage records provider calls, counterevidence searches, model/agent calls, abstract provider credits, sources, candidates, survivor iterations, exhaustion, and graceful-degradation state.

## Quotas and cost controls

Hard/configurable controls include provider/search cap, result/source cap, counterevidence search cap, reserved model and agent-call caps, one-credit-per-provider-call spend ceiling, concurrency, retry count, timeout, candidate/mutation caps, per-client hourly rate limit, per-client daily/monthly research quotas, global daily/monthly quotas, and a distributed concurrency lease. Public Vercel cost-bearing requests still fail closed without distributed protection unless the explicit private-preview override is enabled.

Estimated call delta versus the existing V2.1 path:

- Normal market/business/company/competitor/gap/validation run: 10 landscape searches plus up to 2 counterevidence searches, the same maximum pattern as V2.1; **0 additional provider calls and 0 model calls** from the new role boundaries.
- Focused `falsify_opportunity`: unchanged cap of up to 4 searches.
- Company mode: no extra search pass beyond its normal canonical run; profile construction is deterministic.
- Idea comparison: 2–5 canonical runs sharing a default maximum of 30 provider calls; partial/insufficient states appear if that shared cap is exhausted.
- Watchlist re-check: one fresh normal run only when explicitly invoked.

Provider “credits” count calls, not money, because Brave/Tavily plan prices are external and variable. Actual monetary reporting would require provider billing telemetry not exposed by the current adapters.

## Export/share surface

`exportResearchResult` and `/api/research/export` provide structured JSON, Markdown, and print/PDF-ready HTML/data. All preserve Research Landscape, Signals, Structural Gaps, Candidate Ideas, Rejected Ideas + Why, Survivors, Evidence Lineage, Decisive Risks, Coverage/Confidence, and 24–72 Hour Validation Tests. MCP exposes the same service as `export_research_run`. No UI redesign was made.

## API and MCP surfaces

New HTTP services:

- `GET/POST /api/research` — readiness and mode-aware canonical research/comparison
- `GET /api/research/history`
- `GET /api/research/export?run_id=...&format=json|markdown|print`
- `POST /api/research/feedback`
- `GET/POST/DELETE /api/research/memory`
- `POST /api/research/watchlists`
- `POST /api/research/watchlists/check`

MCP now exposes nine tools: the original `research_market`, `find_market_gaps`, `inspect_competitors`, `falsify_opportunity`, and `get_research_run`, plus `run_research_mode`, `compare_ideas`, `export_research_run`, and `compare_research_runs`.

## Configuration and migration

New optional environment variables are documented in `.env.example`: `RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES`, `RESEARCH_MAX_AGENT_CALLS`, `RESEARCH_MAX_PROVIDER_SPEND_CREDITS`, `RESEARCH_MAX_CONCURRENCY`, `RESEARCH_MAX_RETRIES_PER_SEARCH`, `RESEARCH_COMPARISON_MAX_PROVIDER_CALLS`, `RESEARCH_HISTORY_TTL_SECONDS`, `RESEARCH_PER_USER_DAILY_LIMIT`, and `RESEARCH_PER_USER_MONTHLY_LIMIT`.

No database migration is required. Existing Redis credentials and local run directory continue to work. Old cache/run files are upgraded conservatively in memory on read; new writes include the full V2.1+ record. Deployments should configure Upstash before relying on multi-instance history, memory, watchlists, or quotas.

## Tests and verification

The suite covers established crowded markets, B2B operations, regulation, developer tooling, a local/service market, company analysis, idea comparison, insufficient evidence/zero survivors, competitors that validate demand without solving the residual gap, duplicated/syndicated sources, prompt injection, role/checkpoint structure, status calibration, mechanism deduplication, memory, feedback, watchlists, change detection, exports, Claude Skill helper, MCP in-memory routing, MCP Streamable HTTP, and direct `/api/research` production HTTP.

Final verification commands are recorded in the handoff response. The package ZIP was regenerated locally. Nothing was pushed or deployed.

## Modified and new files

Core research and platform services:

- `lib/research/types.ts`, `pipeline.ts`, `opportunity-pipeline.ts`, `falsification.ts`, `quality.ts`, `normalize.ts`, `store.ts`, `protection.ts`
- `lib/research/governance.ts`, `intents.ts`, `company.ts`, `comparison.ts`, `snapshots.ts`, `changes.ts`, `watchlists.ts`, `platform-store.ts`, `memory.ts`, `feedback.ts`, `exports.ts`
- Preserved/extended V2.1 work in `angles.ts`, `scoring.ts`, plus the existing falsification and opportunity modules above

API and MCP:

- `app/api/research/route.ts`
- `app/api/research/history/route.ts`, `export/route.ts`, `feedback/route.ts`, `memory/route.ts`, `watchlists/route.ts`, `watchlists/check/route.ts`
- `lib/mcp/schemas.ts`, `tools.ts`, `summaries.ts`, `http.ts`; preserved existing focused changes in `falsify.ts`

Tests, packaging, and documentation:

- `lib/research/platform.test.ts`, `regression.test.ts`, `v2.test.ts`, `lib/mcp/mcp.test.ts`
- `scripts/test-skill-helper.mjs`, `test-mcp-http.mjs`, `validate-skill.mjs`, `verify-production-routes.mjs`
- `skill/novelty-engine/SKILL.md`, regenerated `public/novelty-engine.zip`
- `.env.example`, `package.json`, `README.md`, `docs/architecture.md`, and this report

## Remaining limitations

- Search providers return result-level snippets, not a guaranteed full-page factual extraction. Source classification and company-domain control remain transparent heuristics.
- `CompanyProfile` is only as complete as retrieved public evidence; ownership, private pricing, financials, and internal strategy commonly remain UNKNOWN.
- Change detection compares supported snapshot content. It is not a crawler, corporate registry, patent opinion, or proof that an unobserved event did not occur.
- Watchlists require an explicit API/service call. There is intentionally no scheduler, queue, notification delivery, or background polling loop.
- Print output is PDF-ready HTML/data; the service does not generate a binary PDF in this pass.
- Hashed user identifiers provide data minimization, not authentication. A public multi-user deployment still needs its own account/authorization boundary before exposing private history or memory.
- Feedback is stored for explicit future context but there is no automatic learning/ranking system.
- Provider spend is an abstract call-credit count, not a real-time invoice estimate.
- No website UI was added for modes, history, memory, feedback, watchlists, comparison, or exports; the clean API/service layer is ready for a later UI pass.
