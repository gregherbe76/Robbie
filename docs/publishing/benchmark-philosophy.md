# Benchmark philosophy

**Draft article.**

---

Benchmarks for AI systems have a credibility problem. The numbers go up
and to the right; the failure modes go quiet. The benchmark page is a
marketing surface, not a diagnostic surface.

We try to do the opposite.

## Three rules

**1. The benchmark is data, not a press release.** Every metric on
`/benchmarks-public` is computed live, on every page load, from the
real engines. There is no static export. If the framework regresses,
the page regresses.

**2. We surface our failures.** The calibration engine flags
overconfident confidence bands automatically. The flag survives into
the public benchmark page with the gap in percentage points and the
self-critique string. We do not strip it out for visiting investors.

**3. Mutation guards fail loudly.** A mutation guard is an
engine-level invariant — for example, "ingestion never reduces the
confidence of an explicit claim it just absorbed." When a guard
fails, the benchmark page reports `FAIL` next to the guard name. We
deploy that page anyway. Hiding a failed guard would be worse than
shipping one.

## What is in scope

- **Determinism.** Replay signatures are sha256 of the canonical trace
  body. The benchmark page re-runs each of five cases twice and
  compares the signatures. Drift is loud.
- **Mutation invariants.** Engine-level rules the cognition pipeline
  is not allowed to violate. Today there are seven; they are listed
  on `/benchmarks-public`.
- **Calibration.** ECE per case, per-bucket claimed-vs-observed,
  overconfident-band flags with critique strings.
- **Provenance completeness.** Every node in the recommendation graph
  must have a `sourceAgentId`. The benchmark layer counts unattributed
  nodes and reports zero today.

## What is intentionally out of scope (for now)

- **Cross-system comparisons.** We do not benchmark against
  competitors. The benchmark is internal: does *this* system honour
  *its own* contracts?
- **Predictive accuracy on a held-out set.** The framework does not
  yet pull realised outcomes back into the loop. When it does, the
  reliability diagram becomes truth-grounded, not self-reported.
- **Throughput / latency.** Important for production but irrelevant
  to the cognition contract.

## Failure modes we deliberately keep

The 0.45–0.60 band on ambiguous-generalist over-promises by 14
percentage points. The 0.60–0.75 band on chaos-thriver and
founder-builder over-promises by 11–13 points. The org-mismatch case
has the largest ECE of any case and flags both mid bands at once.

These are not bugs in the benchmark. They are facts about the
cognition. They appear on the public page because they are real, and
because the next person who reads the framework deserves to see them
before the architecture deck.

## Rule of thumb

If you are looking at our benchmark page and every metric is green,
either we have lied or we have made the benchmark too easy. Neither
is the goal.
