/**
 * Guided narrative for each replay case.
 *
 * The replay UI is dense: eight layers, dozens of cards, hundreds of
 * provenance edges. This module supplies a six-beat narrative that
 * walks a viewer through the reasoning without any internal context.
 *
 * The narrative is data, not narration generated at request time —
 * it is deterministic and version-controlled alongside the case
 * definitions, and is intentionally short enough to read aloud.
 */

import type { ReplayCaseId } from "./types.js";

export type NarrativeBeat =
  | "first-impression"
  | "contradiction-surfaces"
  | "confidence-propagates"
  | "escalation-triggered"
  | "calibration-critiques"
  | "uncertainty-preserved";

export interface NarrativeStep {
  beat: NarrativeBeat;
  title: string;
  body: string;
  /** Which timeline layer to highlight when this beat plays. */
  highlightLayer:
    | "ingestion"
    | "agents"
    | "cognition"
    | "propagation"
    | "disagreement"
    | "org-fit"
    | "escalation"
    | "calibration"
    | "recommendation";
}

export interface CaseNarrative {
  caseId: ReplayCaseId;
  /** One-sentence hook surfaced above the story panel. */
  hook: string;
  steps: NarrativeStep[];
}

const NARRATIVES: Record<ReplayCaseId, CaseNarrative> = {
  "founder-builder": {
    caseId: "founder-builder",
    hook: "Real upside, real risk. The framework refuses to flatten the asymmetry.",
    steps: [
      {
        beat: "first-impression",
        title: "Strong on paper",
        body: "A 0→1 builder with a steep ownership trajectory and real OSS evidence. On the surface the Bayesian scorer reads high, the trajectory modeller reads steeper.",
        highlightLayer: "agents",
      },
      {
        beat: "contradiction-surfaces",
        title: "Mostly coherent",
        body: "Cross-source signals largely agree. A small number of low-severity contradictions appear around scope of ownership at later stages.",
        highlightLayer: "disagreement",
      },
      {
        beat: "confidence-propagates",
        title: "Trajectory lifts cognition",
        body: "Confidence propagates from the trajectory signal into the global synthesis. The system grows more confident, but not uniformly — the propagation graph shows where lift comes from.",
        highlightLayer: "propagation",
      },
      {
        beat: "escalation-triggered",
        title: "High upside, high risk",
        body: "The real escalation engine flags this as an asymmetric outcome distribution. Advancement requires the hiring committee to explicitly accept the downside scenario.",
        highlightLayer: "escalation",
      },
      {
        beat: "calibration-critiques",
        title: "The 0.60–0.75 band is over-trusted",
        body: "The evaluation engine reports a 13-point gap between claimed and observed positive rate in the upper-mid confidence band on this archetype. Treat that range with caution.",
        highlightLayer: "calibration",
      },
      {
        beat: "uncertainty-preserved",
        title: "Advance with eyes open",
        body: "The recommendation is advance, but with explicit unresolved risks and a calibration haircut suggestion. Nothing is laundered into a single number.",
        highlightLayer: "recommendation",
      },
    ],
  },

  "inflated-senior": {
    caseId: "inflated-senior",
    hook: "Senior on the CV; the evidence does not agree.",
    steps: [
      {
        beat: "first-impression",
        title: "Looks like a staff hire",
        body: "Claims of staff-level platform leadership across multiple roles. Bayesian scorer reads moderate-to-high on the headline claims.",
        highlightLayer: "agents",
      },
      {
        beat: "contradiction-surfaces",
        title: "Cross-source evidence refutes",
        body: "The contradiction agent flags multiple high-severity contradictions: scope claims unsupported by code review artefacts, ownership claims contradicted by reference signals.",
        highlightLayer: "disagreement",
      },
      {
        beat: "confidence-propagates",
        title: "Confidence is pulled down",
        body: "Contradiction pressure propagates into the global synthesis. Confidence drops; the disagreement score climbs. The system does not paper over the conflict.",
        highlightLayer: "propagation",
      },
      {
        beat: "escalation-triggered",
        title: "Adversarial panel requested",
        body: "The escalation engine raises an adversarial-panel review on two contradiction clusters. Evidence requests are opened, not silently absorbed.",
        highlightLayer: "escalation",
      },
      {
        beat: "calibration-critiques",
        title: "Mid-band is the failure mode",
        body: "The evaluation engine flags the 0.45–0.60 band as overconfident: claims that look strong but cross-source evidence refutes. Today's case sits squarely there.",
        highlightLayer: "calibration",
      },
      {
        beat: "uncertainty-preserved",
        title: "Investigate, do not advance",
        body: "The recommendation is investigate. Specific evidence requests must close before the case can return for review.",
        highlightLayer: "recommendation",
      },
    ],
  },

  "ambiguous-generalist": {
    caseId: "ambiguous-generalist",
    hook: "Wide vocabulary, neutral evidence. The framework refuses to invent a signal.",
    steps: [
      {
        beat: "first-impression",
        title: "Generalist surface",
        body: "Broad domain vocabulary across the dossier. The Bayesian scorer reads in the mid-band; the trajectory signal is shallow but not negative.",
        highlightLayer: "agents",
      },
      {
        beat: "contradiction-surfaces",
        title: "No contradictions, but no depth",
        body: "The contradiction agent finds little to flag. That is the problem: the absence of refutation is not evidence of strength.",
        highlightLayer: "disagreement",
      },
      {
        beat: "confidence-propagates",
        title: "Confidence stays low and flat",
        body: "Without strong signal in any direction, global confidence does not rise. The propagation graph is sparse — there is nothing to propagate.",
        highlightLayer: "propagation",
      },
      {
        beat: "escalation-triggered",
        title: "Confidence floor breached",
        body: "Global confidence sits below the action floor. The escalation engine raises a confidence-collapse signal and asks what additional evidence would lift it above 0.6.",
        highlightLayer: "escalation",
      },
      {
        beat: "calibration-critiques",
        title: "Mid-band over-rates ambiguous profiles",
        body: "The evaluation engine reports a sharp gap in the 0.45–0.60 band on ambiguous archetypes — confidence systematically overstates observed fit. This case is the textbook failure regime.",
        highlightLayer: "calibration",
      },
      {
        beat: "uncertainty-preserved",
        title: "Ambiguous, investigate",
        body: "The recommendation is ambiguous / investigate. Uncertainty is preserved verbatim, not collapsed into a number nobody can act on.",
        highlightLayer: "recommendation",
      },
    ],
  },

  "chaos-thriver": {
    caseId: "chaos-thriver",
    hook: "Chaos org meets chaos thriver. The fit-recommendation says yes, the calibration says \"watch the upper-mid band.\"",
    steps: [
      {
        beat: "first-impression",
        title: "High autonomy, cross-domain wins",
        body: "Bayesian scorer reads moderate, trajectory reads steep. The candidate has shipped across multiple domains under shifting priorities.",
        highlightLayer: "agents",
      },
      {
        beat: "contradiction-surfaces",
        title: "Coherent narrative",
        body: "Cross-source evidence is largely consistent. A small number of low-severity contradictions appear around scope estimates.",
        highlightLayer: "disagreement",
      },
      {
        beat: "confidence-propagates",
        title: "Trajectory lifts the synthesis",
        body: "Confidence propagates from the trajectory signal into the global confidence. The propagation graph shows the chain of lift.",
        highlightLayer: "propagation",
      },
      {
        beat: "escalation-triggered",
        title: "No critical escalation",
        body: "The escalation engine surfaces watch-points but does not raise a blocking escalation. The case is advanceable with explicit success conditions.",
        highlightLayer: "escalation",
      },
      {
        beat: "calibration-critiques",
        title: "Upper-mid band over-projects",
        body: "The evaluation engine flags the 0.60–0.75 band: chaos-fit predictions in this band are systematically too confident. Outcomes only confirm fit in the top band.",
        highlightLayer: "calibration",
      },
      {
        beat: "uncertainty-preserved",
        title: "Advance, conditional fit",
        body: "Recommendation is advance / conditional_fit. The success conditions are explicit and survive in the report. The downside scenarios are not hidden.",
        highlightLayer: "recommendation",
      },
    ],
  },

  "org-mismatch": {
    caseId: "org-mismatch",
    hook: "Capability is real. Environment is wrong. The framework's largest open calibration failure.",
    steps: [
      {
        beat: "first-impression",
        title: "Strong operator profile",
        body: "Process-dependent operator with consistent ownership in structured environments. Bayesian scorer reads strong on capability.",
        highlightLayer: "agents",
      },
      {
        beat: "contradiction-surfaces",
        title: "No internal contradiction",
        body: "The contradiction agent finds little to flag inside the dossier — the issue is not internal coherence. The issue is external context.",
        highlightLayer: "disagreement",
      },
      {
        beat: "confidence-propagates",
        title: "Capability confidence holds",
        body: "Confidence in capability stays high. But the cognition layer alone does not yet see the environment problem; that lives in the org-fit layer.",
        highlightLayer: "org-fit",
      },
      {
        beat: "escalation-triggered",
        title: "Role-environment mismatch",
        body: "The org-fit engine flags multiple role-environment mismatches. The escalation engine raises a missing-evidence signal: environment-fit evidence is not present and the system refuses to substitute capability for it.",
        highlightLayer: "escalation",
      },
      {
        beat: "calibration-critiques",
        title: "Two overconfident bands at once",
        body: "The evaluation engine flags both the 0.45–0.60 and 0.60–0.75 bands as overconfident for this archetype — claims that look mid-fit on capability collapse on environment. ECE is the largest of any case.",
        highlightLayer: "calibration",
      },
      {
        beat: "uncertainty-preserved",
        title: "Poor context fit, investigate",
        body: "Recommendation is poor_context_fit / investigate. The strongest risk drivers in the report are all environment-shaped. Nothing is laundered into a capability score.",
        highlightLayer: "recommendation",
      },
    ],
  },
};

export function findNarrative(caseId: string): CaseNarrative | null {
  return NARRATIVES[caseId as ReplayCaseId] ?? null;
}

export function listNarrativeCases(): ReplayCaseId[] {
  return Object.keys(NARRATIVES) as ReplayCaseId[];
}
