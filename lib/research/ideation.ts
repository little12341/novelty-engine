import type { CandidateGap, ContradictionHypothesis, FailedAttempt, GraphHole, IdeaCandidate, WeakSignal, WorkflowStitchingPattern } from "./types.ts";
import { evidenceUnion, stableId } from "./utils.ts";

const MECHANISMS = [
  { label: "event bridge", family: "interoperability protocol", transferIndex: 3, interface: "background integration", technology: "event-driven connectors", position: "between existing tools", differentiator: "moves only decision-relevant state without another system of record" },
  { label: "exception queue", family: "exception management", transferIndex: 0, interface: "message-based exception inbox", technology: "rules and lightweight automation", position: "after source-system events", differentiator: "asks for attention only when systems disagree" },
  { label: "shared proof", family: "portable trust record", transferIndex: 1, interface: "portable job receipt", technology: "local-first signed records", position: "at the handoff", differentiator: "coordinates parties without centralizing their operational data" },
  { label: "outcome service", family: "outcome-based service", transferIndex: 4, interface: "concierge-to-automation service", technology: null, position: "at job completion", differentiator: "sells a verified outcome instead of another seat" },
  { label: "ambient capture", family: "zero-entry capture", transferIndex: 2, interface: "passive capture at the worksite", technology: "edge sensing or device metadata", position: "when work occurs", differentiator: "removes manual data entry rather than making it faster" },
  { label: "reversible handoff", family: "escrowed workflow", transferIndex: 5, interface: "time-bounded handoff contract", technology: "policy rules and verifiable receipts", position: "before a risky handoff", differentiator: "makes the transfer reversible until evidence clears the acceptance rule" },
  { label: "pooled access", family: "shared capacity network", transferIndex: 4, interface: "cohort purchasing or shared service", technology: null, position: "before procurement", differentiator: "aggregates fragmented demand without forcing each customer to buy full capacity" },
];

const TRANSFERS = [
  { sourceDomain: "aviation operations", borrowedMechanism: "exception-only control", structuralAnalogue: "routine events stay automated while anomalies require accountable human review", adaptationBoundary: "transfer the escalation logic, not cockpit visual language" },
  { sourceDomain: "payment networks", borrowedMechanism: "escrow and settlement receipts", structuralAnalogue: "multiple parties need proof before a handoff becomes final", adaptationBoundary: "use bounded verification; do not imply financial custody without the required controls" },
  { sourceDomain: "lean manufacturing", borrowedMechanism: "poka-yoke error prevention", structuralAnalogue: "prevent an invalid workflow state before downstream rework occurs", adaptationBoundary: "transfer the causal guardrail, not factory-themed interfaces" },
  { sourceDomain: "logistics cross-docking", borrowedMechanism: "route without warehousing", structuralAnalogue: "move only the minimum decision-relevant payload between systems", adaptationBoundary: "avoid becoming another system of record" },
  { sourceDomain: "insurance mutuals", borrowedMechanism: "pool fragmented risk and purchasing power", structuralAnalogue: "small buyers cannot individually support fixed cost or specialist capacity", adaptationBoundary: "validate adverse selection and regulatory implications before pooling money or risk" },
  { sourceDomain: "version control", borrowedMechanism: "small reversible change sets", structuralAnalogue: "a workflow change needs provenance, review, and rollback", adaptationBoundary: "transfer review and rollback semantics, not developer jargon" },
];

function marketDefinition(query: string, target: string | null): { industry: string; companyProfile: string; decisionMaker: string } {
  const rules: Array<[RegExp, string, string, string]> = [
    [/consumer|household|food waste|grocery|pantry/i, "consumer household operations", "households of roughly 1–6 people with recurring grocery, storage, and meal-planning workflows", "household buyer or primary grocery decision-maker"],
    [/contract|construction|trades?|home service|field service/i, "contracting and field services", "contracting or home-service companies with roughly 2–50 field workers and recurring subcontractor/vendor handoffs", "owner, operations manager, or risk/compliance lead"],
    [/finance|account|month.end|reconcil/i, "accounting and finance operations", "small and mid-sized companies with 2–20 person finance teams and a recurring close or reconciliation process", "controller, head of finance, or finance operations lead"],
    [/clinical|trial|health|medical/i, "regulated healthcare and clinical research", "regulated clinics, research sites, or sponsors with a named audit owner and recurring document workflows", "site director, clinical operations lead, or compliance owner"],
    [/developer|engineering|devops|software|\bci\b/i, "software engineering", "software companies with multi-repository engineering teams and a dedicated build or platform owner", "engineering manager, platform lead, or developer-tools buyer"],
    [/restaurant|food service|hospitality/i, "hospitality and food service", "independent and regional operators with 1–25 locations and recurring frontline workflows", "owner-operator or operations director"],
    [/insurance|broker|risk/i, "insurance and risk operations", "businesses or brokerages with recurring policy, certificate, or third-party risk workflows", "risk manager, controller, or insurance operations lead"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(query));
  const industry = matched?.[1] ?? (query.replace(/^(?:find|research|investigate|identify)\b/i, "").trim().split(/\s+/).slice(0, 7).join(" ") || "the researched market");
  const genericTarget = !target || /mobile.first|field users?|users?|teams?|small businesses|regulated teams/i.test(target);
  const companyProfile = genericTarget
    ? matched?.[2] ?? `${industry} organizations with an identifiable recurring workflow, an accountable buyer, and an observable operating profile`
    : `${target} in ${industry}, with a recurring affected workflow and an identifiable operating buyer`;
  return { industry, companyProfile, decisionMaker: matched?.[3] ?? "the operations owner or budget-holding workflow leader" };
}

export function requestedIdeaCount(query: string): number {
  const match = query.match(/\b(?:generate|give|find|propose|develop|create|return|want)\s+(\d{1,2})\b/i) ?? query.match(/\b(\d{1,2})\s+(?:ideas?|opportunities|concepts?)\b/i);
  return Math.min(12, Math.max(1, Number(match?.[1] ?? 5)));
}

export function generateCandidates(input: {
  query: string; gaps: CandidateGap[]; graphHoles: GraphHole[]; contradictions: ContradictionHypothesis[];
  stitching: WorkflowStitchingPattern[]; signals: WeakSignal[]; failedAttempts: FailedAttempt[]; maxCandidates: number;
}): IdeaCandidate[] {
  const desired = Math.min(input.maxCandidates, Math.max(requestedIdeaCount(input.query) * 3, 15));
  const bases = input.gaps.filter((gap) => gap.confidenceLabel !== "speculative opportunity"
    && !gap.penalties.some((penalty) => penalty.code === "weak_evidence" || penalty.code === "absence_only"));
  if (bases.length === 0) return [];
  const candidates: IdeaCandidate[] = [];
  for (let index = 0; index < desired; index += 1) {
    const gap = bases[index % bases.length];
    const mechanism = MECHANISMS[index % MECHANISMS.length];
    const transfer = TRANSFERS[mechanism.transferIndex];
    const hole = input.graphHoles[index % Math.max(1, input.graphHoles.length)];
    const contradiction = input.contradictions[index % Math.max(1, input.contradictions.length)];
    const stitch = input.stitching[index % Math.max(1, input.stitching.length)];
    const signal = input.signals[index % Math.max(1, input.signals.length)];
    const failed = input.failedAttempts.filter((item) => item.resurrectionEligible)[index % Math.max(1, input.failedAttempts.filter((item) => item.resurrectionEligible).length)];
    const target = gap.affectedSegment ?? stitch?.segment ?? null;
    const market = marketDefinition(input.query, target);
    const variation = Math.floor(index / MECHANISMS.length) + 1;
    const idSeed = `${gap.id}:${mechanism.label}:${variation}`;
    const targetLabel = (target ?? gap.gapType).split(/\s+/).slice(0, 3).join(" ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const currentWorkaround = gap.currentWorkaround ?? stitch?.manualSteps.join(", ") ?? "the cited manual or fragmented incumbent workflow";
    const economicConsequence = gap.willingnessToPaySignal
      ? "Recurring labor, rework, delay, or risk is already tied to a retrieved spend signal; magnitude still requires validation."
      : "Recurring staff time, rework, delay, or compliance exposure is plausible from the cited workflow; monetary magnitude remains UNKNOWN.";
    const proposedMechanism = `${mechanism.label}: ${transfer.borrowedMechanism}${contradiction ? `, bounded by ${contradiction.operation}` : ""}`;
    candidates.push({
      id: stableId("candidate", idSeed), name: `${targetLabel} ${mechanism.label.replace(/\b\w/g, (letter) => letter.toUpperCase())}${variation > 1 ? ` — ${gap.gapType}` : ""}`,
      summary: `${market.companyProfile} use a ${mechanism.label} at ${mechanism.position} to address ${gap.problemStatement.toLowerCase()}; the buyer is ${market.decisionMaker}.`,
      targetCustomer: market.companyProfile, payer: index % 3 === 0 ? `beneficiary or downstream counterparty approved by ${market.decisionMaker}` : market.decisionMaker,
      jobToBeDone: stitch?.job ?? gap.problemStatement,
      mechanism: proposedMechanism,
      interface: mechanism.interface, technology: signal?.label ?? mechanism.technology,
      businessModel: index % 3 === 0 ? "per verified outcome" : index % 3 === 1 ? "usage-based" : "service subscription",
      distribution: index % 2 === 0 ? "through an existing workflow partner" : "direct to the affected segment",
      dataSource: mechanism.label === "ambient capture" ? "operational exhaust or device metadata" : "existing source systems",
      ownershipModel: index % 4 === 0 ? "shared or temporary access" : "customer-controlled",
      workflowPosition: mechanism.position, differentiator: mechanism.differentiator,
      sourceGapIds: gap.id === "gap_unknown" ? [] : [gap.id], sourceGraphHoleIds: hole ? [hole.id] : [],
      sourceContradictionIds: contradiction ? [contradiction.id] : [], sourceStitchingIds: stitch ? [stitch.id] : [],
      sourceSignalIds: signal ? [signal.id] : [], sourceFailedAttemptIds: failed ? [failed.id] : [],
      evidenceIds: evidenceUnion(gap.supportingEvidenceIds, hole?.evidenceIds ?? [], contradiction?.evidenceIds ?? [], stitch?.evidenceIds ?? [], signal?.evidenceIds ?? [], failed?.allEvidenceIds ?? []),
      iteration: 0,
      rootCandidateId: stableId("candidate", idSeed), mechanismFamily: mechanism.family,
      crossDomainTransfer: transfer,
      definition: {
        industry: market.industry,
        companyProfile: market.companyProfile,
        buyer: market.decisionMaker,
        decisionMaker: market.decisionMaker,
        specificProblem: gap.problemStatement,
        currentWorkaround,
        economicConsequence,
        proposedMechanism,
        whyExistingSolutionsFail: gap.whySolutionsFail,
        evidenceIds: evidenceUnion(gap.supportingEvidenceIds, gap.counterEvidenceIds),
      },
    });
  }
  return candidates;
}
