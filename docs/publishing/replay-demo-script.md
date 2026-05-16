# Replay Demo Script

The canonical narrated walkthrough of the public ATS demo. Use this for HN
launch videos, X threads, design-partner calls, and conference talks. Total
runtime ≈ 2:30.

Stages map 1:1 to the seven beats encoded in the `/ats-demo` guided story
mode.

---

## Cold open (0:00 – 0:10)

> *"Your ATS stores hiring decisions. It does not store how you reasoned
> about them. This framework does."*

(Hold on the homepage hero. Cursor moves to the "Replay a hiring decision"
button. Click.)

---

## Beat 1 — Initial candidate strength (0:10 – 0:25)

> *"Marcus Vega. Senior engineer, nine years of distributed-systems
> experience, referral. The first reviewer — Alice — does the phone screen
> and writes an enthusiastic advance. So far, this looks like a clean hire."*

(Highlight: candidate header + first scorecard in evidence timeline.
Confidence trajectory shows the early bar at ~0.78.)

---

## Beat 2 — Disagreement emerges (0:25 – 0:50)

> *"Then the technical loops happen. Bob, an engineering manager, does the
> deep dive and writes a decline. Carol, the founder/CTO, does the system
> design and lands at a lukewarm lean-advance. The reviewer panel has now
> disagreed by 0.4 on the overall — a 'strong-advance' next to a
> 'strong-decline.' The framework records the disagreement explicitly. It
> does not flatten the panel into an average."*

(Highlight: disagreement card surfaces, both rationales side-by-side, spread
badge visible.)

---

## Beat 3 — Confidence collapses (0:50 – 1:05)

> *"Watch the rolling P(hire) estimate. The team's confidence in this hire
> does not stabilize. It drifts down and oscillates as the loop produces
> conflicting signal. The framework reports the trajectory as data, not as
> a single summary number — and the team is no longer well-calibrated on
> this candidate."*

(Highlight: confidence trajectory chart, with the post-Bob dip visible.)

---

## Beat 4 — Escalation triggers (1:05 – 1:25)

> *"The framework detects an escalation. Carol opens a second technical
> loop, explicitly to resolve the system-design disagreement. This is a
> normal recruiting motion. The framework records it as an
> `escalation_signal` with a verbatim rationale and a parent link back to
> the first technical interview."*

(Highlight: escalation card — "Second technical loop to resolve system-design
disagreement.")

---

## Beat 5 — Founder override (1:25 – 1:45)

> *"The second technical comes back — still weak on consensus reasoning
> under partition. Carol writes a note: 'We've been searching for nine
> months. Marcus has founder energy. Propose we hire and pair him with
> Alice for ninety days.' The framework attributes the override to Carol,
> records Bob as a dissenting reviewer, and preserves the rationale
> verbatim. Marcus is hired."*

(Highlight: override card — Carol's name, full rationale, Bob listed as
dissenter.)

---

## Beat 6 — Calibration critique (1:45 – 2:10)

> *"Six months later, Marcus is regretted. The realized outcome is `label
> 0` — the system-design concerns held up. The calibration layer now has a
> data point: the team's expressed confidence at decision time did not
> align with the realized outcome. Per-reviewer drift surfaces the pattern;
> the framework treats it as descriptive across many decisions, never as a
> verdict on a single hire."*

(Highlight: calibration table. Caveat banner visible: small sample,
illustrative.)

---

## Beat 7 — Reasoning becomes visible (2:10 – 2:30)

> *"The replay is signed. The signature is deterministic — same evidence
> in, same signature out. We hit `verify` and the server recomputes from
> stored evidence. Match. If a scorecard had been retroactively edited in
> the ATS, the framework would have known on the next ingest. This is the
> shape of organizational memory: read-only, provenance-first, replayable
> byte for byte."*

(Highlight: signature badge. Click verify. ShieldCheck green. Match.)

---

## Tag (2:30 – 2:40)

> *"Open-source. Synthetic out of the box. Real ATS adapters env-gated.
> We're taking design partners — we sit with you while you replay three
> hires you remember well. The demo and the source are linked below."*

(Cut to repo URL + `/ats-demo` URL.)

---

## Production notes

- **Voice**: measured, forensic, slightly understated. Not breathless. Not
  marketing.
- **Pace**: 145 wpm. The visual is doing most of the work.
- **Music**: ambient, low. Cut to silence during the override beat.
- **Cursor**: deliberate, never jittery. One click per beat.
- **Captions**: full transcript, displayed at 1.0x line height. Highlight
  the active sentence.

---

## Alternate compare-mode coda (optional, +30s)

> *"Now watch what calibrated reasoning looks like. Lena Park, same
> reviewer panel, four weeks later. Three reviewers, all decline, no
> spread, no escalation, no override. The team's confidence at decision
> time aligns with the realized outcome. The signature here is different,
> but the verification works the same way."*

(Switch to `/ats-compare`. Show both replays side-by-side. End on the
calibration delta.)
