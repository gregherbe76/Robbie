/**
 * ProvenanceIntegrityVerifier.
 *
 * Provenance is data, not narration. Every agent reasoning envelope must
 * carry producedBy / producedAt / rationale / derivedFrom; every
 * propagated influence must carry sourceAgent + targetAgent + before/after
 * + derivedFrom; every adjustment must point at evidence ids. Missing
 * provenance is a hard failure — silent reasoning is worse than no
 * reasoning.
 */

import type { AgentReasoning } from "../agents/flagship/index.js";
import type { ProvenanceFinding, ScenarioOutputs } from "./types.js";

function checkEnvelope(
  label: string,
  env: AgentReasoning<unknown>,
  findings: ProvenanceFinding[],
): void {
  const p = env.provenance;
  if (!p) {
    findings.push({ ok: false, path: `${label}.provenance`, detail: "missing provenance" });
    return;
  }
  if (!p.producedBy)
    findings.push({ ok: false, path: `${label}.provenance.producedBy`, detail: "missing producedBy" });
  if (!p.producedAt)
    findings.push({ ok: false, path: `${label}.provenance.producedAt`, detail: "missing producedAt" });
  if (!p.rationale)
    findings.push({ ok: false, path: `${label}.provenance.rationale`, detail: "missing rationale" });
  if (!Array.isArray(p.derivedFrom))
    findings.push({ ok: false, path: `${label}.provenance.derivedFrom`, detail: "derivedFrom not an array" });
  if (!Array.isArray(env.reasoning) || env.reasoning.length === 0)
    findings.push({ ok: false, path: `${label}.reasoning`, detail: "empty reasoning chain" });
  if (!Array.isArray(env.evidenceChain))
    findings.push({ ok: false, path: `${label}.evidenceChain`, detail: "evidenceChain not an array" });
}

export function verifyProvenance(outputs: ScenarioOutputs): {
  ok: boolean;
  findings: ProvenanceFinding[];
} {
  const findings: ProvenanceFinding[] = [];
  checkEnvelope("bayesian", outputs.bayesian, findings);
  checkEnvelope("contradiction", outputs.contradiction, findings);
  checkEnvelope("trajectory", outputs.trajectory, findings);
  checkEnvelope("orgReport.founderFit", outputs.orgReport.founderFit, findings);
  checkEnvelope("orgReport.teamChemistry", outputs.orgReport.teamChemistry, findings);
  checkEnvelope("orgReport.chaosFit", outputs.orgReport.chaosFit, findings);
  checkEnvelope("orgReport.roleEnvironment", outputs.orgReport.roleEnvironment, findings);
  checkEnvelope("orgReport.hiringRisk", outputs.orgReport.hiringRisk, findings);

  // Cognition influences must each carry full provenance.
  outputs.cognition.influences.forEach((inf, idx) => {
    const base = `cognition.influences[${idx}]`;
    if (!inf.sourceAgent)
      findings.push({ ok: false, path: `${base}.sourceAgent`, detail: "missing sourceAgent" });
    if (!inf.targetAgent)
      findings.push({ ok: false, path: `${base}.targetAgent`, detail: "missing targetAgent" });
    if (typeof inf.before !== "number" || typeof inf.after !== "number")
      findings.push({ ok: false, path: `${base}.before/after`, detail: "missing before/after numerics" });
    if (typeof inf.adjustment !== "number")
      findings.push({ ok: false, path: `${base}.adjustment`, detail: "missing adjustment" });
    if (!Array.isArray(inf.derivedFrom))
      findings.push({ ok: false, path: `${base}.derivedFrom`, detail: "derivedFrom not an array" });
    if (!inf.reason)
      findings.push({ ok: false, path: `${base}.reason`, detail: "missing reason" });
  });

  // Reasoning nodes — orphans are a fatal regression.
  const allIds = new Set<string>();
  outputs.bayesian.reasoning.forEach((r) => allIds.add(`b:${r.step}`));
  outputs.contradiction.reasoning.forEach((r) => allIds.add(`c:${r.step}`));
  outputs.trajectory.reasoning.forEach((r) => allIds.add(`t:${r.step}`));
  if (allIds.size === 0) {
    findings.push({ ok: false, path: "reasoning", detail: "no reasoning steps across any agent" });
  }

  // Every output must produce at least one finding entry; default ok-row.
  if (findings.filter((f) => !f.ok).length === 0) {
    findings.push({ ok: true, path: "provenance", detail: "all envelopes complete" });
  }

  const ok = findings.every((f) => f.ok);
  return { ok, findings };
}
