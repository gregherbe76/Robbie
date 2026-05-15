# Philosophy

This document is not feature documentation. It explains *why* the framework is shaped the way it is. If you want to understand the design decisions before reading code, start here.

## Why uncertainty matters

Hiring is decision-making under uncertainty. The evidence is incomplete, the signal is noisy, the reviewers disagree, and the consequences play out over years. Any system that collapses this into a scalar score is **discarding the most important property of the problem** — that we genuinely don't know, and that the *shape* of our uncertainty matters more than a single number.

The framework treats uncertainty as data. Every claim has a `confidence ∈ [0, 1]`, not as a UI label but as a structural field that downstream cognition consumes. Confidence is preserved through synthesis, fusion, and reconciliation. When two agents disagree, both their confidences are retained — the disagreement is the signal.

This is why the console renders confidence everywhere, why memory entries are confidence-weighted, and why fit assessments are not single scalars but compositions of supporting evidence with their own confidence chains.

## Why provenance matters

Hiring decisions are accountable decisions. Years later, somebody will ask: *why did we hire that person?* or *why did we pass on that person?*. The right answer is not "the model said so". The right answer is a chain of evidence with named producers and dated observations, where each step can be inspected, contested, and overridden — with the override itself recorded.

The framework treats provenance as the root of trust. Every signal references its producer. Every memory entry references its source agent. Every report references the signals it was derived from. Every audit entry references the reviewer who acted. Every visibility change references the reason and the reviewer who changed it.

This is what we mean by **provenance-first reasoning**: the lineage is not metadata — it *is* the artifact. You cannot have the report without the evidence chain that produced it. You cannot have the access decision without the rule trace that reached it.

## Why disagreement is preserved

Most systems average out reviewer disagreement because consensus is "easier to consume". This is wrong for two reasons.

First, disagreement is itself diagnostic. When two reviewers disagree about a candidate, the *pattern* of disagreement reveals what kind of role this is, what kind of evidence the organization is missing, and what kind of calibration the reviewers individually need. Averaging discards this information.

Second, disagreement protects against systemic miscalibration. If one reviewer is consistently right against the grain of the group, you want to be able to find that out and reweight accordingly. You can only do that if their dissenting signals survived intact.

The framework's collaboration layer preserves dissent through consensus. Hypothesis tracking lets adversarial probes attach to claims explicitly. Calibration is per-reviewer-per-role, not per-team. The decision inspector shows every rule, not just the one that passed last.

## Why deterministic cognition matters

The framework is not trying to be the smartest. It is trying to be the most **trustworthy**. A trustworthy system is one whose behavior can be reproduced — by an auditor, by a regulator, by a new engineer, by a future version of yourself.

Determinism is what makes the framework auditable:

- The benchmark suite is a contract: same inputs, same outputs. A diff in output is a diff in behavior. The suite fails CI on drift.
- Snapshots are intentional. Updating them is an explicit act, justified in the PR description.
- Provenance is checkable: anyone can replay the cognition from inputs alone and reach the same artifacts.

Non-determinism leaks in everywhere — `Math.random`, `Date.now`, iteration order over a Map, unstable JSON serialization — and the framework treats every leak as a bug. Time is an argument (`now: string`), IDs are derived from inputs (`fnv1a` + `makeId`), and serializers are canonical.

This is what we mean by **deterministic cognition**: the framework's reasoning is a pure function of its inputs, and that property is enforced, not assumed.

## Why recruiting is organizational intelligence

The standard model treats recruiting as candidate-side: parse the résumé, match the keywords, score the fit, move them through the pipeline. This collapses the problem to a one-sided keyword problem and ignores everything that actually predicts outcomes.

The honest model treats recruiting as **two-sided organizational reasoning**:

- The candidate has a trajectory — roles, scope, decisions, disagreements with managers, leverage moments, recovered failures.
- The organization has a trajectory — what roles it has needed at what stage, who it has hired into them, how those hires performed, which reviewers calibrated well, what kinds of evidence it consistently underweights.

A fit decision is a function of *both* graphs. A senior IC who would thrive at one organization will plateau at another. A founder-builder who would crash at one stage will be the linchpin at another. The framework keeps both graphs, computes fit as a joint function, and explains the result as a small subgraph of supporting evidence rather than a scalar score.

This is also why **memory is the moat**: the system's knowledge of the organization compounds over time. The longer you run the framework, the better its calibration is, the more relevant its evidence retrieval is, and the more useful its disagreement patterns become. This is institutional learning, made first-class.

## Why we avoid ATS abstractions

Pipeline stages — *applied*, *phone screen*, *onsite*, *offer*, *hired* — are workflow abstractions, not reasoning abstractions. They are useful for a recruiter coordinating logistics; they are useless for cognition. A candidate is not in a "phone screen" cognitive state.

If the framework adopted pipeline stages as primary objects, it would inherit their assumptions: that hiring is linear, that signals arrive in stage order, that the work of a reviewer fits into the cell of a kanban column. None of this is true at the cognition layer.

The framework deliberately stays one layer below. Products built on top — ATSes, CRMs, kanban boards — are welcome to model stages by subscribing to framework events. The framework itself reasons about people and organizations.

## Why capability-based authorization

Role-based access (RBAC) seems convenient: founders see everything, recruiters see this slice, hiring managers see that slice. But roles are a coarse abstraction over the *actual* permission the system is checking, and they leak. A "founder bypass" gets added quietly, a "for now we'll trust hiring managers to handle X" becomes permanent, an exception accretes.

The framework asks the more honest question for every action: *what specific capability does this require?* The required capability is derived from the action server-side; the caller cannot downgrade it by supplying a weaker token. Reviewer types have default capability bundles for convenience, but the engine never gates on reviewer type — only on capability.

The result is an authorization model that you can read by reading the capability list. There are no implicit privileges.

## Why we ship benchmarks

Benchmarks are not a leaderboard. They are a **reproducibility contract**:

- The cognition benchmark suite says: *given this synthetic world, the framework produces this output, with this provenance, satisfying these guards*.
- The security benchmark suite says: *given this synthetic world, these denial paths fire, and these audit entries are produced*.

When a contributor changes the framework, the benchmarks tell us — and them — exactly how the change altered behavior. If the alteration was intentional, the snapshot is regenerated with justification. If it was unintentional, the benchmark caught a regression before it shipped.

This is also why benchmarks ship in the same repository as the framework. They are not a separate "test suite" — they are part of the public interface in the sense that they describe the framework's committed behavior.

## Closing

The framework is opinionated, but the opinions are not arbitrary. They follow from one premise: **recruiting is probabilistic organizational reasoning under uncertainty, and the software for it should reflect that.**

If you find yourself fighting an invariant, ask whether you are fighting the framework or fighting that premise. If it is the premise, this is not the right framework for the problem. If it is the framework, open an issue — we want to know.
