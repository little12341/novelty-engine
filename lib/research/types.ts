export const RESEARCH_SCHEMA_VERSION = "2.1.0" as const;

export type ClaimStatus = "VERIFIED" | "INFERRED" | "UNKNOWN";

export type SearchAngleKind =
  | "direct_competitors"
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
  | "active_falsification_constraints";

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
  sourceAssessment: {
    quality: number;
    directness: number;
    recency: number;
    independence: number;
    overallWeight: number;
    independenceGroup: string;
    isPrimary: boolean;
    repetitionRisk: "none" | "possible" | "likely";
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
  timeoutMs: number;
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
  };
  tokens: string[];
}

export interface SimilarityResult {
  leftId: string;
  rightId: string;
  score: number;
  matchingDimensions: string[];
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
}

export interface ScoreFactorAssessment {
  score: number;
  status: ClaimStatus;
  rationale: string;
  evidenceIds: string[];
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

export interface FinalOpportunity {
  candidate: IdeaCandidate;
  fingerprint: NoveltyFingerprint;
  nearestAnalogues: SimilarityResult[];
  falsification: FalsificationResult;
  lineage: IdeaLineage;
  score: OpportunityScore;
  validationExperiment: ValidationExperiment;
}

export interface RejectedIdea {
  candidateId: string;
  name: string;
  phase: "evidence_gate" | "deduplication" | "competitor_check" | "falsification" | "mutation" | "selection_cutoff";
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
  missingCriticalSourceFamilies: string[];
  duplicateClaimsCollapsed: number;
  qualityWeightedEvidence: number;
  coverageStatus: "adequate" | "partial" | "insufficient";
}

export interface StopDecision {
  status: "proceed" | "partial_research" | "insufficient_evidence";
  canGenerateCandidates: boolean;
  reasons: string[];
  distinction: "A validated opportunity requires positive demand evidence and a surviving falsification case; merely finding no competitor never qualifies.";
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
  modelIterations: number;
  candidatesGenerated: number;
  survivorIterations: number;
  sourceCount: number;
  exhausted: boolean;
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
  id: string;
  query: string;
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
  candidates: IdeaCandidate[];
  mutations: MutationRecord[];
  fingerprints: NoveltyFingerprint[];
  similarities: SimilarityResult[];
  falsificationResults: FalsificationResult[];
  lineages: IdeaLineage[];
  opportunityScores: OpportunityScore[];
  validationExperiments: ValidationExperiment[];
  finalOpportunities: FinalOpportunity[];
  rejectedIdeas: RejectedIdea[];
  coverage: ResearchCoverage;
  stopDecision: StopDecision;
  output: FinalOutputSchema;
  budgetUsage: PipelineBudgetUsage;
  ideationContext: IdeationContext;
  warnings: string[];
}

export interface ResearchRequestOptions {
  provider?: SearchProvider;
  now?: () => Date;
  bypassCache?: boolean;
  persist?: boolean;
}
