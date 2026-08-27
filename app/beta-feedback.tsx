"use client";

import { FormEvent, useState } from "react";

const feedbackKinds = [
  ["wrong", "Bad research run"],
  ["installation_problem", "Installation problem"],
  ["competitor_does_not_solve_job", "Incorrect competitor"],
  ["source_is_weak", "Source-quality problem"],
  ["mcp_failure", "MCP failure"],
] as const;

export function BetaFeedback() {
  const [kind, setKind] = useState<(typeof feedbackKinds)[number][0]>("wrong");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const runOptional = kind === "installation_problem" || kind === "mcp_failure";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");
    const data = new FormData(form);
    try {
      const response = await fetch("/api/research/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, runId: data.get("runId") || undefined, note: data.get("note") }),
      });
      if (!response.ok) throw new Error("Feedback was not accepted");
      form.reset();
      setKind("wrong");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="beta-feedback" id="feedback" aria-labelledby="feedback-title">
      <div className="page-width beta-feedback-inner">
        <div>
          <p className="eyebrow">Public Beta feedback</p>
          <h2 id="feedback-title">Found a bad run or setup problem?</h2>
          <p>Report research, competitor, source, installation, or MCP issues. Please omit secrets and private customer data.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Problem type
            <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              {feedbackKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Run ID {runOptional ? "(optional)" : "(required)"}
            <input name="runId" placeholder="research_…" required={!runOptional} maxLength={90} />
          </label>
          <label className="feedback-note">
            What happened?
            <textarea name="note" required minLength={5} maxLength={1000} rows={3} />
          </label>
          <button className="button" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send feedback"}</button>
          <p className="feedback-status" role="status" aria-live="polite">
            {status === "sent" ? "Thanks—your beta report was saved." : status === "error" ? "Feedback could not be saved. Please try again or use the GitHub link below." : ""}
          </p>
        </form>
      </div>
    </section>
  );
}
