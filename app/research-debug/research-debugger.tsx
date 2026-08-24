"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { ResearchResult } from "@/lib/research/types";

export default function ResearchDebugger({ initialConfiguration }: { initialConfiguration: { configured: boolean; selected: string | null; supported: string[] } }) {
  const [query, setQuery] = useState("Find AI tools for small contractors");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `Request failed with ${response.status}`);
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="debug-shell">
      <header className="debug-header">
        <Link href="/">← Novelty Engine</Link>
        <div><span className={initialConfiguration.configured ? "status-ready" : "status-missing"} />{initialConfiguration.configured ? `${initialConfiguration.selected} configured` : "Provider key missing"}</div>
      </header>
      <section className="debug-intro">
        <p className="overline">Internal developer view</p>
        <h1>Research inspector</h1>
        <p>Run the evidence pipeline and inspect exactly what will be handed to the ideation stage. This page never receives provider secrets.</p>
      </section>
      <form className="debug-form" onSubmit={submit}>
        <label htmlFor="research-query">Research topic or ideation request</label>
        <div><input id="research-query" value={query} maxLength={500} minLength={8} onChange={(event) => setQuery(event.target.value)} /><button disabled={loading}>{loading ? "Researching…" : "Run research"}</button></div>
      </form>
      {!initialConfiguration.configured && <p className="debug-notice">Set <code>BRAVE_SEARCH_API_KEY</code> or <code>TAVILY_API_KEY</code> on the server to enable live research. The inspector will not substitute fixture data.</p>}
      {error && <p className="debug-error">{error}</p>}
      {result && <ResearchPanels result={result} />}
    </main>
  );
}

function ResearchPanels({ result }: { result: ResearchResult }) {
  return (
    <div className="debug-results">
      <div className="debug-summary"><strong>{result.sources.length}</strong> sources <strong>{result.opportunityGraph.nodes.length}</strong> nodes <strong>{result.candidates.length}</strong> candidates <strong>{result.finalOpportunities.length}</strong> survivors <span>{result.cache.hit ? "cache hit" : result.status}</span></div>
      <details open><summary>Ranked survivors, lineage, scores, and validation</summary><pre>{JSON.stringify(result.finalOpportunities, null, 2)}</pre></details>
      <details open><summary>Opportunity graph ({result.opportunityGraph.nodes.length} nodes / {result.opportunityGraph.edges.length} edges)</summary><GraphPreview result={result} /><pre>{JSON.stringify(result.opportunityGraph, null, 2)}</pre></details>
      <details><summary>Graph holes</summary><pre>{JSON.stringify(result.graphHoles, null, 2)}</pre></details>
      <details><summary>Market assumptions and contradictions</summary><pre>{JSON.stringify({ assumptions: result.assumptions, contradictions: result.contradictions }, null, 2)}</pre></details>
      <details><summary>Workflow stitching findings</summary><pre>{JSON.stringify(result.stitchingPatterns, null, 2)}</pre></details>
      <details><summary>Weak signals</summary><pre>{JSON.stringify(result.weakSignals, null, 2)}</pre></details>
      <details><summary>Failed attempts and blocker changes</summary><pre>{JSON.stringify(result.failedAttempts, null, 2)}</pre></details>
      <details><summary>Candidate field and mutations</summary><pre>{JSON.stringify({ candidates: result.candidates, mutations: result.mutations }, null, 2)}</pre></details>
      <details><summary>Novelty fingerprints and heuristic similarities</summary><pre>{JSON.stringify({ fingerprints: result.fingerprints, similarities: result.similarities }, null, 2)}</pre></details>
      <details><summary>Falsification outcomes</summary><pre>{JSON.stringify(result.falsificationResults, null, 2)}</pre></details>
      <details><summary>Opportunity scores and factor breakdowns</summary><pre>{JSON.stringify(result.opportunityScores, null, 2)}</pre></details>
      <details><summary>Validation experiments</summary><pre>{JSON.stringify(result.validationExperiments, null, 2)}</pre></details>
      <details><summary>Budget usage and limits</summary><pre>{JSON.stringify({ usage: result.budgetUsage, limits: result.limits }, null, 2)}</pre></details>
      <details><summary>Original market gaps</summary><pre>{JSON.stringify(result.gaps, null, 2)}</pre></details>
      <details><summary>Competitor map</summary><pre>{JSON.stringify(result.competitors, null, 2)}</pre></details>
      <details><summary>Complaint clusters</summary><pre>{JSON.stringify(result.complaintClusters, null, 2)}</pre></details>
      <details><summary>Underserved segments</summary><pre>{JSON.stringify(result.underservedSegments, null, 2)}</pre></details>
      <details><summary>Search angles</summary><pre>{JSON.stringify(result.searchAngles, null, 2)}</pre></details>
      <details><summary>Sources and citations</summary><pre>{JSON.stringify(result.sources, null, 2)}</pre></details>
      <details><summary>Exact ideation payload</summary><pre>{JSON.stringify(result.ideationContext, null, 2)}</pre></details>
      <details><summary>Full research JSON</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
    </div>
  );
}

function GraphPreview({ result }: { result: ResearchResult }) {
  const counts = Object.entries(result.opportunityGraph.nodes.reduce<Record<string, number>>((accumulator, node) => {
    accumulator[node.type] = (accumulator[node.type] ?? 0) + 1;
    return accumulator;
  }, {}));
  return <div className="graph-preview" aria-label="Opportunity graph node counts">{counts.map(([type, count]) => <span key={type}><strong>{count}</strong>{type.replaceAll("_", " ")}</span>)}</div>;
}
