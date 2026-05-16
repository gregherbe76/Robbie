import { createHash } from "node:crypto";

/**
 * Canonical JSON stringifier. Keys are sorted recursively so two
 * semantically-equal objects produce identical strings regardless
 * of key insertion order. Arrays preserve their order.
 *
 * This is what makes our event / memory signatures stable across
 * restarts, language runtimes, and serialization round-trips —
 * the foundation of replay-after-restart verification.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    "{" +
    entries
      .map(([k, v]) => JSON.stringify(k) + ":" + canonicalStringify(v))
      .join(",") +
    "}"
  );
}

/** sha256(canonicalStringify(value)) → first 16 hex chars. */
export function shortSignature(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex")
    .slice(0, 16);
}
