# Collaboration

The `collaboration` and `intelligence_operations` modules are how the framework coordinates **multiple reviewers** reasoning over the same candidate without collapsing their disagreement.

## Why disagreement is preserved

Most systems average reviewer scores into a single number. This loses information. The framework instead:

- keeps every reviewer's signals intact,
- surfaces disagreement as a first-class artifact,
- attaches adversarial probes to claims explicitly,
- runs consensus protocols when consensus is warranted, and records dissent when it isn't.

This is a feature, not a bug. Disagreement is diagnostic — it tells you what kind of evidence the organization is missing and which reviewers may need recalibration.

## Layout

```
lib/framework/src/collaboration/
  (reviewer coordination primitives, consensus protocol, dissent preservation,
   override handling)

lib/framework/src/intelligence_operations/
  investigation.ts  Investigation lifecycle.
  case.ts           Case state machine — investigations grouped by subject.
  hypotheses.ts     Hypothesis tracking with supporting + countering evidence.
  adversarial.ts    Adversarial probes — explicit counter-claims with their own provenance.
  evidence.ts       Evidence handling inside an investigation.
  consensus.ts      Consensus protocol with dissent preservation.
  workflow.ts       Investigation-scoped workflows.
  types.ts          Public types.
```

## The investigation

An investigation is opened when a fit assessment carries low confidence, strong dissent, or an adversarial probe that warrants follow-up. It is the unit of *collaborative reasoning*:

- has a subject (a candidate, a role, an organization claim),
- has a lead reviewer and invited reviewers,
- holds hypotheses + evidence + adversarial probes,
- has its own visibility scope (`investigation_private`),
- closes with a recorded outcome that feeds back into evaluation.

Investigations are auditable end-to-end: every reviewer action inside an investigation is a signed action chained into the session integrity layer.

## Hypotheses

A hypothesis is an explicit claim with:

- supporting evidence (signals that increase confidence in the claim),
- countering evidence (signals that decrease confidence),
- a current confidence,
- a producer (the reviewer or agent that raised the hypothesis),
- a status (open / supported / refuted / inconclusive).

Hypotheses are how reviewers carve up disagreement productively. Instead of "I think X / I think not-X," reviewers state "hypothesis H1, current evidence: …".

## Adversarial probes

An adversarial probe is a structured counter-claim. It has its own provenance and is attached to a hypothesis or claim. The framework gives adversarial probes first-class status because **the absence of counter-evidence is itself information**: a hypothesis with no probes attached has less audit value than one whose probes have all been refuted.

`adversarial.ts` is where probes live. The cognition layer feeds candidate adversarial signals (e.g. `fake_oss_signal` scenarios) into this module so they can be assessed deliberately.

## Consensus with dissent

`consensus.ts` runs a structured consensus protocol that:

- collects signals from invited reviewers,
- detects whether the signals converge (consensus) or diverge (dissent),
- records dissent as a first-class artifact, not as a tiebreaker outcome,
- emits a `ConsensusRecord` with the participants, the convergence summary, and any preserved dissenting positions.

A consensus record does **not** overwrite the individual reviewer signals. Both survive — the consensus is a derivation, not a replacement.

## Override handling

Sometimes a reviewer needs to override an automated recommendation. The framework treats overrides as structured events:

- requires the `override_recommendation` capability,
- requires an open session,
- records the previous recommendation, the new recommendation, and the reviewer's stated justification,
- emits an audit entry,
- feeds the override into the evaluation layer so reviewer overrides can be calibrated (was the override usually right? wrong? in which kinds of cases?).

There is no "silent override" path.

## Console view

The Operations and Collaboration pages surface:

- Active investigations with their lead reviewer, invited reviewers, and current hypotheses.
- Hypothesis trees with supporting/countering evidence.
- Adversarial probes attached to claims.
- Consensus records with dissent preserved.
- Override events with their full justification trail.
