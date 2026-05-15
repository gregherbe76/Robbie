# Evaluation

The `evaluation` module turns outcomes into calibration. It's the framework's longitudinal learning surface — the place where *what actually happened* updates *how the framework reasons next time*.

## Why this layer exists

A static recommendation engine cannot get better. A calibrated one can — but only if the calibration is:

- per-reviewer-per-role (not a single global weight),
- deterministic and auditable (calibration changes are recorded artifacts, not silent drift),
- attributable through provenance (we know whose signals predicted well).

The framework treats calibration as **data**, not as a hyperparameter.

## Layout

```
lib/framework/src/evaluation/
  evaluation.ts   Public engine — record outcomes, compute calibration deltas.
  outcomes.ts     Outcome model — what "actually happened" looks like in this framework.
  learning.ts     Calibration update rules.
  reports.ts      Evaluation reports — confidence-weighted summaries of reviewer + agent performance.
  benchmarks.ts   Benchmark integration — calibration is a guard in the cognition suite.
  types.ts        Public types.
```

## Outcomes

An outcome is a recorded post-hoc fact about a previous decision:

- the original decision (with its provenance),
- the observed outcome (hired / not hired, performance window, departure context),
- the observer (the reviewer or system event that closed the loop),
- a confidence — outcomes can themselves be uncertain (e.g. someone leaves at 18 months; was that good or bad?).

The outcome model is intentionally rich. A reductive "good/bad" outcome would discard the same kind of information the framework refuses to discard elsewhere.

## Calibration

Calibration is a function over `(reviewer, role family, organization, kind of evidence)`. When an outcome is recorded:

1. The framework looks up the signals that contributed to the original decision.
2. For each signal, it computes a calibration delta — did this signal predict well in this kind of case?
3. The delta is applied to the producer's weighting profile.
4. The update is recorded as an artifact with its own provenance — *which outcome caused this delta*.

You can read the calibration history of any reviewer or agent and see the chain of outcomes that shaped their current weighting.

## Longitudinal learning

The framework is designed for the long horizon. Calibration accumulates over quarters and years. Memory deepens. Disagreement patterns stabilize and become diagnostic. This is what we mean by **memory is the moat**: the institutional knowledge of the organization is captured structurally and compounds.

The framework does not lose calibration when reviewers move between organizations — each reviewer's identity is deterministic, but their calibration is scoped to `(reviewer, organization)` so drift across organizations is detectable.

## Evaluation reports

`reports.ts` produces confidence-weighted summaries:

- per-reviewer calibration over a window,
- per-agent calibration over a window,
- per-evidence-kind reliability (which kinds of signal have been most predictive?),
- per-org calibration health (is the organization's reasoning drifting?).

These are themselves auditable artifacts; nothing in them is computed without provenance.

## Cognition benchmark integration

The cognition benchmark suite's `calibration` guard runs the evaluation engine against the scenario outputs and asserts that calibration weights stay within the documented band. This means **the framework cannot regress its calibration silently** — drift fails CI.

## Console view

The Evaluation page surfaces:

- Recent outcomes with the decisions they reference.
- Calibration deltas, grouped by reviewer and by agent.
- Evaluation reports for the active organization.
- Calibration health summary — is anything drifting?
