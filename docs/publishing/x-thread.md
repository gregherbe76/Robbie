# X / Twitter thread — draft

**1/**

Most "AI for hiring" software is a database problem with a chatbot on top.

We think hiring is a reasoning problem.

Today we're open-sourcing a framework that treats it that way.

Deterministic. Provenance-first. Calibration-aware.

(link)

**2/**

The bet:

The current AI hiring tools flatten uncertainty into a score, hide
disagreement behind a ranking, and give you a confidence number nobody
can audit.

When the decision is wrong, there's no replay.

We built the opposite.

**3/**

Same input → same bytes. Every time.

The replay runner is fully deterministic. Each replay produces a
sha256 trace signature. We re-verify the signatures live on the
benchmarks page on every page load.

If it ever drifts, the page tells you.

**4/**

Provenance is data, not logging.

Every claim, every signal, every escalation carries who-produced-what.
The provenance graph is a first-class artefact you can walk — not a
side-effect of a logger.

**5/**

Disagreement is preserved.

When two agents read the same dossier in incompatible ways, the
framework surfaces both readings.

It refuses to average them into a number.

**6/**

Calibration self-critiques.

The evaluation engine reports which of its own confidence bands
systematically over-promise.

Today: 0.45–0.60 on ambiguous-generalist, 0.60–0.75 on
capability-vs-context-fit. Flagged on every benchmark run.

**7/**

What this is NOT:

- Not an ATS.
- Not a CV matcher.
- Not an "AI recruiter".
- Not autonomous hiring.
- Not a chatbot.

It is decision-support infrastructure. Humans stay first-class.
Escalations are explicit. The framework refuses to advance cases it
cannot justify.

**8/**

Honest about maturity.

It's 0.1. In-memory seeds. No persistence by default. No built-in
auth. Provider adapters exist but the skeleton runs without keys.

We say this on the front page. We say it on the benchmarks page. We
say it in the design partner toolkit.

**9/**

Five worked cases. Eight layers. One trace.

Replay any of them live at /demo:

- inflated-senior
- org-mismatch
- ambiguous-generalist
- chaos-thriver
- founder-builder

Each runs end-to-end through the real engines on every request.

**10/**

If you build hiring decisions and you care more about being right than
about being confident — read the trace.

If the cognition holds up, contribute a module. If it doesn't, file
an issue.

(link to repo + demo)
