# HN Launch — Draft

## Title

**Show HN: Replayable hiring intelligence built on top of ATS evidence**

(Alternate, slightly more technical: *Show HN: Deterministic recruiting
intelligence with replayable audits*)

## Body

We've been building a framework that does something unusual for recruiting
tooling: it doesn't make hiring decisions, surface candidates, or pretend to
"AI-recruit" anyone. It reads operational evidence out of your ATS (Ashby and
Greenhouse adapters today; synthetic adapter for the public demo) and
**reconstructs how the organization actually reasoned** about each hire.

Open-source, deterministic, provenance-first, read-only. No write-back to the
ATS — ever.

What it does that the ATS doesn't:

- **Replay** every hiring decision as a signed, byte-stable trace. Same
  evidence in, same trace out, every time.
- **Preserve disagreement** instead of flattening reviewer panels into a single
  number. When two reviewers diverge ≥ 0.2 on a topic, the spread, both
  rationales, and the resolution path stay in the replay.
- **Reconstruct escalations and overrides** explicitly. If a founder lowered
  the bar on system-design and hired over a senior engineer's dissent, the
  replay says so, attributes it, and the calibration layer will quietly notice
  if that pattern produces regretted hires.
- **Self-critique its own confidence.** Per-reviewer calibration drift,
  per-bucket overconfidence, Brier score, ECE. Honest small-sample caveats.

The public demo (`/ats-demo`) walks through a synthetic candidate end-to-end:
three reviewers, one disagreement, two escalations, one founder override, one
regretted hire. There's a compare view (`/ats-compare`) that puts that case
next to a calibrated decline so the difference between "the team reasoned well"
and "the team overrode itself" is visually unambiguous.

Every replay is signed (SHA-256 prefix of a canonical projection of the
evidence). There's a `/verify` endpoint that recomputes the signature
server-side and returns `match: true/false`. If a scorecard is retroactively
edited in the ATS, the framework will know on the next ingest.

### Why we built this

Recruiting is organizational reasoning. The artefact most companies keep —
the ATS row — captures the outcome but throws away the reasoning. Six months
later when a hire fails, there's no signal trail to learn from. Two years
later, when the same reviewer is again overconfident on the same topic,
nobody notices.

We think the next layer of recruiting infrastructure is not another ATS, not
another CV matcher, not an "AI recruiter." It's an **organizational memory**
that replays decisions, preserves disagreement, and critiques the team's own
calibration with the dignity of evidence.

### Status

- Open-source. MIT.
- Synthetic adapter ships out of the box; no API keys required.
- Ashby + Greenhouse adapters implement the real HTTP contract, env-gated on
  `ASHBY_API_KEY` / `GREENHOUSE_API_KEY`.
- Postgres event store (in-memory fallback for demos).
- Deterministic replay verified by signature roundtrips in the public demo.
- We're taking design partners. We sit with you while you replay three hires
  you remember well and see if the framework matches your gut. If it doesn't,
  we want to know why.

Constructive criticism, especially from people who have built or operated ATS
integrations at scale, is what we are here for.

— [maintainer]

## Comments preempted

**"Isn't this just an ATS plugin?"**
No. Plugins write back. This is read-only. The framework is not in the hiring
loop; it is the audit trail of the hiring loop.

**"How is this different from a CV matcher / AI recruiter?"**
We don't surface candidates, score resumes, or recommend hires. We reconstruct
the reasoning the human team already performed.

**"Why deterministic?"**
Because a non-deterministic audit trail is not an audit trail.

**"What's the catch?"**
The framework only shows you what's in your ATS. If your reviewers don't
write down their reasoning, the replay will show you that they didn't. That's
useful information, but it isn't the framework's job to fix.

---

## Pre-launch checklist

- [ ] Public demo URL reachable and stable
- [ ] `/ats-demo` autoplays the guided walkthrough cleanly
- [ ] `/ats-compare` renders both cases without scroll-jank
- [ ] `/api/ats/replay/:id/verify` returns `match: true` for both demo replays
- [ ] Repo README leads with the replay framing, not the cognition framing
- [ ] HN demo accounts not required
- [ ] No write-back endpoints exposed
