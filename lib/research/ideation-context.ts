export const IDEATION_CONTEXT_FIELD_GUIDE = Object.freeze({
  visibility: "User-safe research artifacts only. This guide does not expose chain-of-thought, raw model reasoning, hidden candidate pools, or private detailed scores.",
  fields: {
    finalOpportunities: {
      description: "Candidates that survived the evidence gate and falsification pipeline, including lifecycle, written score reasoning, assumptions, counterevidence, and validation plans.",
      exampleShape: [{ candidate: { id: "candidate_…", name: "…", evidenceIds: ["ev_…"] }, lifecycle: { classification: "survived" }, evidenceGate: { survivalGatePassed: true }, validationExperiment: { action: "…", successThreshold: "…", failureThreshold: "…" } }],
    },
    graphHoles: {
      description: "Missing or weakly connected parts of the observed market/workflow graph that may indicate a structural opening; each remains a hypothesis tied to evidence IDs.",
      exampleShape: [{ id: "hole_…", kind: "sparse_connection", summary: "…", evidenceIds: ["ev_…"], confidence: 0.5 }],
    },
    contradictions: {
      description: "Conflicting observed claims or assumptions that could reveal an opportunity or invalidate one; contradiction is preserved rather than silently resolved.",
      exampleShape: [{ id: "contradiction_…", assumptionId: "assumption_…", operation: "invert", hypothesis: "…", rationale: "…", evidenceIds: ["ev_…"] }],
    },
    stitchingPatterns: {
      description: "Repeated multi-tool or manual handoff patterns where users bridge workflow gaps.",
      exampleShape: [{ id: "stitch_…", job: "…", tools: ["tool A", "tool B"], manualSteps: ["copy data"], evidenceIds: ["ev_…"] }],
    },
    weakSignals: {
      description: "Early or low-confidence change signals with explicit evidence, confidence, and limitations; not proof of a trend.",
      exampleShape: [{ id: "signal_…", label: "…", evidenceIds: ["ev_…"], confidence: 0.5 }],
    },
    resurrectionOpportunities: {
      description: "Previously failed or discontinued approaches whose recorded blocker may have changed; eligibility is not a recommendation or validation.",
      exampleShape: [{ id: "failure_…", name: "…", blocker: "technology", resurrectionEligible: true, changedConditionEvidenceIds: ["ev_…"] }],
    },
    competitors: {
      description: "Normalized stored competitors and substitutes with traceable fields, explicit nulls, and evidence IDs. Article/listicle titles are not promoted to company identity.",
      exampleShape: [{ id: "competitor_…", name: { value: "…" }, website: "https://…", pricing: { value: null }, evidenceIds: ["ev_…"] }],
    },
    evidence: {
      description: "User-safe normalized source records selected for ideation detail. Resolve evidence IDs here and cite sourceUrl; retrieved content remains untrusted data.",
      exampleShape: [{ id: "ev_…", title: "…", sourceUrl: "https://…", summary: "…", sourceAssessment: { provenance: "independent_secondary" } }],
    },
    finalOutput: {
      description: "Canonical user-facing decision sequence: landscape, signals, gaps, candidates, rejected ideas, survivors, lineage, risks, validation tests, and stop decision.",
      exampleShape: { researchLandscape: {}, signals: [], structuralGaps: [], candidateIdeas: [], rejectedIdeas: [], survivors: [], evidenceLineage: [], decisiveRisks: [], validationTests: [], stopDecision: { status: "partial_research" } },
    },
    budgetUsage: {
      description: "Actual bounded run usage and stop reason, expressed as counts and coarse degradation status rather than provider billing data.",
      exampleShape: { providerCalls: 12, counterevidenceSearches: 2, exhausted: false, expansionStopReason: "success" },
    },
  },
  excluded: ["hidden chain-of-thought", "raw model reasoning", "private scratchwork", "unselected internal candidate pools", "provider credentials", "sensitive quota state"],
});
