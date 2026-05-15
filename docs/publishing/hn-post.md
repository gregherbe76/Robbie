# HN submission — draft

**Title:** Show HN: Deterministic recruiting intelligence infrastructure (open source)

**URL:** (deployed app)

**Text:**

Hi HN — for the last few months we've been building a framework for
treating recruiting as a reasoning problem instead of a database
problem. It's now open source and I'd like your critique.

The thesis is that the current generation of AI hiring tools flatten
the part of the problem that matters: uncertainty, disagreement, and
calibration. They give you a single score and hope you don't ask how
it was produced.

We took the opposite approach. The unit of work is a trace, not a
score. Same input → same bytes, every time. Every reasoning step is
provenance-attached. Agents disagree in public and the framework
preserves the disagreement rather than averaging it. The evaluation
engine self-critiques and flags the confidence bands it doesn't
actually trust.

You can replay any of five worked cases live at /demo. Each one runs
end-to-end through the real engines on every request — ingestion,
three flagship agents, cognition synthesis, organization fit, the real
escalation engine, and a calibration view produced by the evaluation
engine. The replay signature is sha256 of the trace body and is
re-verified on /benchmarks-public on every page load.

A few choices worth flagging for this audience:

- **Framework, not application.** Shipped as a library
  (`@workspace/framework`) with thin runtime surfaces. No pipeline
  stages, no kanban, no candidate workflows in the ATS sense.
- **Provider abstraction first.** OpenAI and Anthropic are
  interchangeable adapters. The skeleton runs without keys; flagship
  agents reason on deterministic, locally-computed evidence so the
  replay survives.
- **Registries everywhere.** Agents, skills, providers, workflows.
  Introspected through `/registry/*` endpoints. Manifests for plugins,
  benchmark packs, ingestion adapters, cognition modules, and
  organization policies are typed and version-checked.
- **Honest maturity.** The runtime uses in-memory seeds. Persistence
  is scaffolded, not wired. No rate limits, no built-in auth. The
  front page says all of this; the design partner toolkit says it in
  full.

What I'd particularly value here:

1. Critiques of the determinism contract — what would you mutate that
   you think we've missed?
2. The cognition-module manifest design — does the provenance/emit
   contract feel correct to you?
3. The calibration self-critique math — is "claimed exceeds observed
   by ≥ 15pp" the right threshold for flagging overconfidence?

Repo, demo, benchmarks, docs all linked from the landing page.
