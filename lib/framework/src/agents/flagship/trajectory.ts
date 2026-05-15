/**
 * TrajectoryAgent.
 *
 * Models a candidate's *forward* potential from their chronological history
 * instead of static pedigree. The output explains accelerating vs plateaued
 * vs emerging-elite patterns using explicit derivatives.
 *
 * Mathematical model
 * ------------------
 *   composite(role)        = 0.5·complexity + 0.3·scope + 0.2·ownership
 *   velocity(t -> t+1)     = Δcomposite / Δyears                  // per year
 *   acceleration           = mean(Δvelocity / Δyears) across pairs
 *   momentum               = Σ_i v_i · e^(-λ·age_i_years)   λ=0.5
 *   founderPotential       = 0.4·maxOwnership + 0.3·breadth +
 *                            0.3·clamp01(momentum)
 *   trajectoryScore        = clamp01(0.45·momentum + 0.30·acceleration_norm +
 *                                    0.25·maxComposite)
 */

import { BaseAgent } from "./base.js";
import type { AgentManifest } from "../index.js";
import type {
  CandidateDossier,
  ReasoningStep,
  RoleEvent,
} from "./types.js";

export interface TrajectorySignal {
  id:
    | "accelerating-builder"
    | "plateau-detected"
    | "emerging-elite"
    | "unusually-fast-progression"
    | "high-ownership-momentum"
    | "complexity-growth";
  rationale: string;
  derivedFrom: string[];
}

export interface TrajectoryRisk {
  id: "plateau" | "volatility" | "single-data-point" | "ownership-stagnation";
  severity: "low" | "medium" | "high";
  rationale: string;
}

export interface TrajectoryResult {
  trajectoryScore: number;
  growthVelocity: number;
  acceleration: number;
  momentum: number;
  founderPotential: number;
  complexityCurve: Array<{
    roleId: string;
    title: string;
    year: number;
    composite: number;
  }>;
  trajectorySignals: TrajectorySignal[];
  risks: TrajectoryRisk[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function composite(r: RoleEvent): number {
  return 0.5 * r.complexity + 0.3 * r.scope + 0.2 * r.ownership;
}

function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear() + new Date(iso).getUTCMonth() / 12;
}

export class TrajectoryAgent extends BaseAgent<TrajectoryResult> {
  public readonly manifest: AgentManifest = {
    id: "trajectory-modeler",
    name: "Trajectory Agent",
    role: "forward-potential-modeling",
    description:
      "Models candidate trajectory and momentum from chronological role progression, project complexity evolution, and ownership growth — focused on forward potential rather than static pedigree.",
    capabilities: [
      "temporal-reasoning",
      "complexity-evolution-analysis",
      "momentum-analysis",
      "founder-potential-scoring",
    ],
    allowedSkills: [],
    defaultProvider: undefined,
  };

  protected analyzeDossier(dossier: CandidateDossier) {
    const reasoning: ReasoningStep[] = [];
    const evidenceChain: string[] = [];

    const roles = [...dossier.roles].sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    );
    if (roles.length === 0) {
      return {
        result: {
          trajectoryScore: 0,
          growthVelocity: 0,
          acceleration: 0,
          momentum: 0,
          founderPotential: 0,
          complexityCurve: [],
          trajectorySignals: [],
          risks: [
            {
              id: "single-data-point" as const,
              severity: "high" as const,
              rationale: "No chronological role data available.",
            },
          ],
        },
        reasoning: [
          { step: "no-data", detail: "Empty role history; trajectory undefined." },
        ],
        evidenceChain: [],
        confidence: 0.3,
        rationaleSummary: "No role history.",
      };
    }

    const curve = roles.map((r) => ({
      roleId: r.id,
      title: r.title,
      year: yearOf(r.startedAt),
      composite: composite(r),
    }));
    evidenceChain.push(...roles.map((r) => r.id));

    reasoning.push({
      step: "composite-curve",
      detail: `Computed composite = 0.5·complexity + 0.3·scope + 0.2·ownership for ${roles.length} role(s).`,
      derivedFrom: roles.map((r) => r.id),
    });

    // Velocity per consecutive pair
    const velocities: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1]!;
      const cur = curve[i]!;
      const dt = Math.max(0.25, cur.year - prev.year); // floor 3 months
      const v = (cur.composite - prev.composite) / dt;
      velocities.push(v);
    }
    const growthVelocity =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : 0;
    reasoning.push({
      step: "velocity",
      detail: `Mean Δcomposite/Δyear across ${velocities.length} transition(s) = ${growthVelocity.toFixed(3)}.`,
      value: growthVelocity,
    });

    // Acceleration
    const accelerations: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      const dv = velocities[i]! - velocities[i - 1]!;
      const dt = Math.max(0.25, curve[i + 1]!.year - curve[i]!.year);
      accelerations.push(dv / dt);
    }
    const acceleration =
      accelerations.length > 0
        ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
        : 0;
    reasoning.push({
      step: "acceleration",
      detail: `Mean Δvelocity/Δyear across ${accelerations.length} sample(s) = ${acceleration.toFixed(3)}.`,
      value: acceleration,
    });

    // Momentum: exponentially weighted by recency. `this.now()` is the
    // injected clock — tests can pin it; production passes a real Date.
    const lambda = 0.5;
    const now = this.now();
    const nowYear = now.getUTCFullYear() + now.getUTCMonth() / 12;
    let momentum = 0;
    for (let i = 0; i < velocities.length; i++) {
      const ageYears = nowYear - curve[i + 1]!.year;
      momentum += velocities[i]! * Math.exp(-lambda * Math.max(0, ageYears));
    }
    reasoning.push({
      step: "momentum",
      detail: `Σ v_i · e^(-${lambda}·age) over ${velocities.length} transition(s) = ${momentum.toFixed(3)}.`,
      value: momentum,
    });

    // Breadth: number of distinct title roots
    const distinctTitles = new Set(
      roles.map((r) => r.title.split(" ")[0]?.toLowerCase() ?? r.title),
    );
    const breadth = clamp01(distinctTitles.size / 4);

    const maxOwnership = Math.max(...roles.map((r) => r.ownership));
    const maxComposite = Math.max(...curve.map((c) => c.composite));

    const momentumNorm = clamp01(momentum / 0.4);
    const accelerationNorm = clamp01(0.5 + acceleration / 0.4); // -0.2..0.2 -> 0..1
    const founderPotential = clamp01(
      0.4 * maxOwnership + 0.3 * breadth + 0.3 * momentumNorm,
    );
    const trajectoryScore = clamp01(
      0.45 * momentumNorm + 0.3 * accelerationNorm + 0.25 * maxComposite,
    );
    reasoning.push({
      step: "score",
      detail: `trajectoryScore = 0.45·momentumNorm(${momentumNorm.toFixed(2)}) + 0.30·accelNorm(${accelerationNorm.toFixed(2)}) + 0.25·maxComposite(${maxComposite.toFixed(2)}) = ${trajectoryScore.toFixed(3)}.`,
      value: trajectoryScore,
    });

    // Signals
    const signals: TrajectorySignal[] = [];
    if (acceleration > 0.05) {
      signals.push({
        id: "accelerating-builder",
        rationale: `Acceleration ${acceleration.toFixed(3)} > 0.05 indicates compounding growth.`,
        derivedFrom: roles.map((r) => r.id),
      });
    }
    if (
      velocities.length >= 2 &&
      velocities[velocities.length - 1]! < 0.02 &&
      velocities[velocities.length - 2]! < 0.02
    ) {
      signals.push({
        id: "plateau-detected",
        rationale: `Last two velocity samples both < 0.02 (${velocities
          .slice(-2)
          .map((v) => v.toFixed(3))
          .join(", ")}).`,
        derivedFrom: roles.slice(-3).map((r) => r.id),
      });
    }
    if (maxComposite >= 0.8 && momentum >= 0.2) {
      signals.push({
        id: "emerging-elite",
        rationale: `Peak composite ${maxComposite.toFixed(2)} ≥ 0.80 with momentum ${momentum.toFixed(2)}.`,
        derivedFrom: roles
          .filter((r) => composite(r) >= 0.8)
          .map((r) => r.id),
      });
    }
    if (growthVelocity > 0.15) {
      signals.push({
        id: "unusually-fast-progression",
        rationale: `Mean velocity ${growthVelocity.toFixed(3)} > 0.15/year.`,
        derivedFrom: roles.map((r) => r.id),
      });
    }
    if (maxOwnership >= 0.7 && momentumNorm >= 0.5) {
      signals.push({
        id: "high-ownership-momentum",
        rationale: `Max ownership ${maxOwnership.toFixed(2)} with sustained momentum.`,
        derivedFrom: roles.filter((r) => r.ownership >= 0.7).map((r) => r.id),
      });
    }
    if (
      curve.length >= 2 &&
      curve[curve.length - 1]!.composite > curve[0]!.composite + 0.25
    ) {
      signals.push({
        id: "complexity-growth",
        rationale: `Composite grew from ${curve[0]!.composite.toFixed(2)} to ${curve[curve.length - 1]!.composite.toFixed(2)}.`,
        derivedFrom: [curve[0]!.roleId, curve[curve.length - 1]!.roleId],
      });
    }

    // Risks
    const risks: TrajectoryRisk[] = [];
    if (signals.some((s) => s.id === "plateau-detected")) {
      risks.push({
        id: "plateau",
        severity: "medium",
        rationale: "Recent velocity flatlined; momentum decaying.",
      });
    }
    if (velocities.length >= 2) {
      const mean =
        velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const variance =
        velocities.reduce((s, v) => s + (v - mean) ** 2, 0) / velocities.length;
      if (variance > 0.05) {
        risks.push({
          id: "volatility",
          severity: "medium",
          rationale: `Velocity variance ${variance.toFixed(3)} > 0.05 — uneven trajectory.`,
        });
      }
    }
    if (roles.length < 2) {
      risks.push({
        id: "single-data-point",
        severity: "high",
        rationale: "Only one role observed — trajectory inference is fragile.",
      });
    }
    if (maxOwnership < 0.3) {
      risks.push({
        id: "ownership-stagnation",
        severity: "low",
        rationale: `Max observed ownership ${maxOwnership.toFixed(2)} < 0.3.`,
      });
    }

    const confidence = clamp01(
      0.3 + 0.1 * roles.length + 0.05 * dossier.github.signatureProjects.length,
    );

    return {
      result: {
        trajectoryScore: Number(trajectoryScore.toFixed(3)),
        growthVelocity: Number(growthVelocity.toFixed(3)),
        acceleration: Number(acceleration.toFixed(3)),
        momentum: Number(momentum.toFixed(3)),
        founderPotential: Number(founderPotential.toFixed(3)),
        complexityCurve: curve.map((c) => ({
          ...c,
          composite: Number(c.composite.toFixed(3)),
        })),
        trajectorySignals: signals,
        risks,
      },
      reasoning,
      evidenceChain,
      confidence,
      rationaleSummary: `Trajectory score ${trajectoryScore.toFixed(3)} (momentum ${momentum.toFixed(2)}, acceleration ${acceleration.toFixed(3)}) over ${roles.length} role(s).`,
    };
  }
}
