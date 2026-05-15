# Recruiting intelligence as infrastructure

**Draft launch post — site / blog format.**

---

Most recruiting software is a database problem. We think it is a
reasoning problem.

Today we are open-sourcing a framework that treats it that way:
deterministic, provenance-first, calibration-aware. Eight composable
layers, byte-stable replay, public benchmarks. It is not an ATS. It
is not an AI recruiter. It is the reasoning layer underneath those
products — the part everyone hand-waves.

## The bet

The current generation of AI hiring tools collapses uncertainty into a
single number and hides disagreement behind a ranking. When the
decision is wrong, there is no replay. When the model drifts, there is
no alarm. When the agent is overconfident, there is no critic.

We built the opposite.

- **Same input → same bytes, every time.** The replay runner is
  deterministic. Replay signatures are sha256-stable and verified live
  on every benchmark page load.
- **Provenance is data, not logging.** Every claim, every signal, every
  escalation carries who-produced-what. The provenance graph is a
  first-class artefact.
- **Disagreement is preserved.** When the contradiction agent and the
  trajectory agent read the same dossier in incompatible ways, the
  framework surfaces both readings rather than averaging them into a
  number.
- **Calibration self-critiques.** The evaluation engine reports which
  confidence bands systematically over-promise. Today the 0.45–0.60
  band on ambiguous archetypes and the 0.60–0.75 band on
  capability-fit-versus-context-fit are flagged automatically.

## Five cases, eight layers

The public demo runs five cases end-to-end through the real engines on
each request:

- **inflated-senior** — claims that look strong, cross-source evidence
  refutes them.
- **org-mismatch** — capability is real, environment is wrong.
- **ambiguous-generalist** — wide vocabulary, neutral evidence.
- **chaos-thriver** — fit recommendation says yes, calibration says
  watch the upper-mid band.
- **founder-builder** — high upside, high risk; the escalation engine
  flags the asymmetric outcome distribution.

Replay any of them at `/demo`. The full eight-layer trace is on a
single page, with a guided narrative if you want the tour, and a raw
timeline if you want to read the bytes.

## What this is not

- Not an ATS.
- Not a CV matcher.
- Not an "AI recruiter."
- Not autonomous hiring.
- Not a chatbot.

The framework is decision-support infrastructure. It produces a trace,
surfaces what it does not know, and refuses to advance cases it cannot
justify. Humans remain first-class. Escalations are explicit.

## Honest about maturity

The framework is `0.1`. The runtime ships with in-memory seeds — the
Drizzle schema is scaffolded but persistence is not on by default.
Provider adapters exist but the skeleton runs without keys.
Production-hardening (rate limits, auth, observability) is
intentionally out of scope for the framework layer.

We say all of this on the front page. We say it on the benchmarks
page. We say it in the design partner toolkit. Selecting partners on a
clear picture is more useful than impressing them with one.

## Where to go

- **Replay a case** → `/demo`
- **See benchmarks** → `/benchmarks-public`
- **Read the architecture** → `/architecture`
- **First 30 minutes** → `/docs`
- **GitHub** → (repo URL)

If you build hiring decisions and you care about being right rather
than being confident, we want to hear from you.
