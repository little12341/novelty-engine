---
name: novelty-engine
description: Discover market gaps and generate differentiated ideas for startups, products, inventions, features, business models, creative solutions, and other open-ended ideation tasks.
---

# Novelty Engine

Use this process when the user asks for ideas, inventions, startup or business concepts, products, features, creative solutions, new approaches, or other ideation. The goal is useful differentiation grounded in an underserved need: concepts with meaningfully different mechanisms, credible market gaps, or ideally both.

Do not use the full process for factual questions, editing, summarization, implementation of an already-chosen solution, or requests where the user explicitly wants conventional best practices only.

## Operating principles

- Optimize for the user's actual objective, not novelty in isolation.
- Treat novelty and market demand as hypotheses. Never claim an idea is globally new, never invented, patentable, completely unique, or a proven business opportunity without adequate evidence.
- Distinguish **unusual** (departs from defaults), **differentiated** (has a specific contrast), **apparently uncommon** (few close analogues found in a limited check), and **verified novel** (supported by an appropriate documented search). Most outputs should use the first two labels.
- Distinguish an **invention opportunity** (a new mechanism or technical capability), a **market-gap opportunity** (existing options leave important demand poorly served), and an **overlap opportunity** (a differentiated mechanism directly closes an evidenced gap). Prefer overlap opportunities when they are credible; do not force an invention where distribution, pricing, integration, or service design is the real gap.
- Existing competitors can validate demand. Finding no competitor is not evidence of a good opportunity; it may indicate weak demand, hidden constraints, bad economics, regulation, or ineffective search.
- Create diversity in both the core mechanism and the gap addressed. Renaming, cosmetic audience changes, or adding AI to a familiar category does not create a new candidate.
- Do the divergent search, scoring, and similarity checks internally. Do not expose chain-of-thought, private scratchwork, detailed scores, or an exhaustive candidate list. Return concise conclusions, evidence summaries, and decision-relevant comparisons.

## Research-first operating mode

For commercial ideation, market-gap discovery, startup ideas, business ideas, or requests that ask for market evidence, use the Novelty Engine research backend before generating any final ideas when the backend is available. Do not brainstorm first and retrofit evidence afterward.

Use research paths in this order:

1. **Remote MCP (preferred):** In Claude browser, check for Novelty Engine MCP tools before attempting any local helper. When available, call `research_market` with the user's complete request. Use its structured survivor and gap outputs as the research result; do not redo independent web research or brainstorm a replacement. Use its returned run ID with `find_market_gaps`, `inspect_competitors`, or `get_research_run` only when more detail is needed. Call `falsify_opportunity` when a survivor needs a fresh, focused counterevidence search. Do not replace these deliberate tools with a generic HTTP request.
2. **Direct helper (Claude Code fallback):** If MCP is unavailable and the bundled helper can run, use:

```bash
node scripts/research.mjs "<the user's complete research or ideation request>"
```

   The helper calls `NOVELTY_RESEARCH_API_URL`, which should point to the deployed `/api/research` endpoint (or defaults to `http://localhost:3000/api/research`). It prints the structured research JSON. If direct HTTP tools are available instead, send `POST {"query":"..."}` to that endpoint.
3. **Local methodology (last fallback):** If neither MCP nor the direct helper is available, continue with this Skill's bounded local methodology and clearly label every result as **non-researched, hypothesis-led ideation**. Do not imply that live evidence was checked.

Claude browser users should install this Skill and connect `https://novelty-engine.vercel.app/api/mcp` once under **Settings → Connectors → Add custom connector**. They can test server readiness at `https://novelty-engine.vercel.app/api/mcp/health`. They do not need `NOVELTY_RESEARCH_API_URL`, PowerShell configuration, or a Tavily/Brave key. Provider credentials stay on the Novelty Engine server.

Treat the backend as the evidence and invention system, not merely a source finder. Read `ideationContext.finalOutput` first and preserve its exact decision structure: **Research Landscape → Signals → Structural Gaps → Candidate Ideas → Rejected Ideas + Why → Survivors → Evidence Lineage → Decisive Risks → 24–72 Hour Validation Tests**. Use `finalOpportunities`, `graphHoles`, `contradictions`, `stitchingPatterns`, `weakSignals`, `resurrectionOpportunities`, `competitors`, and `evidence` only for detail. The backend has already applied its evidence gate, checked competitors and substitutes, collapsed mechanism-level duplicates, run adversarial falsification, bounded mutations, scored decision factors with written reasoning, and generated validation experiments. Do not silently resurrect a rejected candidate or replace its evidence lineage with an unsupported story.

Resolve every evidence ID to a record in `ideationContext.evidence` and then to its `sourceUrl`. Never invent a competitor, price, complaint, capability, failure reason, trend, source, or citation to fill a `null`, empty, or missing field. Treat `counterEvidenceIds`, falsification arguments, penalties, warnings, low confidence, approximate weak-signal acceleration, and exhausted budgets as decision-relevant evidence. Novelty fingerprints and opportunity scores are explicitly heuristic: explain their useful factor-level meaning, never present them as proof of uniqueness, demand, or success.

Preserve the backend's claim calibration exactly: **VERIFIED** means the claim has direct, quality-weighted support under the recorded provenance rule; **INFERRED** means evidence plus an explicit transform supports a hypothesis; **UNKNOWN** means the retrieved record does not answer the question. Never promote INFERRED to VERIFIED or UNKNOWN to an assumption. Use `sourceAssessment` to account for quality, independence, recency, and directness. When `duplicateSourceUrls` is non-empty, say that repetitions were collapsed; several pages repeating one underlying claim do not become several independent signals.

Honor `stopDecision`. `insufficient_evidence` means return the landscape, what was searched, missing source families, and the next research action—no ideas. `partial_research` means label the limitation and return only survivors that actually cleared the evidence and falsification gates. “No competitor found” is a retrieval result, never a validated opportunity.

Preserve the requested count from the backend whenever it returned that many survivors. If it returned fewer, say why based on the recorded rejection/budget state. Do not pad the answer with failed concepts. You may ask for a larger backend run only if doing so remains within the user's scope and configured budgets.

For every final survivor, preserve the concrete **24–72 hour** validation experiment when that timeframe is practical, including its success and failure thresholds.

If MCP returns an error, report its actual category (for example `RESEARCH_NOT_CONFIGURED`, `DURABLE_PROTECTION_REQUIRED`, `RATE_LIMIT`, `DAILY_BUDGET`, `MONTHLY_BUDGET`, `CONCURRENCY`, or transport unavailable) before trying a fallback. In Claude browser, do not attempt the local `NOVELTY_RESEARCH_API_URL` helper; continue to the graceful local methodology. In Claude Code, try the direct helper before the final fallback. If no research path succeeds or no supported gaps are returned, continue with the graceful fallback in “When web or search access is unavailable.” Explicitly label the result as non-researched and hypothesis-led rather than research-backed, and make external validation the first next step. Never substitute fabricated research or imply that fixture/test data is live evidence.

## 1. Frame the real problem

Extract or infer:

- the underlying problem and desired outcome;
- intended user, beneficiary, buyer, and other affected participants;
- constraints and non-negotiables;
- available resources, capabilities, and unfair advantages;
- context of use and current alternatives, including doing nothing;
- success criteria, time horizon, and requested number of ideas.

Ask focused clarification only when a missing answer would materially change the search space. Otherwise state one or two important assumptions and proceed.

Translate a solution-shaped request into a mechanism-neutral challenge. For example, turn “an app that reminds people to use groceries” into “reduce edible household food discarded because attention and meal timing do not match decay.” Preserve explicit user constraints.

## 2. Map existing solution categories before ideating

Build an internal landscape of how the problem is currently addressed. Identify:

- direct products, services, and incumbent categories;
- indirect substitutes, adjacent tools, and bundled features;
- professional or enterprise workflows;
- open-source and do-it-yourself approaches;
- spreadsheets, messaging, labor, consultants, and other manual workarounds;
- the option to tolerate, avoid, or postpone the problem.

For each important category, note the typical customer, value proposition, delivery model, pricing or business model, strengths, limitations, and why users choose it. This is a compact category map, not an exhaustive market report.

Also construct an exclusion map of obvious brainstorm defaults: first associations, common prompt answers, “marketplace for X,” “AI assistant for X,” dashboards, reminder apps, generic subscriptions, and gamification when they are predictable. Temporarily exclude them unless a later candidate changes their mechanism or market structure in a consequential way.

## 3. Search deliberately for unmet demand and structural gaps

Before generating candidates, look for evidence that current solutions leave demand poorly served. Test for multiple gap types:

- underserved customer segments or edge cases;
- repeated complaints, low-rated experiences, and abandoned workflows;
- incumbents that are too expensive, complex, slow, risky, or hard to adopt;
- fragmented workflows and context switching;
- recurring manual workarounds, shadow tools, and spreadsheet glue;
- missing integrations or incompatible hardware and software;
- geographic, language, accessibility, or distribution gaps;
- pricing, packaging, procurement, ownership, or incentive structures that exclude users;
- regulatory changes that create new obligations or remove old constraints;
- technologies that incumbents have not adapted to;
- behavior changes that alter when, where, or how the problem occurs;
- hardware/software combinations that are served poorly;
- established markets where products exist but solve the job badly.

Ask why each apparent gap persists. Possible causes include low willingness to pay, high acquisition cost, regulation, liability, difficult support, unfavorable unit economics, rare frequency, fragmented buyers, technical constraints, or incumbent incentives. A durable reason can make a gap defensible or make it a trap.

### When the research backend or web search is available

Prefer the structured research backend described above. If it is unavailable but legitimate web search is available, research the landscape directly. Use focused, mechanism- and problem-based queries rather than only proposed names. Search a useful mix of:

- competitor and incumbent product pages, pricing, documentation, and integration lists;
- Reddit, specialist forums, community discussions, and support threads;
- product reviews, app-store reviews, comparison pages, and cancellation complaints;
- GitHub repositories, issues, feature requests, and abandoned projects;
- startup directories, launch platforms, accelerators, and company databases;
- procurement pages, job posts, regulatory sources, research, and industry publications when relevant.

Look for repeated patterns across independent sources. Separate observed evidence from inference, record the search scope and date when useful, and calibrate conclusions to source quality. A complaint is a clue, not proof of a market. Search for counterevidence such as adequate existing solutions, weak purchasing intent, or failed prior attempts.

If no close competitor is found, do not label the space attractive by default. Try broader category, substitute, workflow, and outcome queries, then state that the landscape check was limited and test whether the absence reflects low demand or a hidden constraint.

### When web or search access is unavailable

Continue using known categories and plausible gap hypotheses. Label them as hypotheses based on known or obvious alternatives, and make validation the first next step rather than presenting them as verified market findings.

## 4. Build an opportunity brief

Summarize internally before ideating:

- who is underserved and the job they are trying to complete;
- what they use now and what repeatedly fails;
- the strongest evidence or signal of unmet demand;
- why the gap may exist;
- what changed, if anything, that makes a new approach timely;
- whether the opening is primarily invention, market gap, or both.

Do not assume every prompt contains a viable market. If evidence contradicts the initial premise, adapt the opportunity brief and say so concisely in the final answer.

When structured V2 output exists, use its compact idea lineage as the opportunity brief: for example, `repeated complaint → manual workaround → underserved segment → contradiction → enabling technology → mutated concept`. This is provenance, not hidden chain-of-thought. Do not expand it into private scratchwork.

## 5. Search distant domains for transferable mechanisms

Explore a varied subset of distant domains that fit the opportunity brief. Consider unrelated industries, scientific fields, technologies, physical mechanisms, biological systems, historical systems, behavioral patterns, economic and distribution models, user interfaces, cultural behaviors, manufacturing, logistics, ecology, games, governance, insurance, performance art, and materials science.

Transfer a causal mechanism, not a metaphor. For each useful source, ask internally:

1. What does this system reliably accomplish?
2. What mechanism causes that result?
3. What is the structural analogue in the user's problem?
4. Which evidenced gap would the transfer close?
5. What would have to change for the mechanism to work here?

Use multiple transfer patterns: inversion, recombination, removal, decentralization, temporal shift, environmental embedding, incentive redesign, and turning a product into a protocol or vice versa.

## 6. Generate a broad candidate field

Generate at least 15 substantially different candidates internally before selecting. If the user asks for more than five final ideas, increase the candidate pool enough to support meaningful rejection and replacement.

Spread candidates across different mechanisms, gap types, ownership models, interfaces, channels, scales, and degrees of technical ambition. Include a mix of invention opportunities, market-gap opportunities, and overlap opportunities. Include low-tech, service, distribution, business-model, or non-software mechanisms when appropriate; do not default to apps or generative AI.

A candidate is not distinct if its one-sentence causal explanation and target gap are substantially the same as another candidate. Merge duplicates early.

## 7. Apply selection pressure

Evaluate each candidate internally on:

- novelty and mechanism-level differentiation;
- usefulness and severity or frequency of the job addressed;
- market-gap strength: clarity of the underserved user, failure of current alternatives, supporting signal, and plausible willingness to adopt or pay;
- feasibility under stated constraints;
- defensibility or cumulative advantage where relevant;
- similarity to obvious directions, incumbents, and known existing ideas;
- specificity and clarity of the mechanism;
- simplicity relative to value created;
- the persistence risk: whether the gap exists for a reason that defeats the idea.

Treat similarity as a risk to investigate, not a positive score. Reject candidates that are generic, derivative, vague, novelty theater, unsupported demand stories, impractical without a reason to accept that risk, or solutions whose economics and user behavior do not fit the gap.

With the V2.1 backend, honor each structured falsification outcome across demand, economics, feasibility, competition, distribution, behavior, trust, regulation, liability, defensibility, switching cost, and incumbent response. Separate `argumentsFor` from `argumentsAgainst`, surface `decisiveRisks`, and preserve `unknownCriticalCount`. An unknown falsification dimension remains unknown; absence of counterevidence is not evidence that the risk is cleared.

## 8. Mutate the strongest survivors

Only a promising candidate that cleared the positive-evidence gate and received `outcome: mutate` may be changed. Change exactly one core assumption, record the parent and before/after constraint, and retest it once. A rejected mutation is terminal for that root candidate. Useful mutation axes include:

- target user, buyer, or beneficiary;
- which complaint or workflow failure is addressed;
- interface and interaction model;
- who pays, ownership, pricing, and economic model;
- timing, frequency, and duration;
- scale and unit of coordination;
- distribution channel and point of intervention;
- physical mechanism or material;
- software architecture and degree of automation;
- integrations and hardware/software boundary;
- incentive structure and source of trust;
- what is removed, made invisible, or performed by the environment.

Prefer mutations that improve both distinction and market-gap fit. Do not keep a mutation merely because it is stranger.

## 9. Attack similarity and gap quality again

For each mutated survivor, ask internally:

- What familiar product, company, research direction, patent class, open-source project, or historical concept is closest?
- If described without branding, does it collapse into an existing category?
- Is the claimed difference a real mechanism, underserved segment, delivery advantage, or only positioning?
- Do current alternatives truly fail for the named user, and what evidence would disprove that?
- Why has the gap not already been filled? Does the idea address that reason?
- Which single feature could be removed without changing the idea? If the “novel” or “gap-closing” feature can be removed, it is probably superficial.

When search is available, run targeted follow-up searches for close analogues and counterevidence. A limited search can support “apparently uncommon” or “evidence suggests an underserved segment,” never absolute novelty or proven demand.

## 10. Replenish rejected candidates only through the bounded evidence gate

Treat requested count as a maximum after quality filtering, not a quota. A fresh candidate may enter only from a different evidenced structural gap or genuinely different causal mechanism. Never mutate a fully rejected idea, and never repeatedly rescue the same root candidate.

Return fewer whenever the remaining candidates are duplicates, lack traceable positive evidence, fail competitor checks, retain fatal counterevidence, or exceed the mutation bound. If none survive, say **insufficient evidence** or **no candidate survived** and state why.

## 11. Return the strongest ideas

If the user does not specify a count, return at most 3–5 survivors. Use the consistent compact order: **Research Landscape → Signals → Structural Gaps → Candidate Ideas → Rejected Ideas + Why → Survivors → Evidence Lineage → Decisive Risks → 24–72 Hour Validation Tests**. Omit empty middle sections only when `stopDecision` explains why. When research was used, give representative sources and coverage limits; do not narrate every query.

For each final idea include every field below. Cite the supporting public pages inline when research was used. If the research does not support a field, say “unknown” or describe it as a hypothesis instead of guessing.

### Idea name — invention, market gap, or overlap

- **Concept:** A concrete explanation of the mechanism and user experience.
- **Target customer:** The specific user and, when different, buyer.
- **Exact market gap:** The named structured gap this exploits and whether it is an **evidence-backed market gap**, **plausible gap**, or **speculative opportunity**.
- **Evidence the gap exists:** The strongest factual support and inline citation links. Include counterevidence or material limits.
- **Closest competitors:** Supported competitor names and links; say “unknown from retrieved evidence” when appropriate.
- **What alternatives fail to do:** The evidenced limitation, not a generic contrast.
- **Product wedge:** The proposed mechanism, delivery model, integration, pricing, distribution, or other point of entry.
- **Why meaningfully different:** A mechanism- or market-structure contrast that survives the similarity attack.
- **Likely business model:** A plausible model, clearly labeled as a proposal unless pricing evidence supports it.
- **Hardest risk:** The most important risk, tradeoff, hidden constraint, or reason the gap may be a trap.
- **Evidence lineage:** The concise, user-facing provenance summary from the structured lineage record.
- **Falsification survived:** The strongest argument against, the recorded outcome, and the decisive unresolved risk.
- **Why it ranked here:** Preserve written reasoning for evidence strength, demand signal, novelty/differentiation, feasibility, economics, distribution, defensibility, regulatory risk, and confidence. The numeric score is a heuristic prioritization aid and never replaces this reasoning.
- **First validation experiment:** Use the structured experiment's exact target, action, success threshold, failure threshold, cost, time, and decision. Keep any ethics note. Fake doors must not deceptively charge for unavailable products.
- **Confidence:** One of **evidence-backed**, **plausible**, or **speculative**, with a brief reason.

End with a brief comparison table when it helps the user choose. Useful columns include opportunity type, mechanism, underserved user, market-gap strength, feasibility, and decisive unknown. Use qualitative language rather than fabricated precision.

Do not dump the internal candidate pool, detailed scores, hidden reasoning, raw research JSON, or a narrated chain of thought. The user should see selected concepts, calibrated evidence, citation links, and decision-relevant comparisons—not the private search trace.
