# Novelty Engine V2 evaluation rubric

Compare three blinded responses to every case:

1. **Ordinary model ideation:** no Novelty Engine instructions and no research payload.
2. **Novelty Engine local-only:** use `skill/novelty-engine/SKILL.md`, force the documented unavailable-backend fallback, and provide no market evidence.
3. **Novelty Engine evidence-driven V2:** run `/api/research` first and give the Skill only `ideationContext` from that run.

Keep the model, settings, original prompt, and requested count identical. Record the research run ID for condition 3. Randomize response labels before human review so the reviewer cannot infer the condition.

Score each metric from 1 (poor) to 5 (excellent):

| Metric | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Specificity | Labels and vague features | Understandable concepts with partial mechanics | Concrete customer, job, mechanism, wedge, business model, and validation test |
| Evidence quality | Unsupported claims or invented facts | Some relevant support with caveats | Multiple relevant sources, clear fact/inference boundaries, counterevidence, and unknowns preserved |
| Market-gap strength | Invented demand or “no competitor” logic | A plausible underserved user or incumbent failure | A repeated, specific failure tied to an affected segment, workaround, alternatives, and persistence reason |
| Idea diversity | Repeats one category | Varies audiences or features | Varies mechanisms, constraints, channels, and business structures |
| Mechanism novelty | Renames default answers | Some uncommon combinations | Causal mechanisms remain distinct after fingerprint attack |
| Competitor similarity | Renamed incumbent | Names a wedge but overlap is high | Clear mechanism-level distance with nearest analogue and heuristic caveat |
| Source validity | Missing, fake, or irrelevant links | Links exist but partly support claims | Every material factual claim resolves to retrieved supporting evidence |
| Falsification quality | Sales pitch rationalizes risks | Lists generic risks | Separate evidence for/against, unknowns, kill criteria, and penalties |
| Lineage clarity | No provenance | Vague “research inspired” story | Concise evidence → gap → contradiction/mutation provenance |
| Validation usefulness | “Talk to users” | Identifies a test | Exact target, action, thresholds, cost, time, ethics, and next decision |
| Requested-count fidelity | Ignores count or pads duplicates | Count is right with weak items | Requested count survives quality filters or bounded shortfall is explained |
| Unsupported-claim rate | Many unsupported facts | Mostly calibrated with some leakage | No unsupported market facts; unknowns remain explicit |
| Feasibility | Ignores constraints | Plausible with major unknowns | Proportional, implementation-aware, and testable |
| Differentiation | Branding-only distinction | Names a nearest alternative | Explains the exact wedge and why alternatives fail to provide it |

Source validity is scored 1 for conditions without citations unless the response correctly says it has no research evidence and makes no research-backed claims; in that case a 2 is appropriate. For `unsupportedClaimRate`, a higher score means fewer unsupported claims. Fluent prose does not earn evidence credit without inspectable support.

## Protocol

1. Capture all three responses for all cases.
2. For the research condition, retain the saved structured JSON and verify every cited URL appears in its `sources` array.
3. Remove condition-revealing language and randomize A/B/C order.
4. Have at least one reviewer score every metric; two reviewers are preferable.
5. Flag calibration failures separately: fabricated competitor or price, fake citation, absolute uniqueness/patent/success claim, or fixture data represented as live.
6. Run `npm run eval:init`, fill the scores, and run `npm run eval:score -- evals/results/local.json`.

Report all per-metric means by condition. Do not collapse the result to one number: higher novelty can coexist with weaker feasibility, and polished citations can still be irrelevant.
