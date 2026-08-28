import { createHash } from "node:crypto";
import { extractCompetitors } from "./analyze.ts";
import { fingerprintCandidate, fingerprintCompetitor, compareFingerprints, similarityMatrix } from "./fingerprints.ts";
import { buildProviderQuery } from "./angles.ts";
import { getConfiguredProvider } from "./providers.ts";
import { normalizeResults } from "./normalize.ts";
import type {
  CandidateCompetitorRecall, CandidateGap, Competitor, CompetitorRecallReport, Evidence, IdeaCandidate,
  ResearchResult, SearchAngle, SearchProvider,
} from "./types.ts";

export interface CompetitorDiscoveryGroup {
  id: string;
  candidateIds: string[];
  buyer: string;
  job: string;
  workflow: string;
  outcome: string;
  problem: string;
  workaround: string;
  categoryTerms: string;
}

export interface CompetitorDiscoveryPlan {
  groups: CompetitorDiscoveryGroup[];
  primaryAngles: SearchAngle[];
  crossCheckAngles: SearchAngle[];
  escalationAngles: SearchAngle[];
}

function compact(value: string | null | undefined, max = 220): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function quoted(value: string): string {
  const safe = compact(value, 150).replace(/["()]/g, " ");
  return safe ? `"${safe}"` : "";
}

function groupKey(candidate: IdeaCandidate): string {
  const raw = `${candidate.definition?.industry ?? ""}|${candidate.targetCustomer ?? ""}|${candidate.jobToBeDone}|${candidate.definition?.specificProblem ?? ""}`
    .toLowerCase().replace(/[^a-z0-9| ]/g, " ").replace(/\s+/g, " ");
  return createHash("sha1").update(raw).digest("hex").slice(0, 10);
}

function categoryTerms(text: string): string {
  const terms = [...new Set((text.match(/\b(?:compliance|insurance|certificate|coi|contractor|subcontractor|vendor|risk|audit|procurement|scheduling|invoicing|reconciliation|clinical|workflow|field service|construction|devops|testing|accounting)\b/gi) ?? []).map((item) => item.toLowerCase()))];
  return terms.join(" ") || compact(text, 100);
}

export function planCompetitorDiscovery(candidates: IdeaCandidate[], gaps: CandidateGap[], queriesPerCandidate = 2): CompetitorDiscoveryPlan {
  const grouped = new Map<string, IdeaCandidate[]>();
  for (const candidate of candidates.filter((item) => item.iteration === 0)) {
    const key = groupKey(candidate);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  const groups = [...grouped.entries()].map(([key, members]) => {
    const candidate = members[0];
    const gap = gaps.find((item) => candidate.sourceGapIds.includes(item.id));
    return {
      id: `recall_group_${key}`,
      candidateIds: members.map((item) => item.id),
      buyer: compact(candidate.definition?.companyProfile ?? candidate.targetCustomer ?? "unknown buyer"),
      job: compact(candidate.jobToBeDone),
      workflow: compact(candidate.workflowPosition),
      outcome: compact(candidate.definition?.economicConsequence ?? candidate.differentiator),
      problem: compact(candidate.definition?.specificProblem ?? gap?.problemStatement ?? candidate.summary),
      workaround: compact(candidate.definition?.currentWorkaround ?? gap?.currentWorkaround ?? "manual service spreadsheet email consultant"),
      categoryTerms: categoryTerms(`${candidate.definition?.industry ?? ""} ${candidate.jobToBeDone} ${gap?.gapType ?? ""}`),
    } satisfies CompetitorDiscoveryGroup;
  });
  const perPass = Math.max(2, Math.min(4, queriesPerCandidate));
  const angle = (group: CompetitorDiscoveryGroup, pass: "primary" | "crosscheck" | "escalation", index: number, query: string, purpose: string, domains: string[] = []): SearchAngle => ({
    id: `competitor_${pass}_${group.id.slice(-10)}_${index + 1}`,
    kind: pass === "primary" ? "competitor_high_recall_primary" : pass === "crosscheck" ? "competitor_high_recall_crosscheck" : "competitor_recall_escalation",
    query: compact(query, 900), purpose, targetedDomains: domains,
  });
  const primaryAngles = groups.flatMap((group) => [
    angle(group, "primary", 0,
      `${quoted(group.buyer)} ${quoted(group.job)} ${group.workflow} (software OR SaaS OR platform OR startup OR service) (competitors OR alternatives OR tools)`,
      "High-recall buyer + exact job + workflow discovery; product names are deliberately excluded from query construction."),
    angle(group, "primary", 1,
      `${quoted(group.problem)} ${quoted(group.buyer)} reviews complaints workaround software alternatives`,
      "Problem-phrase and user-voice discovery across forums and review sources; vendor listicles are discovery-only.",
      ["reddit.com", "g2.com", "capterra.com", "trustradius.com", "getapp.com"]),
    angle(group, "primary", 2,
      `${group.categoryTerms} ${quoted(group.buyer)} trade forum industry association product directory vendors`,
      "Trade-forum, association, and directory discovery for category-specific vendor and substitute language."),
    angle(group, "primary", 3,
      `${quoted(group.job)} ${quoted(group.outcome)} ${group.categoryTerms} customer case study implementation`,
      "Customer-case and outcome-language discovery to locate products described with different category labels."),
  ].slice(0, perPass));
  const crossCheckAngles = groups.flatMap((group) => [
    angle(group, "crosscheck", 0,
      `${quoted(group.buyer)} ${quoted(group.outcome)} ${quoted(group.workaround)} replace spreadsheet consultant broker managed service in-house alternatives`,
      "Independent cross-check using desired outcome and substitute language rather than the primary buyer/job formulation."),
    angle(group, "crosscheck", 1,
      `${group.categoryTerms} pricing procurement RFP vendor shortlist job posting case study directory comparison`,
      "Independent commercial cross-check across pricing, procurement/RFP, job, case-study, and product-directory evidence.",
      ["g2.com", "capterra.com", "trustradius.com", "getapp.com", "producthunt.com"]),
    angle(group, "crosscheck", 2,
      `${quoted(group.job)} official regulation standard industry body association approved vendors software`,
      "Independent official, regulatory, standards, and industry-body cross-check for compliance-shaped categories.",
      [".gov", "iso.org", "nist.gov"]),
    angle(group, "crosscheck", 3,
      `${quoted(group.problem)} who solves this startup platform service company competitors`,
      "Independent problem-first cross-check designed to find vendors whose marketing labels differ from the candidate wording."),
  ].slice(0, perPass));
  const escalationAngles = groups.flatMap((group) => [
    angle(group, "escalation", 0,
      `${group.categoryTerms} market map vendors competitors alternatives comparison "best software"`,
      "Recall escalation for an established category that returned fewer credible competitors than configured."),
    angle(group, "escalation", 1,
      `${quoted(group.buyer)} ${quoted(group.job)} pricing customers integrations competitors alternatives`,
      "Independently worded recall escalation using buyer, job, pricing, customers, and integrations."),
  ]);
  return { groups, primaryAngles, crossCheckAngles, escalationAngles };
}

export function establishedCategory(query: string, competitors: Competitor[]): boolean {
  if (/\b(?:genuinely new|nascent|pre-category|first-ever|newly emerging)\b/i.test(query) && competitors.length <= 1) return false;
  return competitors.length >= 2 || /\b(?:software|saas|platform|management|compliance|insurance|crm|erp|procurement|workflow|marketplace|service category|industry)\b/i.test(query);
}

export function credibleCompetitor(competitor: Competitor, evidence: Evidence[]): boolean {
  const records = evidence.filter((item) => competitor.evidenceIds.includes(item.id));
  return Boolean(competitor.name.value && competitor.coreJobToBeDone.value && records.some((item) => !item.sourceAssessment.discoveryOnly
    && ["official_company", "pricing", "documentation", "review", "product_directory", "app_marketplace"].includes(item.sourceType)));
}

function competitorIdsForAngles(competitors: Competitor[], evidence: Evidence[], angleIds: string[]): string[] {
  const wanted = new Set(angleIds);
  return competitors.filter((competitor) => competitor.evidenceIds.some((id) => evidence.find((item) => item.id === id)?.searchAngleIds.some((angleId) => wanted.has(angleId)))).map((item) => item.id);
}

export function buildCompetitorRecallReport(input: {
  query: string; plan: CompetitorDiscoveryPlan; candidates: IdeaCandidate[]; competitors: Competitor[]; evidence: Evidence[];
  successfulAngleIds: string[]; minimumCredibleCompetitors: number; escalationTriggeredGroupIds?: string[];
}): CompetitorRecallReport {
  const successful = new Set(input.successfulAngleIds);
  const escalated = new Set(input.escalationTriggeredGroupIds ?? []);
  const established = establishedCategory(input.query, input.competitors);
  const audits: CandidateCompetitorRecall[] = [];
  for (const group of input.plan.groups) {
    const primaryQueryIds = input.plan.primaryAngles.filter((item) => item.id.includes(group.id.slice(-10))).map((item) => item.id);
    const crossCheckQueryIds = input.plan.crossCheckAngles.filter((item) => item.id.includes(group.id.slice(-10))).map((item) => item.id);
    const escalationQueryIds = input.plan.escalationAngles.filter((item) => item.id.includes(group.id.slice(-10))).map((item) => item.id);
    const primaryCompetitorIds = competitorIdsForAngles(input.competitors, input.evidence, primaryQueryIds);
    const crossCheckCompetitorIds = competitorIdsForAngles(input.competitors, input.evidence, crossCheckQueryIds);
    const escalationCompetitorIds = competitorIdsForAngles(input.competitors, input.evidence, escalationQueryIds);
    const candidate = input.candidates.find((item) => group.candidateIds.includes(item.id));
    const related = [...new Set([...primaryCompetitorIds, ...crossCheckCompetitorIds, ...escalationCompetitorIds])]
      .filter((id) => {
        const competitor = input.competitors.find((item) => item.id === id);
        return competitor && credibleCompetitor(competitor, input.evidence)
          && (!candidate || compareFingerprints(fingerprintCandidate(candidate), fingerprintCompetitor(competitor)).score >= .18);
      });
    const materialNewDirectCompetitorIds = crossCheckCompetitorIds.filter((id) => !primaryCompetitorIds.includes(id)).filter((id) => {
      const competitor = input.competitors.find((item) => item.id === id);
      return Boolean(candidate && competitor && competitor.relationship?.value !== "substitute"
        && compareFingerprints(fingerprintCandidate(candidate), fingerprintCompetitor(competitor)).score >= .32);
    });
    const crossCheckComplete = crossCheckQueryIds.some((id) => successful.has(id));
    const escalationTriggered = escalated.has(group.id);
    const escalationComplete = !escalationTriggered || escalationQueryIds.some((id) => successful.has(id));
    const recallSufficient = crossCheckComplete && (!established || related.length >= input.minimumCredibleCompetitors || escalationComplete);
    for (const candidateId of group.candidateIds) audits.push({
      candidateId, structuralGroupId: group.id, establishedCategory: established,
      minimumCredibleCompetitors: input.minimumCredibleCompetitors, primaryQueryIds, crossCheckQueryIds, escalationQueryIds,
      primaryCompetitorIds, crossCheckCompetitorIds, escalationCompetitorIds, credibleCompetitorIds: related,
      materialNewDirectCompetitorIds, crossCheckComplete, escalationTriggered, escalationComplete, recallSufficient,
      explanation: `Primary and independently constructed cross-check passes were compared. ${materialNewDirectCompetitorIds.length} material direct competitor(s) appeared only in the second pass. ${related.length} credible competitor/substitute record(s) were linked to this buyer/job group${escalationTriggered ? "; low recall triggered an additional independently worded escalation" : ""}.`,
    });
  }
  return {
    minimumCredibleCompetitors: input.minimumCredibleCompetitors,
    primaryQueries: input.plan.primaryAngles.length,
    crossCheckQueries: input.plan.crossCheckAngles.length,
    escalationQueries: input.plan.escalationAngles.filter((item) => [...escalated].some((id) => item.id.includes(id.slice(-10)))).length,
    candidates: audits,
  };
}

export async function freshCompetitorExpansion(run: ResearchResult, candidateId?: string, signal?: AbortSignal, provider: SearchProvider = getConfiguredProvider()): Promise<ResearchResult> {
  const selected = candidateId ? run.candidates.filter((item) => item.id === candidateId) : run.candidates.filter((item) => item.iteration === 0).slice(0, 5);
  if (candidateId && selected.length === 0) throw new RangeError(`Candidate ${candidateId} was not found in research run ${run.id}.`);
  if (!selected.length) throw new RangeError(`Research run ${run.id} has no candidate definition to expand.`);
  const plan = planCompetitorDiscovery(selected, run.gaps, run.limits.competitorQueriesPerCandidate ?? 2);
  const angles = [...plan.primaryAngles, ...plan.crossCheckAngles, ...plan.escalationAngles].slice(0, 12);
  const batches: Array<{ angle: SearchAngle; results: Awaited<ReturnType<SearchProvider["search"]>> }> = [];
  for (const angle of angles) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Competitor expansion cancelled.", "AbortError");
    batches.push({ angle, results: await provider.search(buildProviderQuery(angle), { limit: run.limits.resultsPerQuery, signal }) });
  }
  const fresh = normalizeResults(batches, new Date().toISOString(), run.limits.maxSources);
  const mergedByUrl = new Map(run.sources.map((item) => [item.normalizedUrl, structuredClone(item)]));
  for (const item of fresh) {
    const existing = mergedByUrl.get(item.normalizedUrl);
    if (existing) existing.searchAngleIds = [...new Set([...existing.searchAngleIds, ...item.searchAngleIds])];
    else mergedByUrl.set(item.normalizedUrl, item);
  }
  const sources = [...mergedByUrl.values()];
  const competitors = extractCompetitors(sources);
  const similarities = similarityMatrix(run.candidates.map(fingerprintCandidate), competitors.map(fingerprintCompetitor));
  const report = buildCompetitorRecallReport({ query: run.query, plan, candidates: selected, competitors, evidence: sources,
    successfulAngleIds: angles.map((item) => item.id), minimumCredibleCompetitors: run.limits.minCredibleCompetitors ?? 5,
    escalationTriggeredGroupIds: plan.groups.map((item) => item.id) });
  return { ...run, sources, competitors, similarities, competitorRecall: report, warnings: [...run.warnings, "inspect_competitors performed a fresh high-recall expansion; the stored run itself was not mutated."] };
}
