export const RESEARCH_SCHEMA_VERSION = "2.1.0" as const;
export const RESEARCH_ENGINE_VERSION = "2.2.0" as const;

export type ClaimStatus = "VERIFIED" | "INFERRED" | "UNKNOWN";
export type FactState = "KNOWN" | "INFERRED" | "UNKNOWN" | "CONTRADICTED";
export type ResearchDepth = "fast" | "standard" | "deep";

export type ResearchMode =
  | "find_business" | "research_market" | "research_company" | "find_competitors"
  | "find_gaps" | "falsify" | "validate_idea" | "compare_ideas";

export type ResearchRole =
  | "market_mapping" | "competitor_analysis" | "complaint_workaround_mining"
  | "structural_gap_detection" | "adversarial_falsification" | "source_verification"
  | "company_analysis" | "opportunity_synthesis";

export type SpecialistAgent =
  | "scout" | "competitor" | "gap" | "skeptic" | "evidence" | "pricing"
  | "customer_pain" | "market_sizing" | "trend" | "distribution" | "regulatory"
  | "technical_feasibility" | "business_model" | "bull" | "bear" | "judge" | "final_judge";

export type CandidateLifecycleState =
  | "DISCOVERED" | "RESEARCHING" | "CHALLENGED" | "FALSIFICATION"
  | "SURVIVED" | "VALIDATING" | "VALIDATED" | "KILLED";

export interface CandidateLifecycleEvent {
  candidateId: string;
  state: CandidateLifecycleState;
  at: string;
  reason: string;
  evidenceIds: string[];
  killCode: string | null;
}

export interface CandidateLifecycleRecord {
  candidateId: string;
  currentState: CandidateLifecycleState;
  classification: "discovered" | "promising" | "survived" | "validated" | "killed";
  events: CandidateLifecycleEvent[];
  exactKillReason: string | null;
  failureFeedback: string[];
}

export type PipelineCheckpointName =
  | "source_validation_deduplication" | "competitor_substitute_check"
  | "residual_gap_test" | "candidate_mechanism_deduplication" | "falsification"
  | "citation_validation" | "final_persistence";

export interface PipelineCheckpoint {
  name: PipelineCheckpointName;
  status: "passed" | "failed" | "not_applicable";
  completedAt: string;
  details: string;
}

export interface ResearchRoleOutput {
  role: ResearchRole;
  inputEvidenceIds: string[];
  outputRecordIds: string[];
  status: "complete" | "partial" | "skipped";
  permissions: Array<"read_retrieved_evidence" | "derive_structured_records" | "request_bounded_search">;
  notes: string[];
}

export type SearchAngleKind =
  | "direct_competitors"
  | "competitor_high_recall_primary"
  | "competitor_high_recall_crosscheck"
  | "competitor_recall_escalation"
  | "adjacent_categories"
  | "customer_complaints"
  | "manual_workarounds"
  | "pricing_complaints"
  | "underserved_segments"
  | "workflow_fragmentation"
  | "poor_integrations"
  | "change_signals"
  | "substitutes"
  | "customer_language"
  | "failed_attempts"
  | "research_regulation"
  | "open_source_patents"
  | "jobs_procurement"
  | "adjacent_mechanisms"
  | "active_falsification_competition"
  | "active_falsification_constraints"
  | "evidence_gap_pain"
  | "evidence_gap_spend"
  | "evidence_gap_institutional";

export type SourceType =
  | "official_company"
  | "pricing"
  | "documentation"
  | "reddit"
  | "forum"
  | "github"
  | "product_directory"
  | "app_marketplace"
  | "review"
  | "industry_publication"
  | "regulator"
  | "research"
  | "patent"
  | "job_posting"
  | "marketplace"
  | "other";

export type GapType =
  | "product"
  | "pricing"
  | "usability"
  | "distribution"
  | "integration"
  | "trust"
  | "compliance"
  | "isolated";

export interface SearchAngle {
  id: string;
  kind: SearchAngleKind;
  query: string;
  purpose: string;
  targetedDomains: string[];
}

export interface ProviderSearchResult {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string | null;
  rank?: number;
}

export interface SearchProvider {
  readonly id: string;
  readonly displayName: string;
  search(query: string, options: { limit: number; signal?: AbortSignal }): Promise<ProviderSearchResult[]>;
}

export interface StructuredModelProvider {
  readonly id: string;
  readonly displayName: string;
  generate<T>(request: {
    stage: "extraction" | "candidate_generation" | "falsification";
    input: unknown;
    schemaName: string;
    signal?: AbortSignal;
  }): Promise<T>;
}

export interface Evidence {
  id: string;
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  sourceType: SourceType;
  publicationDate: string | null;
  retrievedAt: string;
  summary: string;
  supports: string;
  confidence: number;
  searchAngleIds: string[];
  claimFingerprint: string;
  duplicateSourceUrls: string[];
  duplicateSourceTypes: SourceType[];
  security: {
    treatedAsUntrustedData: true;
    promptInjectionDetected: boolean;
    ignoredDirectiveCategories: string[];
  };
  sourceAssessment: {
    quality: number;
    directness: number;
    recency: number;
    independence: number;
    overallWeight: number;
    independenceGroup: string;
    isPrimary: boolean;
    repetitionRisk: "none" | "possible" | "likely";
    sourceFamily: "competitor" | "user_voice" | "technical" | "institutional" | "failed_attempt" | "commercial" | "general";
    provenance: "company_controlled" | "government" | "research" | "user_generated" | "independent_secondary" | "marketplace";
    commercialBiasRisk: "low" | "medium" | "high" | "unknown";
    observationKind: "factual_market_observation" | "opinion_experience" | "company_claim" | "mixed";
    discoveryOnly: boolean;
    rationale: string;
  };
}

export interface TraceableClaim {
  id: string;
  claim: string;
  status: ClaimStatus;
  evidenceIds: string[];
  rationale: string;
}

export interface SupportedValue<T> {
  value: T | null;
  evidenceIds: string[];
  confidence: number;
}

export interface CompetitorIntelligence {
  funding: SupportedValue<string>;
  headcount: SupportedValue<string>;
  hiring: SupportedValue<string[]>;
  traffic: SupportedValue<string>;
  reviews: SupportedValue<string[]>;
  complaints: SupportedValue<string[]>;
  partnerships: SupportedValue<string[]>;
  integrations: SupportedValue<string[]>;
  channels: SupportedValue<string[]>;
  launches: SupportedValue<string[]>;
  strategicDirection: SupportedValue<string>;
}

export interface Competitor {
  id: string;
  name: SupportedValue<string>;
  website: string;
  targetCustomer: SupportedValue<string>;
  coreJobToBeDone: SupportedValue<string>;
  pricing: SupportedValue<string>;
  keyFeatures: SupportedValue<string[]>;
  positioning: SupportedValue<string>;
  likelyStrengths: SupportedValue<string[]>;
  likelyWeaknesses: SupportedValue<string[]>;
  relationship?: SupportedValue<"direct" | "substitute">;
  intelligence: CompetitorIntelligence;
  evidenceIds: string[];
}

export interface ComplaintCluster {
  id: string;
  label: string;
  normalizedProblem: string;
  evidenceCount: number;
  severity: "low" | "medium" | "high";
  affectedSegment: string | null;
  representativeEvidenceIds: string[];
  representativeSourceUrls: string[];
  gapType: GapType;
  isIsolated: boolean;
  currentWorkaround: string | null;
  requestedFeatures: string[];
  willingnessToPaySignals: string[];
  churnReasons: string[];
  buyingObjections: string[];
  jobsToBeDone: string[];
}

export interface UnderservedSegment {
  id: string;
  segment: string;
  rationale: string;
  evidenceIds: string[];
  confidence: number;
}

export interface GapScoreFactors {
  painSeverity: number;
  complaintRecurrence: number;
  currentSolutionWeakness: number;
  competitiveWhitespace: number;
  differentiationPotential: number;
  willingnessToPay: number;
  timing: number;
  implementationFeasibility: number;
  distributionAccessibility: number;
  defensibility: number;
}

export interface GapPenalty {
  code: "absence_only" | "weak_evidence" | "one_off" | "incumbent_dominance";
  points: number;
  reason: string;
}

export interface CandidateGap {
  id: string;
  problemStatement: string;
  affectedSegment: string | null;
  currentWorkaround: string | null;
  existingSolutions: string[];
  whySolutionsFail: string;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  competitiveDensity: "low" | "medium" | "high" | "unknown";
  willingnessToPaySignal: string | null;
  implementationDifficulty: "low" | "medium" | "high" | "unknown";
  timingSignal: string | null;
  gapType: GapType;
  score: number;
  scoreFactors: GapScoreFactors;
  penalties: GapPenalty[];
  confidence: number;
  confidenceLabel: "evidence-backed market gap" | "plausible gap" | "speculative opportunity";
}

export interface ResearchLimits {
  maxQueryLength: number;
  maxSearchQueries: number;
  resultsPerQuery: number;
  maxSources: number;
  maxCandidates: number;
  maxModelIterations: number;
  maxSurvivorIterations: number;
  maxProviderCalls: number;
  maxCounterevidenceSearches: number;
  maxAgentCalls: number;
  maxProviderSpendCredits: number;
  maxConcurrency: number;
  maxRetriesPerSearch: number;
  timeoutMs: number;
  maxExpansionBranches: number;
  maxRunDurationMs: number;
  minCredibleCompetitors: number;
  competitorQueriesPerCandidate: number;
}

export interface SearchBranch {
  id: string;
  parentId: string | null;
  dimension: "segment" | "workflow" | "vertical" | "geography" | "business_model" | "upstream" | "downstream" | "sub_niche";
  query: string;
  reason: string;
  learnedFromKillReasons: string[];
  status: "searched" | "skipped_budget" | "no_new_evidence";
  searchAngleIds: string[];
}

export type GraphNodeType =
  | "competitor" | "product" | "customer_segment" | "complaint" | "workaround"
  | "job_to_be_done" | "technology" | "regulation" | "pricing_model"
  | "distribution_channel" | "failed_attempt" | "behavior" | "gap";

export type GraphEdgeType =
  | "serves" | "complains-about" | "depends-on" | "replaces" | "integrates-with"
  | "blocked-by" | "priced-for" | "workaround-for" | "enabled-by" | "failed-because"
  | "similar-to" | "underserved-by";

export interface OpportunityGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  attributes: Record<string, string | number | boolean | null>;
  evidenceIds: string[];
  confidence: number;
}

export interface OpportunityGraphEdge {
  id: string;
  type: GraphEdgeType;
  from: string;
  to: string;
  evidenceIds: string[];
  confidence: number;
}

export interface OpportunityGraph {
  schemaVersion: "1.0";
  nodes: OpportunityGraphNode[];
  edges: OpportunityGraphEdge[];
}

export type GraphHoleKind =
  | "underserved_segment" | "complaint_workaround_pattern" | "technology_unlock"
  | "regulatory_shift" | "missing_combination" | "sparse_connection";

export interface GraphHole {
  id: string;
  kind: GraphHoleKind;
  summary: string;
  nodeIds: string[];
  evidenceIds: string[];
  strength: number;
  confidence: number;
}

export type ContradictionOperation =
  | "invert" | "remove" | "compress" | "decentralize" | "delay"
  | "automate" | "externalize" | "unbundle" | "reverse_payer";

export interface MarketAssumption {
  id: string;
  statement: string;
  dimension: string;
  affectedEntityIds: string[];
  evidenceIds: string[];
  confidence: number;
}

export interface ContradictionHypothesis {
  id: string;
  assumptionId: string;
  operation: ContradictionOperation;
  hypothesis: string;
  rationale: string;
  evidenceIds: string[];
  strength: number;
}

export interface WorkflowStitchingPattern {
  id: string;
  job: string;
  segment: string | null;
  tools: string[];
  manualSteps: string[];
  evidenceIds: string[];
  scoreFactors: {
    toolCount: number; manualSteps: number; recurrence: number; switchingCost: number;
    errorRisk: number; timeCost: number; willingnessToPay: number;
  };
  score: number;
  confidence: number;
}

export type WeakSignalKind =
  | "terminology" | "api_capability" | "hardware_availability" | "open_source_growth"
  | "integration_demand" | "regulatory_change" | "behavior_change" | "price_collapse";

export interface WeakSignal {
  id: string;
  kind: WeakSignalKind;
  label: string;
  description: string;
  firstSeen: string | null;
  recency: number;
  recurrence: number;
  accelerationProxy: number | null;
  accelerationIsApproximation: boolean;
  evidenceIds: string[];
  confidence: number;
}

export type FailureBlocker =
  | "technology" | "customer_acquisition" | "timing" | "regulation" | "hardware_cost"
  | "user_behavior" | "infrastructure" | "market_size" | "trust" | "pricing"
  | "distribution" | "execution" | "unknown";

export interface FailedAttempt {
  id: string;
  name: string;
  outcome: "failed" | "discontinued" | "shut_down" | "acquired_and_abandoned" | "low_adoption" | "unknown";
  approach: string | null;
  blocker: FailureBlocker;
  blockerEvidenceIds: string[];
  allEvidenceIds: string[];
  blockerStillExists: boolean | null;
  changedConditionEvidenceIds: string[];
  resurrectionEligible: boolean;
  confidence: number;
}

export type MutationDimension =
  | "target_user" | "payer" | "ownership_model" | "price_point" | "distribution_channel"
  | "interface" | "hardware_software" | "human_autonomy" | "architecture" | "usage_timing"
  | "scale" | "geography" | "timing" | "privacy_model" | "data_source" | "incentive_structure"
  | "revenue_model" | "integration_depth" | "physical_mechanism" | "deployment_environment";

export interface IdeaCandidate {
  id: string;
  name: string;
  summary: string;
  targetCustomer: string | null;
  payer: string | null;
  jobToBeDone: string;
  mechanism: string;
  interface: string;
  technology: string | null;
  businessModel: string | null;
  distribution: string | null;
  dataSource: string | null;
  ownershipModel: string | null;
  workflowPosition: string;
  differentiator: string;
  sourceGapIds: string[];
  sourceGraphHoleIds: string[];
  sourceContradictionIds: string[];
  sourceStitchingIds: string[];
  sourceSignalIds: string[];
  sourceFailedAttemptIds: string[];
  evidenceIds: string[];
  iteration: number;
  rootCandidateId: string;
  mechanismFamily: string;
  crossDomainTransfer: {
    sourceDomain: string;
    borrowedMechanism: string;
    structuralAnalogue: string;
    adaptationBoundary: string;
  } | null;
  definition?: {
    industry: string;
    companyProfile: string;
    buyer: string;
    decisionMaker: string;
    specificProblem: string;
    currentWorkaround: string;
    economicConsequence: string;
    proposedMechanism: string;
    whyExistingSolutionsFail: string;
    evidenceIds: string[];
  };
}

export interface MutationRecord {
  id: string;
  parentCandidateId: string;
  resultCandidateId: string;
  dimension: MutationDimension;
  before: string | null;
  after: string;
  effect: string;
  iteration: number;
  boundedRationale: string;
  result: "pending" | "survived" | "rejected";
}

export interface NoveltyFingerprint {
  candidateId: string;
  dimensions: {
    targetCustomer: string | null; jobToBeDone: string; mechanism: string; interface: string;
    technology: string | null; businessModel: string | null; distribution: string | null;
    dataSource: string | null; ownershipModel: string | null; workflowPosition: string;
    coreDifferentiator: string;
    desiredOutcome?: string | null;
    integrationsSystemBoundary?: string | null;
    pricingBusinessModel?: string | null;
    distributionContext?: string | null;
  };
  tokens: string[];
}

export interface SimilarityResult {
  leftId: string;
  rightId: string;
  score: number;
  matchingDimensions: string[];
  nonMatchingDimensions?: string[];
  dimensionScores?: Record<string, number>;
  explanation: string;
  heuristic: true;
}

export interface LineageStep {
  kind: "complaint" | "workaround" | "segment" | "graph_hole" | "contradiction" | "technology" | "failed_attempt" | "mutation";
  refId: string;
  label: string;
  evidenceIds: string[];
  claimStatus: ClaimStatus;
}

export interface IdeaLineage {
  candidateId: string;
  steps: LineageStep[];
  summary: string;
  observations: TraceableClaim[];
  contradictions: TraceableClaim[];
  mutations: Array<{ mutationId: string; parentCandidateId: string; dimension: MutationDimension; before: string | null; after: string }>;
  evidenceIds: string[];
}

export type FalsificationDimension =
  | "demand" | "competition" | "economics" | "distribution" | "technical_feasibility"
  | "regulation" | "user_behavior" | "trust" | "liability" | "switching_cost" | "defensibility";

export interface FalsificationHypothesis {
  dimension: FalsificationDimension;
  statement: string;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  risk: number;
  unknown: boolean;
  claimStatus: ClaimStatus;
  rationale: string;
  decisive: boolean;
}

export type ResidualDemandCriterion =
  | "repeated_unresolved_complaints" | "workaround_prevalence" | "switching_behavior"
  | "underserved_segments" | "price_performance_gaps" | "trust_failures" | "distribution_gaps"
  | "missing_integrations" | "procurement_friction" | "tolerated_bad_solutions";

export interface ResidualDemandSignalAssessment {
  criterion: ResidualDemandCriterion;
  present: boolean | null;
  claimStatus: ClaimStatus;
  evidenceIds: string[];
  rationale: string;
}

export interface ResidualUnmetDemandAssessment {
  competitorsPresent: boolean;
  closestCompetitorSimilarity: number | null;
  sameJobSameUserSubstitute: boolean;
  signals: Record<ResidualDemandCriterion, ResidualDemandSignalAssessment>;
  mechanismMateriallyChangesOutcome: {
    present: boolean | null;
    claimStatus: ClaimStatus;
    evidenceIds: string[];
    rationale: string;
  };
  meaningfulResidualGap: boolean;
  adequateSameJobSameUserSolution: boolean;
  conclusion: "meaningful_residual_gap" | "adequately_solved" | "residual_gap_uncertain" | "no_competitor_evaluated";
  rationale: string;
  evidenceIds: string[];
}

export interface FalsificationResult {
  candidateId: string;
  hypotheses: FalsificationHypothesis[];
  argumentsFor: Array<{ claim: string; evidenceIds: string[] }>;
  argumentsAgainst: Array<{ claim: string; evidenceIds: string[] }>;
  survivalScore: number;
  outcome: "survived" | "mutate" | "rejected";
  reason: string;
  decisiveRisks: Array<{ dimension: FalsificationDimension; risk: number; status: ClaimStatus; reason: string; evidenceIds: string[] }>;
  unknownCriticalCount: number;
  residualUnmetDemand: ResidualUnmetDemandAssessment;
}

export interface OpportunityScoreFactors {
  marketGapStrength: number; complaintRecurrence: number; severity: number; willingnessToPay: number;
  competitorWeakness: number; saturation: number; noveltyDistance: number; weakSignalStrength: number;
  feasibility: number; distributionAccessibility: number; defensibility: number; timing: number;
  falsificationSurvival: number;
}

export interface OpportunityScore {
  candidateId: string;
  score: number;
  factors: OpportunityScoreFactors;
  penalties: Array<{ code: string; points: number; reason: string }>;
  confidenceLabel: "evidence-backed" | "plausible" | "speculative";
  heuristic: true;
  decisionFactors: {
    evidenceStrength: ScoreFactorAssessment;
    demandSignal: ScoreFactorAssessment;
    noveltyDifferentiation: ScoreFactorAssessment;
    feasibility: ScoreFactorAssessment;
    economics: ScoreFactorAssessment;
    distribution: ScoreFactorAssessment;
    defensibility: ScoreFactorAssessment;
    regulatoryRisk: ScoreFactorAssessment;
    confidence: ScoreFactorAssessment;
  };
  writtenReasoning: string;
  evidenceConfidence: EvidenceConfidenceScore;
  noveltyScore: NoveltyScore;
  scorecard: StructuredOpportunityScorecard;
  intelligence: DecisionIntelligenceScores;
}

export interface ScoreFactorAssessment {
  score: number;
  status: ClaimStatus;
  rationale: string;
  evidenceIds: string[];
}

export interface EvidenceConfidenceScore {
  score: number;
  label: "low" | "moderate" | "high";
  evidenceDensity: number;
  independentSourceCount: number;
  sourceDiversity: number;
  citationCoverage: number;
  freshness: number;
  contradictionPenalty: number;
  rationale: string;
  heuristic: true;
}

export interface NoveltyScore {
  score: number;
  overlap: {
    feature: number;
    positioning: number;
    customer: number;
    workflow: number;
    technology: number;
    businessModel: number;
  };
  closestCompetitorId: string | null;
  collisionDetected: boolean;
  rationale: string;
  heuristic: true;
}

export type StructuredScoreDimension =
  | "painSeverity" | "painFrequency" | "existingSpend" | "willingnessToPay"
  | "marketGrowth" | "marketSize" | "competition" | "saturation" | "differentiation"
  | "distributionDifficulty" | "customerAccessibility" | "technicalDifficulty"
  | "regulatoryRisk" | "capitalRequirements" | "timeToMvp" | "defensibility"
  | "switchingCosts" | "recurringRevenue" | "margins" | "retentionPotential"
  | "founderFit" | "evidenceQuality" | "evidenceQuantity" | "sourceDiversity"
  | "confidence" | "timing" | "incumbentVulnerability" | "fragmentation"
  | "aiCommoditizationRisk";

export type StructuredOpportunityScorecard = Record<StructuredScoreDimension, ScoreFactorAssessment>;

export interface DecisionIntelligenceScores {
  evidenceDensity: number;
  consensusVsContrarian: number;
  opportunityHalfLife: number;
  demandAuthenticity: number;
  painToSpendRatio: number;
  marketFragmentation: number;
  incumbentVulnerability: number;
  switchingFriction: number;
  timing: number;
  regulatoryTailwind: number;
  manualLaborReplacement: number;
  distributionViability: number;
  aiCommoditization: number;
  definitions: Record<string, string>;
  heuristic: true;
}

export interface EvidenceGateThresholds {
  minIndependentPainSignals: number;
  minIndependentSpendSignals: number;
  minCompetitorsAnalyzed: number;
  minUnderservedSegments: number;
  minTimingSignals: number;
  minSourceTypes: number;
  minCitationCoverage: number;
  maxUnresolvedFatalFalsifications: number;
}

export interface EvidenceGateResult {
  candidateId: string;
  thresholds: EvidenceGateThresholds;
  observed: {
    independentPainSignals: number;
    independentSpendSignals: number;
    competitorsAnalyzed: number;
    underservedSegments: number;
    timingSignals: number;
    sourceTypes: number;
    citationCoverage: number;
    unresolvedFatalFalsifications: number;
  };
  checks: Record<"pain" | "spend" | "competition" | "competitorRecall" | "buyerSpecificity" | "segment" | "timing" | "sourceDiversity" | "citationCoverage" | "fatalFalsification", boolean>;
  survivalGatePassed: boolean;
  validationEvidenceGatePassed: boolean;
  externallyValidated: boolean;
  classification: "discovered" | "promising" | "survived" | "validated" | "killed";
  blockers: string[];
  rationale: string;
}

export type AssumptionLedgerStatus = "UNTESTED" | "WEAK" | "SUPPORTED" | "DISPROVEN" | "CRITICAL";

export interface AssumptionLedgerEntry {
  id: string;
  candidateId: string;
  assumption: string;
  dimension: "customer_pain" | "pain_frequency" | "existing_spend" | "buyer_access" | "incumbent_weakness" | "switching" | "technology" | "regulation" | "market_size";
  status: AssumptionLedgerStatus;
  factState: FactState;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  researchToResolve: string | null;
  killCriterion: string;
}

export interface WhyNotBuiltAnalysis {
  candidateId: string;
  verdict: "recently_viable" | "persistent_trap" | "possibly_overlooked" | "unknown";
  explanations: Array<{
    factor: "technology" | "regulation" | "market_size" | "distribution_economics" | "willingness_to_pay" | "prior_failure" | "incumbent_distribution" | "switching_cost" | "fake_pain" | "overlooked";
    state: FactState;
    rationale: string;
    evidenceIds: string[];
  }>;
  unresolvedQuestion: string;
}

export interface CounterfactualResearch {
  candidateId: string;
  targetOutcome: string;
  requiredConditions: Array<{ condition: string; factState: FactState; test: string; killCriterion: string; evidenceIds: string[] }>;
  verdict: "PLAUSIBLE_IF" | "CONTRADICTED" | "TOO_UNKNOWN";
  rationale: string;
}

export interface MoatStressTest {
  candidateId: string;
  attackers: Array<"OpenAI" | "Anthropic" | "Google" | "Microsoft" | "Amazon" | "incumbent" | "open_source">;
  coreCapabilityBecomesFree: {
    remainingMoats: string[];
    destroyedAdvantages: string[];
    survivability: number;
    verdict: "RESILIENT" | "EXPOSED" | "COMMODITIZED";
  };
  rationale: string;
}

export interface AdversarialAgentResult {
  agent: "bull" | "bear" | "judge";
  candidateId: string;
  independentInputHash: string;
  verdict: "SURVIVES" | "INVESTIGATE" | "KILL";
  claims: Array<{ claim: string; factState: FactState; evidenceIds: string[] }>;
  contradictions: string[];
  unresolvedAssumptions: string[];
  sourceQualityScore: number;
  rationale: string;
}

export interface AgentExecutionRecord {
  id: string;
  agent: SpecialistAgent;
  dependsOn: string[];
  status: "complete" | "partial" | "skipped" | "failed" | "cancelled";
  attempt: number;
  startedAt: string;
  completedAt: string;
  inputRecordIds: string[];
  outputRecordIds: string[];
  permissions: ResearchRoleOutput["permissions"];
  notes: string[];
}

export interface ResearchTaskGraph {
  depth: ResearchDepth;
  resumable: true;
  checkpointId: string;
  cancelled: boolean;
  agents: AgentExecutionRecord[];
  dependencies: Array<{ from: string; to: string }>;
}

export interface ValidationExperiment {
  candidateId: string;
  type: "fake_door" | "cold_outreach" | "concierge" | "manual_service" | "clickable_prototype" | "preorder" | "pricing_test" | "comparison_ad" | "marketplace_listing" | "waitlist" | "interview" | "technical_poc";
  hypothesis: string;
  targetUser: string;
  action: string;
  successThreshold: string;
  failureThreshold: string;
  estimatedCost: string;
  estimatedTime: string;
  decision: string;
  ethicsNote: string | null;
}

export interface ValidationPlan {
  candidateId: string;
  interviewTargets: string[];
  outreachTargets: string[];
  experiments: ValidationExperiment[];
  milestones: Array<{ milestone: string; successCriterion: string; killCriterion: string }>;
}

export interface ExternalValidationOutcome {
  id: string;
  runId: string;
  candidateId: string;
  recordedAt: string;
  experimentType: ValidationExperiment["type"];
  success: boolean;
  observedMetrics: string[];
  artifactUrls: string[];
  decision: "VALIDATED" | "KILLED" | "INVESTIGATE";
  rationale: string;
  lifecycleEvent: CandidateLifecycleEvent;
}

export interface NextBestAction {
  candidateId: string | null;
  action: string;
  reason: string;
  resolvesAssumptionIds: string[];
  expectedInformationGain: number;
  estimatedCost: string;
  estimatedTime: string;
  successCriterion: string;
  killCriterion: string;
}

export interface FinalOpportunity {
  candidate: IdeaCandidate;
  fingerprint: NoveltyFingerprint;
  nearestAnalogues: SimilarityResult[];
  falsification: FalsificationResult;
  lineage: IdeaLineage;
  score: OpportunityScore;
  validationExperiment: ValidationExperiment;
  evidenceGate: EvidenceGateResult;
  lifecycle: CandidateLifecycleRecord;
  assumptionLedger: AssumptionLedgerEntry[];
  whyNotBuilt: WhyNotBuiltAnalysis;
  counterfactual: CounterfactualResearch;
  moatStressTest: MoatStressTest;
  adversarialReview: { bull: AdversarialAgentResult; bear: AdversarialAgentResult; judge: AdversarialAgentResult };
  validationPlan: ValidationPlan;
}

export interface RejectedIdea {
  candidateId: string;
  name: string;
  phase: "evidence_gate" | "founder_constraint" | "deduplication" | "competitor_check" | "falsification" | "mutation" | "selection_cutoff";
  reason: string;
  evidenceIds: string[];
  decisiveRisks: FalsificationDimension[];
  mutatedFrom: string | null;
}

export interface ResearchCoverage {
  requestedAngles: number;
  successfulAngles: number;
  failedAngles: number;
  usableSourceCount: number;
  independentSourceCount: number;
  sourceTypeCount: number;
  sourceTypes: SourceType[];
  sourceFamilyCoverage: Record<"competitor" | "user_voice" | "technical" | "institutional" | "failed_attempt" | "commercial", number>;
  sourceFamilyAttempts: Record<"competitor" | "user_voice" | "technical" | "institutional" | "failed_attempt" | "commercial", "covered" | "attempted_unavailable" | "not_attempted">;
  missingCriticalSourceFamilies: string[];
  commercialEvidenceThin: boolean;
  counterevidenceBudgetExhausted: boolean;
  duplicateClaimsCollapsed: number;
  qualityWeightedEvidence: number;
  coverageStatus: "adequate" | "partial" | "insufficient";
}

export interface StopDecision {
  status: "proceed" | "partial_research" | "insufficient_evidence";
  canGenerateCandidates: boolean;
  reasons: string[];
  distinction: "Competitor existence can validate that a job or market may exist, but it is not a rejection by itself. A validated opportunity requires positive residual-demand evidence and a surviving falsification case; merely finding no competitor never qualifies.";
}

export interface FinalOutputSchema {
  researchLandscape: {
    coverage: ResearchCoverage;
    competitors: Array<{ id: string; name: string | null; website: string; claimStatus: ClaimStatus; evidenceIds: string[] }>;
    sourceTypeCounts: Partial<Record<SourceType, number>>;
  };
  signals: Array<{ id: string; label: string; status: ClaimStatus; evidenceIds: string[] }>;
  structuralGaps: CandidateGap[];
  candidateIdeas: Array<{ candidateId: string; name: string; mechanismFamily: string; status: "rejected" | "survivor" }>;
  rejectedIdeas: RejectedIdea[];
  survivors: FinalOpportunity[];
  evidenceLineage: IdeaLineage[];
  decisiveRisks: Array<{ candidateId: string; risks: FalsificationResult["decisiveRisks"] }>;
  validationTests: ValidationExperiment[];
  stopDecision: StopDecision;
}

export interface PipelineBudgetUsage {
  providerCalls: number;
  counterevidenceSearches: number;
  agentCalls: number;
  modelIterations: number;
  estimatedProviderCredits: number;
  candidatesGenerated: number;
  survivorIterations: number;
  sourceCount: number;
  exhausted: boolean;
  gracefulDegradation: "none" | "partial_provider_failure" | "counterevidence_budget_exhausted" | "insufficient_evidence";
  expansionStopReason?: "not_needed" | "survivor_found" | "budget_exhausted" | "coverage_plateau" | "duplicate_branches" | "provider_limit" | "user_cancelled";
}

export interface CandidateCompetitorRecall {
  candidateId: string;
  structuralGroupId: string;
  establishedCategory: boolean;
  minimumCredibleCompetitors: number;
  primaryQueryIds: string[];
  crossCheckQueryIds: string[];
  escalationQueryIds: string[];
  primaryCompetitorIds: string[];
  crossCheckCompetitorIds: string[];
  escalationCompetitorIds: string[];
  credibleCompetitorIds: string[];
  materialNewDirectCompetitorIds: string[];
  crossCheckComplete: boolean;
  escalationTriggered: boolean;
  escalationComplete: boolean;
  recallSufficient: boolean;
  explanation: string;
}

export interface CompetitorRecallReport {
  minimumCredibleCompetitors: number;
  primaryQueries: number;
  crossCheckQueries: number;
  escalationQueries: number;
  candidates: CandidateCompetitorRecall[];
}

export interface EvidenceSnapshot {
  schemaVersion: "1.0";
  capturedAt: string;
  evidence: Evidence[];
  normalizedClaims: Array<{ evidenceId: string; claim: string; status: ClaimStatus; sourceAssessment: Evidence["sourceAssessment"] }>;
  duplicateWarnings: Array<{ evidenceId: string; duplicateSourceUrls: string[] }>;
  missingSourceFamilyWarnings: string[];
}

export interface CompanyProfile {
  identity: TraceableClaim;
  productsServices: TraceableClaim[];
  targetUsers: TraceableClaim[];
  apparentPositioning: TraceableClaim;
  pricingBusinessModel: TraceableClaim;
  directCompetitorIds: string[];
  indirectSubstitutes: TraceableClaim[];
  companyComplaints: TraceableClaim[];
  categoryComplaints: TraceableClaim[];
  competitorStrengthsWeaknesses: TraceableClaim[];
  underservedSegments: TraceableClaim[];
  threats: TraceableClaim[];
  differentiationOpportunities: TraceableClaim[];
  adjacentMarkets: TraceableClaim[];
  validationActions: ValidationExperiment[];
  factsFromCompanyControlledSources: string[];
  thirdPartyEvidenceIds: string[];
  unknowns: string[];
}

export interface IdeationContext {
  instruction: string;
  topGaps: Array<Pick<CandidateGap, "id" | "problemStatement" | "affectedSegment" | "currentWorkaround" | "existingSolutions" | "whySolutionsFail" | "supportingEvidenceIds" | "counterEvidenceIds" | "score" | "confidenceLabel">>;
  competitors: Array<Pick<Competitor, "id" | "name" | "website" | "pricing" | "keyFeatures" | "likelyWeaknesses" | "evidenceIds">>;
  evidence: Evidence[];
  graphHoles: GraphHole[];
  contradictions: ContradictionHypothesis[];
  stitchingPatterns: WorkflowStitchingPattern[];
  weakSignals: WeakSignal[];
  resurrectionOpportunities: FailedAttempt[];
  finalOpportunities: FinalOpportunity[];
  finalOutput: FinalOutputSchema;
  budgetUsage: PipelineBudgetUsage;
}

export interface ResearchResult {
  schemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  engineVersion: typeof RESEARCH_ENGINE_VERSION;
  id: string;
  query: string;
  mode: Exclude<ResearchMode, "compare_ideas">;
  depth: ResearchDepth;
  canonicalQuery: string;
  status: "complete" | "partial";
  startedAt: string;
  completedAt: string;
  provider: { id: string; displayName: string };
  cache: { hit: boolean; matchedRunId: string | null };
  limits: ResearchLimits;
  searchAngles: SearchAngle[];
  sources: Evidence[];
  competitors: Competitor[];
  competitorRecall: CompetitorRecallReport;
  complaintClusters: ComplaintCluster[];
  underservedSegments: UnderservedSegment[];
  gaps: CandidateGap[];
  opportunityGraph: OpportunityGraph;
  graphHoles: GraphHole[];
  assumptions: MarketAssumption[];
  contradictions: ContradictionHypothesis[];
  stitchingPatterns: WorkflowStitchingPattern[];
  weakSignals: WeakSignal[];
  failedAttempts: FailedAttempt[];
  searchBranches: SearchBranch[];
  candidates: IdeaCandidate[];
  mutations: MutationRecord[];
  fingerprints: NoveltyFingerprint[];
  similarities: SimilarityResult[];
  falsificationResults: FalsificationResult[];
  lineages: IdeaLineage[];
  opportunityScores: OpportunityScore[];
  validationExperiments: ValidationExperiment[];
  finalOpportunities: FinalOpportunity[];
  candidateLifecycles: CandidateLifecycleRecord[];
  evidenceGates: EvidenceGateResult[];
  assumptionLedger: AssumptionLedgerEntry[];
  adversarialReviews: AdversarialAgentResult[];
  taskGraph: ResearchTaskGraph;
  nextBestAction: NextBestAction;
  rejectedIdeas: RejectedIdea[];
  coverage: ResearchCoverage;
  stopDecision: StopDecision;
  output: FinalOutputSchema;
  budgetUsage: PipelineBudgetUsage;
  roleOutputs: ResearchRoleOutput[];
  checkpoints: PipelineCheckpoint[];
  evidenceSnapshot: EvidenceSnapshot;
  companyProfile: CompanyProfile | null;
  ideationContext: IdeationContext;
  warnings: string[];
}

export interface ResearchRequestOptions {
  provider?: SearchProvider;
  now?: () => Date;
  bypassCache?: boolean;
  persist?: boolean;
  mode?: Exclude<ResearchMode, "compare_ideas">;
  userContext?: ResearchUserContext;
  depth?: ResearchDepth;
  signal?: AbortSignal;
}

export interface ResearchUserContext {
  profileId?: string;
  preferredIndustries?: string[];
  geography?: string;
  budget?: string;
  technicalSkills?: string[];
  availableCapital?: string;
  businessModelPreferences?: string[];
  resources?: string[];
  previouslyResearchedMarkets?: string[];
  previouslyRejectedMechanisms?: string[];
  teamSize?: number;
  timeToMvpWeeks?: number;
  technicalLimits?: string[];
  industryExclusions?: string[];
  geographyExclusions?: string[];
  riskTolerance?: "low" | "medium" | "high";
  distributionChannels?: string[];
}

export interface ResearchMemoryProfile extends ResearchUserContext {
  id: string;
  userId: string;
  optedIn: boolean;
  createdAt: string;
  updatedAt: string;
  previousRunIds: string[];
}

export type FeedbackKind =
  | "useful" | "wrong" | "irrelevant" | "already_known" | "missing_competitor"
  | "competitor_does_not_solve_job" | "opportunity_already_exists" | "source_is_weak"
  | "validation_result_success" | "validation_result_failure";

export interface ResearchFeedback {
  id: string;
  runId: string;
  userId: string | null;
  kind: FeedbackKind;
  targetId: string | null;
  note: string | null;
  createdAt: string;
  evidenceStatus: "USER_PROVIDED_CONTEXT_NOT_PUBLIC_EVIDENCE";
}

export interface ResearchNote {
  id: string;
  runId: string;
  userId: string;
  candidateId: string | null;
  kind: "research_note" | "decision_log";
  title: string;
  body: string;
  tags: string[];
  folder: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistConfig {
  id: string;
  userId: string | null;
  label: string;
  query: string;
  mode: "opportunity" | "company" | "market";
  baselineRunId: string;
  candidateId: string | null;
  signals: Array<"competitors" | "products_features" | "pricing" | "funding_hiring" | "regulation" | "patents_research" | "complaints" | "substitutes" | "platform_policy" | "demand">;
  createdAt: string;
  lastCheckedAt: string | null;
  enabled: boolean;
}

export interface MaterialChange {
  category: WatchlistConfig["signals"][number] | "coverage";
  severity: "low" | "medium" | "high";
  summary: string;
  beforeEvidenceIds: string[];
  afterEvidenceIds: string[];
  statusBefore: ClaimStatus;
  statusAfter: ClaimStatus;
}

export interface ChangeDetectionResult {
  baselineRunId: string;
  comparisonRunId: string;
  comparedAt: string;
  materialChanges: MaterialChange[];
  ignoredTrivialChanges: number;
  summary: string;
  opportunityEvolution: Array<{
    mechanismFamily: string;
    beforeScore: number | null;
    afterScore: number | null;
    beforeEvidenceConfidence: number | null;
    afterEvidenceConfidence: number | null;
    status: "appeared" | "strengthened" | "weakened" | "stable" | "disappeared";
  }>;
}

export interface IdeaComparisonDimension {
  name: "evidence_strength" | "demand" | "residual_gap" | "differentiation" | "feasibility" | "economics" | "distribution" | "switching_cost" | "trust" | "regulation_liability" | "defensibility" | "incumbent_response" | "decisive_risks";
  assessment: string;
  status: ClaimStatus;
  evidenceIds: string[];
}

export interface ComparedIdea {
  idea: string;
  runId: string;
  dimensions: IdeaComparisonDimension[];
  recommendation: "advance" | "validate_first" | "hold" | "reject";
  rationale: string;
}

export interface IdeaComparisonResult {
  schemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  mode: "compare_ideas";
  id: string;
  createdAt: string;
  ideas: ComparedIdea[];
  recommendation: string;
  runIds: string[];
  budgetUsage: PipelineBudgetUsage;
}
