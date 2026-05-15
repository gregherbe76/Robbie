/**
 * Deterministic structural hash. No external dependencies, no crypto —
 * a pure FNV-1a over a stable canonical JSON encoding. The benchmark
 * layer uses this for the determinism fingerprint of each scenario
 * digest, so any drift in structural cognition is visible immediately.
 */

export function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  if (typeof value === "number") {
    // Avoid float drift across runs: snap to 6 decimals.
    return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  }
  return value;
}

export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function structuralHash(value: unknown): string {
  return fnv1aHash(canonicalJSON(value));
}
