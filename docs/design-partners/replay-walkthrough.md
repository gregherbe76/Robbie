# ATS Replay Walkthrough — Design Partner Guide

> *"Our ATS stores what we decided. This framework replays how we reasoned."*

This guide explains how the Recruiting Intelligence Framework reads operational
evidence out of your ATS, reconstructs how your organization reasoned about a
hire, and surfaces the dynamics that traditional ATS reports flatten:
disagreement, escalation, override, confidence drift, and calibration.

It is intended for design partners — founders, governance leads, and
recruiting-tech architects evaluating the framework against their own hiring
process.

---

## What ATS replay actually means

A traditional ATS records:

- the candidate row
- the stage transitions
- the scorecards
- the final decision

That is the **outcome layer**. It tells you *what was decided*. It does not
tell you:

- which reviewers disagreed and on what
- whether the disagreement was resolved or papered over
- whether confidence rose or collapsed across the loop
- whether someone overrode the room
- whether the team has ever been right about candidates that looked like this

ATS replay is the reconstruction of those dynamics from the same data the ATS
already holds. No new instrumentation, no reviewer surveys, no behavioral
nudges. Read-only.

The framework treats every ATS record (scorecard, note, interview kit, decision,
activity event) as a **normalized evidence unit** in a closed type union:

- `explicit_claim` — a factual assertion (years experience, current title)
- `reviewer_assessment` — a scored signal from a reviewer
- `contradiction_signal` — two reviewer assessments that diverge on a topic
- `uncertainty_signal` — a reviewer hedging or asking for more data
- `escalation_signal` — additional loops, panel-level escalation, founder review
- `override_signal` — a decision crossing reviewer dissent
- `calibration_signal` — historical reviewer reliability surfacing in the loop

The replay is the sorted, signed, byte-stable projection of those units back
into the reasoning that produced the decision.

---

## What organizational memory means here

Organizational memory is the *persistent* store of:

- every signed replay
- every reviewer's calibration trajectory
- every override and its stated rationale
- every disagreement and how it resolved

It is append-only, scoped per org, and addressable by candidate, reviewer, role,
or outcome. The framework will not silently overwrite a memory entry; every
revision becomes a new entry pointing back to the prior one.

This is what makes the framework auditable across hires, not just within one.

---

## What disagreement preservation means

Most automated recruiting tools collapse a reviewer panel into a single number
(a "score," a "recommendation," a "fit"). The framework refuses to do this.

When two reviewers diverge on a topic with a spread ≥ 0.2 on the normalized
scale, the replay records the disagreement explicitly:

- topic, spread, both reviewer IDs
- both summaries verbatim
- whether the disagreement was resolved by consensus, override, or never

Disagreement is data. It is preserved end-to-end and exposed in the replay and
the calibration view. When the high-confidence reviewer is consistently wrong
on a topic, the calibration layer surfaces that pattern.

---

## How calibration critique works

For every reviewer assessment that maps to an "overall" hire/decline
prediction, the framework records the claimed confidence and waits for the
realized outcome. The realized outcome can be:

- `hired` + `succeeded` → label 1
- `hired` + `regretted` → label 0
- `declined` → label 0
- `withdrawn` → excluded

Across many decisions the framework computes:

- **Expected Calibration Error (ECE)** — weighted gap between claimed and
  observed across buckets
- **Brier score** — overall squared-error penalty
- **Per-reviewer drift** — `mean(claimed) − mean(realized)`. Positive drift =
  overconfident.

The calibration view is descriptive, not punitive. On a small sample size the
report carries a visible caveat. Calibration becomes meaningful only across
dozens of observations per reviewer.

The framework does not use the calibration score to *adjust* future scorecards
without the org's consent. The information is surfaced; the human chooses.

---

## What replay signatures prove

Every `HiringDecisionReplay` is signed with a SHA-256 prefix computed from a
canonical projection of its evidence, reviewers, disagreements, escalations,
overrides, and outcome. The signature is:

- **deterministic** — the same inputs produce the same signature
- **stable** — independent of ingestion order
- **verifiable** — `GET /api/ats/replay/:id/verify` recomputes from stored
  evidence and returns `match: true/false`

If a replay is tampered with — say, a reviewer's scorecard is edited
retroactively in the ATS — re-ingestion will produce a new signature and the
verify endpoint will report a mismatch.

Signatures are not cryptographic provenance; they are deterministic content
identifiers. They establish *that this replay was computed from exactly this
evidence*.

---

## Current maturity limitations

The framework is honest about what is not yet mature:

- **Synthetic adapter** is the default. The Ashby and Greenhouse adapters
  implement the real HTTP contract but are env-gated. Production data ingestion
  requires `ASHBY_API_KEY` or `GREENHOUSE_API_KEY` and is currently single-org.
- **Calibration sample sizes** in the public demo are illustrative (≤30
  predictions). Real reviewer reliability requires dozens of decisions.
- **No write-back.** The framework reads. It does not move stages, send
  rejection emails, ping reviewers, or modify your ATS in any way. This is a
  constraint, not a limitation; we will keep it.
- **No CV matching.** The framework is not an "AI recruiter" and will not
  surface candidates from a pile.
- **No outcome auto-collection.** Six-month performance signals are entered
  manually by the org until we ship an HRIS adapter.

---

## How to engage as a design partner

1. **Pilot with synthetic.** Walk the synthetic Marcus Vega and Lena Park
   replays end-to-end in `/ats-demo`. Make sure the framing matches your
   intuition about how your org reasons.
2. **Connect a read-only ATS key.** Ashby or Greenhouse. The framework will
   ingest your last 90 days of decisions and produce signed replays. Nothing
   is shipped back to the ATS.
3. **Review three replays you remember well.** A great hire, a regretted hire,
   a debated decline. Confirm the replay matches what actually happened.
4. **Look at the calibration report.** Per-reviewer drift, bucket-level
   overconfidence. We do not show this to your reviewers without your call.
5. **Decide what becomes operating practice.** Replay every hire?
   Calibration-review cadence? Disagreement-resolution etiquette? Those are
   org decisions, not framework defaults.

We sit with you while you do this. Design-partner engagements are limited and
deliberate.

---

## See also

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — framework module map and design
  decisions
- [`docs/publishing/replay-demo-script.md`](../publishing/replay-demo-script.md)
  — the canonical narrated demo
- The live console: `/console/ats`
- The public demo: `/ats-demo`
- The signed-replay comparison: `/ats-compare`
