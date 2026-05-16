# Determinism is the New Explainability

> *"Why did we hire this person?" should never be a question with a different
> answer next Tuesday.*

We've spent the last few years watching recruiting tooling get "smarter" and
less inspectable in the same motion. AI recruiters. AI scorecards. AI panel
summarizers. Each layer of automation accreting on top of the ATS without ever
asking the question that matters: *can you replay the reasoning that produced
this hire?*

Almost universally, the answer is no. The ATS holds the outcome. The reviewer
holds a vague recollection. The Slack thread is gone. The "AI summary" was
generated against a different model version. The decision lives nowhere
reproducible.

This is the gap we set out to close. Not with more cognition. With **deterministic
replay**.

---

## What we mean by replay

Every hiring decision in our framework produces a signed, byte-stable trace:

- the candidate row
- every reviewer's scorecard, normalized into a closed evidence type union
- every disagreement above the spread threshold, preserved verbatim
- every escalation (additional loop, panel review, founder intervention)
- every override, attributed by reviewer, with the stated rationale
- the rolling confidence trajectory across the loop
- the unresolved tensions at decision time
- the realized outcome and the calibration delta it implies

The trace is signed. The signature is the SHA-256 prefix of a canonical
projection of the evidence. Same evidence in, same signature out. Always.

A `/verify` endpoint recomputes the signature server-side and reports `match:
true/false`. If a scorecard is retroactively edited in the source ATS, the
framework will notice on the next ingest.

This is what we mean by **deterministic explainability**: not a paragraph from
a language model explaining why a decision was made, but a recomputable trace
of the evidence that produced it.

---

## Why explainability alone is not enough

"Explainable AI" has converged on a default pattern: a model produces a
prediction, and a second pass produces a natural-language rationale. The
rationale sounds good. It is also non-deterministic, post-hoc, and frequently
divorced from the actual computation.

For high-stakes domains — hiring, lending, medical triage — this is a
malpractice. The rationale needs to be *the same* every time the trace is
recomputed. The audit needs to be *byte-stable*. Otherwise the audit trail is
fiction.

Determinism is what makes explainability auditable.

---

## The shape of the trace

A `HiringDecisionReplay` is a record with:

```ts
{
  id: string;                    // stable, candidate-derived
  signature: string;             // SHA-256 prefix of canonical projection
  candidateName: string;
  outcome: "hired" | "declined" | "withdrawn" | "open";
  reviewers: Reviewer[];
  evidence: NormalizedEvidence[];
  disagreements: ReviewerDisagreement[];
  escalations: EscalationMoment[];
  overrides: OverrideMoment[];
  confidenceTrajectory: ConfidencePoint[];
  unresolvedTensions: string[];
}
```

Every field is computed from the raw ATS records via pure functions. Sort
stability is enforced. Floating-point drift is bounded. The signature is the
proof.

---

## Two demos that make the difference visible

In our public demo, we ship two synthetic Ashby-shaped hiring stories at the
same fictional company:

- **Marcus Vega** — *regretted hire*. Three reviewers, a 0.4 spread on the
  overall recommendation, two escalations (a second technical loop and a
  founder review), one founder override that hired over reviewer dissent,
  regretted six months later. Calibration: the team was overconfident.

- **Lena Park** — *calibrated decline*. Same three reviewers, consensus
  decline across the loop, no escalation, no override. Outcome aligns with the
  team's expressed confidence.

Side-by-side, the replays make a point no dashboard can:

- **the team's reasoning quality is not the same across cases**
- **disagreement is a signal, not noise**
- **overrides have memory**

Open `/ats-compare`. The shape of the trace is the shape of the difference.

---

## Why we built this

The next layer of recruiting infrastructure is not another ATS. The ATS is
fine; it stores the outcome. The next layer is **organizational memory**: a
read-only, deterministic, provenance-first replay layer that sits above the
ATS and answers the question every hiring loop eventually faces — *did we
reason well, or did we just decide?*

If we get this right, hiring failure modes that are currently invisible — the
founder who systematically overrides, the reviewer who is overconfident on
seniority signal, the panel that papers over disagreement to ship the offer —
become inspectable. Not punishable. Inspectable. The team chooses what to do
with the information.

---

## What we are not building

To be explicit:

- We are not an ATS.
- We are not a CV matcher.
- We are not an "AI recruiter."
- We are not a chatbot for hiring managers.
- We are not in the hiring loop.

We are an audit trail with feelings about determinism.

---

## What's next

- Design partners. We sit with you while you replay three hires you remember
  well.
- More adapters. Lever, Workday, custom.
- HRIS adapter for automatic outcome ingestion.
- Multi-org calibration views (your own data only).

If this resonates, the public demo is at `/ats-demo` and the source is on
GitHub. We are listening for everything you tell us about it.
