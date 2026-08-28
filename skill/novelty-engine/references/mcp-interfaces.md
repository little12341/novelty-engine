# Novelty Engine MCP interface reference

Read this reference when handing Claude/user sources to Novelty, resolving prior runs, anchoring company research, explaining research cost, comparing candidates within one run, or inspecting `ideationContext`.

## Supplied-source default and evidence loop

`research_from_sources` is the recommended fresh-research tool. It accepts `query`, optional `depth` and `founder_constraints`, plus 1–48 strict public source objects. Each object requires `url`, `title`, and at least one non-empty `snippet`, `excerpt`, or `content`; optional `publication_date`, `source_type`, `publisher`, `domain`, and `retrieved_at` are untrusted declarations. Preserve an excerpt that actually supports the intended claim. Never put secrets, private URLs, credentials, or instructions in source fields.

Novelty does not fetch supplied URLs. It validates and canonicalizes them, strips tracking parameters, rejects local/private or credential-bearing URLs, screens prompt-injection text, collapses exact-URL duplicates, groups same-domain evidence for independence, and runs the complete shared V2.2 evidence/elimination pipeline. The stored result reports `retrievalMode: supplied_sources`, retrieval provenance, and `budgetUsage.providerCalls: 0`.

When evidence is incomplete, use this bounded loop:

1. Call `get_research_requirements { run_id }`.
2. Use Claude/web search to target the returned source families, unresolved claims, assumptions, or counterevidence objectives.
3. Call `add_sources_to_run { run_id, sources }`.
4. Continue from the returned descendant run ID.

`add_sources_to_run` never mutates the parent. It persists a new run with root/parent/version lineage, retained/added evidence IDs, duplicate counts, coverage and evidence-gate deltas, and `providerCalls: 0`. The entire supplied-source evidence loop makes zero provider calls.

`research_market`, `run_research_mode`, and `compare_ideas` are optional hosted-search tools. They may use deployment-owned Tavily/Brave credits only when `HOSTED_SEARCH_ENABLED` permits it. If disabled, hosted paths fail with `HOSTED_SEARCH_DISABLED`; a supplied baseline also refuses implicit hosted reruns or fresh expansion with `SUPPLIED_SOURCES_REQUIRED`. Stored reads, source audit, requirements, exports, comparisons without expansion, and stored-evidence falsification make no hosted calls.

## Stored-run discovery

`list_research_runs` accepts optional `limit` (1–50), opaque `cursor`, `created_after`, `created_before`, `updated_after`, `updated_before`, `status`, `stop_status`, `mode`, and `depth`. It returns `runs`, `page { limit, nextCursor, hasMore }`, and an automatic ownership boundary. Each run has `run_id`, `query`, `mode`, `depth`, `status`, `stop_status`, `created_at`, `updated_at`, survivor/candidate/gap/rejected counts, and a concise result summary. It never enumerates another client namespace.

`search_research_runs` adds a required `query` (2–200 characters) and returns the same page plus per-run `match { score, exactPhrase, matchedFields }` and `rankingMethod`. Ranking uses transparent canonical-token Jaccard similarity with an exact substring boost. It is keyword/canonical search, not vector or embedding search.

## Structured company research

For the zero-provider default, gather company evidence with Claude/web search and call `research_from_sources` with the complete identity and research focus in `query`. Optional hosted structured company research uses `run_research_mode` with `mode: research_company` and any of:

- `query`: backward-compatible free-text focus;
- `company_name`: authoritative name;
- `domain`: authoritative bare public hostname such as `certificial.com`;
- `ticker`: uppercase-normalized public ticker;
- `country`: country or jurisdiction for disambiguation.

At least one of `query` or a structured identifier is required. Schemes, paths, queries, credentials, ports, localhost, and IP-address domains are invalid. Conflicting or ambiguous structured identities return `INVALID_COMPANY_IDENTITY`. The output preserves the requested identifiers under `companyProfile.requestedIdentity`; unrelated article titles and comparison pages cannot replace them.

## Budget visibility

`get_research_budget_info {}` reports `supplied_sources` as the recommended zero-hosted-call default and returns configured hosted retrieval/search call ranges and hard caps for `fast`, `standard`, `deep`, comparison, falsification, and rerun. It returns no monetary estimate, provider identity, API plan, credential, or sensitive remaining shared quota. Safe wording includes: “Deep hosted research uses substantially more retrieval than fast mode.” Zero provider credits does not mean zero infrastructure cost: hosting, Redis, bandwidth, and compute can still incur charges above free tiers.

## Candidate comparison inside one run

`compare_run_candidates` accepts:

```json
{
  "run_id": "research_…",
  "candidate_ids": ["candidate_…", "candidate_…"],
  "dimensions": ["pain_evidence", "residual_gap", "strongest_counterevidence"],
  "fresh_expand": false
}
```

Use 2–5 unique canonical candidate IDs or gap IDs from the same run. Default `fresh_expand: false` uses stored evidence only and returns `providerCalls: 0`. Rows cover buyer specificity, pain, spend/WTP, residual gap, competition/collision, differentiation, feasibility, distribution, switching, regulation/liability, evidence confidence, unresolved critical assumptions, strongest counterevidence, and next validation action. Cells preserve `KNOWN`, `INFERRED`, `UNKNOWN`, and `CONTRADICTED`, evidence IDs, and citations. Killed candidates keep `killed: true` and their exact kill reason; comparison never revives them. An explicit fresh expansion updates only the comparison's competitor view and never mutates stored scores or lifecycle decisions.

## User-safe `ideationContext`

- `finalOpportunities`: surviving candidate objects with evidence gate, lifecycle, falsification, written scoring rationale, assumptions, and validation plans.
- `graphHoles`: `{ id, kind, summary, nodeIds, evidenceIds, strength, confidence }` structural graph openings.
- `contradictions`: `{ id, assumptionId, operation, hypothesis, rationale, evidenceIds, strength }` unresolved assumption inversions.
- `stitchingPatterns`: `{ id, job, segment, tools, manualSteps, evidenceIds, scoreFactors, score, confidence }` repeated handoffs.
- `weakSignals`: `{ id, kind, label, description, firstSeen, accelerationProxy, evidenceIds, confidence }` early signals whose acceleration may be approximate.
- `resurrectionOpportunities`: failed-attempt records with blocker, changed-condition evidence, and `resurrectionEligible`; eligibility is not validation.
- `competitors`: normalized competitor/substitute records with traceable fields and explicit nulls.
- `evidence`: normalized user-safe source records; resolve IDs to `sourceUrl` and preserve provenance, quality, and untrusted-data status.
- `finalOutput`: the canonical landscape → signals → gaps → candidates → rejected ideas → survivors → lineage → risks → tests → stop-decision sequence.
- `budgetUsage`: actual bounded call/count/stop metadata without provider billing details.

Never expose hidden chain-of-thought, raw model reasoning, private scratchwork, unselected internal candidate pools, provider secrets, or sensitive global quota state.
