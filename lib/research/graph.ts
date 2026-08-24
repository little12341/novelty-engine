import type { CandidateGap, ComplaintCluster, Competitor, Evidence, FailedAttempt, GraphHole, OpportunityGraph, OpportunityGraphEdge, OpportunityGraphNode, UnderservedSegment } from "./types.ts";
import { clamp, evidenceUnion, stableId, unique } from "./utils.ts";

function node(type: OpportunityGraphNode["type"], label: string, evidenceIds: string[], attributes: OpportunityGraphNode["attributes"] = {}, confidence = 0.65): OpportunityGraphNode {
  return { id: stableId(type, label), type, label, attributes, evidenceIds: unique(evidenceIds), confidence };
}

function edge(type: OpportunityGraphEdge["type"], from: string, to: string, evidenceIds: string[], confidence = 0.6): OpportunityGraphEdge {
  return { id: stableId("edge", `${type}:${from}:${to}`), type, from, to, evidenceIds: unique(evidenceIds), confidence };
}

function inferredEvidenceNodes(evidence: Evidence[]): OpportunityGraphNode[] {
  const nodes: OpportunityGraphNode[] = [];
  for (const item of evidence) {
    const text = `${item.title} ${item.summary}`;
    if (item.sourceType === "regulator" || /regulat|policy|rule|mandate|recordkeeping/i.test(text)) nodes.push(node("regulation", item.title, [item.id], { publicationDate: item.publicationDate }, item.confidence));
    const technology = text.match(/\b(?:api|webhook|sensor|model|automation|mobile|open[- ]source|hardware|robot|computer vision|llm)\b/i)?.[0];
    if (technology) nodes.push(node("technology", technology.toLowerCase(), [item.id], {}, item.confidence * 0.85));
    const channel = text.match(/\b(?:marketplace|app store|direct sales|partner|reseller|self[- ]serve|community)\b/i)?.[0];
    if (channel) nodes.push(node("distribution_channel", channel.toLowerCase(), [item.id], {}, item.confidence * 0.8));
    const behavior = text.match(/\b(?:copy and paste|text messages?|manual(?:ly)?|spreadsheet|mobile[- ]first|remote work)\b/i)?.[0];
    if (behavior) nodes.push(node("behavior", behavior.toLowerCase(), [item.id], {}, item.confidence));
  }
  const merged = new Map<string, OpportunityGraphNode>();
  for (const item of nodes) {
    const existing = merged.get(item.id);
    if (existing) existing.evidenceIds = evidenceUnion(existing.evidenceIds, item.evidenceIds);
    else merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function buildOpportunityGraph(
  evidence: Evidence[], competitors: Competitor[], complaints: ComplaintCluster[], segments: UnderservedSegment[], gaps: CandidateGap[],
): OpportunityGraph {
  const nodes: OpportunityGraphNode[] = [];
  const edges: OpportunityGraphEdge[] = [];
  for (const competitor of competitors) {
    const name = competitor.name.value ?? "Unknown competitor";
    const competitorNode = node("competitor", name, competitor.evidenceIds, { website: competitor.website }, competitor.name.confidence);
    const productNode = node("product", `${name} product`, competitor.evidenceIds, { pricing: competitor.pricing.value, job: competitor.coreJobToBeDone.value }, 0.62);
    nodes.push(competitorNode, productNode);
    edges.push(edge("depends-on", productNode.id, competitorNode.id, competitor.evidenceIds, 0.9));
    if (competitor.coreJobToBeDone.value) {
      const jobNode = node("job_to_be_done", competitor.coreJobToBeDone.value, competitor.coreJobToBeDone.evidenceIds, {}, competitor.coreJobToBeDone.confidence);
      nodes.push(jobNode);
      edges.push(edge("serves", productNode.id, jobNode.id, competitor.coreJobToBeDone.evidenceIds));
    }
    if (competitor.targetCustomer.value) {
      const segmentNode = node("customer_segment", competitor.targetCustomer.value, competitor.targetCustomer.evidenceIds, {}, competitor.targetCustomer.confidence);
      nodes.push(segmentNode);
      edges.push(edge("serves", productNode.id, segmentNode.id, competitor.targetCustomer.evidenceIds));
    }
    if (competitor.pricing.value) {
      const pricingNode = node("pricing_model", competitor.pricing.value, competitor.pricing.evidenceIds, {}, competitor.pricing.confidence);
      nodes.push(pricingNode);
      edges.push(edge("priced-for", productNode.id, pricingNode.id, competitor.pricing.evidenceIds));
    }
  }
  for (const segment of segments) nodes.push(node("customer_segment", segment.segment, segment.evidenceIds, { rationale: segment.rationale }, segment.confidence));
  for (const complaint of complaints) {
    const complaintNode = node("complaint", complaint.label, complaint.representativeEvidenceIds, { severity: complaint.severity, recurrence: complaint.evidenceCount }, complaint.isIsolated ? 0.4 : 0.72);
    nodes.push(complaintNode);
    if (complaint.affectedSegment) {
      const segmentNode = node("customer_segment", complaint.affectedSegment, complaint.representativeEvidenceIds);
      nodes.push(segmentNode);
      edges.push(edge("complains-about", segmentNode.id, complaintNode.id, complaint.representativeEvidenceIds));
    }
    if (complaint.currentWorkaround) {
      const workaroundNode = node("workaround", complaint.currentWorkaround, complaint.representativeEvidenceIds);
      nodes.push(workaroundNode);
      edges.push(edge("workaround-for", workaroundNode.id, complaintNode.id, complaint.representativeEvidenceIds, 0.75));
    }
  }
  for (const gap of gaps) {
    const gapNode = node("gap", gap.problemStatement, gap.supportingEvidenceIds, { score: gap.score, confidenceLabel: gap.confidenceLabel }, gap.confidence);
    nodes.push(gapNode);
    const segmentNode = nodes.find((item) => item.type === "customer_segment" && item.label === gap.affectedSegment);
    if (segmentNode) edges.push(edge("underserved-by", segmentNode.id, gapNode.id, gap.supportingEvidenceIds, gap.confidence));
  }
  nodes.push(...inferredEvidenceNodes(evidence));
  const merged = new Map<string, OpportunityGraphNode>();
  for (const item of nodes) {
    const existing = merged.get(item.id);
    if (existing) {
      existing.evidenceIds = evidenceUnion(existing.evidenceIds, item.evidenceIds);
      existing.confidence = Math.max(existing.confidence, item.confidence);
      existing.attributes = { ...existing.attributes, ...item.attributes };
    } else merged.set(item.id, item);
  }
  const mergedNodes = [...merged.values()];
  for (const gapNode of mergedNodes.filter((item) => item.type === "gap")) {
    for (const technologyNode of mergedNodes.filter((item) => item.type === "technology" && item.evidenceIds.some((id) => gapNode.evidenceIds.includes(id)))) {
      edges.push(edge("enabled-by", gapNode.id, technologyNode.id, evidenceUnion(gapNode.evidenceIds, technologyNode.evidenceIds), Math.min(gapNode.confidence, technologyNode.confidence)));
    }
  }
  return { schemaVersion: "1.0", nodes: mergedNodes, edges: [...new Map(edges.map((item) => [item.id, item])).values()] };
}

export function addFailedAttemptsToGraph(graph: OpportunityGraph, attempts: FailedAttempt[]): OpportunityGraph {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  for (const attempt of attempts) {
    const failedNode = node("failed_attempt", attempt.name, attempt.allEvidenceIds, { outcome: attempt.outcome, blocker: attempt.blocker, blockerStillExists: attempt.blockerStillExists }, attempt.confidence);
    nodes.push(failedNode);
    const blockerNode = graph.nodes.find((item) => item.type === "technology" && item.label.includes(attempt.blocker.replaceAll("_", " ")));
    if (blockerNode) edges.push(edge("failed-because", failedNode.id, blockerNode.id, attempt.blockerEvidenceIds, attempt.confidence));
  }
  return { ...graph, nodes: [...new Map(nodes.map((item) => [item.id, item])).values()], edges: [...new Map(edges.map((item) => [item.id, item])).values()] };
}

export function detectGraphHoles(graph: OpportunityGraph): GraphHole[] {
  const holes: GraphHole[] = [];
  const incident = (id: string) => graph.edges.filter((item) => item.from === id || item.to === id);
  const complaints = graph.nodes.filter((item) => item.type === "complaint");
  for (const segment of graph.nodes.filter((item) => item.type === "customer_segment")) {
    const links = incident(segment.id);
    const complaintLinks = links.filter((item) => item.type === "complains-about");
    const solutionLinks = links.filter((item) => item.type === "serves");
    if (complaintLinks.length > solutionLinks.length) holes.push({
      id: stableId("hole", `underserved:${segment.id}`), kind: "underserved_segment",
      summary: `${segment.label} connects to more evidenced complaints than serving products.`,
      nodeIds: unique([segment.id, ...complaintLinks.map((item) => item.to)]),
      evidenceIds: evidenceUnion(segment.evidenceIds, ...complaintLinks.map((item) => item.evidenceIds)),
      strength: clamp(5 + complaintLinks.length * 1.5 - solutionLinks.length), confidence: segment.confidence,
    });
  }
  for (const complaint of complaints) {
    const workaroundLinks = graph.edges.filter((item) => item.type === "workaround-for" && item.to === complaint.id);
    if (workaroundLinks.length) holes.push({
      id: stableId("hole", `workaround:${complaint.id}`), kind: "complaint_workaround_pattern",
      summary: `${complaint.label} repeatedly produces a manual or stitched workaround.`,
      nodeIds: [complaint.id, ...workaroundLinks.map((item) => item.from)],
      evidenceIds: evidenceUnion(complaint.evidenceIds, ...workaroundLinks.map((item) => item.evidenceIds)),
      strength: clamp(6 + Number(complaint.attributes.recurrence ?? 0)), confidence: complaint.confidence,
    });
  }
  const technologies = graph.nodes.filter((item) => item.type === "technology");
  const gapNodes = graph.nodes.filter((item) => item.type === "gap");
  for (const technology of technologies) {
    if (!graph.edges.some((item) => item.from === technology.id || item.to === technology.id)) holes.push({
      id: stableId("hole", `technology:${technology.id}`), kind: "technology_unlock",
      summary: `${technology.label} appears in the evidence but is not connected to an existing product category.`,
      nodeIds: [technology.id, ...gapNodes.slice(0, 1).map((item) => item.id)], evidenceIds: technology.evidenceIds,
      strength: 5.5, confidence: technology.confidence * 0.8,
    });
  }
  const underservedSegments = holes.filter((item) => item.kind === "underserved_segment").flatMap((item) => item.nodeIds).map((id) => graph.nodes.find((node) => node.id === id)).filter((item): item is OpportunityGraphNode => item?.type === "customer_segment");
  for (const technology of technologies) {
    const segment = underservedSegments.find((item) => !graph.edges.some((connection) => (connection.from === technology.id && connection.to === item.id) || (connection.to === technology.id && connection.from === item.id)));
    if (segment) holes.push({
      id: stableId("hole", `combination:${technology.id}:${segment.id}`), kind: "missing_combination",
      summary: `No retrieved incumbent connection combines ${technology.label} with the evidenced needs of ${segment.label}.`,
      nodeIds: [technology.id, segment.id], evidenceIds: evidenceUnion(technology.evidenceIds, segment.evidenceIds),
      strength: 5.8, confidence: Math.min(technology.confidence, segment.confidence) * 0.75,
    });
  }
  for (const regulation of graph.nodes.filter((item) => item.type === "regulation")) holes.push({
    id: stableId("hole", `regulation:${regulation.id}`), kind: "regulatory_shift",
    summary: `${regulation.label} may make an established workflow or product category outdated.`,
    nodeIds: [regulation.id, ...gapNodes.slice(0, 1).map((item) => item.id)], evidenceIds: regulation.evidenceIds,
    strength: 6, confidence: regulation.confidence,
  });
  return holes.sort((a, b) => b.strength - a.strength);
}
