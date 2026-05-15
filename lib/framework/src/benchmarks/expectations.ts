/**
 * ScenarioExpectationEngine — declarative expectation evaluation.
 *
 * Expectations are intentionally behaviour-oriented: ranges, recommendation
 * categories, non-empty arrays, provenance completeness, and deltas
 * (confidence_decreased, uncertainty_increased). Brittle exact-score
 * expectations are avoided so cognition can evolve without breaking the
 * suite — but **behaviour** drift always breaks the suite.
 */

import type {
  Expectation,
  ExpectationResult,
  ScenarioOutputs,
} from "./types.js";
import { verifyProvenance } from "./provenance_integrity.js";

function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null) return undefined;
    if (typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

export function evaluateExpectation(
  expectation: Expectation,
  outputs: ScenarioOutputs,
): ExpectationResult {
  const path = expectation.path ?? "";
  const actual = path ? getPath(outputs, path) : undefined;
  const fail = (detail: string): ExpectationResult => ({
    expectation,
    passed: false,
    actual,
    detail,
  });
  const pass = (detail: string): ExpectationResult => ({
    expectation,
    passed: true,
    actual,
    detail,
  });

  switch (expectation.type) {
    case "equals":
      return actual === expectation.value
        ? pass(`${path} === ${String(expectation.value)}`)
        : fail(`${path} was ${JSON.stringify(actual)}, expected ${JSON.stringify(expectation.value)}`);
    case "not_equals":
      return actual !== expectation.value
        ? pass(`${path} !== ${String(expectation.value)}`)
        : fail(`${path} must not equal ${JSON.stringify(expectation.value)}`);
    case "range": {
      const n = typeof actual === "number" ? actual : NaN;
      const { min, max } = expectation;
      if (!Number.isFinite(n)) return fail(`${path} is not a finite number`);
      if (min !== undefined && n < min) return fail(`${path}=${n} < min ${min}`);
      if (max !== undefined && n > max) return fail(`${path}=${n} > max ${max}`);
      return pass(`${path}=${n} within [${min ?? "-inf"}, ${max ?? "inf"}]`);
    }
    case "greater_than": {
      const n = typeof actual === "number" ? actual : NaN;
      const threshold = (expectation.value ?? expectation.min) as number;
      return n > threshold
        ? pass(`${path}=${n} > ${threshold}`)
        : fail(`${path}=${JSON.stringify(actual)} not > ${threshold}`);
    }
    case "less_than": {
      const n = typeof actual === "number" ? actual : NaN;
      const threshold = (expectation.value ?? expectation.max) as number;
      return n < threshold
        ? pass(`${path}=${n} < ${threshold}`)
        : fail(`${path}=${JSON.stringify(actual)} not < ${threshold}`);
    }
    case "includes": {
      if (!Array.isArray(actual))
        return fail(`${path} is not an array`);
      const needle = expectation.value;
      return actual.includes(needle as never)
        ? pass(`${path} includes ${JSON.stringify(needle)}`)
        : fail(`${path} does not include ${JSON.stringify(needle)}`);
    }
    case "excludes": {
      if (!Array.isArray(actual))
        return fail(`${path} is not an array`);
      const needle = expectation.value;
      return !actual.includes(needle as never)
        ? pass(`${path} excludes ${JSON.stringify(needle)}`)
        : fail(`${path} unexpectedly contains ${JSON.stringify(needle)}`);
    }
    case "non_empty":
      return !isEmpty(actual)
        ? pass(`${path} non-empty`)
        : fail(`${path} is empty`);
    case "empty":
      return isEmpty(actual)
        ? pass(`${path} empty`)
        : fail(`${path} unexpectedly non-empty: ${JSON.stringify(actual).slice(0, 80)}`);
    case "stable_hash":
      return outputs.determinismHash === expectation.value
        ? pass(`determinismHash === ${String(expectation.value)}`)
        : fail(`determinismHash drifted: actual=${outputs.determinismHash}, snapshot=${String(expectation.value)}`);
    case "provenance_complete": {
      const r = verifyProvenance(outputs);
      return r.ok
        ? pass("provenance complete")
        : fail(`provenance gaps: ${r.findings.filter((f) => !f.ok).map((f) => f.path).join(", ")}`);
    }
    case "confidence_decreased": {
      const before = outputs.preCognitionBayesianConfidence;
      const after = outputs.cognition.confidence.globalConfidence;
      return after < before
        ? pass(`globalConfidence ${after.toFixed(3)} < pre ${before.toFixed(3)}`)
        : fail(`globalConfidence did not decrease: pre=${before.toFixed(3)} after=${after.toFixed(3)}`);
    }
    case "uncertainty_increased": {
      const u = outputs.cognition.uncertainty.uncertaintyLevel;
      return u >= 0.4
        ? pass(`uncertaintyLevel ${u.toFixed(3)} >= 0.4`)
        : fail(`uncertaintyLevel ${u.toFixed(3)} below 0.4 — cognition collapsed to false certainty`);
    }
    case "recommendation_in": {
      const set = (expectation.values ?? []) as unknown[];
      return set.includes(actual)
        ? pass(`${path}=${String(actual)} ∈ {${set.map(String).join(",")}}`)
        : fail(`${path}=${JSON.stringify(actual)} not in {${set.map(String).join(",")}}`);
    }
    default:
      return fail(`unknown expectation type: ${(expectation as Expectation).type}`);
  }
}

export function evaluateExpectations(
  expectations: Expectation[],
  outputs: ScenarioOutputs,
): ExpectationResult[] {
  return expectations.map((e) => evaluateExpectation(e, outputs));
}
