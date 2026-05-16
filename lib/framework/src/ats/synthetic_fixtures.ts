/**
 * Deterministic synthetic ATS fixtures used by the public demo and
 * the test suite.
 *
 * One hiring story: "Marcus Vega → Staff Backend Engineer at Atlas
 * Robotics." Three reviewers, conflicting scorecards on system
 * design and seniority signal, an escalation that adds a second
 * technical loop, a hiring-manager intervention to lower the bar,
 * and a six-month outcome of "regretted hire" that the calibration
 * layer surfaces as overconfidence.
 *
 * The shape mimics the way an Ashby export looks — candidate row,
 * scorecards, interviews, decision, rejection_rationale absent
 * because the candidate was hired and later regretted. Each
 * record's `id` is a stable opaque string.
 */

import type { ATSRawRecord } from "./types.js";

const ISO = (s: string) => new Date(s).toISOString();

export const SYNTHETIC_REVIEWERS = [
  {
    id: "rev_alice",
    name: "Alice Hoffmann",
    role: "Staff Engineer · Distributed Systems",
  },
  {
    id: "rev_bob",
    name: "Bob Sato",
    role: "Engineering Manager · Platform",
  },
  {
    id: "rev_carol",
    name: "Carol Diaz",
    role: "Founder / CTO",
  },
] as const;

export const SYNTHETIC_CANDIDATE = {
  atsId: "cand_marcus_vega",
  name: "Marcus Vega",
  targetRole: "Staff Backend Engineer",
  organization: "Atlas Robotics",
  applicationOpenedAt: ISO("2026-03-01T15:04:00Z"),
  hiredAt: ISO("2026-03-12T18:00:00Z"),
} as const;

/**
 * Build the synthetic Ashby-shaped raw records. Mimics what the
 * Ashby adapter would return for one candidate's full process.
 */
export function buildSyntheticAshbyRecords(): ATSRawRecord[] {
  const records: ATSRawRecord[] = [];
  const push = (r: Omit<ATSRawRecord, "provider" | "fetchedAt">) => {
    records.push({
      provider: "synthetic",
      fetchedAt: ISO("2026-03-16T00:00:00Z"),
      ...r,
    });
  };

  push({
    atsId: SYNTHETIC_CANDIDATE.atsId,
    kind: "candidate",
    occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
    payloadHash: "h_candidate_root",
    payload: {
      id: SYNTHETIC_CANDIDATE.atsId,
      name: SYNTHETIC_CANDIDATE.name,
      currentTitle: "Senior Engineer",
      currentCompany: "Quaternion",
      yearsExperience: 9,
      sourceChannel: "referral",
    },
  });

  push({
    atsId: "app_marcus_atlas",
    kind: "application",
    parentIds: [SYNTHETIC_CANDIDATE.atsId],
    occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
    payloadHash: "h_application",
    payload: {
      id: "app_marcus_atlas",
      candidateId: SYNTHETIC_CANDIDATE.atsId,
      role: SYNTHETIC_CANDIDATE.targetRole,
      organization: SYNTHETIC_CANDIDATE.organization,
      stage: "Onsite",
    },
  });

  for (const r of SYNTHETIC_REVIEWERS) {
    push({
      atsId: r.id,
      kind: "reviewer",
      occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
      payloadHash: `h_reviewer_${r.id}`,
      payload: { id: r.id, name: r.name, role: r.role },
    });
  }

  // Phone screen (Alice) — strong
  push({
    atsId: "iv_alice_phone",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-02T17:30:00Z"),
    payloadHash: "h_iv_alice_phone",
    payload: {
      id: "iv_alice_phone",
      interviewer: "rev_alice",
      kind: "phone-screen",
      durationMinutes: 45,
    },
  });
  push({
    atsId: "sc_alice_phone",
    kind: "scorecard",
    parentIds: ["iv_alice_phone"],
    occurredAt: ISO("2026-03-02T18:15:00Z"),
    payloadHash: "h_sc_alice_phone",
    payload: {
      id: "sc_alice_phone",
      interviewId: "iv_alice_phone",
      submitter: "rev_alice",
      overall: { value: "advance", score: 4, scale: 5 },
      attributes: [
        {
          topic: "communication",
          score: 4,
          scale: 5,
          comment: "Clear and concise. Asked sharp clarifying questions.",
        },
        {
          topic: "ownership-signal",
          score: 4,
          scale: 5,
          comment: "Drove three distributed systems migrations as DRI.",
        },
      ],
      confidence: 0.78,
    },
  });

  // Technical (Bob) — weak
  push({
    atsId: "iv_bob_tech1",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-04T20:00:00Z"),
    payloadHash: "h_iv_bob_tech1",
    payload: {
      id: "iv_bob_tech1",
      interviewer: "rev_bob",
      kind: "technical-deep-dive",
      durationMinutes: 75,
    },
  });
  push({
    atsId: "sc_bob_tech1",
    kind: "scorecard",
    parentIds: ["iv_bob_tech1"],
    occurredAt: ISO("2026-03-04T21:30:00Z"),
    payloadHash: "h_sc_bob_tech1",
    payload: {
      id: "sc_bob_tech1",
      interviewId: "iv_bob_tech1",
      submitter: "rev_bob",
      overall: { value: "decline", score: 2, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 2,
          scale: 5,
          comment:
            "Hand-waved on partitioning. Could not articulate consensus tradeoffs.",
        },
        {
          topic: "seniority-signal",
          score: 2,
          scale: 5,
          comment: "Concrete examples were thin for a staff candidate.",
        },
      ],
      confidence: 0.82,
    },
  });

  // System design (Carol) — middling
  push({
    atsId: "iv_carol_design",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-05T18:00:00Z"),
    payloadHash: "h_iv_carol_design",
    payload: {
      id: "iv_carol_design",
      interviewer: "rev_carol",
      kind: "system-design",
      durationMinutes: 60,
    },
  });
  push({
    atsId: "sc_carol_design",
    kind: "scorecard",
    parentIds: ["iv_carol_design"],
    occurredAt: ISO("2026-03-05T19:15:00Z"),
    payloadHash: "h_sc_carol_design",
    payload: {
      id: "sc_carol_design",
      interviewId: "iv_carol_design",
      submitter: "rev_carol",
      overall: { value: "lean-advance", score: 3, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 3,
          scale: 5,
          comment:
            "Solid at small/medium scale. Uncertain whether they have seen 100k+ rps.",
        },
        {
          topic: "founder-fit",
          score: 4,
          scale: 5,
          comment: "Energy and bias for shipping is exactly our default mode.",
        },
      ],
      confidence: 0.55,
    },
  });

  // Escalation — additional loop requested
  push({
    atsId: "kit_extension",
    kind: "interview_kit",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-08T16:00:00Z"),
    payloadHash: "h_kit_ext",
    payload: {
      id: "kit_extension",
      addedBy: "rev_carol",
      reason: "Second technical loop to resolve system-design disagreement.",
      addedInterview: "iv_bob_tech2",
    },
  });

  // Second technical (Bob) — still weak
  push({
    atsId: "iv_bob_tech2",
    kind: "interview",
    parentIds: ["app_marcus_atlas", "kit_extension"],
    occurredAt: ISO("2026-03-10T20:00:00Z"),
    payloadHash: "h_iv_bob_tech2",
    payload: {
      id: "iv_bob_tech2",
      interviewer: "rev_bob",
      kind: "technical-deep-dive-v2",
      durationMinutes: 60,
    },
  });
  push({
    atsId: "sc_bob_tech2",
    kind: "scorecard",
    parentIds: ["iv_bob_tech2"],
    occurredAt: ISO("2026-03-10T21:00:00Z"),
    payloadHash: "h_sc_bob_tech2",
    payload: {
      id: "sc_bob_tech2",
      interviewId: "iv_bob_tech2",
      submitter: "rev_bob",
      overall: { value: "decline", score: 2, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 2,
          scale: 5,
          comment:
            "Sharper this time but still missed quorum reasoning under partition.",
        },
      ],
      confidence: 0.79,
    },
  });

  // Founder note: pressure to lower bar
  push({
    atsId: "note_founder_bar",
    kind: "note",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-11T15:00:00Z"),
    payloadHash: "h_note_founder",
    payload: {
      id: "note_founder_bar",
      author: "rev_carol",
      body:
        "We have been searching for nine months. Marcus has founder energy. " +
        "Proposing we hire and pair him with Alice on consensus work for 90 days.",
    },
  });

  // Decision — hire over reviewer dissent (override)
  push({
    atsId: "dec_hire",
    kind: "decision",
    parentIds: ["app_marcus_atlas"],
    occurredAt: SYNTHETIC_CANDIDATE.hiredAt,
    payloadHash: "h_decision",
    payload: {
      id: "dec_hire",
      outcome: "hired",
      decidedBy: "rev_carol",
      overrideRationale:
        "Founder override: bar lowered for system-design, hire approved with structured 90-day plan.",
      dissentingReviewers: ["rev_bob"],
    },
  });

  push({
    atsId: "approval_offer",
    kind: "approval",
    parentIds: ["dec_hire"],
    occurredAt: ISO("2026-03-12T20:00:00Z"),
    payloadHash: "h_approval",
    payload: {
      id: "approval_offer",
      approver: "rev_carol",
      type: "offer-approval",
    },
  });

  // Activity feed — terse trace
  push({
    atsId: "act_stage_onsite",
    kind: "activity",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-04T15:00:00Z"),
    payloadHash: "h_act_onsite",
    payload: { id: "act_stage_onsite", event: "stage-moved", to: "Onsite" },
  });
  push({
    atsId: "act_stage_offer",
    kind: "activity",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-12T19:00:00Z"),
    payloadHash: "h_act_offer",
    payload: { id: "act_stage_offer", event: "stage-moved", to: "Offer" },
  });

  return records;
}

/**
 * Synthetic outcome record — six months later the hire was let go.
 * Used by the calibration layer to score the confidence the org
 * expressed at decision time.
 */
export const SYNTHETIC_OUTCOMES = [
  {
    candidateAtsId: SYNTHETIC_CANDIDATE.atsId,
    outcome: "regretted" as const,
    observedAt: ISO("2026-09-15T00:00:00Z"),
    note: "Did not pass first performance review. Difficulties matched Bob's stated concerns.",
  },
];
